import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Followup, DevcoTask } from '@/lib/models';
import { getUserFromRequest } from '@/lib/permissions/middleware';
import { PermissionChecker, isSuperAdmin } from '@/lib/permissions/service';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import { broadcast } from '@/lib/realtime/pusher-server';
import { revalidateTag } from 'next/cache';

// ──────────────────────────────────────────────
// PATCH /api/followups/[id]
// Body: { status?, remarks?, nextFollowupDate?, sentiment?, channel?, snoozedUntil? }
// ──────────────────────────────────────────────
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        await connectToDatabase();

        const followup = await Followup.findById(id);
        if (!followup) {
            return NextResponse.json({ success: false, error: 'Followup not found' }, { status: 404 });
        }

        // Permission: owner or Super Admin, plus TASKS.EDIT role permission
        const isOwner = followup.createdBy?.toLowerCase().trim() === user.email?.toLowerCase().trim();
        if (!isSuperAdmin(user.role)) {
            const checker = await new PermissionChecker(user.userId).load();
            if (!checker.can(MODULES.TASKS, ACTIONS.EDIT)) {
                return NextResponse.json({ success: false, error: 'Permission denied: TASKS.EDIT required' }, { status: 403 });
            }
            if (!isOwner) {
                return NextResponse.json({
                    success: false,
                    error: `Permission denied: Only the creator (${followup.createdBy}) can edit this followup.`,
                }, { status: 403 });
            }
        }

        const body = await request.json();
        const updates: any = {};
        const auditEntry: any = {
            at: new Date().toISOString(),
            by: user.email,
            action: 'updated',
            details: '',
        };

        // Allowed fields
        if (body.remarks !== undefined) updates.remarks = body.remarks;
        if (body.nextFollowupDate !== undefined) updates.nextFollowupDate = body.nextFollowupDate;
        if (body.sentiment !== undefined) updates.sentiment = body.sentiment;
        if (body.channel !== undefined) updates.channel = body.channel;
        if (body.suggestedAction !== undefined) updates.suggestedAction = body.suggestedAction;
        if (body.snoozedUntil !== undefined) updates.snoozedUntil = body.snoozedUntil;

        // Status transitions
        if (body.status && body.status !== followup.status) {
            updates.status = body.status;

            if (body.status === 'completed') {
                updates.completedAt = new Date().toISOString();
                updates.completedBy = user.email;
                auditEntry.action = 'completed';
                auditEntry.details = 'Marked as completed';

                // Mark linked DevcoTask as done
                if (followup.linkedTaskId) {
                    try {
                        await DevcoTask.findByIdAndUpdate(followup.linkedTaskId, {
                            status: 'done',
                            lastUpdatedBy: user.email,
                            lastUpdatedAt: new Date(),
                        });
                        console.log(`[API] Linked task ${followup.linkedTaskId} marked done`);
                    } catch (taskErr) {
                        console.error('[API] Failed to complete linked task:', taskErr);
                    }
                }

                // Pusher broadcast for completion
                broadcast('private-org-followups', 'followup-completed', {
                    followupId: id,
                    estimateNumber: followup.estimateNumber,
                    actor: user.email,
                });
            } else if (body.status === 'snoozed') {
                auditEntry.action = 'snoozed';
                auditEntry.details = `Snoozed until ${body.snoozedUntil || 'unspecified'}`;
            } else if (body.status === 'open' && followup.status === 'completed') {
                auditEntry.action = 'reopened';
                auditEntry.details = 'Reopened from completed';
                updates.completedAt = '';
                updates.completedBy = '';
            }
        }

        if (!auditEntry.details) {
            auditEntry.details = `Updated: ${Object.keys(updates).join(', ')}`;
        }

        const updated = await Followup.findByIdAndUpdate(
            id,
            {
                ...updates,
                $push: { auditLog: auditEntry },
            },
            { new: true }
        ).lean();

        // Cache invalidation
        revalidateTag('followups-list', 'default');
        revalidateTag(`followups-estimate-${followup.estimateNumber}`, 'default');

        // Broadcast update
        broadcast('private-org-followups', 'followup-updated', {
            followup: updated,
            actor: user.email,
        });

        return NextResponse.json({ success: true, followup: updated });
    } catch (error: any) {
        console.error('PATCH /api/followups/[id] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// ──────────────────────────────────────────────
// DELETE /api/followups/[id]
// Soft-delete via status='cancelled'
// ──────────────────────────────────────────────
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        await connectToDatabase();

        const followup = await Followup.findById(id);
        if (!followup) {
            return NextResponse.json({ success: false, error: 'Followup not found' }, { status: 404 });
        }

        // Permission: owner or Super Admin, plus TASKS.DELETE role permission
        const isOwner = followup.createdBy?.toLowerCase().trim() === user.email?.toLowerCase().trim();
        if (!isSuperAdmin(user.role)) {
            const checker = await new PermissionChecker(user.userId).load();
            if (!checker.can(MODULES.TASKS, ACTIONS.DELETE)) {
                return NextResponse.json({ success: false, error: 'Permission denied: TASKS.DELETE required' }, { status: 403 });
            }
            if (!isOwner) {
                return NextResponse.json({
                    success: false,
                    error: `Permission denied: Only the creator (${followup.createdBy}) can delete this followup.`,
                }, { status: 403 });
            }
        }

        // Delete linked DevcoTask if one exists
        if (followup.linkedTaskId) {
            try {
                await DevcoTask.findByIdAndDelete(followup.linkedTaskId);
                console.log(`[API] Linked task ${followup.linkedTaskId} deleted with followup ${id}`);
            } catch (taskErr) {
                console.error('[API] Failed to delete linked task:', taskErr);
            }
        }

        // Soft-delete: set status to 'cancelled'
        const updated = await Followup.findByIdAndUpdate(
            id,
            {
                status: 'cancelled',
                $push: {
                    auditLog: {
                        at: new Date().toISOString(),
                        by: user.email,
                        action: 'updated',
                        details: 'Soft-deleted (cancelled)',
                    },
                },
            },
            { new: true }
        ).lean();

        // Cache invalidation
        revalidateTag('followups-list', 'default');
        revalidateTag(`followups-estimate-${followup.estimateNumber}`, 'default');

        // Broadcast deletion
        broadcast('private-org-followups', 'followup-deleted', {
            followupId: id,
            estimateNumber: followup.estimateNumber,
            actor: user.email,
        });

        return NextResponse.json({ success: true, followup: updated });
    } catch (error: any) {
        console.error('DELETE /api/followups/[id] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
