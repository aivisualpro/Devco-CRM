import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import PrelimDoc from '@/lib/models/PrelimDoc';
import { processGoogleDoc } from '@/lib/googleService';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Configure R2 Client
const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

const TEMPLATE_ID = '1tkVNaR45XBFatu7WSn7LUpmsLS8G5aqy9IO5xtlQcAA';

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        const body = await request.json();
        const { action, payload } = body;

        switch (action) {

            case 'getPrelimDocs': {
                const { estimate } = payload || {};
                if (!estimate) return NextResponse.json({ success: false, error: 'estimate is required' }, { status: 400 });
                const docs = await PrelimDoc.find({ estimate }).sort({ createdAt: -1 }).lean();
                return NextResponse.json({ success: true, result: docs });
            }

            // Generate PDF from template + store uploaded file → single record with both
            case 'generatePrelimDoc': {
                const {
                    estimate, variables, createdByName, createdByEmail,
                    position, generatedDate, docName, uploadedFile
                } = payload || {};

                if (!estimate) {
                    return NextResponse.json({ success: false, error: 'estimate is required' }, { status: 400 });
                }

                // 1. Generate PDF from Google Doc template
                const pdfBuffer = await processGoogleDoc(TEMPLATE_ID, variables || {});

                // 2. Upload generated PDF to R2
                const timestamp = Date.now();
                const safeName = `20_Day_Prelim_${estimate.replace(/[^a-zA-Z0-9-]/g, '_')}_${timestamp}.pdf`;
                const r2Key = `estimates/${estimate}/prelims/${safeName}`;

                const hasR2 = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY;
                let fileUrl = '';

                if (hasR2) {
                    await r2Client.send(new PutObjectCommand({
                        Bucket: process.env.R2_BUCKET_NAME,
                        Key: r2Key,
                        Body: pdfBuffer,
                        ContentType: 'application/pdf',
                    }));

                    const filesDomain = process.env.R2_FILES_DOMAIN || 'https://files.devcohq.com';
                    fileUrl = `${filesDomain}/${r2Key}`;
                }

                // 3. Sanitize uploadedFile: strip any base64 data to keep DB lean
                let sanitizedUploadedFile = uploadedFile ? { ...uploadedFile } : undefined;
                if (sanitizedUploadedFile) {
                    // Strip base64 thumbnailUrl — only store URL links
                    if (sanitizedUploadedFile.thumbnailUrl?.startsWith('data:')) {
                        sanitizedUploadedFile.thumbnailUrl = '';
                    }
                    // Strip any accidental base64 in url field
                    if (sanitizedUploadedFile.url?.startsWith('data:')) {
                        sanitizedUploadedFile.url = '';
                    }
                }

                // 4. Create record with both generated + uploaded file
                const doc = await PrelimDoc.create({
                    estimate,
                    docName: docName || '20 Day Prelim',
                    createdByName: createdByName || '',
                    createdByEmail: createdByEmail || '',
                    position: position || '',
                    generatedDate: generatedDate || new Date().toLocaleDateString('en-US'),
                    generatedFile: {
                        url: fileUrl,
                        r2Key,
                        fileName: safeName,
                        fileType: 'application/pdf',
                        fileSize: pdfBuffer.length,
                        uploadedBy: createdByEmail || '',
                        uploadedAt: new Date(),
                    },
                    uploadedFile: sanitizedUploadedFile,
                });

                return NextResponse.json({ success: true, result: doc });
            }

            case 'uploadToPrelimDoc': {
                const { id, uploadedFile: uf } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
                if (!uf?.url) return NextResponse.json({ success: false, error: 'uploadedFile with url is required' }, { status: 400 });

                // Sanitize: strip any base64 data
                const cleanFile = { ...uf };
                if (cleanFile.thumbnailUrl?.startsWith('data:')) cleanFile.thumbnailUrl = '';
                if (cleanFile.url?.startsWith('data:')) cleanFile.url = '';

                const updated = await PrelimDoc.findByIdAndUpdate(
                    id,
                    { $set: { uploadedFile: cleanFile } },
                    { new: true }
                );
                if (!updated) return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
                return NextResponse.json({ success: true, result: updated });
            }

            case 'deletePrelimDoc': {
                const { id } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
                await PrelimDoc.findByIdAndDelete(id);
                return NextResponse.json({ success: true, message: 'Deleted' });
            }

            default:
                return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
        }
    } catch (error: any) {
        console.error('Prelim Docs API Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
}
