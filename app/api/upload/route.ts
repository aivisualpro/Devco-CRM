import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure R2 Client
const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
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

        // Convert file to base64 and buffer
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
        let r2Key = '';

        if (isPdf) {
            // === PDF Strategy: Store in R2 (reliable access) + Cloudinary (thumbnail only) ===
            
            // 1. Upload to R2 for permanent, direct access
            const timestamp = Date.now();
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            r2Key = `${folder}/${timestamp}_${safeName}`;

            const hasR2 = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY;
            
            if (hasR2) {
                await r2Client.send(new PutObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME,
                    Key: r2Key,
                    Body: buffer,
                    ContentType: 'application/pdf',
                }));
                
                // Use Cloudflare Worker + R2 custom domain for permanent, direct access
                const filesDomain = process.env.R2_FILES_DOMAIN || 'https://files.devcohq.com';
                mainUrl = `${filesDomain}/${r2Key}`;
            }

            // 2. Upload to Cloudinary just for thumbnail generation
            try {
                const result = await cloudinary.uploader.upload(dataUri, {
                    folder: `devcocrm/${folder}`,
                    resource_type: 'image',
                });
                
                publicId = result.public_id;
                resourceType = 'image';
                
                // Generate thumbnail from first page
                thumbnailUrl = result.secure_url
                    .replace('/upload/', '/upload/w_800,h_600,c_fill,g_north,pg_1/')
                    .replace('.pdf', '.jpg');

                // If R2 wasn't available, fall back to Cloudinary URL
                if (!mainUrl) {
                    mainUrl = result.secure_url;
                }
                    
            } catch (pdfError: any) {
                console.error('Cloudinary PDF thumbnail generation failed:', pdfError.message);
                thumbnailUrl = ''; // Will trigger fallback placeholder in UI
                
                if (!mainUrl) {
                    // No R2 and Cloudinary failed - try raw upload as last resort
                    const rawResult = await cloudinary.uploader.upload(dataUri, {
                        folder: `devcocrm/${folder}`,
                        resource_type: 'raw',
                        format: 'pdf'
                    });
                    mainUrl = rawResult.secure_url;
                    publicId = rawResult.public_id;
                    resourceType = 'raw';
                }
            }
        } else {
            // === Images and other files: Cloudinary (great transforms) ===
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
            isPdf: isPdf,
            r2Key: r2Key || undefined,
        });

    } catch (error: any) {
        console.error('Upload error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Upload failed' }, { status: 500 });
    }
}
