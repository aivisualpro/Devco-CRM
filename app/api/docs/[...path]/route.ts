import { NextRequest } from 'next/server';
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || "",
        secretAccessKey: R2_SECRET_ACCESS_KEY || "",
    },
});

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const pathParams = await params;
    const key = pathParams.path.join('/');
    const searchParams = request.nextUrl.searchParams;
    const downloadName = searchParams.get('name');

    if (!R2_BUCKET_NAME || !key) {
        return new Response("Missing bucket or key", { status: 400 });
    }

    try {
        const command = new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
        });

        const response = await s3Client.send(command);

        if (!response.Body) {
            return new Response("File not found", { status: 404 });
        }

        // Convert the stream to a ByteArray
        const data = await response.Body.transformToByteArray();

        return new Response(Buffer.from(data), {
            headers: {
                "Content-Type": response.ContentType || "application/octet-stream",
                "Content-Disposition": `inline; filename="${downloadName || key.split('/').pop()}"`,
                "Cache-Control": "public, max-age=31536000",
            },
        });
    } catch (error) {
        console.error("Error fetching from R2:", error);
        return new Response("Error fetching file", { status: 500 });
    }
}
