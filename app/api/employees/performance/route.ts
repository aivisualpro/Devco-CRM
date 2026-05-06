import { NextRequest, NextResponse } from 'next/server';
import { getCachedWipCalculations } from '@/app/api/quickbooks/projects/route';
import { connectToDatabase } from '@/lib/db';

/**
 * GET /api/employees/performance?writerEmail=nr@devco-inc.com&writerName=Nick+Rossi
 * 
 * 1. Gets ALL proposal numbers where this email is a proposalWriter (from Estimate collection)
 * 2. Filters WIP projects to only those with matching proposalNumbers
 * 3. Computes financial KPIs and a 0-100 performance score
 */
export async function GET(req: NextRequest) {
    try {
        const writerEmail = req.nextUrl.searchParams.get('writerEmail') || '';
        const writerName  = req.nextUrl.searchParams.get('writerName')  || '';

        if (!writerEmail && !writerName) {
            return NextResponse.json({ error: 'writerEmail or writerName is required' }, { status: 400 });
        }

        // ── Step 1: Find ALL proposal numbers where this person is a writer ──
        // Query the Estimate collection directly for the email
        await connectToDatabase();
        const { default: Estimate } = await import('@/lib/models/Estimate');

        // proposalWriter can be a string or array — match by email
        const emailQuery = writerEmail
            ? { proposalWriter: writerEmail }
            : { proposalWriter: { $regex: writerName, $options: 'i' } };

        const estimates = await Estimate.find(
            emailQuery,
            { estimate: 1, _id: 0 }
        ).lean();

        const writerProposalNumbers = new Set<string>();
        estimates.forEach((e: any) => {
            if (e.estimate) writerProposalNumbers.add(e.estimate);
        });

        if (writerProposalNumbers.size === 0) {
            return NextResponse.json({ isWriter: false, projects: [], kpis: null });
        }

        // ── Step 2: Get WIP projects and filter by those proposal numbers ──
        const allProjects = await getCachedWipCalculations() as any[];

        const myProjects = allProjects.filter((p: any) =>
            p.proposalNumber && writerProposalNumbers.has(p.proposalNumber)
        );

        if (!myProjects.length) {
            return NextResponse.json({ isWriter: false, projects: [], kpis: null });
        }

        // ── Step 3: Compute KPIs ────────────────────────────────────────────
        const sum = (key: string) => myProjects.reduce((s: number, p: any) => s + (Number(p[key]) || 0), 0);

        const income         = sum('income');
        const qbCost         = sum('qbCost');
        const jobTicketCost  = sum('devcoCost');
        const totalCost      = qbCost + jobTicketCost;
        const profit         = income - totalCost;
        const marginPct      = income > 0 ? (profit / income) * 100 : 0;
        const arOutstanding  = sum('ar');
        const payables       = sum('ap');
        const originalContract = sum('originalContract');
        const changeOrders   = sum('changeOrders');
        const contractValue  = originalContract + changeOrders;
        const backlog        = Math.max(0, contractValue - income);
        const pctComplete    = contractValue > 0 ? Math.min(100, (income / contractValue) * 100) : 0;
        const avgProjectSize = myProjects.length > 0 ? contractValue / myProjects.length : 0;
        const dso            = income > 0 ? Math.round((arOutstanding / income) * 365) : 0;
        const collectedPct   = income > 0 ? ((income - arOutstanding) / income) * 100 : 0;

        // Per-project margin list for ranking
        const projectMargins = myProjects.map((p: any) => {
            const inc  = p.income || 0;
            const cost = (p.qbCost || 0) + (p.devcoCost || 0);
            const gp   = inc - cost;
            const mg   = inc > 0 ? (gp / inc) * 100 : 0;
            return { name: p.DisplayName || p.name || '', income: inc, cost, profit: gp, margin: mg, ar: p.ar || 0, proposalNumber: p.proposalNumber };
        }).sort((a, b) => b.profit - a.profit);

        // ── Step 4: Performance Score (0-100) ───────────────────────────────
        const marginScore     = Math.min(100, Math.max(0, marginPct * 2.5));
        const collectionScore = Math.min(100, Math.max(0, collectedPct));
        const dsoScore        = Math.min(100, Math.max(0, 100 - (dso / 90) * 100));
        const volumeScore     = Math.min(100, Math.log10(Math.max(1, income)) * 14);
        const completionScore = Math.min(100, Math.max(0, pctComplete));

        const performanceScore = Math.round(
            marginScore     * 0.35 +
            collectionScore * 0.20 +
            dsoScore        * 0.15 +
            volumeScore     * 0.15 +
            completionScore * 0.15
        );

        const grade =
            performanceScore >= 85 ? { label: 'Excellent', color: 'emerald' } :
            performanceScore >= 70 ? { label: 'Good',      color: 'blue'    } :
            performanceScore >= 50 ? { label: 'Average',   color: 'amber'   } :
                                     { label: 'Needs Work', color: 'red'    };

        return NextResponse.json({
            isWriter: true,
            projectCount: myProjects.length,
            performanceScore,
            grade,
            kpis: {
                income, qbCost, jobTicketCost, totalCost, profit, marginPct,
                arOutstanding, payables, contractValue, backlog, pctComplete,
                avgProjectSize, dso, collectedPct,
                originalContract, changeOrders,
            },
            scores: { marginScore, collectionScore, dsoScore, volumeScore, completionScore },
            topProjects:  projectMargins.slice(0, 5),
            lossProjects: projectMargins.filter(p => p.profit < 0).slice(0, 5),
        });
    } catch (err: any) {
        console.error('[Employee Performance]', err);
        return NextResponse.json({ error: err?.message || 'Failed' }, { status: 500 });
    }
}
