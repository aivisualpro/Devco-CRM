
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { uploadBufferToR2 } from '@/lib/s3';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `assets/pdf-footer.png`;
        const r2Url = await uploadBufferToR2(buffer, fileName, file.type);

        if (!r2Url) {
            throw new Error('Failed to upload to R2');
        }

        return NextResponse.json({ success: true, message: 'Footer updated successfully', url: r2Url });
    } catch (error: any) {
        console.error('Error uploading footer:', error);
        return NextResponse.json({ error: error.message || 'Failed to upload footer' }, { status: 500 });
    }
}
