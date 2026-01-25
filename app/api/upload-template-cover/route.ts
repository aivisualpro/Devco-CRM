
import { NextRequest, NextResponse } from 'next/server';

import { uploadToCloudinary } from '@/lib/cloudinary';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const templateId = formData.get('templateId') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Generate publicId
        const publicId = `cover_${templateId || 'temp_' + Date.now()}`;
        const result = await uploadToCloudinary(buffer, 'covers', publicId);

        if (!result) {
            throw new Error('Failed to upload to Cloudinary');
        }

        return NextResponse.json({ success: true, url: result.url });
    } catch (error: any) {
        console.error('Error uploading cover:', error);
        return NextResponse.json({ error: error.message || 'Failed to upload cover' }, { status: 500 });
    }
}
