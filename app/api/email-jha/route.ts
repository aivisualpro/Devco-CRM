
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { connectToDatabase } from '@/lib/db';
import mongoose from 'mongoose';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { emailTo, subject, emailBody, attachment, jhaId, scheduleId, createdBy } = body;

        if (!emailTo || !attachment || !jhaId) {
            console.error('Missing fields:', { hasEmailTo: !!emailTo, hasAttachment: !!attachment, hasJhaId: !!jhaId });
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Send Email via Resend
        if (!process.env.RESEND_API_KEY) {
            console.error('Missing RESEND_API_KEY');
            return NextResponse.json({ success: false, error: 'Email service configuration missing' }, { status: 500 });
        }

        // Remove the data:application/pdf;base64, prefix if present for the buffer
        const base64Content = attachment.includes('base64,') ? attachment.split('base64,')[1] : attachment;
        const buffer = Buffer.from(base64Content, 'base64');

        const { data, error } = await resend.emails.send({
            from: 'Devco CRM <info@devco.email>',
            to: emailTo,
            subject: subject || 'JHA Document',
            html: (emailBody || 'Please find attached JHA document').replace(/\n/g, '<br>'),
            attachments: [
                {
                    filename: 'JHA_Document.pdf',
                    content: buffer,
                },
            ],
        });

        if (error) {
            console.error('Resend Error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // 2. Update JHA document using RAW MongoDB driver
        //    Bypass Mongoose to avoid _id type mismatch (String schema vs ObjectId in DB)
        await connectToDatabase();
        const db = mongoose.connection.db!;
        const jhasCol = db.collection('jhas');

        const emailRecord = { emailto: emailTo, createdBy: createdBy || '', createdAt: new Date() };

        // Try multiple _id formats + schedule_id fallback
        const idVariants: any[] = [
            { schedule_id: scheduleId || jhaId },  // Most reliable — schedule_id is always a clean string
            { _id: jhaId },                         // String match
        ];

        // Try ObjectId match if it's a valid hex string
        if (/^[a-f\d]{24}$/i.test(jhaId)) {
            idVariants.push({ _id: new mongoose.Types.ObjectId(jhaId) });
        }

        let updateResult = null;
        for (const query of idVariants) {
            const result = await jhasCol.findOneAndUpdate(
                query,
                {
                    $inc: { emailCounter: 1 },
                    $push: { jhaEmails: emailRecord } as any
                },
                { returnDocument: 'after' }
            );
            if (result) {
                updateResult = result;
                console.log(`[email-jha] Updated via query ${JSON.stringify(query)}, emailCounter=${result.emailCounter}`);
                break;
            }
        }

        if (!updateResult) {
            console.error(`[email-jha] FAILED to find JHA. jhaId=${jhaId}, scheduleId=${scheduleId}`);
        }

        return NextResponse.json({ success: true, jha: updateResult, emailId: data?.id });
    } catch (error: any) {
        console.error('Email JHA Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
