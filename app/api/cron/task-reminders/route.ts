import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { connectToDatabase } from '@/lib/db';
import DevcoTask from '@/lib/models/DevcoTask';
import Employee from '@/lib/models/Employee';
import Notification from '@/lib/models/Notification';
import { pushNotification } from '@/lib/pusher';

/**
 * Vercel Cron Job: Task Due Date Reminders
 * Runs every hour; sends reminders for tasks due today that are NOT "done".
 * 
 * - Emails go to: createdBy + all assignees
 * - In-app notifications go to: same set of users
 * - Idempotency: tracks which tasks were already reminded today via metadata
 */

/* ─── Helper: Get today's date string in PT (YYYY-MM-DD) ─── */
function getTodayPT(): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());
}

/* ─── Helper: Build employee name map ─── */
async function buildEmployeeMap(): Promise<Map<string, { name: string; image?: string }>> {
    const employees = await Employee.find().select('email firstName lastName profilePicture').lean();
    const map = new Map<string, { name: string; image?: string }>();
    employees.forEach((e: any) => {
        const email = (e.email || '').toLowerCase().trim();
        const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || email;
        map.set(email, { name, image: e.profilePicture });
    });
    return map;
}

/* ─── Helper: Get unique recipients for a task ─── */
function getRecipients(task: any): string[] {
    const emails = new Set<string>();
    if (task.createdBy) emails.add(task.createdBy.toLowerCase().trim());
    (task.assignees || []).forEach((a: string) => {
        if (a) emails.add(a.toLowerCase().trim());
    });
    return Array.from(emails);
}

/* ─── Helper: Format date for display ─── */
function formatDisplayDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    });
}

