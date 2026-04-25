import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { DevcoTask, Employee, Constant } from '@/lib/models';
import { Resend } from 'resend';
import { getUserFromRequest } from '@/lib/permissions/middleware';
import { isSuperAdmin } from '@/lib/permissions/service';
import { revalidateTag } from 'next/cache';
import { getWeekIdFromDate } from '@/lib/scheduleUtils';

import { parsePagination, parseSearch, buildPaginationResponse } from '@/lib/api/pagination';
import { formatWallDate, formatWallTime, formatWallDateTime } from '@/lib/format/date';

export const revalidate = 60;

export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();
        
        const { page, limit, skip, sort } = parsePagination(req);
        const { q } = parseSearch(req);
        
        const { searchParams } = new URL(req.url);
        const assignee = searchParams.get('assignee');
        
        let query: any = {};
        if (assignee) {
            query.assignees = assignee;
        }
        
        if (q) {
            query.$or = [
                { task: { $regex: q, $options: 'i' } },
                { customerName: { $regex: q, $options: 'i' } },
                { estimate: { $regex: q, $options: 'i' } },
                { jobAddress: { $regex: q, $options: 'i' } }
            ];
        }
        
        const appliedSort = sort || { createdAt: -1 };
        const selectedFields = '_id task dueDate assignees status customerId customerName estimate jobAddress createdBy createdAt lastUpdatedBy lastUpdatedAt';
        
        const [tasks, total] = await Promise.all([
            DevcoTask.find(query)
                .select(selectedFields)
                .lean()
                .sort(appliedSort as any)
                .skip(skip)
                .limit(limit),
            DevcoTask.countDocuments(query)
        ]);

        return NextResponse.json({ 
            success: true, 
            ...buildPaginationResponse(tasks, total, page, limit) 
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const body = await req.json();
        
        const taskData = {
            ...body,
            task: body.task || 'Untitled Task',
            status: body.status || 'todo',
            assignees: body.assignees || [],
            createdBy: user.email // Absolute priority: authenticated user
        };

        const task = await (DevcoTask as any).create(taskData);
        console.log(`[API] Task created by ${user.email}:`, task._id);

        // ── Task Alert Email (Background) ──
        if (Array.isArray(taskData.assignees) && taskData.assignees.length > 0) {
            Promise.resolve().then(async () => {
                try {
                    const alertSetting = await Constant.findOne({ type: 'AppSettings', value: 'emailBot_taskAlert' }).lean();
                    const alertConfig = (alertSetting as any)?.data;
                    const alertEnabled = alertConfig ? alertConfig.enabled !== false : true;

                    if (alertEnabled && process.env.RESEND_API_KEY) {
                        const resendClient = new Resend(process.env.RESEND_API_KEY);
                        const fromName = alertConfig?.fromName || 'DEVCO Notifications';
                        
                        const assigneeDocs = await Employee.find({ email: { $in: taskData.assignees } }).select('email firstName lastName').lean();
                        const recipientEmails = assigneeDocs.map((e: any) => e.email).filter(Boolean);

                        if (recipientEmails.length > 0) {
                            const fmtDateShort = (d: any) => d ? formatWallDate(d) : 'N/A';
                            
                            const taskFields = [
                                { label: 'Customer', value: taskData.customerName || '--', icon: '🏢' },
                                { label: 'Estimate', value: taskData.estimate || '--', icon: '📋' },
                                { label: 'Job Address', value: taskData.jobAddress || '--', icon: '📍' },
                                { label: 'Due Date', value: fmtDateShort(taskData.dueDate), icon: '📅' },
                                { label: 'Status', value: taskData.status === 'in progress' ? 'In Progress' : (taskData.status === 'done' ? 'Done' : 'To Do'), icon: '✅' },
                                { label: 'Task', value: taskData.task || '--', icon: '📝' }
                            ];

                            const fieldRows = taskFields.map((f, i) => `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};"><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:12px;"><span style="margin-right:6px;">${f.icon}</span><strong style="color:#64748b;font-size:10px;text-transform:uppercase;">${f.label}</strong></td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;font-weight:600;">${f.value}</td></tr>`).join('');

                            const emailHtml = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;"><div style="background:linear-gradient(135deg,#1e3a8a 0%,#312e81 100%);padding:32px 40px;text-align:center;"><p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:2px;">📋 NEW TASK ASSIGNED</p><h1 style="margin:0;font-size:24px;font-weight:900;color:#ffffff;">Please review the details below</h1></div><div style="padding:24px 28px;"><table style="width:100%;border-collapse:collapse;">${fieldRows}</table></div></div></body></html>`;

                            await resendClient.emails.send({
                                from: `${fromName} <info@devco.email>`,
                                to: recipientEmails,
                                subject: `You have been assigned to a new task`,
                                html: emailHtml,
                            });
                            console.log(`[TaskAlert] ✅ Email sent to ${recipientEmails.length} assignee(s)`);
                        }
                    }
                } catch (err) {
                    console.error('[TaskAlert] ❌ Error processing task alert email:', err);
                }
            });
        }
        
        revalidateTag(`dashboard-${getWeekIdFromDate(task.dueDate || task.createdAt)}`, undefined as any);
        return NextResponse.json({ success: true, task });
    } catch (error: any) {
        console.error('POST /api/tasks error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const body = await req.json();
        const { id, ...updates } = body;
        
        if (!id) {
            return NextResponse.json({ success: false, error: 'Task ID is required' }, { status: 400 });
        }

        const task = await DevcoTask.findById(id);
        if (!task) {
            return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
        }

        // Check if this is a status-only update
        const isStatusOnlyUpdate = Object.keys(updates).every(key => 
            ['status', 'lastUpdatedBy', 'lastUpdatedAt'].includes(key)
        );

        // Ownership Check: Only creator or Super Admin can do full edits
        // But anyone can change status
        const isOwner = task.createdBy?.toLowerCase().trim() === user.email?.toLowerCase().trim();
        const canFullEdit = isSuperAdmin(user.role) || isOwner;
        
        if (!isStatusOnlyUpdate && !canFullEdit) {
            const errorMsg = `Permission denied: Only the creator (${task.createdBy}) can edit this task. You are logged in as ${user.email}.`;
            console.log('Permission Denied - Full Edit:', {
                taskCreatedBy: task.createdBy,
                userEmail: user.email,
                userRole: user.role,
                updates: Object.keys(updates)
            });
            return NextResponse.json({ 
                success: false, 
                error: errorMsg
            }, { status: 403 });
        }
        
        const updatedTask = await DevcoTask.findByIdAndUpdate(id, { 
            ...updates,
            lastUpdatedBy: user.email,
            lastUpdatedAt: new Date()
        }, { new: true });
        
        if (updatedTask) {
            revalidateTag(`dashboard-${getWeekIdFromDate(updatedTask.dueDate || updatedTask.createdAt)}`, undefined as any);
        }
        return NextResponse.json({ success: true, task: updatedTask });
    } catch (error: any) {
        console.error('PATCH /api/tasks error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ success: false, error: 'Task ID is required' }, { status: 400 });
        }

        const task = await DevcoTask.findById(id);
        if (!task) {
            return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
        }

        // Ownership Check: Only creator or Super Admin can delete
        const canDelete = isSuperAdmin(user.role) || task.createdBy?.toLowerCase().trim() === user.email?.toLowerCase().trim();

        if (!canDelete) {
            const errorMsg = `Permission denied: Only the creator (${task.createdBy}) can delete this task. You are logged in as ${user.email}.`;
            console.log('Permission Denied Details:', {
                taskCreatedBy: task.createdBy,
                userEmail: user.email,
                userRole: user.role
            });
            return NextResponse.json({ 
                success: false, 
                error: errorMsg 
            }, { status: 403 });
        }
        
        await DevcoTask.findByIdAndDelete(id);
        revalidateTag(`dashboard-${getWeekIdFromDate(task.dueDate || task.createdAt)}`, undefined as any);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

