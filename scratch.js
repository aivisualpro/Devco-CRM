const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
require('dotenv').config({ path: '.env.local' });

async function run() {
    let PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
    if (PRIVATE_KEY) {
        if (PRIVATE_KEY.startsWith('"') && PRIVATE_KEY.endsWith('"')) PRIVATE_KEY = PRIVATE_KEY.slice(1, -1);
        if (PRIVATE_KEY.includes('\\n')) PRIVATE_KEY = PRIVATE_KEY.replace(/\\n/g, '\n');
    }

    const auth = new JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/documents']
    });

    await auth.authorize();
    const docs = google.docs({ version: 'v1', auth });

    const doc = await docs.documents.get({ documentId: '1wB2BrBGgkX_tVSJ0YsfFpEMuhKRLf0eQjs5tf9d27zI' });
    
    const placeholders = new Set();
    const scan = (elements) => {
        for (const el of elements) {
            if (el.paragraph?.elements) {
                for (const run of el.paragraph.elements) {
                    const text = run.textRun?.content || '';
                    const matches = text.match(/\{\{([^}]+)\}\}/g);
                    if (matches) matches.forEach(m => placeholders.add(m));
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
    console.log(Array.from(placeholders).filter(p => p.toLowerCase().includes('pin')));
}

run().catch(console.error);
