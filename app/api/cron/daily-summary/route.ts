import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { connectToDatabase } from '@/lib/db';
import { Schedule, Employee, Constant, DailyJobTicket } from '@/lib/models';
import { calculateTimesheetData, robustNormalizeISO } from '@/lib/timeCardUtils';

/**
 * Vercel Cron Job: Daily Summary Email
 * Triggered at 11 PM PST every day (6 AM UTC next day)
 * 
 * Cron schedule configured in vercel.json: "0 6 * * *" (6 AM UTC = 11 PM PST)
 * 
 * This route directly executes the email-bot logic instead of making an HTTP
 * self-fetch, which avoids URL resolution issues in serverless environments.
 */

const SETTINGS_TYPE = 'AppSettings';
const BOT_KEY = 'emailBot_dailySummary';

/* ─── Helper: Get today's date string in PT (YYYY-MM-DD) ─── */
function getTodayPT(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/* ─── Helper: Format date for display ─── */
function formatDisplayDate(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/* ─── Helper: Build employee name map ─── */
async function buildEmployeeMap(): Promise<Map<string, string>> {
    const employees = await Employee.find().select('email firstName lastName').lean();
    const map = new Map<string, string>();
    employees.forEach((e: any) => {
        const email = (e.email || '').toLowerCase();
        const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || email;
        map.set(email, name);
    });
    return map;
}

/* ─── Core: Generate HTML email for daily summary ─── */
async function generateDailySummaryHTML(dateStr: string): Promise<{ html: string; stats: any }> {
    const empMap = await buildEmployeeMap();
    const dayStart = new Date(dateStr + 'T00:00:00.000Z');
    const dayEnd = new Date(dateStr + 'T23:59:59.999Z');

    const schedules = await Schedule.find({
        fromDate: { $gte: dayStart, $lte: dayEnd }
    }).select('title jobLocation assignees service item fromDate timesheet jha customerName estimate').lean();

    // ── 1. Today's Schedules ──
    const scheduleRows = (schedules as any[]).map(s => {
        const assigneeNames = (s.assignees || []).map((a: string) => empMap.get(a.toLowerCase()) || a).join(', ');
        return `
            <tr>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${s.title || '--'}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${s.jobLocation || '--'}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${assigneeNames || '--'}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${s.service || '--'}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${s.item || '--'}</td>
            </tr>`;
    });

    // ── 2. Today's JHAs ──
    const jhaSchedules = (schedules as any[]).filter(s => s.jha && Object.keys(s.jha).length > 0);
    const jhaRows = jhaSchedules.map(s => {
        return `
            <tr>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${s.customerName || '--'}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${s.estimate || '--'}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${s.jobLocation || '--'}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${s.jha?.createdBy ? (empMap.get(s.jha.createdBy.toLowerCase()) || s.jha.createdBy) : '--'}</td>
            </tr>`;
    });

    // ── 3. Today's Job Tickets (DJTs) — from dailyjobtickets collection ──
    const scheduleIds = (schedules as any[]).map(s => String(s._id));
    const djtsForToday = await DailyJobTicket.find(
        { schedule_id: { $in: scheduleIds } },
        { schedule_id: 1, createdBy: 1 }
    ).lean();
    const djtByScheduleId = new Map(djtsForToday.map((d: any) => [String(d.schedule_id), d]));

    const djtSchedules = (schedules as any[]).filter(s => djtByScheduleId.has(String(s._id)));
    const djtRows = djtSchedules.map(s => {
        const djt = djtByScheduleId.get(String(s._id));
        return `
            <tr>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${s.customerName || '--'}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${s.estimate || '--'}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${s.jobLocation || '--'}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;">${djt?.createdBy ? (empMap.get(djt.createdBy.toLowerCase()) || djt.createdBy) : '--'}</td>
            </tr>`;
    });

    // ── 4. Today's Timesheet Summary (per employee) ──
    const tsMap = new Map<string, { siteHours: number; driveHours: number; totalHours: number }>();
    (schedules as any[]).forEach(s => {
        (s.timesheet || []).forEach((ts: any) => {
            if (!ts.clockIn) return;
            const clockInStr = robustNormalizeISO(ts.clockIn);
            const clockInDate = clockInStr.split('T')[0];
            if (clockInDate !== dateStr) return;

            const empEmail = (ts.employee || '').toLowerCase();
            const { hours } = calculateTimesheetData(ts, s.fromDate);
            const isDrive = (ts.type || '').toLowerCase().includes('drive');

            if (!tsMap.has(empEmail)) tsMap.set(empEmail, { siteHours: 0, driveHours: 0, totalHours: 0 });
            const entry = tsMap.get(empEmail)!;
            if (isDrive) {
                entry.driveHours = Math.round((entry.driveHours + hours) * 100) / 100;
            } else {
                entry.siteHours = Math.round((entry.siteHours + hours) * 100) / 100;
            }
            entry.totalHours = Math.round((entry.siteHours + entry.driveHours) * 100) / 100;
        });
    });

    // Compute Reg/OT split: Reg = min(8, siteHours), OT = max(0, siteHours - 8)
    const r2 = (n: number) => Math.round(n * 100) / 100;

    const timesheetRows = Array.from(tsMap.entries())
        .sort((a, b) => (empMap.get(a[0]) || a[0]).localeCompare(empMap.get(b[0]) || b[0]))
        .map(([email, data]) => {
            const siteReg = r2(Math.min(8, data.siteHours));
            const siteOt = r2(Math.max(0, data.siteHours - 8));
            const siteTot = data.siteHours;
            const hasOt = siteOt > 0;
            return `
            <tr>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;font-weight:600;">${empMap.get(email) || email}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;text-align:center;">${siteReg.toFixed(2)}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;text-align:center;${hasOt ? 'color:#dc2626;font-weight:700;' : 'color:#334155;'}">${siteOt.toFixed(2)}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;text-align:center;font-weight:600;">${siteTot.toFixed(2)}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;text-align:center;">${data.driveHours.toFixed(2)}</td>
                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#334155;text-align:center;font-weight:700;">${data.totalHours.toFixed(2)}</td>
            </tr>`;
        });

    const totalSite = Array.from(tsMap.values()).reduce((s, v) => s + v.siteHours, 0);
    const totalSiteReg = r2(Array.from(tsMap.values()).reduce((s, v) => s + Math.min(8, v.siteHours), 0));
    const totalSiteOt = r2(Array.from(tsMap.values()).reduce((s, v) => s + Math.max(0, v.siteHours - 8), 0));
    const totalDrive = Array.from(tsMap.values()).reduce((s, v) => s + v.driveHours, 0);
    const totalAll = Math.round((totalSite + totalDrive) * 100) / 100;

    // ── Build Section Helper ──
    const makeSection = (title: string, icon: string, headerCols: string[], rows: string[], emptyMsg: string) => {
        if (rows.length === 0) return '';
        return `
        <div style="margin-bottom:32px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <span style="font-size:20px;">${icon}</span>
                <h2 style="margin:0;font-size:18px;font-weight:800;color:#1e293b;">${title}</h2>
                <span style="background:#e0f2fe;color:#0284c7;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;">${rows.length}</span>
            </div>
            <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;">
                <thead>
                    <tr>
                        ${headerCols.map(c => `<th style="padding:10px 14px;background:#0f172a;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border:1px solid #1e293b;">${c}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows.join('')}
                </tbody>
            </table>
        </div>`;
    };

    const displayDate = formatDisplayDate(dateStr);

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:780px;margin:0 auto;padding:24px;">
            <!-- Header Banner -->
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0f172a 100%);border-radius:16px;padding:32px 40px;text-align:center;margin-bottom:24px;">
                <h1 style="margin:0 0 6px 0;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">📋 Everyday Summary Report</h1>
                <p style="margin:0;font-size:14px;color:#94a3b8;font-weight:500;">${displayDate}</p>
            </div>

            <!-- Quick Stats -->
            <div style="display:flex;gap:12px;margin-bottom:28px;">
                <div style="flex:1;background:#ffffff;border-radius:12px;padding:16px 20px;border:1px solid #e2e8f0;text-align:center;">
                    <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Schedules</p>
                    <p style="margin:0;font-size:28px;font-weight:900;color:#0f172a;">${schedules.length}</p>
                </div>
                <div style="flex:1;background:#ffffff;border-radius:12px;padding:16px 20px;border:1px solid #e2e8f0;text-align:center;">
                    <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">JHAs</p>
                    <p style="margin:0;font-size:28px;font-weight:900;color:#0f172a;">${jhaSchedules.length}</p>
                </div>
                <div style="flex:1;background:#ffffff;border-radius:12px;padding:16px 20px;border:1px solid #e2e8f0;text-align:center;">
                    <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Job Tickets</p>
                    <p style="margin:0;font-size:28px;font-weight:900;color:#0f172a;">${djtSchedules.length}</p>
                </div>
                <div style="flex:1;background:#ffffff;border-radius:12px;padding:16px 20px;border:1px solid #e2e8f0;text-align:center;">
                    <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Total Hours</p>
                    <p style="margin:0;font-size:28px;font-weight:900;color:#0f172a;">${totalAll.toFixed(2)}</p>
                </div>
            </div>

            <!-- Content Container -->
            <div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e2e8f0;">
                ${makeSection("Today's Schedules", '📅', ['Title', 'Location', 'Assignees', 'Service', 'Item'], scheduleRows, 'No schedules for today.')}
                ${makeSection("Today's JHAs", '🛡️', ['Customer', 'Job Number', 'Location', 'Created By'], jhaRows, 'No JHAs for today.')}
                ${makeSection("Today's Job Tickets", '📝', ['Customer', 'Job Number', 'Location', 'Created By'], djtRows, 'No DJTs for today.')}
                ${timesheetRows.length > 0 ? `
                <div style="margin-bottom:32px;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                        <span style="font-size:20px;">⏱️</span>
                        <h2 style="margin:0;font-size:18px;font-weight:800;color:#1e293b;">Today's Timesheet</h2>
                        <span style="background:#dcfce7;color:#16a34a;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;">${tsMap.size} employees</span>
                    </div>
                    <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;">
                        <thead>
                            <tr>
                                <th rowspan="2" style="padding:10px 14px;background:#0f172a;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border:1px solid #1e293b;vertical-align:middle;">Employee Name</th>
                                <th colspan="3" style="padding:8px 14px;background:#0f172a;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:center;border:1px solid #1e293b;">Site Hours</th>
                                <th rowspan="2" style="padding:10px 14px;background:#0f172a;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:center;border:1px solid #1e293b;vertical-align:middle;">Drive Hours</th>
                                <th rowspan="2" style="padding:10px 14px;background:#0f172a;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;text-align:center;border:1px solid #1e293b;vertical-align:middle;">Total Hours</th>
                            </tr>
                            <tr>
                                <th style="padding:6px 14px;background:#1e293b;color:#94a3b8;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:center;border:1px solid #334155;">Reg</th>
                                <th style="padding:6px 14px;background:#1e293b;color:#fca5a5;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:center;border:1px solid #334155;">OT</th>
                                <th style="padding:6px 14px;background:#1e293b;color:#94a3b8;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;text-align:center;border:1px solid #334155;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${timesheetRows.join('')}
                            <tr style="background:#f8fafc;">
                                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:800;">TOTAL</td>
                                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:800;text-align:center;">${totalSiteReg.toFixed(2)}</td>
                                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#dc2626;font-weight:800;text-align:center;">${totalSiteOt.toFixed(2)}</td>
                                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:800;text-align:center;">${r2(totalSite).toFixed(2)}</td>
                                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:800;text-align:center;">${r2(totalDrive).toFixed(2)}</td>
                                <td style="padding:10px 14px;border:1px solid #e2e8f0;font-size:13px;color:#0f172a;font-weight:800;text-align:center;">${totalAll.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>` : ''}

                ${schedules.length === 0 && timesheetRows.length === 0 ? `
                <div style="text-align:center;padding:40px 20px;">
                    <p style="font-size:48px;margin:0 0 12px 0;">📭</p>
                    <p style="font-size:16px;color:#94a3b8;font-weight:600;">No activity recorded for today.</p>
                </div>` : ''}
            </div>

            <!-- Footer -->
            <div style="text-align:center;padding:24px 0 0 0;">
                <p style="margin:0;font-size:11px;color:#94a3b8;">This is an automated report from <strong>DEVCO CRM</strong>. Generated at ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hour12: true })} PST.</p>
            </div>
        </div>
    </body>
    </html>`;

    return {
        html,
        stats: {
            schedules: schedules.length,
            jhas: jhaSchedules.length,
            djts: djtSchedules.length,
            employees: tsMap.size,
            totalHours: totalAll
        }
    };
}

export async function GET(req: NextRequest) {
    try {
        console.log('[Cron] daily-summary invoked', { ts: new Date().toISOString(), ua: req.headers.get('user-agent') });

        // Verify cron secret to prevent unauthorized triggers
        const authHeader = req.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        console.log('[Cron] auth check', { hasSecret: !!cronSecret, headerPresent: !!authHeader, match: authHeader === `Bearer ${cronSecret}` });

        // Vercel cron sends: Authorization: Bearer <CRON_SECRET>
        // Only enforce in production, and only if CRON_SECRET is actually set
        if (process.env.NODE_ENV === 'production' && cronSecret) {
            if (authHeader !== `Bearer ${cronSecret}`) {
                console.error('[Cron] Unauthorized: auth header mismatch');
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
        }

        console.log('[Cron] Daily summary triggered at', new Date().toISOString());

        // ── Execute email-bot logic directly (no self-fetch) ──
        await connectToDatabase();

        const setting = await Constant.findOne({ type: SETTINGS_TYPE, value: BOT_KEY });
        if (!setting?.data) {
            console.error('[Cron] No email bot configuration found');
            return NextResponse.json({ success: false, error: 'No email bot configuration found.' }, { status: 400 });
        }

        const config = setting.data;

        // Check if the bot is active (support legacy 'active' flag if 'enabled' is undefined)
        const isEnabled = config.enabled ?? config.active ?? true;
        if (isEnabled === false) {
            console.log('[Cron] Email bot is inactive, skipping');
            return NextResponse.json({ success: true, message: 'Bot is inactive, skipped' });
        }

        // Check if current hour in PST matches the configured time
        const currentHourPST = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
        const configuredTime = Number(config.time || '23'); // Default to 11 PM if undefined
        if (currentHourPST !== configuredTime) {
            console.log(`[Cron] Not the scheduled time. Current PST hour: ${currentHourPST}, Configured: ${configuredTime}`);
            return NextResponse.json({ success: true, skipped: true, reason: 'Not the configured schedule time' });
        }

        // Idempotency: don't send twice the same PT day
        const todayPT = getTodayPT();
        const lastSentDayPT = config.lastSent ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date(config.lastSent)) : null;
        if (lastSentDayPT === todayPT) {
            console.log('[Cron] Already sent today, skipping');
            return NextResponse.json({ success: true, skipped: true, reason: 'Already sent today' });
        }

        if (!config.recipients || config.recipients.length === 0) {
            console.error('[Cron] No recipients configured');
            return NextResponse.json({ success: false, error: 'No recipients configured.' }, { status: 400 });
        }

        if (!process.env.RESEND_API_KEY) {
            console.error('[Cron] RESEND_API_KEY not configured');
            return NextResponse.json({ success: false, error: 'RESEND_API_KEY not configured' }, { status: 500 });
        }

        const resend = new Resend(process.env.RESEND_API_KEY);
        const dateStr = getTodayPT();
        const { html, stats } = await generateDailySummaryHTML(dateStr);

        const fromName = config.fromName || 'DEVCO Notifications';
        const subject = config.subject || 'Everyday Summary Report';
        const bodyPrefix = config.body ? `<div style="max-width:780px;margin:0 auto;padding:20px 24px 0 24px;font-size:14px;color:#334155;line-height:1.6;">${config.body.replace(/\n/g, '<br>')}</div>` : '';

        const { data, error } = await resend.emails.send({
            from: `${fromName} <info@devco.email>`,
            to: config.recipients,
            subject: `${subject} — ${formatDisplayDate(dateStr)}`,
            html: bodyPrefix + html,
        });

        if (error) {
            console.error('[Cron] Resend error:', error);
            return NextResponse.json({ success: false, error: (error as any).message || 'Email send failed' }, { status: 500 });
        }

        // Log the send
        await Constant.findOneAndUpdate(
            { type: SETTINGS_TYPE, value: BOT_KEY },
            { $set: { 'data.lastSent': new Date().toISOString(), 'data.lastStats': stats } }
        );

        console.log('[Cron] Daily summary email sent successfully. Stats:', stats);
        return NextResponse.json({
            success: true,
            message: 'Daily summary email sent',
            stats,
            emailId: data?.id
        });
    } catch (error: any) {
        console.error('[Cron] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
