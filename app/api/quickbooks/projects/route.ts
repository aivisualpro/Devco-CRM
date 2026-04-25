import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DevcoQuickBooks } from '@/lib/models';
import { unstable_cache } from 'next/cache';

const getCachedWipCalculations = unstable_cache(
    async () => {
        await connectToDatabase();

        console.log('Fetching QuickBooks projects from MongoDB...');

        // Fetch projects excluding the massive transactions array (not needed here).
        // income, qbCost, and devcoCost are pre-computed and stored directly on
        // each document during Sync, so no Schedule/OverheadItem queries needed.
        const projects = await DevcoQuickBooks.find({})
            .select('-transactions')
            .sort({ createdAt: -1 })
            .lean();

        console.log(`Fetched ${projects.length} projects from DevcoQuickBooks`);

        // Fetch matching estimates to get contract amounts, writers, and change orders
        const proposalNumbers = projects
            .map(p => p.proposalNumber)
            .filter((n): n is string => !!n);

        const { default: Estimate } = await import('@/lib/models/Estimate');

        const allRelatedEstimates = await Estimate.find(
            { estimate: { $in: proposalNumbers } } as any,
            { _id: 1, estimate: 1, grandTotal: 1, subTotal: 1, proposalWriter: 1, isChangeOrder: 1, versionNumber: 1, status: 1 }
        ).lean();

        // Map proposalNumber -> { originalContract, changeOrders, writers, estimateId }
        const estimateDataMap = new Map<string, {
            originalContract: number;
            originalContractCost: number;
            changeOrdersTotal: number;
            proposalWriters: string[];
            latestVersion: number;
            estimateId: any;
        }>();

        allRelatedEstimates.forEach((e: any) => {
            if (!e.estimate) return;

            if (!estimateDataMap.has(e.estimate)) {
                estimateDataMap.set(e.estimate, {
                    originalContract: 0,
                    originalContractCost: 0,
                    changeOrdersTotal: 0,
                    proposalWriters: [],
                    latestVersion: -1,
                    estimateId: e._id
                });
            }

            const data = estimateDataMap.get(e.estimate)!;

            if (e.isChangeOrder) {
                const status = (e.status || '').toLowerCase();
                if (status === 'completed' || status === 'won') {
                    data.changeOrdersTotal += (e.grandTotal || 0);
                }
            } else {
                if ((e.versionNumber || 0) > data.latestVersion) {
                    data.originalContract = e.grandTotal || 0;
                    data.originalContractCost = e.subTotal || 0;
                    data.latestVersion = e.versionNumber || 0;
                    data.estimateId = e._id;

                    const writers = Array.isArray(e.proposalWriter)
                        ? e.proposalWriter
                        : e.proposalWriter ? [e.proposalWriter] : [];
                    data.proposalWriters = writers;
                }
            }
        });

        // Map MongoDB projects to the format expected by the UI
        return projects.map(p => {
            const income = p.income || 0;
            const qbCost = p.qbCost || 0;
            // devcoCost is pre-computed during Sync and stored directly on the document
            const devcoCost = p.devcoCost || 0;
            const totalProjectCost = qbCost + devcoCost;

            const estData = p.proposalNumber ? estimateDataMap.get(p.proposalNumber) : null;
            const proposalSlug = p.proposalNumber
                ? (estData && estData.latestVersion > 0
                    ? `${p.proposalNumber}-V${estData.latestVersion}`
                    : estData?.estimateId)
                : null;

            return {
                Id: p.projectId,
                DisplayName: p.project,
                CompanyName: p.customer,
                FullyQualifiedName: `${p.customer}:${p.project}`,
                MetaData: { CreateTime: p.startDate || p.createdAt },
                income,
                cost: totalProjectCost,
                profitMargin: income > 0 ? Math.round(((income - totalProjectCost) / income) * 100) : 0,
                status: p.status,
                proposalNumber: p.proposalNumber,
                proposalSlug,
                proposalWriters: estData?.proposalWriters || [],
                originalContract: (p as any).manualOriginalContract ?? estData?.originalContract ?? 0,
                originalContractCost: estData?.originalContractCost || 0,
                changeOrders: (p as any).manualChangeOrders ?? estData?.changeOrdersTotal ?? 0,
                estOriginalContract: estData?.originalContract || 0,
                estChangeOrders: estData?.changeOrdersTotal || 0,
                isManualOriginalContract: (p as any).manualOriginalContract !== undefined && (p as any).manualOriginalContract !== null,
                isManualChangeOrders: (p as any).manualChangeOrders !== undefined && (p as any).manualChangeOrders !== null,
                startDate: p.startDate,
                endDate: p.endDate,
                Active: true,
                CurrencyRef: { value: 'USD' },
                Balance: 0
            };
        });
    },
    ['wip-calculations'],
    { tags: ['wip-calculations'], revalidate: 300 }
);
export async function GET() {
    try {
        const formattedProjects = await getCachedWipCalculations();
        console.log(`Returning ${formattedProjects.length} formatted projects`);
        return NextResponse.json(formattedProjects);
    } catch (error: any) {
        console.error('Error fetching QuickBooks projects from MongoDB:', error);
        return NextResponse.json({
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
