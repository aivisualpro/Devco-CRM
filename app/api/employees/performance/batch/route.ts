import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';

/**
 * GET /api/employees/performance/batch
 * Returns { [email]: { score, isPM, isWriter } } for ALL employees in one call.
 */
export async function GET() {
    try {
        await connectToDatabase();
        const { default: Schedule } = await import('@/lib/models/Schedule');

        // Aggregate PM compliance per projectManager email (excluding Day Off)
        const pmStats = await Schedule.aggregate([
            { $match: { projectManager: { $exists: true, $ne: '' }, item: { $ne: 'Day Off' } } },
            { $group: {
                _id: '$projectManager',
                total: { $sum: 1 },
                withJHA: { $sum: { $cond: [{ $eq: ['$hasJHA', true] }, 1, 0] } },
                withDJT: { $sum: { $cond: [{ $eq: ['$hasDJT', true] }, 1, 0] } },
                withBoth: { $sum: { $cond: [{ $and: [{ $eq: ['$hasJHA', true] }, { $eq: ['$hasDJT', true] }] }, 1, 0] } },
            }}
        ]);

        // Build PM score map: email -> score
        const pmScoreMap = new Map<string, number>();
        pmStats.forEach((pm: any) => {
            if (!pm._id || pm.total === 0) return;
            const jhaRate = (pm.withJHA / pm.total) * 100;
            const djtRate = (pm.withDJT / pm.total) * 100;
            const bothRate = (pm.withBoth / pm.total) * 100;
            const score = Math.round(bothRate * 0.60 + jhaRate * 0.20 + djtRate * 0.20);
            pmScoreMap.set(pm._id, score);
        });

        // Get writer scores from estimates + WIP
        const { default: Estimate } = await import('@/lib/models/Estimate');
        const { getCachedWipCalculations } = await import('@/app/api/quickbooks/projects/route');

        const allEstimates = await Estimate.find(
            { proposalWriter: { $exists: true, $ne: null } },
            { estimate: 1, proposalWriter: 1, _id: 0 }
        ).lean();

        // Build: writerEmail -> Set of proposal numbers
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

        // Get all projects
        const allProjects = await getCachedWipCalculations() as any[];

        // Build writer score map
        const writerScoreMap = new Map<string, number>();
        writerProposals.forEach((proposalNums, email) => {
            const myProjects = allProjects.filter((p: any) => p.proposalNumber && proposalNums.has(p.proposalNumber));
            if (!myProjects.length) return;

            const income = myProjects.reduce((s: number, p: any) => s + (p.income || 0), 0);
            const cost = myProjects.reduce((s: number, p: any) => s + (p.qbCost || 0) + (p.devcoCost || 0), 0);
            const ar = myProjects.reduce((s: number, p: any) => s + (p.ar || 0), 0);
            const marginPct = income > 0 ? ((income - cost) / income) * 100 : 0;
            const collectedPct = income > 0 ? ((income - ar) / income) * 100 : 0;
            const dso = income > 0 ? Math.round((ar / income) * 365) : 0;

            const mS = Math.min(100, Math.max(0, marginPct * 2.5));
            const cS = Math.min(100, Math.max(0, collectedPct));
            const dS = Math.min(100, Math.max(0, 100 - (dso / 90) * 100));
            const score = Math.round(mS * 0.40 + cS * 0.30 + dS * 0.30);
            writerScoreMap.set(email, score);
        });

        // Combine: all unique emails
        const allEmails = new Set([...pmScoreMap.keys(), ...writerScoreMap.keys()]);
        const result: Record<string, { score: number; isPM: boolean; isWriter: boolean }> = {};

        allEmails.forEach(email => {
            const pm = pmScoreMap.get(email);
            const wr = writerScoreMap.get(email);
            const isPM = pm !== undefined;
            const isWriter = wr !== undefined;

            let score = 0;
            if (isPM && isWriter) score = Math.round(((pm || 0) + (wr || 0)) / 2);
            else if (isPM) score = pm || 0;
            else score = wr || 0;

            result[email] = { score, isPM, isWriter };
        });

        return NextResponse.json(result);
    } catch (err: any) {
        console.error('[Batch Performance]', err);
        return NextResponse.json({ error: err?.message }, { status: 500 });
    }
}
