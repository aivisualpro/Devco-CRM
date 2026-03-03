import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy endpoint to download files from external URLs (e.g. old Cloudinary files).
 * This solves CORS and content-disposition issues with old Cloudinary uploads.
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
        const allowedDomains = ['res.cloudinary.com'];
        const urlObj = new URL(url);

        if (!allowedDomains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`))) {
            return NextResponse.json({ error: 'URL domain not allowed' }, { status: 403 });
        }

        // For Cloudinary PDFs that were uploaded as image type, we need to use fl_attachment
        // to force download, or fetch the raw bytes via the API
        let fetchUrl = url;

        // If it's a Cloudinary image/upload URL for a PDF, modify to force raw delivery
        if (url.includes('res.cloudinary.com') && url.includes('/image/upload/') && url.toLowerCase().endsWith('.pdf')) {
            // Replace /image/upload/ with /raw/upload/ for direct PDF access
            // Also remove any transformation parameters that might be in the URL
            fetchUrl = url.replace('/image/upload/', '/raw/upload/');
        }

        // Fetch the file from the external URL
        const response = await fetch(fetchUrl, {
            headers: {
                'User-Agent': 'DevCo-CRM-Server/1.0',
            },
        });

        if (!response.ok) {
            // If raw URL failed, try the original URL as fallback
            if (fetchUrl !== url) {
                const fallbackResponse = await fetch(url, {
                    headers: {
                        'User-Agent': 'DevCo-CRM-Server/1.0',
                    },
                });

                if (!fallbackResponse.ok) {
                    return NextResponse.json(
                        { error: `Failed to fetch file: ${fallbackResponse.status} ${fallbackResponse.statusText}` },
                        { status: fallbackResponse.status }
                    );
                }

                const fallbackBuffer = await fallbackResponse.arrayBuffer();
                const fallbackContentType = fallbackResponse.headers.get('content-type') || 'application/octet-stream';

                return new NextResponse(fallbackBuffer, {
                    status: 200,
                    headers: {
                        'Content-Type': fallbackContentType,
                        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
                        'Content-Length': fallbackBuffer.byteLength.toString(),
                        'Cache-Control': 'public, max-age=86400',
                    },
                });
            }

            return NextResponse.json(
                { error: `Failed to fetch file: ${response.status} ${response.statusText}` },
                { status: response.status }
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
