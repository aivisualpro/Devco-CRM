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

export async function processGoogleDoc(templateId: string, variables: Record<string, string>): Promise<Buffer> {
    if (!SHARED_DRIVE_FOLDER_ID) {
        throw new Error('GOOGLE_TEMP_FOLDER_ID is not configured');
    }

    let auth;
    try {
        auth = await getAuthClient();
    } catch (authError: any) {
        throw new Error(`Google Auth Failed: ${authError.message}`);
    }

    const drive = google.drive({ version: 'v3', auth });
    const docs = google.docs({ version: 'v1', auth });

    let tempFileId: string | null = null;

    try {
        console.log('Copying template:', templateId);
        const copyRes = await drive.files.copy({
            fileId: templateId,
            supportsAllDrives: true,
            requestBody: {
                name: `Temp_Generated_${Date.now()}`,
                parents: [SHARED_DRIVE_FOLDER_ID]
            }
        });

        tempFileId = copyRes.data.id!;
        if (!tempFileId) throw new Error('Failed to copy template');

        // 1. Prepare variables
        const signatureData = variables.signature;
        const textVariables = { ...variables };
        delete textVariables.signature;

        // 2. Perform TEXT replacements
        const textRequests = Object.entries(textVariables).map(([key, value]) => ({
            replaceAllText: {
                containsText: { text: `{{${key}}}`, matchCase: true },
                replaceText: String(value || '')
            }
        }));

        if (textRequests.length > 0) {
            await docs.documents.batchUpdate({
                documentId: tempFileId,
                requestBody: { requests: textRequests }
            });
        }

        // 3. Handle Signature
        if (signatureData && signatureData.startsWith('data:image')) {
            console.log('Processing signature...');
            
            // Use a unique marker to find the exact location for the image
            const MARKER = `__SIG_MARKER_POS_${Date.now()}__`;
            await docs.documents.batchUpdate({
                documentId: tempFileId,
                requestBody: {
                    requests: [{
                        replaceAllText: {
                            containsText: { text: '{{signature}}', matchCase: true },
                            replaceText: MARKER
                        }
                    }]
                }
            });

            // Upload signature image to Drive temporarily
            const base64Data = signatureData.split(',')[1];
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const imageRes = await drive.files.create({
                supportsAllDrives: true,
                requestBody: {
                    name: `sig_${Date.now()}.png`,
                    mimeType: 'image/png',
                    parents: [SHARED_DRIVE_FOLDER_ID]
                },
                media: {
                    mimeType: 'image/png',
                    body: Readable.from(imageBuffer)
                }
            });
            const sigFileId = imageRes.data.id!;

            // Make it public so Docs can pull it
            await drive.permissions.create({
                fileId: sigFileId,
                supportsAllDrives: true,
                requestBody: { role: 'reader', type: 'anyone' }
            });

            const sigFile = await drive.files.get({
                fileId: sigFileId,
                fields: 'thumbnailLink',
                supportsAllDrives: true
            });
            const sigUrl = sigFile.data.thumbnailLink?.replace(/=s\d+$/, '=s1000') || 
                          `https://drive.google.com/uc?export=view&id=${sigFileId}`;

            // Find marker in document
            const doc = await docs.documents.get({ documentId: tempFileId });
            let markerPos: any = null;

            const scan = (elements: any[]) => {
                for (const el of elements) {
                    if (markerPos) return;
                    if (el.paragraph?.elements) {
                        for (const child of el.paragraph.elements) {
                            if (child.textRun?.content?.includes(MARKER)) {
                                const offset = child.textRun.content.indexOf(MARKER);
                                if (typeof child.startIndex === 'number') {
                                    markerPos = { index: child.startIndex + offset, length: MARKER.length };
                                    return;
                                }
                            }
                        }
                    } else if (el.table?.tableRows) {
                        for (const row of el.table.tableRows) {
                            for (const cell of row.tableCells || []) {
                                if (cell.content) scan(cell.content);
                            }
                        }
                    }
                }
            };
            scan(doc.data.body?.content || []);

            if (markerPos) {
                await docs.documents.batchUpdate({
                    documentId: tempFileId,
                    requestBody: {
                        requests: [
                            {
                                insertInlineImage: {
                                    location: { index: markerPos.index },
                                    uri: sigUrl,
                                    objectSize: {
                                        height: { magnitude: 50, unit: 'PT' },
                                        width: { magnitude: 150, unit: 'PT' }
                                    }
                                }
                            },
                            {
                                deleteContentRange: {
                                    range: {
                                        startIndex: markerPos.index + 1,
                                        endIndex: markerPos.index + 1 + markerPos.length
                                    }
                                }
                            }
                        ]
                    } as any
                });
            }

            // Clean up sig image
            try { await drive.files.delete({ fileId: sigFileId, supportsAllDrives: true }); } catch (e) {}
        } else {
            // Remove {{signature}} if no data
            await docs.documents.batchUpdate({
                documentId: tempFileId,
                requestBody: {
                    requests: [{
                        replaceAllText: { containsText: { text: '{{signature}}', matchCase: true }, replaceText: '' }
                    }]
                }
            });
        }

        // 4. Final Cleanup: Remove any remaining {{...}} tags
        const finalDoc = await docs.documents.get({ documentId: tempFileId });
        const remaining: string[] = [];
        const findTags = (elements: any[]) => {
            for (const el of elements) {
                if (el.paragraph?.elements) {
                    for (const e of el.paragraph.elements) {
                        const m = e.textRun?.content?.match(/\{\{[^}]+\}\}/g);
                        if (m) remaining.push(...m);
                    }
                } else if (el.table?.tableRows) {
                    for (const r of el.table.tableRows) {
                        for (const c of r.tableCells || []) if (c.content) findTags(c.content);
                    }
                }
            }
        };
        findTags(finalDoc.data.body?.content || []);
        
        const uniques = [...new Set(remaining)];
        if (uniques.length > 0) {
            console.log('Cleaning up remaining placeholders:', uniques);
            await docs.documents.batchUpdate({
                documentId: tempFileId,
                requestBody: {
                    requests: uniques.map(tag => ({
                        replaceAllText: { containsText: { text: tag, matchCase: true }, replaceText: '' }
                    }))
                }
            });
        }

        // 5. Export to PDF
        const exportRes = await drive.files.export({
            fileId: tempFileId,
            mimeType: 'application/pdf'
        }, { responseType: 'arraybuffer' });

        return Buffer.from(exportRes.data as ArrayBuffer);

    } finally {
        if (tempFileId) {
            try {
                await drive.files.delete({ fileId: tempFileId, supportsAllDrives: true });
                console.log('Cleaned up temp doc');
            } catch (e) {}
        }
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
