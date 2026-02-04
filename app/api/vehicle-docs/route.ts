import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { VehicleDoc } from '@/lib/models';
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
        const docs = await VehicleDoc.find().sort({ createdAt: -1 }).lean();
        
        // Generate fresh signed URLs for R2 documents
        const docsWithUrls = await Promise.all(docs.map(async (doc: any) => {
            // Handle new schema
            if (doc.documents && Array.isArray(doc.documents)) {
                const updatedDocuments = await Promise.all(doc.documents.map(async (file: any) => {
                    if (file.r2Key) {
                        try {
                            const freshUrl = await generateSignedUrl(file.r2Key, file.fileName || 'document');
                            return { ...file, url: freshUrl };
                        } catch (err) {
                            console.error('Error generating signed URL for', file.fileName, err);
                            return file;
                        }
                    }
                    return file;
                }));
                return { ...doc, documents: updatedDocuments };
            }
            
            // Handle legacy schema (fallback if needed, or simply return as is)
            if (doc.r2Key) {
                 try {
                    const freshUrl = await generateSignedUrl(doc.r2Key, doc.title || 'document');
                    return { 
                        ...doc, 
                        documents: [{
                            url: freshUrl,
                            r2Key: doc.r2Key,
                            fileName: doc.title,
                            type: doc.type,
                            uploadedBy: doc.uploadedBy,
                            uploadedAt: doc.createdAt
                        }] 
                    };
                } catch (err) {
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
        const { unit, unitNumber, vinSerialNumber, documents } = body;

        // documents should be an array of { url, r2Key, fileName, type, uploadedBy }

        if (!unit || !unitNumber || !vinSerialNumber || !documents || !Array.isArray(documents)) {
            return NextResponse.json({ success: false, error: 'All fields are required' }, { status: 400 });
        }

        // Check if vehicle entry exists
        let vehicleDoc = await VehicleDoc.findOne({ unitNumber, vinSerialNumber });

        if (vehicleDoc) {
            // Add new documents to existing entry
            vehicleDoc.documents.push(...documents);
            // Update other fields if they changed (optional, but good practice to keep unit name in sync)
            vehicleDoc.unit = unit; 
            await vehicleDoc.save();
        } else {
            // Create new entry
            vehicleDoc = await VehicleDoc.create({
                unit,
                unitNumber,
                vinSerialNumber,
                documents: documents.map((doc: any) => ({
                    ...doc,
                    uploadedAt: new Date()
                }))
            });
        }

        return NextResponse.json({ success: true, doc: vehicleDoc });
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

        // Delete the entire vehicle entry
        // In a real app, we should also delete all associated files from R2
        // For now, we just delete the DB record
        await VehicleDoc.findByIdAndDelete(id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting doc:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete doc' }, { status: 500 });
    }
}
