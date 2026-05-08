import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { Followup } from '@/lib/models';
import { getUserFromRequest } from '@/lib/permissions/middleware';

/**
 * GET /api/followups/suggest?estimateNumber=X&customerId=Y
 * Returns 2-3 smart suggestion chips based on:
 *   - Most-used channels from the last 5 followups for this customer
 *   - Whether the estimate is overdue / stale (no recent contact)
 *   - Avg response time pattern from completed followups
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();

        const { searchParams } = new URL(req.url);
        const estimateNumber = searchParams.get('estimateNumber');
        const customerId = searchParams.get('customerId');

        const suggestions: { label: string; remarks: string; channel?: string; sentiment?: string }[] = [];

        // ── 1. Analyze past followups for channel preference ──
        const query: any = { status: { $ne: 'cancelled' } };
        if (customerId) query.customerId = customerId;
        else if (estimateNumber) query.estimateNumber = estimateNumber;
        else {
            return NextResponse.json({ success: true, suggestions: [] });
        }

        const recentFollowups = await Followup.find(query)
            .sort({ followupDate: -1 })
            .limit(10)
            .select('channel sentiment followupDate status completedAt remarks')
            .lean() as any[];

        // Channel frequency
        const channelCounts: Record<string, number> = {};
        for (const f of recentFollowups) {
            if (f.channel) channelCounts[f.channel] = (channelCounts[f.channel] || 0) + 1;
        }
        const topChannel = Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

        // ── 2. Days since last contact ──
        const lastContact = recentFollowups[0];
        let daysSinceContact = -1;
        if (lastContact) {
            daysSinceContact = Math.floor((Date.now() - new Date(lastContact.followupDate).getTime()) / 86400000);
        }

        // ── 3. Avg response time (completed followups) ──
        const completedFollowups = recentFollowups.filter(f => f.status === 'completed' && f.completedAt && f.followupDate);
        let avgResponseDays = -1;
        if (completedFollowups.length >= 2) {
            const responseTimes = completedFollowups.map(f => {
                const created = new Date(f.followupDate).getTime();
                const completed = new Date(f.completedAt).getTime();
                return Math.max(0, (completed - created) / 86400000);
            });
            avgResponseDays = Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10;
        }

        // ── Build suggestions ──

        // If no recent contact or stale (> 7 days), escalate
        if (daysSinceContact > 7) {
            suggestions.push({
                label: `🔥 No contact in ${daysSinceContact}d — escalate`,
                remarks: `No followup logged in ${daysSinceContact} days. Checking in on status and next steps.`,
                channel: topChannel || 'phone',
                sentiment: 'urgent',
            });
        } else if (daysSinceContact > 3) {
            suggestions.push({
                label: `📞 Check-in (${daysSinceContact}d since last)`,
                remarks: `Routine check-in — last contact was ${daysSinceContact} days ago.`,
                channel: topChannel || 'phone',
                sentiment: 'neutral',
            });
        }

        // Suggest common patterns based on recent remarks
        const recentRemarks = recentFollowups.slice(0, 3).map(f => (f.remarks || '').toLowerCase());
        const hasPricingMention = recentRemarks.some(r => r.includes('pric') || r.includes('cost') || r.includes('budget'));
        const hasContractMention = recentRemarks.some(r => r.includes('contract') || r.includes('sign'));
        const hasDocsMention = recentRemarks.some(r => r.includes('insurance') || r.includes('docs') || r.includes('document'));

        if (hasPricingMention) {
            suggestions.push({
                label: '💰 Pricing question follow-up',
                remarks: 'Following up on pricing discussion. Confirming quoted amount and addressing any questions.',
                channel: topChannel || 'email',
                sentiment: 'neutral',
            });
        }
        if (hasContractMention) {
            suggestions.push({
                label: '📝 Awaiting signed contract',
                remarks: 'Following up on contract status. Checking if there are any questions or revisions needed.',
                channel: 'email',
                sentiment: 'neutral',
            });
        }
        if (hasDocsMention) {
            suggestions.push({
                label: '📋 Docs/insurance requested',
                remarks: 'Following up on outstanding documentation and insurance certificates.',
                channel: 'email',
                sentiment: 'neutral',
            });
        }

        // If we have < 2 suggestions, add generic ones
        if (suggestions.length < 2) {
            const channelLabel: Record<string, string> = { phone: '📞 Phone', email: '✉️ Email', meeting: '🤝 Meeting' };
            if (topChannel && suggestions.length < 3) {
                suggestions.push({
                    label: `${channelLabel[topChannel] || '📞 Phone'} followup (preferred channel)`,
                    remarks: `Routine followup via ${topChannel}.`,
                    channel: topChannel,
                    sentiment: 'neutral',
                });
            }
        }

        return NextResponse.json({
            success: true,
            suggestions: suggestions.slice(0, 3),
            meta: {
                daysSinceContact,
                avgResponseDays,
                topChannel: topChannel || null,
                totalHistory: recentFollowups.length,
            },
        });
    } catch (error: any) {
        console.error('GET /api/followups/suggest error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
