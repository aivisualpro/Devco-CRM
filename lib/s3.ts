import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || "",
        secretAccessKey: R2_SECRET_ACCESS_KEY || "",
    },
});

export async function uploadToR2(
    base64String: string,
    fileName: string,
    contentType: string = "image/png"
): Promise<string | null> {
    if (!R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        console.error("R2 credentials or bucket name not configured");
        return null;
    }

    try {
        // Remove data:[type];base64, prefix
        const base64Data = base64String.replace(/^data:[\w/\-+.]+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: contentType,
            ACL: "public-read", // Optional: depends on bucket settings
        });

        await s3Client.send(command);

        // Return the proxy URL
        return `/api/docs/${fileName}`;
    } catch (error) {
        console.error("R2 Upload Error:", error);
        return null;
    }
}

export async function removeFromR2(fileName: string): Promise<boolean> {
    if (!R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        console.error("R2 credentials or bucket name not configured");
        return false;
    }

    try {
        const command = new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fileName,
        });

        await s3Client.send(command);
        return true;
    } catch (error) {
        console.error("R2 Delete Error:", error);
        return false;
    }
}
