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
 * Uses Cloudinary SDK to generate authenticated signed URLs for reliable access.
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

        // Extract public_id and resource_type from the Cloudinary URL
        // URL format: https://res.cloudinary.com/{cloud}/[resource_type]/upload/[v123456789/][transformations/]public_id.ext
        const { publicId, resourceType } = parseCloudinaryUrl(url);

        if (!publicId) {
            return NextResponse.json({ error: 'Could not parse Cloudinary URL' }, { status: 400 });
        }

        // Strategy: Try multiple approaches to fetch the file

        // Approach 1: Generate a signed URL with fl_attachment for direct download
        const signedUrl = cloudinary.url(publicId, {
            resource_type: resourceType,
            type: 'upload',
            sign_url: true,
            flags: 'attachment',
            secure: true,
        });

        let response = await fetch(signedUrl);

        // Approach 2: Try with 'raw' resource type if image didn't work
        if (!response.ok && resourceType === 'image') {
            const rawSignedUrl = cloudinary.url(publicId, {
                resource_type: 'raw',
                type: 'upload',
                sign_url: true,
                secure: true,
            });
            response = await fetch(rawSignedUrl);
        }

        // Approach 3: Try fetching the original URL with fl_attachment injected
        if (!response.ok) {
            const attachmentUrl = injectFlAttachment(url);
            response = await fetch(attachmentUrl);
        }

        // Approach 4: Try the original URL directly as last resort
        if (!response.ok) {
            response = await fetch(url);
        }

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch file from Cloudinary: ${response.status}` },
                { status: 502 }
            );
        }

        const buffer = await response.arrayBuffer();

        // Determine content type
        let contentType = response.headers.get('content-type') || 'application/octet-stream';

        // If filename ends with .pdf, ensure correct content type
        if (filename.toLowerCase().endsWith('.pdf')) {
            contentType = 'application/pdf';
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

    } catch (error: any) {
        console.error('Proxy download error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to proxy download' },
            { status: 500 }
        );
    }
}

/**
 * Parse a Cloudinary URL to extract the public_id and resource_type.
 * Handles URLs like:
 *   https://res.cloudinary.com/doqijlrhv/image/upload/v1770396289/signed_contracts/contract_xxx.pdf
 *   https://res.cloudinary.com/doqijlrhv/raw/upload/v123/folder/file.pdf
 */
function parseCloudinaryUrl(url: string): { publicId: string; resourceType: string } {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');

        // Find the resource_type (image, video, raw) and 'upload' keyword
        let resourceType = 'image';
        let uploadIndex = -1;

        for (let i = 0; i < pathParts.length; i++) {
            if (pathParts[i] === 'upload') {
                uploadIndex = i;
                // Resource type is the part before 'upload'
                if (i > 0 && ['image', 'video', 'raw'].includes(pathParts[i - 1])) {
                    resourceType = pathParts[i - 1];
                }
                break;
            }
        }

        if (uploadIndex === -1) {
            return { publicId: '', resourceType: 'image' };
        }

        // Everything after 'upload' – skip version (v123456789) if present
        let remainingParts = pathParts.slice(uploadIndex + 1);

        // Skip version string (starts with 'v' followed by digits)
        if (remainingParts.length > 0 && /^v\d+$/.test(remainingParts[0])) {
            remainingParts = remainingParts.slice(1);
        }

        // Join remaining parts to get the public_id (with folder path)
        let publicId = remainingParts.join('/');

        // Remove file extension for the public_id
        const lastDotIndex = publicId.lastIndexOf('.');
        if (lastDotIndex > 0) {
            publicId = publicId.substring(0, lastDotIndex);
        }

        return { publicId, resourceType };
    } catch {
        return { publicId: '', resourceType: 'image' };
    }
}

/**
 * Inject fl_attachment flag into a Cloudinary URL for forced download.
 * Inserts it right after /upload/ in the URL path.
 */
function injectFlAttachment(url: string): string {
    // Insert fl_attachment after /upload/ (before version or public_id)
    return url.replace(
        /\/(image|video|raw)\/upload\//,
        '/$1/upload/fl_attachment/'
    );
}
