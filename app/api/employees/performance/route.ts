import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getCachedWipCalculations } from '@/app/api/quickbooks/projects/route';

/**
 * GET /api/employees/performance?writerEmail=nr@devco-inc.com&writerName=Nick+Rossi
 *
 * Computes a combined performance score from THREE sources:
 * 1. PROPOSAL WRITER : Financial KPIs from WIP projects
 * 2. PROJECT MANAGER : JHA/DJT compliance on schedules they managed
 * 3. ASSIGNEE        : JHA & DJT signing rate on schedules where they appear as assignee
 */
export async function GET(req: NextRequest) {
    try {
        const writerEmail = req.nextUrl.searchParams.get('writerEmail') || '';
        const writerName  = req.nextUrl.searchParams.get('writerName')  || '';

        if (!writerEmail && !writerName) {
            return NextResponse.json({ error: 'writerEmail or writerName is required' }, { status: 400 });
        }

        await connectToDatabase();

        // ══════════════════════════════════════════════════════════════════════
        // PART A: Proposal Writer — financial KPIs
        // ══════════════════════════════════════════════════════════════════════
        const { default: Estimate } = await import('@/lib/models/Estimate');
        const emailQuery = writerEmail
            ? { proposalWriter: writerEmail }
            : { proposalWriter: { $regex: writerName, $options: 'i' } };

        const estimates = await Estimate.find(emailQuery, { estimate: 1, _id: 0 }).lean();
        const writerProposalNumbers = new Set<string>();
        estimates.forEach((e: any) => { if (e.estimate) writerProposalNumbers.add(e.estimate); });

        let writerData: any = null;
        if (writerProposalNumbers.size > 0) {
            const allProjects = await getCachedWipCalculations() as any[];
            const myProjects = allProjects.filter((p: any) =>
                p.proposalNumber && writerProposalNumbers.has(p.proposalNumber)
            );
            if (myProjects.length > 0) {
                const sum = (key: string) => myProjects.reduce((s: number, p: any) => s + (Number(p[key]) || 0), 0);
                const income        = sum('income');
                const totalCost     = sum('qbCost') + sum('devcoCost');
                const profit        = income - totalCost;
                const marginPct     = income > 0 ? (profit / income) * 100 : 0;
                const arOutstanding = sum('ar');
                const collectedPct  = income > 0 ? ((income - arOutstanding) / income) * 100 : 0;
                const contractValue = sum('originalContract') + sum('changeOrders');
                const pctComplete   = contractValue > 0 ? Math.min(100, (income / contractValue) * 100) : 0;
                const projectMargins = myProjects.map((p: any) => {
                    const inc = p.income || 0; const cost = (p.qbCost||0)+(p.devcoCost||0);
                    const gp = inc - cost; const mg = inc > 0 ? (gp / inc) * 100 : 0;
                    return { name: p.DisplayName || '', income: inc, cost, profit: gp, margin: mg, ar: p.ar || 0, proposalNumber: p.proposalNumber };
                }).sort((a, b) => b.profit - a.profit);
                writerData = {
                    projectCount: myProjects.length, income, totalCost, profit, marginPct,
                    arOutstanding, collectedPct, contractValue, pctComplete,
                    backlog: Math.max(0, contractValue - income),
                    avgProjectSize: contractValue / myProjects.length,
                    payables: sum('ap'),
                    dso: income > 0 ? Math.round((arOutstanding / income) * 365) : 0,
                    originalContract: sum('originalContract'),
                    changeOrders: sum('changeOrders'),
                    topProjects: projectMargins.slice(0, 5),
                    lossProjects: projectMargins.filter(p => p.profit < 0).slice(0, 5),
                };
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // PART B: Project Manager — JHA/DJT compliance on managed schedules
        // ══════════════════════════════════════════════════════════════════════
        const { default: Schedule } = await import('@/lib/models/Schedule');
        const pmQuery = writerEmail
            ? { projectManager: writerEmail }
            : { projectManager: { $regex: `^${writerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } };

        const scheduleStats = await Schedule.aggregate([
            { $match: { ...pmQuery, item: { $nin: ['Day Off', 'Other'] } } },
            { $group: {
                _id: null,
                total:    { $sum: 1 },
                withJHA:  { $sum: { $cond: [{ $and: [{ $eq: ['$hasJHA', true] }, { $ne: ['$isRequiredJHA', false] }] }, 1, 0] } },
                withDJT:  { $sum: { $cond: [{ $and: [{ $eq: ['$hasDJT', true] }, { $ne: ['$isRequiredDJT', false] }] }, 1, 0] } },
                withBoth: { $sum: { $cond: [{ $and: [{ $eq: ['$hasJHA', true] }, { $eq: ['$hasDJT', true] }, { $ne: ['$isRequiredJHA', false] }, { $ne: ['$isRequiredDJT', false] }] }, 1, 0] } },
                totalRequiringJHA: { $sum: { $cond: [{ $ne: ['$isRequiredJHA', false] }, 1, 0] } },
                totalRequiringDJT: { $sum: { $cond: [{ $ne: ['$isRequiredDJT', false] }, 1, 0] } },
            }}
        ]);

        const pm = scheduleStats[0] || { total: 0, withJHA: 0, withDJT: 0, withBoth: 0, totalRequiringJHA: 0, totalRequiringDJT: 0 };
        const isPM   = pm.total > 0;
        const jhaRate  = pm.totalRequiringJHA > 0 ? (pm.withJHA  / pm.totalRequiringJHA) * 100 : 0;
        const djtRate  = pm.totalRequiringDJT > 0 ? (pm.withDJT  / pm.totalRequiringDJT) * 100 : 0;
        const bothRate = Math.min(pm.totalRequiringJHA, pm.totalRequiringDJT) > 0 ? (pm.withBoth / Math.min(pm.totalRequiringJHA, pm.totalRequiringDJT)) * 100 : 0;

        // ══════════════════════════════════════════════════════════════════════
        // PART C: Assignee — JHA & DJT signing compliance
        // ══════════════════════════════════════════════════════════════════════
        const email = writerEmail;
        let assigneeData: any = null;

        if (email) {
            // All non-DayOff schedules where this email is in assignees
            const assigneeSchedules = await Schedule.find(
                { assignees: email, item: { $exists: true, $ne: null, $nin: ['Day Off', 'Other', ''] } },
                { _id: 1 }
            ).lean() as any[];

            const scheduleIds = assigneeSchedules.map((s: any) => s._id);

            if (scheduleIds.length > 0) {
                const { default: JHA } = await import('@/lib/models/JHA');
                const { default: DailyJobTicket } = await import('@/lib/models/DailyJobTicket');

                // JHA signing: how many JHAs for these schedules have a signature from this employee
                const jhas = await JHA.find(
                    { schedule_id: { $in: scheduleIds } },
                    { schedule_id: 1, signatures: 1 }
                ).lean() as any[];

                // DJTs signing
                const djts = await DailyJobTicket.find(
                    { schedule_id: { $in: scheduleIds } },
                    { schedule_id: 1, signatures: 1 }
                ).lean() as any[];

                // For each schedule: did this employee sign the JHA?
                // A schedule may have 0 or 1 JHAs — we count the schedule as covered if they signed
                const jhaSignedCount = jhas.filter((j: any) =>
                    Array.isArray(j.signatures) && j.signatures.some((s: any) => s.employee === email)
                ).length;
                const jhaTotal = jhas.length; // schedules with a JHA

                const djtSignedCount = djts.filter((d: any) =>
                    Array.isArray(d.signatures) && d.signatures.some((s: any) => s.employee === email)
                ).length;
                const djtTotal = djts.length;

                const jhaSignRate = jhaTotal > 0 ? (jhaSignedCount / jhaTotal) * 100 : 0;
                const djtSignRate = djtTotal > 0 ? (djtSignedCount / djtTotal) * 100 : 0;

                // Only flag as assignee if there's at least one JHA or DJT to sign
                if (jhaTotal > 0 || djtTotal > 0) {
                    const assigneeScore = Math.round((jhaSignRate + djtSignRate) / 2);
                    assigneeData = {
                        scheduleCount: scheduleIds.length,
                        jhaTotal, jhaSignedCount, jhaSignRate: Math.round(jhaSignRate),
                        djtTotal, djtSignedCount, djtSignRate: Math.round(djtSignRate),
                        assigneeScore,
                    };
                }
            }
        }

        // ══════════════════════════════════════════════════════════════════════
        // PART D: Combined Performance Score
        // ══════════════════════════════════════════════════════════════════════
        const isWriter   = !!writerData;
        const isAssignee = !!assigneeData;

        if (!isWriter && !isPM && !isAssignee) {
            return NextResponse.json({ isWriter: false, isPM: false, isAssignee: false, projects: [], kpis: null });
        }

        const pmScore = isPM
            ? Math.round(bothRate * 0.60 + jhaRate * 0.20 + djtRate * 0.20)
            : 0;

        const writerScore = isWriter
            ? (() => {
                const marginScore     = Math.min(100, Math.max(0, (writerData.marginPct || 0) * 2.5));
                const collectionScore = Math.min(100, Math.max(0, writerData.collectedPct || 0));
                const dsoScore        = Math.min(100, Math.max(0, 100 - ((writerData.dso || 0) / 90) * 100));
                return Math.round(marginScore * 0.40 + collectionScore * 0.30 + dsoScore * 0.30);
            })()
            : 0;

        const assigneeScore = isAssignee ? (assigneeData.assigneeScore || 0) : 0;

        // Average all active role scores
        const activeScores = [
            ...(isPM       ? [pmScore]       : []),
            ...(isWriter   ? [writerScore]   : []),
            ...(isAssignee ? [assigneeScore] : []),
        ];
        const performanceScore = Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length);

        const grade =
            performanceScore >= 85 ? { label: 'Excellent', color: 'emerald' } :
            performanceScore >= 70 ? { label: 'Good',      color: 'blue'    } :
            performanceScore >= 50 ? { label: 'Average',   color: 'amber'   } :
                                     { label: 'Needs Work', color: 'red'    };

        return NextResponse.json({
            isWriter, isPM, isAssignee,
            performanceScore, pmScore, writerScore, assigneeScore,
            grade,
            schedules: {
                total: pm.total, withJHA: pm.withJHA, withDJT: pm.withDJT, withBoth: pm.withBoth,
                jhaRate: Math.round(jhaRate), djtRate: Math.round(djtRate), bothRate: Math.round(bothRate),
            },
            assignee: assigneeData,
            kpis: writerData ? {
                income: writerData.income, totalCost: writerData.totalCost, profit: writerData.profit,
                marginPct: writerData.marginPct, arOutstanding: writerData.arOutstanding,
                collectedPct: writerData.collectedPct, contractValue: writerData.contractValue,
                backlog: writerData.backlog, pctComplete: writerData.pctComplete,
                avgProjectSize: writerData.avgProjectSize, payables: writerData.payables,
                dso: writerData.dso, originalContract: writerData.originalContract,
                changeOrders: writerData.changeOrders,
            } : null,
            projectCount: writerData?.projectCount || 0,
            topProjects:  writerData?.topProjects  || [],
            lossProjects: writerData?.lossProjects || [],
        });
    } catch (err: any) {
        console.error('[Employee Performance]', err);
        return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
    }
}
