import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

/**
 * GET /api/employees/performance/batch
 * Returns { [email]: { score, isPM, isWriter, isAssignee } } for ALL employees in one call.
 *
 * Three scoring roles:
 *  PM        — JHA/DJT compliance on schedules they managed
 *  Writer    — Financial KPIs (margin, collection, DSO) on proposals they wrote
 *  Assignee  — JHA & DJT personal signing rate on schedules where they appear as assignee
 */
export async function GET() {
    try {
        await connectToDatabase();

        const { default: Schedule } = await import('@/lib/models/Schedule');
        const { default: JHA }      = await import('@/lib/models/JHA');
        const { default: DailyJobTicket } = await import('@/lib/models/DailyJobTicket');

        // ── 1. PM compliance ──────────────────────────────────────────────────
        const pmStats = await Schedule.aggregate([
            { $match: { projectManager: { $exists: true, $ne: '' }, item: { $nin: ['Day Off', 'Other'] } } },
            { $group: {
                _id: '$projectManager',
                total:    { $sum: 1 },
                withJHA:  { $sum: { $cond: [{ $eq: ['$hasJHA', true] }, 1, 0] } },
                withDJT:  { $sum: { $cond: [{ $eq: ['$hasDJT', true] }, 1, 0] } },
                withBoth: { $sum: { $cond: [{ $and: [{ $eq: ['$hasJHA', true] }, { $eq: ['$hasDJT', true] }] }, 1, 0] } },
            }}
        ]);

        const pmScoreMap = new Map<string, number>();
        pmStats.forEach((pm: any) => {
            if (!pm._id || pm.total === 0) return;
            const jhaRate  = (pm.withJHA  / pm.total) * 100;
            const djtRate  = (pm.withDJT  / pm.total) * 100;
            const bothRate = (pm.withBoth / pm.total) * 100;
            pmScoreMap.set(pm._id, Math.round(bothRate * 0.60 + jhaRate * 0.20 + djtRate * 0.20));
        });

        // ── 2. Writer financial scores ─────────────────────────────────────────
        const { default: Estimate } = await import('@/lib/models/Estimate');
        const { getCachedWipCalculations } = await import('@/app/api/quickbooks/projects/route');

        const allEstimates = await Estimate.find(
            { proposalWriter: { $exists: true, $ne: null } },
            { estimate: 1, proposalWriter: 1, _id: 0 }
        ).lean();

        const writerProposals = new Map<string, Set<string>>();
        allEstimates.forEach((e: any) => {
            if (!e.estimate) return;
            const writers = Array.isArray(e.proposalWriter) ? e.proposalWriter : [e.proposalWriter];
            writers.forEach((w: string) => {
                if (!w) return;
                if (!writerProposals.has(w)) writerProposals.set(w, new Set());
                writerProposals.get(w)!.add(e.estimate);
            });
        });

        const allProjects = await getCachedWipCalculations() as any[];

        const writerScoreMap = new Map<string, number>();
        writerProposals.forEach((proposalNums, email) => {
            const myProjects = allProjects.filter((p: any) => p.proposalNumber && proposalNums.has(p.proposalNumber));
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

        // ── 3. Assignee signing scores ─────────────────────────────────────────
        // Fetch all non-DayOff schedules that have at least one assignee
        // ('assignees.0' checks if index 0 exists = array is non-empty)
        const assigneeSchedules = await Schedule.find(
            { 'assignees.0': { $exists: true }, item: { $exists: true, $ne: null, $nin: ['Day Off', 'Other', ''] } },
            { _id: 1, assignees: 1 }
        ).lean() as any[];

        // Build: scheduleId -> [emails]
        const scheduleAssigneeMap = new Map<string, string[]>();
        const allAssigneeEmails = new Set<string>();
        assigneeSchedules.forEach((s: any) => {
            if (Array.isArray(s.assignees)) {
                scheduleAssigneeMap.set(s._id, s.assignees);
                s.assignees.forEach((e: string) => allAssigneeEmails.add(e));
            }
        });

        const allScheduleIds = assigneeSchedules.map((s: any) => s._id);

        // Fetch all JHAs and DJTs for these schedules
        const [allJHAs, allDJTs] = await Promise.all([
            JHA.find({ schedule_id: { $in: allScheduleIds } }, { schedule_id: 1, signatures: 1 }).lean(),
            DailyJobTicket.find({ schedule_id: { $in: allScheduleIds } }, { schedule_id: 1, signatures: 1 }).lean(),
        ]);

        // Build: scheduleId -> signed employee set (JHA)
        const jhaSignersMap = new Map<string, Set<string>>();
        (allJHAs as any[]).forEach((j: any) => {
            const signers = new Set<string>();
            if (Array.isArray(j.signatures)) j.signatures.forEach((s: any) => { if (s.employee) signers.add(s.employee); });
            jhaSignersMap.set(j.schedule_id, signers);
        });

        // Build: scheduleId -> signed employee set (DJT)
        const djtSignersMap = new Map<string, Set<string>>();
        (allDJTs as any[]).forEach((d: any) => {
            const signers = new Set<string>();
            if (Array.isArray(d.signatures)) d.signatures.forEach((s: any) => { if (s.employee) signers.add(s.employee); });
            djtSignersMap.set(d.schedule_id, signers);
        });

        // Track schedules that have a JHA or DJT (to know what's required)
        const schedulesWithJHA = new Set((allJHAs as any[]).map((j: any) => j.schedule_id));
        const schedulesWithDJT = new Set((allDJTs as any[]).map((d: any) => d.schedule_id));

        // Per employee: compute signing rates
        const assigneeScoreMap = new Map<string, number>();

        allAssigneeEmails.forEach(email => {
            // Schedules this employee appears in
            const myScheduleIds = assigneeSchedules
                .filter((s: any) => Array.isArray(s.assignees) && s.assignees.includes(email))
                .map((s: any) => s._id);

            if (!myScheduleIds.length) return;

            // JHA: count schedules that have a JHA and whether this employee signed it
            const jhaSchedules = myScheduleIds.filter((id: string) => schedulesWithJHA.has(id));
            const jhaSignedCount = jhaSchedules.filter((id: string) => {
                const signers = jhaSignersMap.get(id);
                return signers && signers.has(email);
            }).length;

            // DJT: same
            const djtSchedules = myScheduleIds.filter((id: string) => schedulesWithDJT.has(id));
            const djtSignedCount = djtSchedules.filter((id: string) => {
                const signers = djtSignersMap.get(id);
                return signers && signers.has(email);
            }).length;

            const jhaTotal = jhaSchedules.length;
            const djtTotal = djtSchedules.length;

            if (jhaTotal === 0 && djtTotal === 0) return; // no docs to sign

            const jhaSignRate = jhaTotal > 0 ? (jhaSignedCount / jhaTotal) * 100 : 0;
            const djtSignRate = djtTotal > 0 ? (djtSignedCount / djtTotal) * 100 : 0;

            // Average the two rates (use only available ones)
            const rates = [
                ...(jhaTotal > 0 ? [jhaSignRate] : []),
                ...(djtTotal > 0 ? [djtSignRate] : []),
            ];
            const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
            assigneeScoreMap.set(email, Math.round(avgRate));
        });

        // ── 4. Combine all roles ───────────────────────────────────────────────
        const allEmails = new Set([
            ...pmScoreMap.keys(),
            ...writerScoreMap.keys(),
            ...assigneeScoreMap.keys(),
        ]);

        const result: Record<string, { score: number; isPM: boolean; isWriter: boolean; isAssignee: boolean }> = {};

        allEmails.forEach(email => {
            const pm       = pmScoreMap.get(email);
            const wr       = writerScoreMap.get(email);
            const asn      = assigneeScoreMap.get(email);
            const isPM       = pm  !== undefined;
            const isWriter   = wr  !== undefined;
            const isAssignee = asn !== undefined;

            const activeScores = [
                ...(isPM       ? [pm!]  : []),
                ...(isWriter   ? [wr!]  : []),
                ...(isAssignee ? [asn!] : []),
            ];

            const score = Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length);
            result[email] = { score, isPM, isWriter, isAssignee };
        });

        return NextResponse.json(result);
    } catch (err: any) {
        console.error('[Batch Performance] FAILED:', err?.message);
        console.error('[Batch Performance] STACK:', err?.stack);
        return NextResponse.json({ error: err?.message, stack: err?.stack }, { status: 500 });
    }
}
