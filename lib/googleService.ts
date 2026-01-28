import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Readable } from 'stream';

// Load credentials
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || '';
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID || '';
const SHARED_DRIVE_FOLDER_ID = process.env.GOOGLE_TEMP_FOLDER_ID || '';

// Handle private key
let PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || '';

if (!PRIVATE_KEY) {
    console.error('CRITICAL: GOOGLE_PRIVATE_KEY is missing from environment variables.');
}

if (!CLIENT_EMAIL) {
    console.error('CRITICAL: GOOGLE_CLIENT_EMAIL is missing from environment variables.');
}

// Robust private key parsing
if (PRIVATE_KEY) {
    // 1. Remove surrounding quotes if any (common Vercel/Docker issue)
    if (PRIVATE_KEY.startsWith('"') && PRIVATE_KEY.endsWith('"')) {
        PRIVATE_KEY = PRIVATE_KEY.slice(1, -1);
    }
    
    // 2. Handle escaped newlines (e.g. if pasted as a single line with \n)
    if (PRIVATE_KEY.includes('\\n')) {
        PRIVATE_KEY = PRIVATE_KEY.replace(/\\n/g, '\n');
    }
}

const SCOPES = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive'
];

// Cache auth client to avoid re-authorizing on every request
let cachedAuthClient: JWT | null = null;
let authExpiry: number = 0;

// Create auth client with caching
const getAuthClient = async () => {
    const now = Date.now();
    // Reuse cached client if still valid (expires after 50 minutes to be safe, tokens last 60min)
    if (cachedAuthClient && authExpiry > now) {
        return cachedAuthClient;
    }

    if (!PRIVATE_KEY || !CLIENT_EMAIL) {
        throw new Error('Google Auth configuration error: GOOGLE_PRIVATE_KEY or GOOGLE_CLIENT_EMAIL is missing. Please verify your Vercel Environment Variables.');
    }

    const client = new JWT({
        email: CLIENT_EMAIL,
        key: PRIVATE_KEY,
        scopes: SCOPES
    });
    await client.authorize();
    
    // Cache for 50 minutes
    cachedAuthClient = client;
    authExpiry = now + (50 * 60 * 1000);
    
    return client;
};

