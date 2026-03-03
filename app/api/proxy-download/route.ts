import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Proxy endpoint to download old Cloudinary files.
 * Uses Cloudinary's private_download_url API for authenticated access,
 * bypassing Strict Transformations and CDN delivery restrictions.
 * 
 * Usage: GET /api/proxy-download?url=https://res.cloudinary.com/...&filename=contract.pdf
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const url = searchParams.get('url');
        const filename = searchParams.get('filename') || 'download';

        if (!url) {
            return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
        }

        // Only allow Cloudinary URLs for security
        if (!url.includes('res.cloudinary.com')) {
            return NextResponse.json({ error: 'URL domain not allowed' }, { status: 403 });
        }

        // Extract public_id, resource_type, and format from the Cloudinary URL
        const { publicId, resourceType, format } = parseCloudinaryUrl(url);

        if (!publicId) {
            return NextResponse.json({ error: 'Could not parse Cloudinary URL' }, { status: 400 });
        }

        // Use Cloudinary's private_download_url API — this generates an authenticated
        // API endpoint URL that bypasses CDN restrictions (Strict Transformations, etc.)
        const expiresAt = Math.round(Date.now() / 1000) + 3600; // 1 hour expiry

        const downloadUrl = cloudinary.utils.private_download_url(publicId, format || 'pdf', {
            resource_type: resourceType,
            type: 'upload',
            expires_at: expiresAt,
        });

        // Fetch the file from Cloudinary's download API
        const response = await fetch(downloadUrl);

        if (!response.ok) {
            // Fallback: try with 'raw' resource type if 'image' failed
            if (resourceType === 'image') {
                const rawDownloadUrl = cloudinary.utils.private_download_url(publicId, format || 'pdf', {
                    resource_type: 'raw',
                    type: 'upload',
                    expires_at: expiresAt,
                });

                const rawResponse = await fetch(rawDownloadUrl);
                if (rawResponse.ok) {
                    const buffer = await rawResponse.arrayBuffer();
                    return serveFile(buffer, filename, format);
                }
            }

            return NextResponse.json(
                { error: `Failed to download from Cloudinary: ${response.status}` },
                { status: 502 }
            );
        }

        const buffer = await response.arrayBuffer();
        return serveFile(buffer, filename, format);

    } catch (error: any) {
        console.error('Proxy download error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to proxy download' },
            { status: 500 }
        );
    }
}

/**
 * Serve the downloaded file with proper headers.
 */
function serveFile(buffer: ArrayBuffer, filename: string, format: string): NextResponse {
    let contentType = 'application/octet-stream';
    if (filename.toLowerCase().endsWith('.pdf') || format === 'pdf') {
        contentType = 'application/pdf';
    } else if (['jpg', 'jpeg'].includes(format)) {
        contentType = 'image/jpeg';
    } else if (format === 'png') {
        contentType = 'image/png';
    }

    return new NextResponse(buffer, {
        status: 200,
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
            'Content-Length': buffer.byteLength.toString(),
            'Cache-Control': 'public, max-age=86400',
        },
    });
}

/**
 * Parse a Cloudinary URL to extract the public_id, resource_type, and format.
 * Handles URLs like:
 *   https://res.cloudinary.com/doqijlrhv/image/upload/v1770396289/signed_contracts/contract_xxx.pdf
 */
function parseCloudinaryUrl(url: string): { publicId: string; resourceType: string; format: string } {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');

        let resourceType = 'image';
        let uploadIndex = -1;

        for (let i = 0; i < pathParts.length; i++) {
            if (pathParts[i] === 'upload') {
                uploadIndex = i;
                if (i > 0 && ['image', 'video', 'raw'].includes(pathParts[i - 1])) {
                    resourceType = pathParts[i - 1];
                }
                break;
            }
        }

        if (uploadIndex === -1) {
            return { publicId: '', resourceType: 'image', format: '' };
        }

        let remainingParts = pathParts.slice(uploadIndex + 1);

        // Skip version string (v followed by digits)
        if (remainingParts.length > 0 && /^v\d+$/.test(remainingParts[0])) {
            remainingParts = remainingParts.slice(1);
        }

        let fullPath = remainingParts.join('/');

        // Extract format (file extension)
        let format = '';
        const lastDotIndex = fullPath.lastIndexOf('.');
        if (lastDotIndex > 0) {
            format = fullPath.substring(lastDotIndex + 1).toLowerCase();
            fullPath = fullPath.substring(0, lastDotIndex);
        }

        return { publicId: fullPath, resourceType, format };
    } catch {
        return { publicId: '', resourceType: 'image', format: '' };
    }
}
