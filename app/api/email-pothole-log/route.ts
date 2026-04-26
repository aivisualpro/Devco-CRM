
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { processGoogleDoc } from '@/lib/googleService';

const resend = new Resend(process.env.RESEND_API_KEY);

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { emailTo, subject, emailBody, potholeLogId, pdfPayload } = body;

        if (!emailTo || !pdfPayload || !potholeLogId) {
            console.error('Missing fields:', { hasEmailTo: !!emailTo, hasPdfPayload: !!pdfPayload, hasPotholeLogId: !!potholeLogId });
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        if (!process.env.RESEND_API_KEY) {
            console.error('Missing RESEND_API_KEY');
            return NextResponse.json({ success: false, error: 'Email service configuration missing' }, { status: 500 });
        }

        // Generate PDF server-side using the same payload the download button uses
        const { templateId, variables, items } = pdfPayload;
        if (!templateId) {
            return NextResponse.json({ success: false, error: 'Missing templateId in pdfPayload' }, { status: 400 });
        }

        // Build the full variable set (same logic as generate-pothole-pdf route)
        const allVars: Record<string, any> = { ...variables };
        const itemCount = items?.length || 0;
        const maxTemplateRows = 50;
        const totalSlots = Math.max(itemCount, maxTemplateRows);

        for (let i = 0; i < totalSlots; i++) {
            const idx = i + 1;
            const item = items?.[i];
            if (item) {
                allVars[`pothole_no_${idx}`] = item.potholeNo || String(idx);
                allVars[`utility_type_${idx}`] = item.typeOfUtility || '';
                allVars[`soil_type_${idx}`] = item.soilType || '';
                allVars[`top_depth_${idx}`] = item.topDepthOfUtility || '';
                allVars[`bottom_depth_${idx}`] = item.bottomDepthOfUtility || '';
                // PIN: use pin field, or fall back to GPS coordinates
                const pinValue = item.pin || ((item.latitude && item.longitude) ? `${Number(item.latitude).toFixed(6)}, ${Number(item.longitude).toFixed(6)}` : '');
                allVars[`pin_${idx}`] = pinValue;
                allVars[`pin_no_${idx}`] = pinValue;
                allVars[`latitude_${idx}`] = item.latitude ? String(item.latitude) : '';
                allVars[`longitude_${idx}`] = item.longitude ? String(item.longitude) : '';

                const photos = [
                    ...(item.photos || []),
                    ...(item.photo1 ? [item.photo1] : []),
                    ...(item.photo2 ? [item.photo2] : [])
                ].filter((v: string, vi: number, a: string[]) => a.indexOf(v) === vi);

                allVars[`photo_${idx}_1`] = photos[0] || '';
                allVars[`photo_${idx}_2`] = photos[1] || '';
            } else {
                allVars[`pothole_no_${idx}`] = '';
                allVars[`utility_type_${idx}`] = '';
                allVars[`soil_type_${idx}`] = '';
                allVars[`top_depth_${idx}`] = '';
                allVars[`bottom_depth_${idx}`] = '';
                allVars[`pin_${idx}`] = '';
                allVars[`pin_no_${idx}`] = '';
                allVars[`latitude_${idx}`] = '';
                allVars[`longitude_${idx}`] = '';
                allVars[`photo_${idx}_1`] = '';
                allVars[`photo_${idx}_2`] = '';
            }
        }

        // Generate PDF
        const pdfBuffer = await processGoogleDoc(templateId, allVars, {
            imageSize: { width: 130, height: 100 },
        });

        // Send email with the generated PDF
        const { data, error } = await resend.emails.send({
            from: 'Devco CRM <info@devco.email>',
            to: emailTo,
            subject: subject || 'Pothole Log Report',
            html: (emailBody || 'Please find attached the Pothole Log Report.').replace(/\n/g, '<br>'),
            attachments: [
                {
                    filename: 'Pothole_Log_Report.pdf',
                    content: Buffer.from(pdfBuffer),
                },
            ],
        });

        if (error) {
            console.error('Resend Error:', error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, emailId: data?.id });
    } catch (error: any) {
        console.error('Email Pothole Log Error:', error);
        return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
    }
}
