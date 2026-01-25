
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const templateId = formData.get('templateId') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Ensure covers directory exists
        const publicDir = path.join(process.cwd(), 'public');
        const coversDir = path.join(publicDir, 'covers');
        if (!fs.existsSync(coversDir)) {
            fs.mkdirSync(coversDir, { recursive: true });
        }

        // Generate filename
        const filename = `cover_${templateId || 'temp_' + Date.now()}.png`;
        const filePath = path.join(coversDir, filename);

        fs.writeFileSync(filePath, buffer);

        // Return the relative path for the frontend/DB
        const publicPath = `/covers/${filename}`;

        return NextResponse.json({ success: true, url: publicPath });
    } catch (error: any) {
        console.error('Error uploading cover:', error);
        return NextResponse.json({ error: error.message || 'Failed to upload cover' }, { status: 500 });
    }
}