/* ─── Build Premium HTML Email ─── */
function buildTaskReminderEmail(tasks: any[], recipientEmail: string, empMap: Map<string, { name: string; image?: string }>, todayStr: string): string {
    const recipientName = empMap.get(recipientEmail)?.name || recipientEmail;
    const displayDate = formatDisplayDate(todayStr);

    const statusColor: Record<string, string> = {
        'todo': '#f59e0b',
        'in progress': '#3b82f6',
    };

    const statusLabel: Record<string, string> = {
        'todo': 'To Do',
        'in progress': 'In Progress',
    };

    const taskRows = tasks.map((t, idx) => {
        const assigneeNames = (t.assignees || [])
            .map((a: string) => empMap.get(a.toLowerCase())?.name || a)
            .join(', ');
        const color = statusColor[t.status] || '#64748b';
        const label = statusLabel[t.status] || t.status;
        const customerInfo = t.customerName ? `<span style="color:#64748b;font-size:12px;"> — ${t.customerName}</span>` : '';
        const estimateInfo = t.estimate ? `<span style="background:#e0f2fe;color:#0284c7;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;margin-left:8px;">${t.estimate}</span>` : '';
        const reminderBadge = (t.remindersCount || 0) > 0 ? `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:700;margin-left:6px;">🔔 ${t.remindersCount + 1}</span>` : '';

        return `
        <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;">
                <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:4px;">${t.task}${estimateInfo}${reminderBadge}</div>
                ${customerInfo ? `<div style="font-size:12px;color:#94a3b8;margin-bottom:2px;">📋 ${t.customerName || ''}</div>` : ''}
                ${t.jobAddress ? `<div style="font-size:12px;color:#94a3b8;">📍 ${t.jobAddress}</div>` : ''}
            </td>
            <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;text-align:center;vertical-align:middle;">
                <span style="display:inline-block;background:${color}15;color:${color};padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${label}</span>
            </td>
            <td style="padding:14px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#475569;vertical-align:middle;">${assigneeNames || '—'}</td>
        </tr>`;
    }).join('');

    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:680px;margin:0 auto;padding:24px;">
            <!-- Header Banner -->
            <div style="background:linear-gradient(135deg,#0f172a 0%,#7c3aed 50%,#0f172a 100%);border-radius:16px;padding:32px 40px;text-align:center;margin-bottom:24px;">
                <div style="font-size:48px;margin-bottom:8px;">⏰</div>
                <h1 style="margin:0 0 6px 0;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Task Reminder</h1>
                <p style="margin:0;font-size:14px;color:#c4b5fd;font-weight:500;">${displayDate}</p>
            </div>

            <!-- Greeting -->
            <div style="background:#ffffff;border-radius:16px;padding:24px 28px;border:1px solid #e2e8f0;margin-bottom:20px;">
                <p style="margin:0 0 4px 0;font-size:15px;color:#334155;">Hey <strong>${recipientName}</strong>,</p>
                <p style="margin:0;font-size:14px;color:#64748b;">You have <strong style="color:#7c3aed;">${tasks.length} task${tasks.length > 1 ? 's' : ''}</strong> due today that ${tasks.length > 1 ? 'need' : 'needs'} your attention.</p>
            </div>

            <!-- Tasks Table -->
            <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:20px;">
                <div style="padding:16px 20px;background:#0f172a;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:16px;">📋</span>
                        <span style="font-size:15px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Tasks Due Today</span>
                        <span style="background:#7c3aed;color:#ffffff;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;">${tasks.length}</span>
                    </div>
                </div>
                <table style="width:100%;border-collapse:collapse;">
                    <thead>
                        <tr style="background:#f8fafc;">
                            <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border-bottom:2px solid #e2e8f0;">Task</th>
                            <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;text-align:center;border-bottom:2px solid #e2e8f0;">Status</th>
                            <th style="padding:10px 16px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border-bottom:2px solid #e2e8f0;">Assignees</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${taskRows}
                    </tbody>
                </table>
            </div>

            <!-- CTA -->
            <div style="text-align:center;margin-bottom:24px;">
                <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://devco-crm.vercel.app'}/dashboard" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:12px 32px;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:-0.2px;">Open Dashboard →</a>
            </div>

            <!-- Footer -->
            <div style="text-align:center;padding:8px 0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;">This is an automated reminder from <strong>DEVCO CRM</strong>.</p>
            </div>
        </div>
    </body>
    </html>`;
}

/* ─── Main Handler ─── */
export async function GET(req: NextRequest) {
    try {
        console.log('[Task Reminders] Cron invoked', new Date().toISOString());

        // Verify cron secret in production
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;
        if (process.env.NODE_ENV === 'production' && cronSecret) {
            if (authHeader !== `Bearer ${cronSecret}`) {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
        }

        await connectToDatabase();

        // Only run once per day (check using PT timezone)
        const todayPT = getTodayPT();
        const currentHourPT = Number(new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23'
        }).format(new Date()));

        // Run at 7 AM PT (14:00 UTC) — early morning reminder
        if (process.env.NODE_ENV === 'production' && currentHourPT !== 7) {
            console.log(`[Task Reminders] Not 7AM PT (current: ${currentHourPT}), skipping`);
            return NextResponse.json({ success: true, skipped: true, reason: `Not 7AM PT (current: ${currentHourPT})` });
        }

        // Find tasks due today that are NOT done
        const dayStart = new Date(todayPT + 'T00:00:00.000Z');
        const dayEnd = new Date(todayPT + 'T23:59:59.999Z');

        const dueTasks = await DevcoTask.find({
            dueDate: { $gte: dayStart, $lte: dayEnd },
            status: { $ne: 'done' }
        }).lean();

        console.log(`[Task Reminders] Found ${dueTasks.length} tasks due today (${todayPT})`);

        if (dueTasks.length === 0) {
            return NextResponse.json({ success: true, message: 'No tasks due today', count: 0 });
        }

        const empMap = await buildEmployeeMap();

        // Group tasks by recipient
        const tasksByRecipient = new Map<string, any[]>();
        dueTasks.forEach((task: any) => {
            const recipients = getRecipients(task);
            recipients.forEach(email => {
                if (!tasksByRecipient.has(email)) tasksByRecipient.set(email, []);
                tasksByRecipient.get(email)!.push(task);
            });
        });

        console.log(`[Task Reminders] Sending to ${tasksByRecipient.size} recipients`);

        // Idempotency check: skip tasks already reminded today
        const alreadyReminded = await Notification.find({
            type: 'task_due_reminder',
            'metadata.reminderDate': todayPT,
        }).select('metadata.taskId recipientEmail').lean();

        const remindedSet = new Set(
            alreadyReminded.map((n: any) => `${n.recipientEmail}::${n.metadata?.taskId}`)
        );

        // Send emails + create notifications per recipient
        const resendReady = !!process.env.RESEND_API_KEY;
        const resend = resendReady ? new Resend(process.env.RESEND_API_KEY) : null;

        let emailsSent = 0;
        let notificationsCreated = 0;

        for (const [recipientEmail, tasks] of Array.from(tasksByRecipient.entries())) {
            // Filter out already-reminded tasks for this recipient
            const newTasks = tasks.filter((t: any) => !remindedSet.has(`${recipientEmail}::${String(t._id)}`));
            if (newTasks.length === 0) {
                console.log(`[Task Reminders] All tasks already reminded for ${recipientEmail}, skipping`);
                continue;
            }

            // 1. Create in-app notifications for each task
            const notifDocs = newTasks.map((t: any) => ({
                recipientEmail,
                type: 'task_due_reminder',
                title: `⏰ Task Due Today`,
                message: `"${t.task}" is due today${t.customerName ? ` — ${t.customerName}` : ''}`,
                link: '/dashboard',
                read: false,
                metadata: {
                    taskId: String(t._id),
                    reminderDate: todayPT,
                    taskName: t.task,
                    customerName: t.customerName || '',
                    estimate: t.estimate || ''
                },
                createdBy: 'system',
            }));

            const insertedNotifs = await Notification.insertMany(notifDocs);
            notificationsCreated += insertedNotifs.length;

            // 2. Push real-time notification via Pusher (aggregate)
            try {
                const firstNotif = insertedNotifs[0];
                await pushNotification(recipientEmail, {
                    title: `⏰ ${newTasks.length} Task${newTasks.length > 1 ? 's' : ''} Due Today`,
                    message: newTasks.length === 1
                        ? `"${newTasks[0].task}" needs your attention`
                        : `${newTasks.length} tasks need your attention today`,
                    link: '/dashboard',
                    type: 'task_due_reminder',
                    notificationId: String(firstNotif._id),
                });
            } catch (err) {
                console.error(`[Task Reminders] Pusher push failed for ${recipientEmail}:`, err);
            }

            // 3. Send email
            if (resend) {
                try {
                    const recipientName = empMap.get(recipientEmail)?.name || recipientEmail;
                    const html = buildTaskReminderEmail(newTasks, recipientEmail, empMap, todayPT);
                    const { error } = await resend.emails.send({
                        from: `DEVCO CRM <info@devco.email>`,
                        to: [recipientEmail],
                        subject: `⏰ ${newTasks.length} Task${newTasks.length > 1 ? 's' : ''} Due Today — ${recipientName}`,
                        html,
                    });
                    if (error) {
                        console.error(`[Task Reminders] Email failed for ${recipientEmail}:`, error);
                    } else {
                        emailsSent++;
                        console.log(`[Task Reminders] Email sent to ${recipientEmail} (${newTasks.length} tasks)`);
                    }
                } catch (emailErr) {
                    console.error(`[Task Reminders] Email error for ${recipientEmail}:`, emailErr);
                }
            }
        }

        // 4. Increment remindersCount on each task that was reminded today
        const remindedTaskIds = new Set<string>();
        for (const [, tasks] of Array.from(tasksByRecipient.entries())) {
            tasks.forEach((t: any) => remindedTaskIds.add(String(t._id)));
        }
        // Only increment tasks that were NOT already reminded today (idempotency)
        const alreadyIncrementedIds = new Set(
            alreadyReminded.map((n: any) => n.metadata?.taskId)
        );
        const toIncrementIds = Array.from(remindedTaskIds).filter(id => !alreadyIncrementedIds.has(id));

        if (toIncrementIds.length > 0) {
            const { ObjectId } = require('mongoose').Types;
            await DevcoTask.bulkWrite(
                toIncrementIds.map(id => ({
                    updateOne: {
                        filter: { _id: new ObjectId(id) },
                        update: {
                            $inc: { remindersCount: 1 },
                            $set: { lastReminderAt: new Date() }
                        }
                    }
                }))
            );
            console.log(`[Task Reminders] Incremented remindersCount on ${toIncrementIds.length} tasks`);
        }

        const summary = {
            tasksFound: dueTasks.length,
            recipients: tasksByRecipient.size,
            emailsSent,
            notificationsCreated,
            tasksIncremented: toIncrementIds.length,
            date: todayPT,
        };
        console.log('[Task Reminders] Complete:', summary);

        return NextResponse.json({ success: true, ...summary });
    } catch (error: any) {
        console.error('[Task Reminders] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
