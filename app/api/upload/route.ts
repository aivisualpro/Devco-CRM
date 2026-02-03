import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const folder = formData.get('folder') as string || 'uploads';

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
        }

        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            return NextResponse.json({ success: false, error: 'Cloudinary not configured' }, { status: 500 });
        }

        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        const dataUri = `data:${file.type};base64,${base64}`;

        // Determine resource type
        const isImage = file.type.startsWith('image/');
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        
        // Use 'raw' for PDFs and others to ensure correct MIME types on delivery
        const resource_type = isImage ? 'image' : (isPdf ? 'raw' : 'auto');

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: `devcocrm/${folder}`,
            resource_type: resource_type,
        });

        return NextResponse.json({
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
            name: file.name,
            type: isPdf ? 'application/pdf' : file.type,
            size: file.size,
            resource_type: result.resource_type
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Upload failed' }, { status: 500 });
    }
}
