import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Schedule, Employee, Constant } from '@/lib/models';
import { sendSMS } from '@/lib/signalwire';
import { Resend } from 'resend';

/**
 * Webhook endpoint for AppSheet to add/update schedules
 * 
 * URL: /api/webhook/schedules
 * 
 * Expected POST body (from AppSheet):
 * {
 *   "action": "add" | "update" | "delete",
 *   "Record_ID": "string",           // MongoDB _id
 *   "Title": "string",
 *   "From": "YYYY-MM-DD" or "MM/DD/YYYY",
 *   "To": "YYYY-MM-DD" or "MM/DD/YYYY",
 *   "Customer": "string",            // customerId
 *   "Proposal Number": "string",     // estimate
 *   "Project Manager Name": "string",// projectManager email
 *   "Foreman Name": "string",        // foremanName email
 *   "Assignees": "email1 , email2",  // comma-separated
 *   "Description": "string",         // description/scope
 *   "Service Item": "string",        // service
 *   "Color": "string",               // item/tag
 *   "Labor Agreement": "string",     // fringe
 *   "Certified Payroll": "string",
 *   "Notify Assignees": "Yes" | "No",
 *   "Per Diem": "Yes" | "No",
 *   "Aerial Image": "string",        // URL
 *   "Site Layout": "string",         // URL
 *   "todayObjectives": "obj1 , obj2" // comma-separated
 * }
 */

// Helper to parse date in various formats
function parseDate(dateStr: string | undefined): Date | null {
    if (!dateStr) return null;
    
    // Try YYYY-MM-DD format first
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;
    
    // Try MM/DD/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const [month, day, year] = parts;
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) return date;
    }
    
    return null;
}

// Helper to parse assignees from "email1 , email2" format
function parseAssignees(assigneesStr: string | undefined): string[] {
    if (!assigneesStr) return [];
    return assigneesStr.split(',').map(a => a.trim()).filter(Boolean);
}

