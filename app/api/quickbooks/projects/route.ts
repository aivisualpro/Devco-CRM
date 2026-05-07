import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DevcoQuickBooks } from '@/lib/models';
import { unstable_cache } from 'next/cache';

// Raw computation — can be called directly to bypass cache
export async function computeWipCalculations() {
        await connectToDatabase();

        console.log('Fetching QuickBooks projects from MongoDB...');

        // Use MongoDB aggregation to compute Invoice income server-side
        // (avoids pulling full transaction arrays — runs entirely in MongoDB)
        const projects = await DevcoQuickBooks.aggregate([
            { $addFields: {
                invoiceIncome: {
                    $reduce: {
                        input: { $filter: {
                            input: { $ifNull: ['$transactions', []] },
                            as: 'tx',
                            cond: { $eq: ['$$tx.transactionType', 'Invoice'] }
                        }},
                        initialValue: 0,
                        in: { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] }
                    }
                },
                costTypeSum: {
                    $reduce: {
                        input: { $filter: {
                            input: { $ifNull: ['$transactions', []] },
                            as: 'tx',
                            cond: { $in: ['$$tx.transactionType', ['Expense', 'Check', 'Payroll Check', 'Bill']] }
                        }},
                        initialValue: 0,
                        in: { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] }
                    }
                },
                paymentSum: {
                    $reduce: {
                        input: { $filter: {
                            input: { $ifNull: ['$transactions', []] },
                            as: 'tx',
                            // Payment = Invoice transactions that are explicitly Paid.
                            // Do NOT count 'Cleared' — that's the P&L default for ALL
                            // transactions and doesn't indicate actual payment status.
                            cond: { $and: [
                                { $eq: ['$$tx.transactionType', 'Invoice'] },
                                // Case-insensitive exact match for 'paid'
                                { $eq: [{ $trim: { input: { $toLower: { $ifNull: ['$$tx.status', ''] } } } }, 'paid'] }
                            ]}
                        }},
                        initialValue: 0,
                        in: { $add: ['$$value', { $abs: { $ifNull: ['$$this.amount', 0] } }] }
                    }
                },
                payablesSum: {
                    $reduce: {
                        input: { $filter: {
                            input: { $ifNull: ['$transactions', []] },
                            as: 'tx',
                            // A/P = unpaid cost-type transactions (Open/Overdue).
                            // Uses ALL cost types to match the detail-view fallback behaviour.
                            // Default missing status to 'open' and do case-insensitive match.
                            cond: { $and: [
                                { $in: ['$$tx.transactionType', ['Expense', 'Check', 'Payroll Check', 'Bill']] },
                                { $in: [{ $trim: { input: { $toLower: { $ifNull: ['$$tx.status', 'open'] } } } }, ['open', 'overdue']] }
                            ]}
                        }},
                        initialValue: 0,
                        in: { $add: ['$$value', { $abs: { $ifNull: ['$$this.amount', 0] } }] }
                    }
                }
            }},
            // Join schedules to compute total site/drive hours per project (by estimateNumber)
            { $lookup: {
                from: 'devcoschedules',
                let: { propNum: '$proposalNumber' },
                pipeline: [
                    { $match: { $expr: {
                        $and: [
                            { $ne: ['$$propNum', null] },
                            { $regexMatch: { input: { $ifNull: ['$estimate', ''] }, regex: '$$propNum', options: 'i' } }
                        ]
                    }} },
                    { $project: { timesheet: 1 } }
                ],
                as: '_schedDocs'
            }},
            { $addFields: {
                _totalSiteHours: {
                    $reduce: {
                        input: '$_schedDocs',
                        initialValue: 0,
                        in: {
                            $add: ['$$value', {
                                $reduce: {
                                    input: { $filter: {
                                        input: { $ifNull: ['$$this.timesheet', []] },
                                        as: 'ts',
                                        cond: { $and: [
                                            { $gt: [{ $ifNull: ['$$ts.hours', 0] }, 0] },
                                            { $not: { $regexMatch: { input: { $toLower: { $ifNull: ['$$ts.type', ''] } }, regex: 'drive' } } }
                                        ]}
                                    }},
                                    initialValue: 0,
                                    in: { $add: ['$$value', { $ifNull: ['$$this.hours', 0] }] }
                                }
                            }]
                        }
                    }
                },
                _payrollCost: {
                    $reduce: {
                        input: { $filter: {
                            input: { $ifNull: ['$transactions', []] },
                            as: 'tx',
                            cond: { $eq: ['$$tx.transactionType', 'Payroll Check'] }
                        }},
                        initialValue: 0,
                        in: { $add: ['$$value', { $ifNull: ['$$this.amount', 0] }] }
                    }
                }
            }},
            { $project: { transactions: 0, _schedDocs: 0 } },
            { $sort: { createdAt: -1 as 1 | -1 } }
        ]);

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

        // Resolve proposal writer emails → names via Employee collection
        const allWriterEmails = new Set<string>();
        estimateDataMap.forEach(data => {
            data.proposalWriters.forEach(w => { if (w) allWriterEmails.add(w); });
        });

        let writerNameMap = new Map<string, string>();
        if (allWriterEmails.size > 0) {
            const { default: Employee } = await import('@/lib/models/Employee');
            const employees = await Employee.find(
                { _id: { $in: Array.from(allWriterEmails) } },
                { _id: 1, firstName: 1, lastName: 1 }
            ).lean();
            employees.forEach((emp: any) => {
                const name = [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim();
                if (name) writerNameMap.set(emp._id, name);
            });
        }

        // Replace emails with resolved names in the estimateDataMap
        estimateDataMap.forEach(data => {
            data.proposalWriters = data.proposalWriters.map(email =>
                writerNameMap.get(email) || email
            );
        });

        // Map MongoDB projects to the format expected by the UI
        return projects.map(p => {
            // invoiceIncome & costTypeSum are pre-computed by the aggregation pipeline
            const income = (p as any).invoiceIncome > 0 ? (p as any).invoiceIncome : (p.income || 0);

            // Cost: always use costTypeSum (sum of cost-type transactions) so the
            // WIP list "Cost of Revenue Earned" matches the project detail QB Cost box.
            // Both views now derive cost from the same transaction data.
            const qbCost = (p as any).costTypeSum || 0;

            // devcoCost = Job Ticket cost, pre-computed during Sync
            const devcoCost = p.devcoCost || 0;
            const totalProjectCost = qbCost + devcoCost;
            const payment = (p as any).paymentSum || 0;
            // A/R = Income - Payment. Uses the same `income` variable shown
            // in the Revenue column so the math always holds as displayed.
            const ar = Math.max(0, income - payment);
            const ap = (p as any).payablesSum || 0;

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
                qbCost,
                devcoCost,
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
                Balance: 0,
                ar,
                ap,
                // Labor cost-per-hour (payroll cost ÷ pre-stored site hours from schedules)
                avgCostPerHr: (() => {
                    const siteHrs = (p as any)._totalSiteHours || 0;
                    const payroll = (p as any)._payrollCost || 0;
                    return siteHrs > 0 && payroll > 0 ? Math.round(payroll / siteHrs) : 0;
                })()
            };
        });
}

// Cached wrapper — used by default GET requests
export const getCachedWipCalculations = unstable_cache(
    computeWipCalculations,
    ['wip-calculations'],
    { tags: ['wip-calculations'], revalidate: 30 }
);
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const forceRefresh = url.searchParams.get('refresh') === 'true';

        // When refresh=true (e.g. after sync), bypass unstable_cache entirely
        // and run the aggregation live to guarantee fresh A/R, A/P, etc.
        // revalidateTag alone is unreliable in dev mode.
        let formattedProjects;
        if (forceRefresh) {
            formattedProjects = await computeWipCalculations();
        }
        if (!formattedProjects) {
            formattedProjects = await getCachedWipCalculations();
        }

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
