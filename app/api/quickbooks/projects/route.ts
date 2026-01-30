import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DevcoQuickBooks, Schedule } from '@/lib/models';

export async function GET() {
    try {
        await connectToDatabase();
        
        console.log('Fetching QuickBooks projects from MongoDB...');
        
        // Fetch projects from MongoDB and sort by newest first
        const projects = await DevcoQuickBooks.find({}).sort({ createdAt: -1 });

        // Fetch matching estimates to get contract amounts, writers, and change orders
        const proposalNumbers = projects.map(p => p.proposalNumber).filter((n): n is string => !!n);
        
        const { default: Estimate } = await import('@/lib/models/Estimate');
        
        const allRelatedEstimates = await Estimate.find({
            estimate: { $in: proposalNumbers }
        } as any, { _id: 1, estimate: 1, grandTotal: 1, subTotal: 1, proposalWriter: 1, isChangeOrder: 1, versionNumber: 1, status: 1 });

        // Map proposalNumber -> { originalContract, changeOrders, writers, slug }
        const estimateDataMap = new Map();
        
        allRelatedEstimates.forEach(e => {
            if (!e.estimate) return;
            
            if (!estimateDataMap.has(e.estimate)) {
                estimateDataMap.set(e.estimate, {
                    originalContract: 0,
                    originalContractCost: 0,
                    changeOrdersTotal: 0,
                    proposalWriters: [] as string[],
                    latestVersion: -1,
                    estimateId: e._id
                });
            }
            
            const data = estimateDataMap.get(e.estimate);
            
            if (e.isChangeOrder) {
                const status = (e.status || '').toLowerCase();
                if (status === 'completed' || status === 'won') {
                    data.changeOrdersTotal += (e.grandTotal || 0);
                }
            } else {
                // If it's a normal estimate, we want the latest version for original contract amount and writers
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

        const allRelatedSchedules = await Schedule.find({
            estimate: { $in: proposalNumbers }
        } as any, { estimate: 1, djt: 1 });

        const devcoCostMap = new Map();
        allRelatedSchedules.forEach(s => {
            if (!s.estimate) return;
            const cost = s.djt?.djtCost || 0;
            devcoCostMap.set(s.estimate, (devcoCostMap.get(s.estimate) || 0) + cost);
        });

        // Map MongoDB projects to the format expected by the UI
        const formattedProjects = projects.map(p => {
            const transactions = (p as any).transactions || [];
            let income = 0;
            let qbCost = 0;

            transactions.forEach((t: any) => {
                const amount = t.amount || 0;
                if (t.transactionType?.toLowerCase() === 'invoice') {
                    income += amount;
                } else {
                    qbCost += amount;
                }
            });

            const estData = p.proposalNumber ? estimateDataMap.get(p.proposalNumber) : null;
            const proposalSlug = p.proposalNumber ? (estData?.latestVersion > 0 ? `${p.proposalNumber}-V${estData.latestVersion}` : estData?.estimateId) : null;
            
            const devcoCost = p.proposalNumber ? (devcoCostMap.get(p.proposalNumber) || 0) : 0;
            const totalProjectCost = qbCost + devcoCost;

            return {
                Id: p.projectId,
                DisplayName: p.project,
                CompanyName: p.customer,
                FullyQualifiedName: `${p.customer}:${p.project}`,
                MetaData: { CreateTime: p.startDate || p.createdAt },
                income, // Revenue Earned to Date
                cost: totalProjectCost,   // Cost of Revenue Earned (QB Cost + Devco Cost)
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

        console.log(`Found ${formattedProjects.length} projects in MongoDB`);
        return NextResponse.json(formattedProjects);
    } catch (error: any) {
        console.error('Error fetching QuickBooks projects from MongoDB:', error);
        return NextResponse.json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
