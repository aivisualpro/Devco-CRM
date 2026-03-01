
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { emailTo, subject, emailBody, attachment } = body;

        if (!emailTo || !attachment) {
            console.error('Missing fields:', { hasEmailTo: !!emailTo, hasAttachment: !!attachment });
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

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
            subject: subject || 'Pre-Bore Log Report',
            html: (emailBody || 'Please find attached the Pre-Bore Log Report.').replace(/\n/g, '<br>'),
            attachments: [
                {
                    filename: 'Pre_Bore_Log_Report.pdf',
                    content: buffer,
                },
            ],
        });

        if (error) {
            console.error('Resend Error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, emailId: data?.id });
    } catch (error: any) {
        console.error('Email Pre-Bore Log Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
}
