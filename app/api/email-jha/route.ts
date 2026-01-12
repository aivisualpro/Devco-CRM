import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { connectToDatabase } from '@/lib/db';
import { JHA, Schedule } from '@/lib/models';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { emailTo, subject, emailBody, attachment, jhaId, scheduleId } = body;

        if (!emailTo || !attachment || !jhaId) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Setup Transporter
        // Note: Ensure SMTP_USER and SMTP_PASS are set in .env.local
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 465,
            secure: true, 
            auth: {
                user: process.env.SMTP_USER, 
                pass: process.env.SMTP_PASS,
            },
        });

        // 2. Send Email
        await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Devco CRM" <adeel@devco-inc.com>',
            to: emailTo,
            subject: subject || 'JHA Document',
            text: emailBody || 'Please find attached JHA document',
            attachments: [
                {
                    filename: 'JHA_Document.pdf',
                    content: attachment.split('base64,')[1],
                    encoding: 'base64',
                },
            ],
        });

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
            // Also update the embedded JHA in Schedule to keep it in sync
            // Note: We need to pull the updated JHA emails or just push the new one
            // Ideally replace the whole jha object or update specific fields
             await Schedule.findOneAndUpdate(
                { _id: scheduleId },
                { 
                    $inc: { 'jha.emailCounter': 1 },
                    $push: { 'jha.jhaEmails': { emailto: emailTo, createdAt: new Date() } }
                }
             );
        }

        return NextResponse.json({ success: true, jha: updatedJHA });
    } catch (error: any) {
        console.error('Email JHA Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
