import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Estimate } from '@/lib/models';

// AppSheet Configuration
const APPSHEET_APP_ID = process.env.DEVCOAPPSHEET_APP_ID;
const APPSHEET_API_KEY = process.env.DEVCOAPPSHEET_ACCESS;
const APPSHEET_TABLE_NAME = "Estimates";

// Helper to delete from AppSheet
async function deleteFromAppSheet(id: string) {
    if (!APPSHEET_APP_ID || !APPSHEET_API_KEY) return;

    const APPSHEET_URL = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(APPSHEET_APP_ID)}/tables/${encodeURIComponent(APPSHEET_TABLE_NAME)}/Action`;

    const requestBody = {
        Action: "Delete",
        Properties: {
            Locale: "en-US",
            Timezone: "Pacific Standard Time"
        },
        Rows: [{ "Record_Id": String(id) }]
    };

    try {
        const response = await fetch(APPSHEET_URL, {
            method: 'POST',
            headers: {
                'ApplicationAccessKey': APPSHEET_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            console.error(`AppSheet Delete Error: ${response.status} ${response.statusText}`);
        } else {
            console.log(`AppSheet record deleted: ${id}`);
        }
    } catch (error) {
        console.error("AppSheet Delete Exception:", error);
    }
}

// GET endpoint for AppSheet delete webhook
// Usage: /api/webhook/devcoBackend/delete?id=[Record_Id]
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
        }

        await connectToDatabase();

        // Delete from MongoDB
        await Estimate.findByIdAndDelete(id);

        // Delete from AppSheet
        await deleteFromAppSheet(id);

        console.log(`AppSheet DELETE webhook called for id: ${id}`);
        return NextResponse.json({ success: true, message: `Deleted estimate ${id}` });

    } catch (error) {
        console.error("DELETE WEBHOOK ERROR:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
