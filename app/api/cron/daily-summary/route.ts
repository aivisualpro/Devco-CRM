import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Cron Job: Daily Summary Email
 * Triggered at 11 PM PST every day (6 AM UTC next day)
 * 
 * This endpoint calls the main email-bot API with action: 'sendNow'
 * to trigger the daily summary report email.
 * 
 * Cron schedule configured in vercel.json: "0 6 * * *" (6 AM UTC = 11 PM PST)
 */
export async function GET(req: NextRequest) {
    try {
        // Verify cron secret to prevent unauthorized triggers
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            // In development, allow without auth for testing
            if (process.env.NODE_ENV === 'production') {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
        }

        // Call the email-bot API internally
        const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'http://localhost:3000';

        const res = await fetch(`${baseUrl}/api/email-bot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'sendNow' }),
        });

        const data = await res.json();

        if (data.success) {
            console.log(`[Cron] Daily summary email sent successfully. Stats:`, data.stats);
            return NextResponse.json({
                success: true,
                message: 'Daily summary email sent',
                stats: data.stats,
                emailId: data.emailId
            });
        } else {
            console.error('[Cron] Failed to send daily summary:', data.error);
            return NextResponse.json({ success: false, error: data.error }, { status: 500 });
        }
    } catch (error: any) {
        console.error('[Cron] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