// Helper to parse today objectives from "obj1 , obj2" format
function parseObjectives(objectivesStr: string | undefined): { text: string; completed: boolean }[] {
    if (!objectivesStr) return [];
    return objectivesStr.split(',').map(o => o.trim()).filter(Boolean).map(text => ({
        text,
        completed: false
    }));
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        // Support both single record and array of records
        const records = Array.isArray(body) ? body : [body];
        
        await connectToDatabase();
        
        const results: any[] = [];
        
        for (const record of records) {
            const action = (record.action || 'update').toLowerCase();
            const recordId = record.Record_ID || record._id || record.recordId;
            
            if (!recordId && action !== 'add') {
                results.push({ error: 'Record_ID is required for update/delete', record });
                continue;
            }
            
            // Map AppSheet fields to MongoDB fields
            const scheduleData: any = {};
            
            // Only set fields that are provided (allows partial updates)
            // Support both AppSheet keys (Capitalized/Spaced) and direct Schema keys (camelCase)
            
            const getVal = (keys: string[]) => {
                for (const k of keys) {
                    if (record[k] !== undefined) return record[k];
                }
                return undefined;
            };

            const title = getVal(['Title', 'title']);
            if (title !== undefined) scheduleData.title = title;

            const fromVal = getVal(['From', 'fromDate']);
            if (fromVal !== undefined) {
                const fromDate = parseDate(fromVal);
                if (fromDate) scheduleData.fromDate = fromDate;
            }

            const toVal = getVal(['To', 'toDate']);
            if (toVal !== undefined) {
                const toDate = parseDate(toVal);
                if (toDate) scheduleData.toDate = toDate;
            }

            const customerId = getVal(['Customer', 'customerId']);
            if (customerId !== undefined) scheduleData.customerId = customerId;

            const estimate = getVal(['Proposal Number', 'estimate']);
            if (estimate !== undefined) scheduleData.estimate = estimate;

            const pmName = getVal(['Project Manager Name', 'projectManager']);
            if (pmName !== undefined) scheduleData.projectManager = pmName;

            const foreman = getVal(['Foreman Name', 'foremanName']);
            if (foreman !== undefined) scheduleData.foremanName = foreman;

            const assigneesVal = getVal(['Assignees', 'assignees']);
            if (assigneesVal !== undefined) {
                // If it's already an array, use it. If string, parse it.
                if (Array.isArray(assigneesVal)) {
                    scheduleData.assignees = assigneesVal;
                } else {
                    scheduleData.assignees = parseAssignees(String(assigneesVal));
                }
            }

            const description = getVal(['Description', 'description']);
            if (description !== undefined) scheduleData.description = description;

            const service = getVal(['Service Item', 'service']);
            if (service !== undefined) scheduleData.service = service;

            const item = getVal(['Color', 'item']);
            if (item !== undefined) scheduleData.item = item;

            const fringe = getVal(['Labor Agreement', 'fringe']);
            if (fringe !== undefined) scheduleData.fringe = fringe;

            const certPayroll = getVal(['Certified Payroll', 'certifiedPayroll']);
            if (certPayroll !== undefined) scheduleData.certifiedPayroll = certPayroll;

            const notify = getVal(['Notify Assignees', 'notifyAssignees']);
            if (notify !== undefined) scheduleData.notifyAssignees = notify;

            const perDiem = getVal(['Per Diem', 'perDiem']);
            if (perDiem !== undefined) scheduleData.perDiem = perDiem;

            const aerial = getVal(['Aerial Image', 'aerialImage']);
            if (aerial !== undefined) scheduleData.aerialImage = aerial;

            const site = getVal(['Site Layout', 'siteLayout']);
            if (site !== undefined) scheduleData.siteLayout = site;

            const objectives = getVal(['todayObjectives']);
            if (objectives !== undefined) {
                if (Array.isArray(objectives)) {
                    scheduleData.todayObjectives = objectives; // Assuming already in correct format if array
                } else {
                    scheduleData.todayObjectives = parseObjectives(String(objectives));
                }
            }
            
            // Handle different actions
            switch (action) {
                case 'add':
                case 'create': {
                    // Generate new ID if not provided
                    const newId = recordId || Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
                    
                    const doc = new Schedule({
                        _id: newId,
                        ...scheduleData,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                    await doc.save();
                    
                    const docAny = doc as any;
                    if (docAny.notifyAssignees === true || docAny.notifyAssignees === 'Yes' || docAny.notifyAssignees === 'true') {
                        if (Array.isArray(docAny.assignees) && docAny.assignees.length > 0) {
                            const fmtDate = docAny.fromDate ? new Date(docAny.fromDate).toLocaleDateString() : 'N/A';
                            const messageBody = `You have been assigned to a new devco schedule: ${docAny.title || docAny.jobLocation || 'Job Schedule'}. Date: ${fmtDate}`;
                            
                            try {
                                const assigneesDocs = await Employee.find({ email: { $in: docAny.assignees } }).lean();
                                const smsPromises = assigneesDocs
                                    .map(emp => emp.phone || emp.mobile)
                                    .filter(Boolean)
                                    .map(phone => sendSMS(phone!, messageBody).catch(err => console.error('[SMS] Failed for', phone, err)));
                                await Promise.all(smsPromises);
                            } catch (smsErr) {
                                console.error('[SMS] Error sending notifications:', smsErr);
                            }
                        }
                    }

                    results.push({ 
                        success: true, 
                        action: 'created', 
                        _id: doc._id,
                        record 
                    });

                    // ── Schedule Alert Email ──
                    if (docAny.notifyAssignees === true || docAny.notifyAssignees === 'Yes' || docAny.notifyAssignees === 'true') {
                        if (Array.isArray(docAny.assignees) && docAny.assignees.length > 0) {
                            try {
                                const alertSetting = await Constant.findOne({ type: 'AppSettings', value: 'emailBot_scheduleAlert' }).lean();
                                const alertConfig = (alertSetting as any)?.data;
                                const alertEnabled = alertConfig ? alertConfig.enabled !== false : true;

                                if (alertEnabled && process.env.RESEND_API_KEY) {
                                    const resendClient = new Resend(process.env.RESEND_API_KEY);
                                    const fromName = alertConfig?.fromName || 'DEVCO Notifications';
                                    const assigneeDocs = await Employee.find({ email: { $in: docAny.assignees } }).select('email firstName lastName').lean();
                                    const recipientEmails = assigneeDocs.map((e: any) => e.email).filter(Boolean);

                                    if (recipientEmails.length > 0) {
                                        const fmtDateLong = (d: any) => d ? new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A';
                                        const fmtDateShort = (d: any) => d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'N/A';
                                        const title = docAny.title || docAny.customerName || 'New Schedule';
                                        const assigneeNames = assigneeDocs.map((e: any) => `${e.firstName || ''} ${e.lastName || ''}`.trim()).filter(Boolean);

                                        const fields = [
                                            { l: 'Customer', v: docAny.customerName || '--', i: '\ud83c\udfe2' },
                                            { l: 'Job Location', v: docAny.jobLocation || '--', i: '\ud83d\udccd' },
                                            { l: 'Estimate #', v: docAny.estimate || '--', i: '\ud83d\udccb' },
                                            { l: 'Date', v: `${fmtDateShort(docAny.fromDate)} \u2013 ${fmtDateShort(docAny.toDate)}`, i: '\ud83d\udcc5' },
                                            { l: 'Service', v: docAny.service || '--', i: '\u26a1' },
                                            { l: 'Foreman', v: docAny.foremanName || '--', i: '\ud83d\udc77' },
                                            { l: 'Project Manager', v: docAny.projectManager || '--', i: '\ud83d\udc64' },
                                            { l: 'Description', v: docAny.description || '--', i: '\ud83d\udcdd' },
                                            { l: 'Per Diem', v: docAny.perDiem || 'No', i: '\ud83d\udcb0' },
                                            { l: 'Certified Payroll', v: docAny.certifiedPayroll || 'No', i: '\u2705' },
                                        ];
                                        const rows = fields.map((f, i) => `<tr style="background:${i%2===0?'#fff':'#f8fafc'};"><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:12px;"><span style="margin-right:6px;">${f.i}</span><strong style="color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-size:10px;">${f.l}</strong></td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;font-weight:600;">${f.v}</td></tr>`).join('');

                                        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:640px;margin:0 auto;padding:24px;"><div style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0f172a 100%);border-radius:16px;padding:32px 40px;text-align:center;margin-bottom:24px;"><p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;">\ud83d\udcc5 NEW SCHEDULE ASSIGNED</p><h1 style="margin:0 0 6px 0;font-size:24px;font-weight:900;color:#fbbf24;">${title}</h1><p style="margin:0;font-size:13px;color:#cbd5e1;">${fmtDateLong(docAny.fromDate)}</p></div><div style="background:#fff;border-radius:16px;padding:24px 28px;border:1px solid #e2e8f0;margin-bottom:16px;"><p style="margin:0;font-size:14px;color:#334155;line-height:1.6;">Hi Team,<br><br>You have been assigned to a new schedule. Please review the details below.</p></div><div style="background:#fff;border-radius:16px;padding:0;border:1px solid #e2e8f0;overflow:hidden;margin-bottom:16px;"><div style="padding:16px 20px;background:linear-gradient(90deg,#0f172a,#1e293b);"><h2 style="margin:0;font-size:13px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:1px;">\ud83d\udccb Schedule Details</h2></div><table style="width:100%;border-collapse:collapse;">${rows}</table></div><div style="background:#fff;border-radius:16px;padding:20px 28px;border:1px solid #e2e8f0;margin-bottom:16px;"><p style="margin:0 0 8px 0;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;">\ud83d\udc65 Assigned Team</p><p style="margin:0;font-size:13px;color:#334155;font-weight:600;">${assigneeNames.join(', ')}</p></div><div style="text-align:center;padding:16px 0 0 0;"><p style="margin:0;font-size:11px;color:#94a3b8;">Automated notification from <strong>DEVCO CRM</strong></p></div></div></body></html>`;

                                        await resendClient.emails.send({
                                            from: `${fromName} <info@devco.email>`,
                                            to: recipientEmails,
                                            subject: `New Schedule: ${title} \u2014 ${fmtDateShort(docAny.fromDate)}`,
                                            html,
                                        }).catch(err => console.error('[ScheduleAlert][Webhook] Email error:', err));
                                        console.log(`[ScheduleAlert][Webhook] \u2705 Email sent to ${recipientEmails.length} assignee(s)`);
                                    }
                                }
                            } catch (e) { console.error('[ScheduleAlert][Webhook] Error:', e); }
                        }
                    }
                    break;
                }
                
                case 'update':
                case 'edit': {
                    const updated = await Schedule.findByIdAndUpdate(
                        recordId,
                        { 
                            ...scheduleData, 
                            updatedAt: new Date() 
                        },
                        { new: true, upsert: true } // upsert: create if not exists
                    );
                    
                    results.push({ 
                        success: true, 
                        action: updated ? 'updated' : 'created', 
                        _id: recordId,
                        record 
                    });
                    break;
                }
                
                case 'delete': {
                    await Schedule.findByIdAndDelete(recordId);
                    results.push({ 
                        success: true, 
                        action: 'deleted', 
                        _id: recordId 
                    });
                    break;
                }
                
                default:
                    results.push({ 
                        error: `Unknown action: ${action}`, 
                        record 
                    });
            }
        }
        
        return NextResponse.json({ 
            success: true, 
            processed: results.length,
            results 
        });
        
    } catch (error: any) {
        console.error('[Webhook Schedules] Error:', error);
        return NextResponse.json(
            { success: false, error: error.message }, 
            { status: 500 }
        );
    }
}

// Support GET for testing/health check
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        endpoint: '/api/webhook/schedules',
        description: 'Webhook endpoint for AppSheet to add/update/delete schedules',
        methods: ['POST', 'GET'],
        expectedFields: {
            action: 'add | update | delete (default: update)',
            Record_ID: 'MongoDB _id (required for update/delete)',
            Title: 'Schedule title',
            From: 'From date (YYYY-MM-DD or MM/DD/YYYY)',
            To: 'To date (YYYY-MM-DD or MM/DD/YYYY)',
            Customer: 'Customer ID',
            'Proposal Number': 'Estimate/Proposal number',
            'Project Manager Name': 'PM email',
            'Foreman Name': 'Foreman email',
            Assignees: 'Comma-separated emails (email1 , email2)',
            Description: 'Scope of work',
            'Service Item': 'Service type',
            Color: 'Tag/Item (e.g., Day Off)',
            'Labor Agreement': 'Fringe',
            'Certified Payroll': 'Yes/No',
            'Notify Assignees': 'Yes/No',
            'Per Diem': 'Yes/No',
            'Aerial Image': 'Image URL',
            'Site Layout': 'Site layout URL',
            todayObjectives: 'Comma-separated objectives'
        }
    });
}
