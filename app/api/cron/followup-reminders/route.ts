import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Followup from '@/lib/models/Followup';
import { createNotifications } from '@/lib/notifications';
import { broadcast } from '@/lib/realtime/pusher-server';

/**
 * Vercel Cron Job: Followup Due-Date Reminders
 * Runs hourly; fires a reminder ~1 hour before each open Followup's nextFollowupDate.
 * 
 * - In-app notifications go to the followup creator
 * - Pusher real-time push to the user's private channel
 * - Idempotency: skip if already reminded within the last 50 minutes (via auditLog)
 */

export const revalidate = 0;

export async function GET(req: NextRequest) {
    try {
        console.log('[Followup Reminders] Cron invoked', new Date().toISOString());

        // Verify cron secret in production
        const cronSecret = process.env.CRON_SECRET;
        if (process.env.NODE_ENV === 'production' && cronSecret) {
            if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        await connectToDatabase();

        // Window: now → now + 120 min (hourly cron on Hobby plan)
        const now = new Date();
        const windowEnd = new Date(now.getTime() + 120 * 60 * 1000);

        const due = await Followup.find({
            $or: [
                // Open followups due within the window
                {
                    status: 'open',
                    nextFollowupDate: {
                        $gte: now.toISOString(),
                        $lte: windowEnd.toISOString(),
                    },
                },
                // Snoozed followups whose snooze period has expired (re-activate)
                {
                    status: 'snoozed',
                    snoozedUntil: { $lte: now.toISOString() },
                    nextFollowupDate: { $lte: windowEnd.toISOString() },
                },
            ],
        }).lean();

        console.log(`[Followup Reminders] Found ${due.length} open followups due within window`);

        let firedCount = 0;

        for (const f of due as any[]) {
            // Idempotency: skip if reminded less than 50 minutes ago
            const lastRemind = (f.auditLog || [])
                .filter((l: any) => l.action === 'reminded')
                .pop();
            if (lastRemind) {
                const ageMin = (Date.now() - new Date(lastRemind.at).getTime()) / 60000;
                if (ageMin < 50) {
                    continue;
                }
            }

            // 1. Create in-app notification
            await createNotifications({
                recipientEmails: [f.createdBy],
                type: 'followup_reminder',
                title: `Followup due in ~1 hour`,
                message: `${f.estimateNumber}: ${(f.remarks || '').substring(0, 100)}`,
                link: `/estimates/${f.estimateNumber}`,
                metadata: {
                    followupId: String(f._id),
                    estimateNumber: f.estimateNumber,
                    customerName: f.customerName || '',
                    nextFollowupDate: f.nextFollowupDate,
                },
            });

            // 2. Pusher real-time push to user's private channel
            const sanitizedEmail = (f.createdBy || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
            broadcast(
                `private-user-${sanitizedEmail}`,
                'followup.reminder',
                {
                    followupId: String(f._id),
                    estimateNumber: f.estimateNumber,
                    dueAt: f.nextFollowupDate,
                    remarks: f.remarks,
                    customerName: f.customerName || '',
                }
            );

            // 3. Append 'reminded' audit log entry (idempotency marker)
            await Followup.updateOne(
                { _id: f._id },
                {
                    $push: {
                        auditLog: {
                            at: new Date().toISOString(),
                            by: 'system',
                            action: 'reminded',
                            details: `Reminder fired at ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`,
                        },
                    },
                }
            );

            firedCount++;
        }

        const summary = { ok: true, due: due.length, fired: firedCount };
        console.log('[Followup Reminders] Complete:', summary);

        return NextResponse.json(summary);
    } catch (error: any) {
        console.error('[Followup Reminders] Error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
