import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const rawUrl = searchParams.get('url');
    // Sanitize filename: remove extension if user provided one, then add it back safely
    let filename = (searchParams.get('filename') || 'document').replace(/\.[^/.]+$/, "");

    if (!rawUrl) {
        return new Response('Missing URL', { status: 400 });
    }

    try {
        console.log(`[Download] Processing: ${rawUrl}`);
        
        if (rawUrl.includes('cloudinary.com')) {
            // Extract public ID and resource type reliably
            const parts = rawUrl.split('/');
            const uploadIndex = parts.indexOf('upload');
            const privateIndex = parts.indexOf('private');
            const authenticatedIndex = parts.indexOf('authenticated');
            
            const typeIndex = Math.max(uploadIndex, privateIndex, authenticatedIndex);
            
            if (typeIndex !== -1) {
                const deliveryType = parts[typeIndex];
                const resourceType = parts[typeIndex - 1] || 'image';
                
                // Skip version (v12345) if present
                let startIndex = typeIndex + 1;
                if (parts[startIndex] && parts[startIndex].startsWith('v') && /^\d+$/.test(parts[startIndex].substring(1))) {
                    startIndex++;
                }
                
                const pathParts = parts.slice(startIndex);
                const fullFileName = pathParts[pathParts.length - 1];
                const extension = fullFileName.split('.').pop() || 'pdf';
                
                // Public ID is the path without the extension
                const fullPath = pathParts.join('/');
                const publicId = fullPath.substring(0, fullPath.lastIndexOf('.')) || fullPath;

                console.log(`[Download] ID: ${publicId}, Type: ${resourceType}, Delivery: ${deliveryType}`);

                // Generate a highly-secure signed download URL using official SDK
                // This link is valid for 1 hour and forces a download with the correct filename
                const secureUrl = cloudinary.utils.private_download_url(publicId, extension, {
                    resource_type: resourceType,
                    type: deliveryType,
                    attachment: true
                });

                console.log(`[Download] Redirecting to signed URL...`);
                return NextResponse.redirect(secureUrl);
            }
        }

        // Fallback: If not Cloudinary or weird path, try direct redirect
        return NextResponse.redirect(rawUrl.replace('http://', 'https://'));
        
    } catch (error) {
        console.error('[Download] Internal Error:', error);
        // If redirect logic fails, try one last time to just open the raw URL in a new tab
        return NextResponse.redirect(rawUrl);
    }
}
