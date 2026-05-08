import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Followup, DevcoTask, Employee } from '@/lib/models';
import { getUserFromRequest } from '@/lib/permissions/middleware';
import { PermissionChecker, isSuperAdmin } from '@/lib/permissions/service';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import { createNotifications } from '@/lib/notifications';
import { broadcast } from '@/lib/realtime/pusher-server';
import { revalidateTag } from 'next/cache';
import { formatWallDate } from '@/lib/format/date';

export const revalidate = 60;

// ──────────────────────────────────────────────
// GET /api/followups?estimateNumber=X&status=open|completed|all&groupBy=createdBy
// ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Permission: TASKS.VIEW required
        if (!isSuperAdmin(user.role)) {
            const checker = await new PermissionChecker(user.userId).load();
            if (!checker.can(MODULES.TASKS, ACTIONS.VIEW)) {
                return NextResponse.json({ success: false, error: 'Permission denied: TASKS.VIEW required' }, { status: 403 });
            }
        }

        await connectToDatabase();

        const { searchParams } = new URL(req.url);
        const estimateNumber = searchParams.get('estimateNumber');
        const status = searchParams.get('status') || 'all';
        const groupBy = searchParams.get('groupBy'); // 'createdBy' supported

        if (!estimateNumber) {
            return NextResponse.json({ success: false, error: 'estimateNumber is required' }, { status: 400 });
        }

        const query: any = { estimateNumber, status: { $ne: 'cancelled' } };
        if (status && status !== 'all') {
            query.status = status;
        }

        const followups = await Followup.find(query).sort({ followupDate: -1 }).lean();

        // Group by createdBy if requested
        if (groupBy === 'createdBy') {
            const groupMap = new Map<string, { createdBy: string; createdByName: string; items: any[]; totalCount: number; dueCount: number }>();
            const now = new Date().toISOString();

            for (const f of followups) {
                const key = (f as any).createdBy || 'unknown';
                if (!groupMap.has(key)) {
                    groupMap.set(key, {
                        createdBy: key,
                        createdByName: (f as any).createdByName || key.split('@')[0],
                        items: [],
                        totalCount: 0,
                        dueCount: 0,
                    });
                }
                const group = groupMap.get(key)!;
                group.items.push(f);
                group.totalCount++;
                // Count items where nextFollowupDate is past and status is still open
                if ((f as any).status === 'open' && (f as any).nextFollowupDate && (f as any).nextFollowupDate <= now) {
                    group.dueCount++;
                }
            }

            return NextResponse.json({
                success: true,
                groups: Array.from(groupMap.values()),
            });
        }

        return NextResponse.json({ success: true, followups });
    } catch (error: any) {
        console.error('GET /api/followups error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// ──────────────────────────────────────────────
// POST /api/followups
// Body: { estimateNumber, followupDate, remarks, nextFollowupDate?, sentiment?, channel?, customerName?, customerId?, estimateId? }
// ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();

        // Permission: TASKS.CREATE required
        if (!isSuperAdmin(user.role)) {
            const checker = await new PermissionChecker(user.userId).load();
            if (!checker.can(MODULES.TASKS, ACTIONS.CREATE)) {
                return NextResponse.json({ success: false, error: 'Permission denied: TASKS.CREATE required' }, { status: 403 });
            }
        }

        const body = await req.json();

        const { estimateNumber, followupDate, remarks, nextFollowupDate, sentiment, channel, customerName, customerId, estimateId } = body;

        if (!estimateNumber || !followupDate || !remarks) {
            return NextResponse.json({ success: false, error: 'estimateNumber, followupDate, and remarks are required' }, { status: 400 });
        }

        // Resolve creator name
        const creatorDoc = await Employee.findOne({ email: user.email?.toLowerCase().trim() })
            .select('firstName lastName profilePicture')
            .lean() as any;
        const createdByName = creatorDoc
            ? `${creatorDoc.firstName || ''} ${creatorDoc.lastName || ''}`.trim()
            : user.email?.split('@')[0] || 'Unknown';

        // If no nextFollowupDate → auto-complete
        const autoStatus = nextFollowupDate ? 'open' : 'completed';

        const followupData: any = {
            estimateNumber,
            estimateId: estimateId || '',
            customerId: customerId || '',
            customerName: customerName || '',
            followupDate,
            nextFollowupDate: nextFollowupDate || '',
            remarks,
            suggestedAction: body.suggestedAction || '',
            sentiment: sentiment || 'neutral',
            channel: channel || 'phone',
            status: autoStatus,
            completedAt: autoStatus === 'completed' ? new Date().toISOString() : '',
            completedBy: autoStatus === 'completed' ? user.email : '',
            createdBy: user.email,
            createdByName,
            auditLog: [{
                at: new Date().toISOString(),
                by: user.email,
                action: 'created',
                details: `Followup created${nextFollowupDate ? ` — next: ${formatWallDate(nextFollowupDate)}` : ' (auto-completed, no next date)'}`,
            }],
        };

        const followup = await (Followup as any).create(followupData);
        console.log(`[API] Followup created by ${user.email}:`, followup._id, `estimate: ${estimateNumber}`);

        // Auto-create a DevcoTask when nextFollowupDate is set
        let linkedTaskId = '';
        if (nextFollowupDate) {
            try {
                const taskDoc = await (DevcoTask as any).create({
                    task: `Follow up: ${estimateNumber} — ${remarks.substring(0, 80)}`,
                    dueDate: new Date(nextFollowupDate),
                    assignees: [user.email],
                    status: 'todo',
                    createdBy: user.email,
                    estimate: estimateNumber,
                    customerName: customerName || '',
                    customerId: customerId || '',
                    linkedFollowupId: followup._id.toString(),
                });
                linkedTaskId = taskDoc._id.toString();

                // Update followup with linked task ID
                await Followup.findByIdAndUpdate(followup._id, { linkedTaskId });

                console.log(`[API] Linked DevcoTask ${linkedTaskId} created for followup ${followup._id}`);
            } catch (taskErr) {
                console.error('[API] Auto-task creation for followup failed:', taskErr);
            }
        }

        // Cache invalidation
        revalidateTag('followups-list', 'default');
        revalidateTag(`followups-estimate-${estimateNumber}`, 'default');

        // Real-time broadcast
        broadcast('private-org-followups', 'followup-created', {
            followup: JSON.parse(JSON.stringify(followup)),
            linkedTaskId,
            actor: user.email,
        });

        // Notifications — notify other team members viewing this estimate
        const creatorImage = creatorDoc?.profilePicture || '';
        void createNotifications({
            recipientEmails: [], // Will be populated by consumers who subscribe to this estimate
            type: 'followup_created',
            title: `New Followup: ${estimateNumber}`,
            message: `${createdByName} logged a followup: ${remarks.substring(0, 100)}`,
            link: `/estimates/${estimateNumber}`,
            metadata: {
                followupId: followup._id.toString(),
                estimateNumber,
                creatorName: createdByName,
                creatorImage,
                linkedTaskId,
            },
        }).catch(err => console.error('[notif]', err));

        return NextResponse.json({
            success: true,
            followup: { ...JSON.parse(JSON.stringify(followup)), linkedTaskId },
        });
    } catch (error: any) {
        console.error('POST /api/followups error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
