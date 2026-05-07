import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

export const revalidate = 300; // 5-minute Next.js cache

/**
 * GET /api/employees/performance/batch
 * Returns { [email]: { score, isPM, isWriter, isAssignee } } for ALL employees in one call.
 *
 * Roles:
 *  PM       — JHA/DJT compliance on schedules they managed
 *  Writer   — Financial KPIs on proposals they wrote
 *  Assignee — JHA & DJT personal signing rate
 */

// ── In-memory cache — survives hot-reloads, shared across requests ──────────
let _cache: { data: any; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET() {
    // Serve cached result if still valid
    if (_cache && Date.now() < _cache.expiresAt) {
        return NextResponse.json(_cache.data);
    }

    try {
        await connectToDatabase();

        const { default: Schedule }        = await import('@/lib/models/Schedule');
        const { default: JHA }             = await import('@/lib/models/JHA');
        const { default: DailyJobTicket }  = await import('@/lib/models/DailyJobTicket');
        const { default: Estimate }        = await import('@/lib/models/Estimate');
        const { getCachedWipCalculations } = await import('@/app/api/quickbooks/projects/route');

        // ── Parallel fetch of all heavyweight data ───────────────────────────
        const [pmStats, allEstimates, allProjects, assigneeSchedules] = await Promise.all([
            // 1. PM compliance aggregation
            Schedule.aggregate([
                { $match: { projectManager: { $exists: true, $ne: '' }, item: { $nin: ['Day Off', 'Other'] } } },
                { $group: {
                    _id: '$projectManager',
                    total:    { $sum: 1 },
                    withJHA:  { $sum: { $cond: [{ $eq: ['$hasJHA', true] }, 1, 0] } },
                    withDJT:  { $sum: { $cond: [{ $eq: ['$hasDJT', true] }, 1, 0] } },
                    withBoth: { $sum: { $cond: [{ $and: [{ $eq: ['$hasJHA', true] }, { $eq: ['$hasDJT', true] }] }, 1, 0] } },
                }},
            ]),
            // 2. Estimates for writer mapping
            Estimate.find(
                { proposalWriter: { $exists: true, $ne: null } },
                { estimate: 1, proposalWriter: 1, _id: 0 }
            ).lean(),
            // 3. WIP calculations (already cached at its own layer)
            getCachedWipCalculations() as Promise<any[]>,
            // 4. Assignee schedules (only need _id + assignees)
            Schedule.find(
                { 'assignees.0': { $exists: true }, item: { $exists: true, $ne: null, $nin: ['Day Off', 'Other', ''] } },
                { _id: 1, assignees: 1 }
            ).lean() as Promise<any[]>,
        ]);

        // ── 1. PM scores ─────────────────────────────────────────────────────
        const pmScoreMap = new Map<string, number>();
        pmStats.forEach((pm: any) => {
            if (!pm._id || pm.total === 0) return;
            const jhaRate  = (pm.withJHA  / pm.total) * 100;
            const djtRate  = (pm.withDJT  / pm.total) * 100;
            const bothRate = (pm.withBoth / pm.total) * 100;
            pmScoreMap.set(pm._id, Math.round(bothRate * 0.60 + jhaRate * 0.20 + djtRate * 0.20));
        });

        // ── 2. Writer scores ──────────────────────────────────────────────────
        const writerProposals = new Map<string, Set<string>>();
        (allEstimates as any[]).forEach((e: any) => {
            if (!e.estimate) return;
            const writers = Array.isArray(e.proposalWriter) ? e.proposalWriter : [e.proposalWriter];
            writers.forEach((w: string) => {
                if (!w) return;
                if (!writerProposals.has(w)) writerProposals.set(w, new Set());
                writerProposals.get(w)!.add(e.estimate);
            });
        });

        const writerScoreMap = new Map<string, number>();
        writerProposals.forEach((proposalNums, email) => {
            const myProjects = (allProjects as any[]).filter((p: any) => p.proposalNumber && proposalNums.has(p.proposalNumber));
            if (!myProjects.length) return;
            const income = myProjects.reduce((s: number, p: any) => s + (p.income || 0), 0);
            const cost   = myProjects.reduce((s: number, p: any) => s + (p.qbCost || 0) + (p.devcoCost || 0), 0);
            const ar     = myProjects.reduce((s: number, p: any) => s + (p.ar || 0), 0);
            const marginPct    = income > 0 ? ((income - cost) / income) * 100 : 0;
            const collectedPct = income > 0 ? ((income - ar) / income) * 100 : 0;
            const dso          = income > 0 ? Math.round((ar / income) * 365) : 0;
            const mS = Math.min(100, Math.max(0, marginPct * 2.5));
            const cS = Math.min(100, Math.max(0, collectedPct));
            const dS = Math.min(100, Math.max(0, 100 - (dso / 90) * 100));
            writerScoreMap.set(email, Math.round(mS * 0.40 + cS * 0.30 + dS * 0.30));
        });

        // ── 3. Assignee scores ────────────────────────────────────────────────
        const allAssigneeEmails = new Set<string>();
        assigneeSchedules.forEach((s: any) => {
            if (Array.isArray(s.assignees)) s.assignees.forEach((e: string) => allAssigneeEmails.add(e));
        });

        const allScheduleIds = assigneeSchedules.map((s: any) => s._id);

        const [allJHAs, allDJTs] = await Promise.all([
            JHA.find({ schedule_id: { $in: allScheduleIds } }, { schedule_id: 1, signatures: 1 }).lean(),
            DailyJobTicket.find({ schedule_id: { $in: allScheduleIds } }, { schedule_id: 1, signatures: 1 }).lean(),
        ]);

        const jhaSignersMap = new Map<string, Set<string>>();
        (allJHAs as any[]).forEach((j: any) => {
            const signers = new Set<string>();
            if (Array.isArray(j.signatures)) j.signatures.forEach((s: any) => { if (s.employee) signers.add(s.employee); });
            jhaSignersMap.set(j.schedule_id, signers);
        });

        const djtSignersMap = new Map<string, Set<string>>();
        (allDJTs as any[]).forEach((d: any) => {
            const signers = new Set<string>();
            if (Array.isArray(d.signatures)) d.signatures.forEach((s: any) => { if (s.employee) signers.add(s.employee); });
            djtSignersMap.set(d.schedule_id, signers);
        });

        const schedulesWithJHA = new Set((allJHAs as any[]).map((j: any) => j.schedule_id));
        const schedulesWithDJT = new Set((allDJTs as any[]).map((d: any) => d.schedule_id));

        const assigneeScoreMap = new Map<string, number>();
        allAssigneeEmails.forEach(email => {
            const myScheduleIds = assigneeSchedules
                .filter((s: any) => Array.isArray(s.assignees) && s.assignees.includes(email))
                .map((s: any) => s._id);

            if (!myScheduleIds.length) return;

            const jhaSchedules    = myScheduleIds.filter((id: string) => schedulesWithJHA.has(id));
            const jhaSignedCount  = jhaSchedules.filter((id: string) => jhaSignersMap.get(id)?.has(email)).length;
            const djtSchedules    = myScheduleIds.filter((id: string) => schedulesWithDJT.has(id));
            const djtSignedCount  = djtSchedules.filter((id: string) => djtSignersMap.get(id)?.has(email)).length;

            const jhaTotal = jhaSchedules.length;
            const djtTotal = djtSchedules.length;
            if (jhaTotal === 0 && djtTotal === 0) return;

            const jhaSignRate = jhaTotal > 0 ? (jhaSignedCount / jhaTotal) * 100 : 0;
            const djtSignRate = djtTotal > 0 ? (djtSignedCount / djtTotal) * 100 : 0;
            const rates = [
                ...(jhaTotal > 0 ? [jhaSignRate] : []),
                ...(djtTotal > 0 ? [djtSignRate] : []),
            ];
            assigneeScoreMap.set(email, Math.round(rates.reduce((a, b) => a + b, 0) / rates.length));
        });

        // ── 4. Combine ────────────────────────────────────────────────────────
        const allEmails = new Set([
            ...pmScoreMap.keys(),
            ...writerScoreMap.keys(),
            ...assigneeScoreMap.keys(),
        ]);

        const result: Record<string, { score: number; isPM: boolean; isWriter: boolean; isAssignee: boolean }> = {};
        allEmails.forEach(email => {
            const pm  = pmScoreMap.get(email);
            const wr  = writerScoreMap.get(email);
            const asn = assigneeScoreMap.get(email);
            const isPM       = pm  !== undefined;
            const isWriter   = wr  !== undefined;
            const isAssignee = asn !== undefined;
            const activeScores = [
                ...(isPM       ? [pm!]  : []),
                ...(isWriter   ? [wr!]  : []),
                ...(isAssignee ? [asn!] : []),
            ];
            result[email] = {
                score: Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length),
                isPM,
                isWriter,
                isAssignee,
            };
        });

        // Store result in memory cache
        _cache = { data: result, expiresAt: Date.now() + CACHE_TTL_MS };

        return NextResponse.json(result);
    } catch (err: any) {
        console.error('[Batch Performance] FAILED:', err?.message);
        return NextResponse.json({ error: err?.message }, { status: 500 });
    }
}
