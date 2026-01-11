import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Readable } from 'stream';

// Load credentials
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || '';
const PROJECT_ID = process.env.GOOGLE_PROJECT_ID || '';
const SHARED_DRIVE_FOLDER_ID = process.env.GOOGLE_TEMP_FOLDER_ID || '';

// Handle private key
let PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || '';
if (PRIVATE_KEY.includes('\\n')) {
    PRIVATE_KEY = PRIVATE_KEY.split('\\n').join('\n');
}

const SCOPES = [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive'
];

// Create auth client
const getAuthClient = async () => {
    const client = new JWT({
        email: CLIENT_EMAIL,
        key: PRIVATE_KEY,
        scopes: SCOPES
    });
    await client.authorize();
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
        // Step 1: Copy template (unavoidable)
        const copyRes = await drive.files.copy({
            fileId: templateId,
            supportsAllDrives: true,
            requestBody: { name: `T_${Date.now()}`, parents: [SHARED_DRIVE_FOLDER_ID] }
        });
        tempFileId = copyRes.data.id!;

        // Step 2: Build minimal replacement requests (only {{key}} format for speed)
        const requests: any[] = [];
        const imageJobs: { key: string; value: string; marker: string }[] = [];

        for (const [key, value] of Object.entries(variables)) {
            if (typeof value === 'boolean' || Array.isArray(value)) continue;
            const str = String(value ?? '');
            
            // Image detection: must have real data
            if (str.length > 50 && (str.startsWith('data:image') || str.startsWith('http'))) {
                const marker = `__I${key}__`;
                imageJobs.push({ key, value: str, marker });
                requests.push({ replaceAllText: { containsText: { text: `{{${key}}}`, matchCase: false }, replaceText: marker } });
            } else {
                requests.push({ replaceAllText: { containsText: { text: `{{${key}}}`, matchCase: false }, replaceText: str } });
            }
        }

        // Boolean markers cleanup
        for (const [key, value] of Object.entries(variables)) {
            if (typeof value === 'boolean') {
                requests.push({ replaceAllText: { containsText: { text: `{{if_${key}}}`, matchCase: false }, replaceText: '' } });
                requests.push({ replaceAllText: { containsText: { text: `{{endif}}`, matchCase: false }, replaceText: '' } });
            }
        }

        // Fragment cleanup
        ['hasSignatures}}', 'if_hasSignatures}}', '{if_', '{endif}', 'endif}}', '_hasSignatures}}'].forEach(f => {
            requests.push({ replaceAllText: { containsText: { text: f, matchCase: false }, replaceText: '' } });
        });

        // Step 3: Apply all text replacements in ONE batch
        if (requests.length > 0) {
            await docs.documents.batchUpdate({ documentId: tempFileId, requestBody: { requests } });
        }

        // Step 4: Handle images (if any) - this is the slowest part
        if (imageJobs.length > 0) {
            // Upload all images in parallel
            const imageResults = await Promise.all(imageJobs.map(async (job) => {
                try {
                    let buf: Buffer;
                    if (job.value.startsWith('data:image')) {
                        buf = Buffer.from(job.value.split(',')[1], 'base64');
                    } else {
                        const r = await fetch(job.value);
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
                    
                    // Fire and forget - don't wait
                    drive.permissions.create({ fileId: id, supportsAllDrives: true, requestBody: { role: 'reader', type: 'anyone' } }).catch(() => {});
                    
                    return { marker: job.marker, url: `https://drive.google.com/uc?export=view&id=${id}` };
                } catch { return null; }
            }));

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

        // Step 5: Export PDF
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
