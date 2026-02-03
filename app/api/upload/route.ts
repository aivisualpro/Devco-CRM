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

        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImage = file.type.startsWith('image/');
        
        let mainUrl = '';
        let thumbnailUrl = '';
        let publicId = '';
        let resourceType = 'auto';

        if (isPdf) {
            // For PDFs: Upload as 'image' type so Cloudinary serves with correct Content-Type
            // This allows browser viewing and proper downloads
            try {
                const result = await cloudinary.uploader.upload(dataUri, {
                    folder: `devcocrm/${folder}`,
                    resource_type: 'image', // Upload PDF as image type for proper serving
                });
                
                mainUrl = result.secure_url;
                publicId = result.public_id;
                resourceType = 'image';
                
                // Generate thumbnail from first page
                thumbnailUrl = result.secure_url
                    .replace('/upload/', '/upload/w_400,h_533,c_fill,g_north,pg_1/')
                    .replace('.pdf', '.jpg');
                    
            } catch (pdfError: any) {
                console.error('PDF as image upload failed, trying raw:', pdfError.message);
                
                // Fallback: Upload as raw if image processing fails (very large PDFs)
                const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "").substring(0, 50);
                const timestamp = Date.now();
                const safeName = fileNameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
                
                const rawResult = await cloudinary.uploader.upload(dataUri, {
                    folder: `devcocrm/${folder}`,
                    resource_type: 'raw',
                    public_id: `${safeName}_${timestamp}`,
                    format: 'pdf'
                });
                
                mainUrl = rawResult.secure_url;
                publicId = rawResult.public_id;
                resourceType = 'raw';
                
                // For raw PDFs, use a static placeholder thumbnail
                thumbnailUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/v1/devcocrm/placeholders/pdf_icon.png`;
            }
        } else {
            // For images and other files
            const result = await cloudinary.uploader.upload(dataUri, {
                folder: `devcocrm/${folder}`,
                resource_type: 'auto',
            });
            
            mainUrl = result.secure_url;
            publicId = result.public_id;
            resourceType = result.resource_type;
            
            if (isImage) {
                thumbnailUrl = result.secure_url.replace('/upload/', '/upload/w_400,h_400,c_fill,g_auto/');
            } else {
                thumbnailUrl = mainUrl;
            }
        }

        return NextResponse.json({
            success: true,
            url: mainUrl,
            thumbnailUrl: thumbnailUrl,
            publicId: publicId,
            name: file.name,
            type: file.type,
            size: file.size,
            resource_type: resourceType,
            isPdf: isPdf
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Upload failed' }, { status: 500 });
    }
}

