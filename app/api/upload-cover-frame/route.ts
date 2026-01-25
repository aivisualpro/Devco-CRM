
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filePath = path.join(process.cwd(), 'public', 'template-cover-frame.png');

        fs.writeFileSync(filePath, buffer);

        return NextResponse.json({ success: true, message: 'Cover frame uploaded successfully' });
    } catch (error: any) {
        console.error('Error uploading cover frame:', error);
        return NextResponse.json({ error: error.message || 'Failed to upload cover frame' }, { status: 500 });
    }
}
