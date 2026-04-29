import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export const dynamic = 'force-dynamic';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a base64 signature image to Cloudinary and return the URL.
 * Accepts JSON body: { base64: "data:image/png;base64,..." }
 */
export async function POST(request: NextRequest) {
    try {
        const { base64 } = await request.json();

        if (!base64 || !base64.startsWith('data:image')) {
            return NextResponse.json({ success: false, error: 'Invalid base64 image data' }, { status: 400 });
        }

        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            return NextResponse.json({ success: false, error: 'Cloudinary not configured' }, { status: 500 });
        }

        const result = await cloudinary.uploader.upload(base64, {
            folder: 'devcocrm/signatures',
            resource_type: 'image',
            format: 'png',
            transformation: [
                { quality: 'auto:good', fetch_format: 'png' }
            ]
        });

        return NextResponse.json({
            success: true,
            url: result.secure_url,
            publicId: result.public_id,
        });
    } catch (error: any) {
        console.error('Signature upload error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Upload failed' }, { status: 500 });
    }
}
