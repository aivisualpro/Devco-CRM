import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// Configure R2 Client
const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

/**
 * Proxy endpoint to serve R2 files with proper headers.
 * Usage: GET /api/r2-file?key=uploads/1234_file.pdf
 * Optional: &download=true to force download instead of inline display
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        const download = searchParams.get('download') === 'true';

        if (!key) {
            return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
        }

        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
        });

        const response = await r2Client.send(command);

        if (!response.Body) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Convert the readable stream to a buffer
        const chunks: Uint8Array[] = [];
        const reader = response.Body.transformToWebStream().getReader();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        // Determine content type
        const contentType = response.ContentType || 'application/octet-stream';
        
        // Extract filename from key
        const filename = key.split('/').pop() || 'file';
        // Remove timestamp prefix if present (e.g., "1234567890_filename.pdf" -> "filename.pdf")
        const cleanFilename = filename.replace(/^\d+_/, '');

        const headers: Record<string, string> = {
            'Content-Type': contentType,
            'Content-Length': totalLength.toString(),
            'Cache-Control': 'public, max-age=31536000', // Cache for 1 year (files are immutable)
        };

        if (download) {
            headers['Content-Disposition'] = `attachment; filename="${cleanFilename}"`;
        } else {
            headers['Content-Disposition'] = `inline; filename="${cleanFilename}"`;
        }

        return new NextResponse(result, { status: 200, headers });

    } catch (error: any) {
        console.error('R2 file proxy error:', error);
        if (error.name === 'NoSuchKey') {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }
        return NextResponse.json({ error: error.message || 'Failed to retrieve file' }, { status: 500 });
    }
}
