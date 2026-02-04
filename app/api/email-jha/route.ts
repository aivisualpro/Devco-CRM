
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { connectToDatabase } from '@/lib/db';
import { JHA, Schedule } from '@/lib/models';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { emailTo, subject, emailBody, attachment, jhaId, scheduleId } = body;

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

        // 3. Update Database
        await connectToDatabase();
        
        const updatePayload = {
            $inc: { emailCounter: 1 },
            $push: { 
                jhaEmails: {
                    emailto: emailTo,
                    createdAt: new Date()
                }
            }
        };

        const updatedJHA = await JHA.findByIdAndUpdate(jhaId, updatePayload, { new: true });
        
        if (scheduleId) {
             await Schedule.findOneAndUpdate(
                { _id: scheduleId },
                { 
                    $inc: { 'jha.emailCounter': 1 },
                    $push: { 'jha.jhaEmails': { emailto: emailTo, createdAt: new Date() } }
                }
             );
        }

        return NextResponse.json({ success: true, jha: updatedJHA, emailId: data?.id });
    } catch (error: any) {
        console.error('Email JHA Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
