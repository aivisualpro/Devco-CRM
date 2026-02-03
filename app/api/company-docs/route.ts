import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DevcoCompanyDoc } from '@/lib/models';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Configure R2 Client for generating signed URLs
const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

async function generateSignedUrl(r2Key: string, filename: string): Promise<string> {
    const getCommand = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: r2Key,
        ResponseContentDisposition: `inline; filename="${filename}"`,
    });
    
    // Create a signed URL that expires in 1 hour
    return getSignedUrl(r2Client, getCommand, { expiresIn: 3600 });
}

export async function GET(request: NextRequest) {
    try {
        await connectToDatabase();
        const docs = await DevcoCompanyDoc.find().sort({ createdAt: -1 }).lean();
        
        // Generate fresh signed URLs for R2 documents
        const docsWithUrls = await Promise.all(docs.map(async (doc: any) => {
            if (doc.r2Key) {
                try {
                    const freshUrl = await generateSignedUrl(doc.r2Key, doc.title || 'document');
                    return { ...doc, url: freshUrl };
                } catch (err) {
                    console.error('Error generating signed URL for', doc._id, err);
                    return doc;
                }
            }
            return doc;
        }));
        
        return NextResponse.json({ success: true, docs: docsWithUrls });
    } catch (error: any) {
        console.error('Error fetching docs:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch docs' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        const body = await request.json();
        const { title, url, r2Key, type, uploadedBy } = body;

        if (!title || !url) {
            return NextResponse.json({ success: false, error: 'Title and URL are required' }, { status: 400 });
        }

        const newDoc = await DevcoCompanyDoc.create({
            title,
            url,
            r2Key,
            type: type || 'document',
            uploadedBy
        });

        return NextResponse.json({ success: true, doc: newDoc });
    } catch (error: any) {
        console.error('Error creating doc:', error);
        return NextResponse.json({ success: false, error: 'Failed to create doc' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        await connectToDatabase();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });
        }

        // TODO: Also delete from R2 storage
        await DevcoCompanyDoc.findByIdAndDelete(id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting doc:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete doc' }, { status: 500 });
    }
}
