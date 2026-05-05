/**
 * Touching QBO fields? Update /lib/qbo-sync-contract.ts FIRST.
 */
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DevcoQuickBooks } from '@/lib/models';
import { getProjects, getSingleProject, getProjectProfitability, getAccessToken } from '@/lib/quickbooks';
import { BASE_URL, QBO_REALM_ID } from '@/lib/quickbooks';
import { QBO_OWNED_FIELDS, MERGE_RULES } from '@/lib/qbo-sync-contract';

// Extend Vercel function timeout to max allowed (300s for Pro, 60s for Hobby)
export const maxDuration = 300;

export async function POST(req: Request) {
    try {
        await connectToDatabase();

        const url = new URL(req.url);
        const mode = url.searchParams.get('mode');
        
        let projectId = url.searchParams.get('projectId');
        if (!projectId) {
            try {
                const body = await req.json();
                projectId = body.projectId || null;
            } catch (e) {
                // No body or invalid JSON, ignore
            }
        }

        // Enforce bulk sync auth guard (Temporarily disabled for UI testing)
        if (mode === 'full' || (!mode && !projectId)) {
            // const authHeader = req.headers.get('Authorization');
            // if (authHeader !== `Bearer ${process.env.ADMIN_SECRET || 'ADMIN_SECRET'}`) {
            //     return NextResponse.json({ success: false, error: 'Unauthorized bulk sync' }, { status: 401 });
            // }
        }

        console.log(projectId ? `Starting QuickBooks to MongoDB sync for project ${projectId}...` : 'Starting QuickBooks to MongoDB sync for all projects...');

        // 1. Fetch live project(s) from QuickBooks
        let liveProjects = [];
        try {
            if (projectId) {
                const singleProject = await getSingleProject(projectId);
                liveProjects = [singleProject];
            } else {
                // For bulk sync, get projects first
                const projects = await getProjects();

                // Process projects in batches to fetch transactions using reports
                const batchSize = 5; // Reduced batch size to minimize rate limiting
                const processedProjects = [];
                const rateLimitDelay = 1000; // 1 second delay between batches

                for (let i = 0; i < projects.length; i += batchSize) {
                    const batch = projects.slice(i, i + batchSize);
                    console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(projects.length / batchSize)} (${batch.length} projects)`);

                    const batchPromises = batch.map(async (project) => {
                        try {
                            // Add delay between individual project requests to avoid rate limiting
                            await new Promise(resolve => setTimeout(resolve, 200));

                            // Fetch transactions using the same method as getSingleProject
                            const profitability = await getProjectProfitability(project.Id);

                            let transactionsData: any[] = [];
                            try {
                                const accessToken = await getAccessToken();
                                const reportUrl = `${BASE_URL}/v3/company/${QBO_REALM_ID}/reports/ProfitAndLossDetail?customer=${project.Id}&date_macro=All&minorversion=70`;

                                const reportResponse = await fetch(reportUrl, {
                                    headers: {
                                        'Authorization': `Bearer ${accessToken}`,
                                        'Accept': 'application/json',
                                    },
                                    cache: 'no-store'
                                });

                                if (reportResponse.ok) {
                                    const reportData = await reportResponse.json();

                                    const parseAmount = (val: any) => parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
                                    const transactionsMap = new Map<string, any>();

                                    const traverseRows = (rows: any[]) => {
                                        for (const row of rows) {
                                            if (row.type === 'Data' && row.ColData) {
                                                const getValue = (idx: number) => (row.ColData[idx]?.value) || "";
                                                const getId = (idx: number) => (row.ColData[idx]?.id) || null;

                                                const date = getValue(0);
                                                const type = getValue(1);
                                                const txnIdRaw = getId(1);
                                                const num = getValue(2);
                                                const name = getValue(3);
                                                const memo = getValue(4);
                                                const split = getValue(5);
                                                const amountRaw = getValue(6);
                                                const amount = parseAmount(amountRaw);

                                                const groupKey = txnIdRaw || `${date}_${type}_${num}_${amount}`;

                                                if (!transactionsMap.has(groupKey)) {
                                                    transactionsMap.set(groupKey, {
                                                        id: txnIdRaw || `report-${groupKey}`,
                                                        date,
                                                        type,
                                                        no: num,
                                                        from: name,
                                                        memo: "",
                                                        split: "",
                                                        amount: 0,
                                                        status: 'Cleared'
                                                    });
                                                }

                                                const tx = transactionsMap.get(groupKey);
                                                tx.amount += amount;
                                                if (memo && memo.length > (tx.memo?.length || 0)) tx.memo = memo;
                                                if (split && split.length > (tx.split?.length || 0)) tx.split = split;
                                                if (!tx.no && num) tx.no = num;
                                                if (!tx.from && name) tx.from = name;
                                            } else if (row.Rows?.Row) {
                                                traverseRows(row.Rows.Row);
                                            }
                                        }
                                    };

                                    if (reportData.Rows?.Row) {
                                        traverseRows(reportData.Rows.Row);
                                    }

                                    transactionsData = Array.from(transactionsMap.values());
                                    console.log(`Project ${project.Id}: Parsed ${transactionsData.length} transactions from ProfitAndLossDetail report`);
                                } else if (reportResponse.status === 429) {
                                    console.log(`ProfitAndLossDetail report failed for project ${project.Id}: 429 Too Many Requests - Rate limited`);
                                    // Return empty transactions but continue processing
                                    transactionsData = [];
                                } else {
                                    console.log(`ProfitAndLossDetail report failed for project ${project.Id}: ${reportResponse.status}`);
                                }
                            } catch (e) {
                                console.log('Error fetching ProfitAndLossDetail report for project', project.Id, ':', e);
                            }

                            return {
                                ...project,
                                income: profitability.income,
                                cost: profitability.cost,
                                profitMargin: profitability.profitMargin,
                                transactions: transactionsData
                            };
                        } catch (error) {
                            console.error(`Error processing project ${project.Id}:`, error);
                            return {
                                ...project,
                                income: 0,
                                cost: 0,
                                profitMargin: 0,
                                transactions: []
                            };
                        }
                    });

                    const batchResults = await Promise.all(batchPromises);
                    processedProjects.push(...batchResults);

                    // Add delay between batches to avoid rate limiting
                    if (i + batchSize < projects.length) {
                        console.log(`Waiting ${rateLimitDelay}ms before next batch to avoid rate limiting...`);
                        await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
                    }
                }

                liveProjects = processedProjects;
            }
        } catch (error: any) {
            throw error;
        }

        console.log(`Fetched ${liveProjects.length} live project(s) from QuickBooks`);

        // Pre-compute devcoCost from Schedules so it can be stored on each project document.
        // This prevents the projects API from ever needing to query the Schedules collection.
        const allProposalNumbers = liveProjects
            .map((lp: any) => (lp.project || lp.DisplayName || '').match(/^([^_]+)_/)?.[1]?.trim())
            .filter(Boolean);

        let devcoCostMap = new Map<string, number>();
        try {
            const { default: OverheadItem } = await import('@/lib/models/OverheadItem');
            const { Schedule, DailyJobTicket } = await import('@/lib/models');
            const overheads = await OverheadItem.find({}).lean();
            const getOverheadCost = (name: string) => {
                const item = (overheads as any[]).find(c => (c.overhead || '').trim().toLowerCase() === name.toLowerCase());
                return Number(item?.dailyRate) || 0;
            };
            const overheadRate = getOverheadCost('Devco Overhead') + getOverheadCost('Risk Factor');

            // Source of truth: dailyjobtickets collection
            const schedules = await (Schedule as any).find(
                { estimate: { $in: allProposalNumbers } },
                { estimate: 1, _id: 1 }
            ).lean();

            const scheduleIds = schedules.map((s: any) => String(s._id));
            const djts = await DailyJobTicket.find(
                { schedule_id: { $in: scheduleIds } },
                { schedule_id: 1, djtCost: 1 }
            ).lean();
            const djtByScheduleId = new Map(djts.map((d: any) => [String(d.schedule_id), d]));

            schedules.forEach((s: any) => {
                if (!s.estimate) return;
                const djt = djtByScheduleId.get(String(s._id));
                const equipmentCost = djt ? (Number(djt.djtCost) || 0) : 0;
                const hasDjt = !!djt;
                const ticketCost = hasDjt ? equipmentCost + overheadRate : 0;
                devcoCostMap.set(s.estimate, (devcoCostMap.get(s.estimate) || 0) + ticketCost);
            });
            console.log(`Built devcoCostMap for ${devcoCostMap.size} proposals`);
        } catch (e) {
            console.warn('Could not compute devcoCost during sync:', e);
        }

        let addedCount = 0;
        let updatedCount = 0;

        // 2. Process each project
        for (const lp of liveProjects) {
            const updateData: any = {
                project: lp.project || lp.DisplayName,
                customer: lp.customer || lp.CompanyName || lp.FullyQualifiedName.split(':')[0],
                startDate: lp.MetaData?.CreateTime ? new Date(lp.MetaData.CreateTime) : undefined,
                status: lp.status,
                transactions: (lp.transactions || []).map((t: any) => ({
                    transactionId: t.id,
                    date: t.date ? new Date(t.date) : new Date(),
                    transactionType: t.type,
                    split: '', 
                    fromTo: t.from,
                    projectId: lp.Id,
                    amount: t.amount,
                    memo: t.memo,
                    status: t.status || 'Paid',
                    no: t.no || ''
                })),
                income: lp.income || 0,
                qbCost: lp.cost || 0
            };

            // Extract Proposal Number from project name (digits before _)
            const projectName = lp.project || lp.DisplayName || '';
            const proposalMatch = projectName.match(/^([^_]+)_/);
            const extractedProposalNumber = proposalMatch ? proposalMatch[1].trim() : undefined;

            // Add pre-computed devcoCost so the projects API never needs to query Schedules
            const devcoCost = extractedProposalNumber ? (devcoCostMap.get(extractedProposalNumber) || 0) : 0;

            const existingProject = await DevcoQuickBooks.findOne({ projectId: lp.Id });

            const finalUpdateData: any = {};

            // Only set QBO owned fields that are present
            for (const field of QBO_OWNED_FIELDS) {
                if (updateData[field] !== undefined) {
                    finalUpdateData[field] = updateData[field];
                }
            }

            if (MERGE_RULES.transactions === 'replaceAll') {
                finalUpdateData.transactions = updateData.transactions;
            }
            
            if (MERGE_RULES.proposalNumber === 'fillOnlyIfEmpty') {
                if (extractedProposalNumber && (!existingProject || !existingProject.proposalNumber)) {
                    finalUpdateData.proposalNumber = extractedProposalNumber;
                }
            }

            // Always save the freshly computed devcoCost
            finalUpdateData.devcoCost = devcoCost;

            const result = await DevcoQuickBooks.findOneAndUpdate(
                { projectId: lp.Id },
                { $set: finalUpdateData },
                { upsert: true, new: true, runValidators: true }
            );

            if (result && result.createdAt && result.updatedAt && result.createdAt.getTime() === result.updatedAt.getTime()) {
                addedCount++;
            } else if (result) {
                updatedCount++;
            }

        }

        console.log(`Sync complete. Added: ${addedCount}, Updated: ${updatedCount}`);
        
        return NextResponse.json({ 
            success: true, 
            message: `Sync complete. ${projectId ? 'Project updated.' : `Found ${liveProjects.length} live projects. Added: ${addedCount}, Updated: ${updatedCount}`}`,
            stats: { totalFound: liveProjects.length, added: addedCount, updated: updatedCount }
        });
    } catch (error: any) {
        console.error('QuickBooks Sync Error:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}
