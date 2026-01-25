
import { NextRequest, NextResponse } from 'next/server';

import { uploadToCloudinary } from '@/lib/cloudinary';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await uploadToCloudinary(buffer, 'assets', 'template-cover-frame');

        if (!result) {
            throw new Error('Failed to upload to Cloudinary');
        }

        return NextResponse.json({ success: true, message: 'Cover frame uploaded successfully', url: result.url });
    } catch (error: any) {
        console.error('Error uploading cover frame:', error);
        return NextResponse.json({ error: error.message || 'Failed to upload cover frame' }, { status: 500 });
    }
}