export async function processGoogleDoc(templateId: string, variables: Record<string, any>): Promise<Buffer> {
    if (!SHARED_DRIVE_FOLDER_ID) throw new Error('GOOGLE_TEMP_FOLDER_ID is not configured');

    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });
    const docs = google.docs({ version: 'v1', auth });

    let tempFileId: string | null = null;
    const tempImageIds: string[] = [];

    try {
        // Step 1: Copy template and prepare images in parallel
        const [copyRes, imageResultsRaw] = await Promise.all([
            drive.files.copy({
                fileId: templateId,
                supportsAllDrives: true,
                requestBody: { name: `T_${Date.now()}`, parents: [SHARED_DRIVE_FOLDER_ID] }
            }),
            Promise.all(Object.entries(variables).map(async ([key, value]) => {
                const str = String(value ?? '');
                if (str.length > 50 && (str.startsWith('data:image') || str.startsWith('http'))) {
                    try {
                        let buf: Buffer;
                        if (str.startsWith('data:image')) {
                            buf = Buffer.from(str.split(',')[1], 'base64');
                        } else {
                            const r = await fetch(str);
                            if (!r.ok) return null;
                            buf = Buffer.from(await r.arrayBuffer());
                        }
                        
                        const res = await drive.files.create({
                            supportsAllDrives: true,
                            fields: 'id',
                            requestBody: { name: `i_${Date.now()}.png`, mimeType: 'image/png', parents: [SHARED_DRIVE_FOLDER_ID] },
                            media: { mimeType: 'image/png', body: Readable.from(buf) }
                        });
                        const id = res.data.id!;
                        tempImageIds.push(id);
                        
                        // Fire and forget permission update
                        drive.permissions.create({ fileId: id, supportsAllDrives: true, requestBody: { role: 'reader', type: 'anyone' } }).catch(() => {});
                        
                        const marker = `__I${key}__`;
                        return { key, marker, url: `https://drive.google.com/uc?export=view&id=${id}` };
                    } catch { return null; }
                }
                return null;
            }))
        ]);

        tempFileId = copyRes.data.id!;
        const imageResults = imageResultsRaw.filter((ir): ir is NonNullable<typeof ir> => ir !== null);

        // Step 2: Build and apply text replacements
        const requests: any[] = [];
        const imageMarkers = new Set(imageResults.map(ir => ir.key));

        for (const [key, value] of Object.entries(variables)) {
            // Handle image markers
            if (imageMarkers.has(key)) {
                const ir = imageResults.find(r => r.key === key);
                if (ir) {
                    requests.push({ replaceAllText: { containsText: { text: `{{${key}}}`, matchCase: false }, replaceText: ir.marker } });
                }
                continue;
            }

            // Handle arrays (specifically for repeating sections like titleDescriptions)
            if (Array.isArray(value)) {
                // If it's an array of objects, we support {{key}}{{property}} syntax
                if (value.length > 0 && typeof value[0] === 'object') {
                    const properties = Object.keys(value[0]);
                    for (const prop of properties) {
                        const flattenedValue = value.map(item => item[prop] || '').join('\n');
                        requests.push({ 
                            replaceAllText: { 
                                containsText: { text: `{{${key}}}{{${prop}}}`, matchCase: false }, 
                                replaceText: flattenedValue 
                            } 
                        });
                    }
                } else {
                    // Simple array of strings/numbers
                    requests.push({ 
                        replaceAllText: { 
                            containsText: { text: `{{${key}}}`, matchCase: false }, 
                            replaceText: value.join('\n') 
                        } 
                    });
                }
                continue;
            }

            // Standard flat variables
            if (typeof value !== 'boolean') {
                requests.push({ 
                    replaceAllText: { 
                        containsText: { text: `{{${key}}}`, matchCase: false }, 
                        replaceText: String(value ?? '') 
                    } 
                });
            }
        }

        // Apply text replacements
        if (requests.length > 0) {
            await docs.documents.batchUpdate({ documentId: tempFileId, requestBody: { requests } });
        }

        // Step 3: Handle Rich Styling Markers (added after replacement)
        const richDoc = await docs.documents.get({ documentId: tempFileId });
        const richRequests: any[] = [];
        const scanForStyles = (elements: any[]) => {
            for (const el of elements) {
                if (el.paragraph?.elements) {
                    for (const run of el.paragraph.elements) {
                        const text = run.textRun?.content || '';
                        if (!text) continue;
                        const startIdx = run.startIndex || 0;
                        const currentSize = run.textRun.textStyle?.fontSize?.magnitude || 10;

                        // Bold markers [B]...[/B]
                        const bRegex = /\[B\]([\s\S]*?)\[\/B\]/g;
                        let bMatch;
                        while ((bMatch = bRegex.exec(text)) !== null) {
                            richRequests.push({ 
                                updateTextStyle: { 
                                    range: { startIndex: startIdx + bMatch.index, endIndex: startIdx + bMatch.index + bMatch[0].length },
                                    textStyle: { bold: true }, fields: 'bold' 
                                } 
                            });
                        }

                        // Size Plus markers [S+]...[/S+]
                        const sRegex = /\[S\+\]([\s\S]*?)\[\/S\+\]/g;
                        let sMatch;
                        while ((sMatch = sRegex.exec(text)) !== null) {
                            richRequests.push({ 
                                updateTextStyle: { 
                                    range: { startIndex: startIdx + sMatch.index, endIndex: startIdx + sMatch.index + sMatch[0].length },
                                    textStyle: { fontSize: { magnitude: currentSize + 1, unit: 'PT' } }, fields: 'fontSize' 
                                } 
                            });
                        }
                    }
                } else if (el.table?.tableRows) {
                    for (const r of el.table.tableRows) for (const c of r.tableCells || []) if (c.content) scanForStyles(c.content);
                }
            }
        };
        scanForStyles(richDoc.data.body?.content || []);

        if (richRequests.length > 0) {
            // Add deletions of markers at the end of the batch (processed last)
            richRequests.push({ replaceAllText: { containsText: { text: '[B]', matchCase: true }, replaceText: '' } });
            richRequests.push({ replaceAllText: { containsText: { text: '[/B]', matchCase: true }, replaceText: '' } });
            richRequests.push({ replaceAllText: { containsText: { text: '[S+]', matchCase: true }, replaceText: '' } });
            richRequests.push({ replaceAllText: { containsText: { text: '[/S+]', matchCase: true }, replaceText: '' } });
            await docs.documents.batchUpdate({ documentId: tempFileId, requestBody: { requests: richRequests } });
        }

        // Step 4: Handle images (if any)
        if (imageResults.length > 0) {
            // Get doc structure to find markers
            const doc = await docs.documents.get({ documentId: tempFileId });
            const ops: any[] = [];
            const bodyEnd = (doc.data.body?.content?.slice(-1)[0]?.endIndex || 2) - 1;

            const scan = (els: any[]) => {
                for (const el of els) {
                    if (el.paragraph?.elements) {
                        for (const c of el.paragraph.elements) {
                            const txt = c.textRun?.content || '';
                            const start = c.startIndex || 0;
                            for (const ir of imageResults) {
                                if (ir && txt.includes(ir.marker)) {
                                    const idx = start + txt.indexOf(ir.marker);
                                    ops.push({ index: idx, op: { insertInlineImage: { location: { index: idx }, uri: ir.url, objectSize: { height: { magnitude: 40, unit: 'PT' }, width: { magnitude: 120, unit: 'PT' } } } } });
                                    ops.push({ index: idx + 0.1, op: { deleteContentRange: { range: { startIndex: idx, endIndex: Math.min(idx + ir.marker.length, bodyEnd) } } } });
                                }
                            }
                        }
                    } else if (el.table?.tableRows) {
                        for (const r of el.table.tableRows) for (const cell of r.tableCells || []) if (cell.content) scan(cell.content);
                    }
                }
            };
            scan(doc.data.body?.content || []);

            // Sort descending and execute
            if (ops.length > 0) {
                ops.sort((a, b) => b.index - a.index);
                await docs.documents.batchUpdate({ documentId: tempFileId, requestBody: { requests: ops.map(o => o.op) } });
            }
        }

        // Step 4: Export PDF
        const pdf = await drive.files.export({ fileId: tempFileId, mimeType: 'application/pdf' }, { responseType: 'arraybuffer' });
        return Buffer.from(pdf.data as ArrayBuffer);

    } finally {
        // Cleanup in background - don't wait
        if (tempFileId) drive.files.delete({ fileId: tempFileId, supportsAllDrives: true }).catch(() => {});
        tempImageIds.forEach(id => drive.files.delete({ fileId: id, supportsAllDrives: true }).catch(() => {}));
    }
}

export async function cleanupTempFiles() {
    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({
        q: "name contains 'Temp_Generated_' and trashed = false",
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    });
    for (const f of res.data.files || []) {
        try { await drive.files.delete({ fileId: f.id!, supportsAllDrives: true }); } catch (e) {}
    }
}

export async function listGoogleDocsTemplates() {
    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({
        q: "mimeType = 'application/vnd.google-apps.document' and trashed = false",
        fields: 'files(id, name)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
    });
    return res.data.files || [];
}
