import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Chat from '@/lib/models/Chat';
import Constant from '@/lib/models/Constant';
import Employee from '@/lib/models/Employee';
import { Resend } from 'resend';
import { getUserFromRequest } from '@/lib/permissions/middleware';
import { formatWallDate, formatWallTime, formatWallDateTime } from '@/lib/format/date';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { PermissionChecker } = await import('@/lib/permissions/service');
        const { MODULES, ACTIONS, DATA_SCOPE } = await import('@/lib/permissions/types');

        const checker = new PermissionChecker(user.userId);
        await checker.load();



        if (!checker.can(MODULES.CHAT, ACTIONS.VIEW)) {
             return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
        }

        await connectToDatabase();
        
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        
        let query: any = {};
        const andConditions: any[] = [];
        
        // Scope Check: Use Dashboard's widget_chat field data scope for proper widget-level permissions
        // This checks if the role has "View All" enabled for the Chat widget under Dashboard Data Scope
        const chatScope = checker.getFieldScope(MODULES.DASHBOARD, 'widget_chat');
        
        if (chatScope !== DATA_SCOPE.ALL) {
            const escapedEmail = user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const emailRegex = new RegExp(`^${escapedEmail}$`, 'i');
            
            // User must be sender OR assignee
            andConditions.push({
                 $or: [
                     { sender: emailRegex },
                     { assignees: emailRegex }, // Matches if any element in array matches regex
                     { 'assignees.email': emailRegex },
                     { 'assignees.value': emailRegex },
                     { 'assignees.id': emailRegex }, 
                     { 'assignees.userId': emailRegex }
                 ]
            });
        }

        // Filter by estimate if provided
        const estimateFilter = searchParams.get('estimate');
        if (estimateFilter) {
            query.estimate = estimateFilter;
        }

        // Filter by assignee if provided (check if email is in assignees array)
        const assigneeFilter = searchParams.get('assignee');
        if (assigneeFilter) {
            query.assignees = assigneeFilter;
        }

        // General text search filter
        const filterStr = searchParams.get('filter');
        if (filterStr) {
            andConditions.push({
                $or: [
                    { message: { $regex: filterStr, $options: 'i' } },
                    { estimate: { $regex: filterStr, $options: 'i' } },
                    { sender: { $regex: filterStr, $options: 'i' } },
                    { assignees: { $regex: filterStr, $options: 'i' } }, // Searches string assignees
                    { 'assignees.name': { $regex: filterStr, $options: 'i' } }, // Searches object assignee names
                    { 'assignees.email': { $regex: filterStr, $options: 'i' } } // Searches object assignee emails
                ]
            });
        }

        if (andConditions.length > 0) {
            query.$and = andConditions;
        }

        const messages = await Chat.find(query)
            .sort({ createdAt: -1 }) // Newest first
            .limit(limit)
            .lean();

        return NextResponse.json({ success: true, messages: messages.reverse() }); // Return oldest first for chat flow
    } catch (error) {
        console.error('Chat GET Error:', error instanceof Error ? error.message : error);
        return NextResponse.json({ success: false, error: 'Failed to fetch messages' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const body = await request.json();
        const { message, estimate, assignees, replyTo } = body;

        if (!message) {
            return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
        }

        const newChat = await Chat.create({
            sender: user.email,
            message,
            estimate: estimate || undefined,
            assignees: assignees || [],
            replyTo: replyTo || undefined,
        });

        // ── Chat Alert Email (Background) ──
        if (Array.isArray(assignees) && assignees.length > 0) {
            Promise.resolve().then(async () => {
                try {
                    const alertSetting = await Constant.findOne({ type: 'AppSettings', value: 'emailBot_chatAlert' }).lean();
                    const alertConfig = (alertSetting as any)?.data;
                    const alertEnabled = alertConfig ? alertConfig.enabled !== false : true;

                    if (alertEnabled && process.env.RESEND_API_KEY) {
                        const resendClient = new Resend(process.env.RESEND_API_KEY);
                        const fromName = alertConfig?.fromName || 'DEVCO Notifications';
                        
                        const assigneeDocs = await Employee.find({ email: { $in: assignees } }).select('email firstName lastName').lean();
                        const recipientEmails = assigneeDocs.map((e: any) => e.email).filter(Boolean).filter((email: string) => email !== user.email);

                        if (recipientEmails.length > 0) {
                            const fmtDateShort = (d: any) => d ? formatWallDate(d) : 'N/A';
                            
                            const chatFields = [
                                { label: 'Sender', value: user.email || '--', icon: '👤' },
                                { label: 'Message', value: message || '--', icon: '💬' },
                                { label: 'Estimate', value: estimate || 'General', icon: '🔗' },
                                { label: 'Date', value: fmtDateShort(new Date()), icon: '📅' }
                            ];

                            const fieldRows = chatFields.map((f, i) => `<tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};"><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:12px;"><span style="margin-right:6px;">${f.icon}</span><strong style="color:#64748b;font-size:10px;text-transform:uppercase;">${f.label}</strong></td><td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155;font-weight:600;">${f.value}</td></tr>`).join('');

                            const emailHtml = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;"><div style="background:linear-gradient(135deg,#022c22 0%,#064e3b 100%);padding:32px 40px;text-align:center;"><p style="margin:0 0 4px 0;font-size:12px;font-weight:700;color:#6ee7b7;text-transform:uppercase;letter-spacing:2px;">💬 NEW CHAT MESSAGE</p><h1 style="margin:0;font-size:24px;font-weight:900;color:#ffffff;">You have received a new message</h1></div><div style="padding:24px 28px;"><table style="width:100%;border-collapse:collapse;">${fieldRows}</table></div></div></body></html>`;

                            await resendClient.emails.send({
                                from: `${fromName} <info@devco.email>`,
                                to: recipientEmails,
                                subject: `You have been assigned to a new chat message`,
                                html: emailHtml,
                            });
                            console.log(`[ChatAlert] ✅ Email sent to ${recipientEmails.length} assignee(s)`);
                        }
                    }
                } catch (err) {
                    console.error('[ChatAlert] ❌ Error processing chat alert email:', err);
                }
            });
        }

        return NextResponse.json({ success: true, message: newChat });
    } catch (error) {
        console.error('Chat POST Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 });
    }
}
