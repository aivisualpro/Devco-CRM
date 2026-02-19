import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DevcoQuickBooks } from '@/lib/models';
import { getProjects, getSingleProject } from '@/lib/quickbooks';

export async function POST(req: Request) {
    try {
        await connectToDatabase();

        // Parse request body for optional projectId
        let projectId: string | null = null;
        try {
            const body = await req.json();
            projectId = body.projectId || null;
        } catch (e) {
            // No body or invalid JSON, ignore
        }

        console.log(projectId ? `Starting QuickBooks to MongoDB sync for project ${projectId}...` : 'Starting QuickBooks to MongoDB sync for all projects...');

        // 1. Fetch live project(s) from QuickBooks
        let liveProjects = [];
        try {
            if (projectId) {
                const singleProject = await getSingleProject(projectId);
                liveProjects = [singleProject];
            } else {
                // LIGHTWEIGHT BULK SYNC: Only fetch basic project metadata (single QBO API call).
                // This avoids Vercel 504 timeouts caused by fetching profitability + transactions
                // for every project. Per-project financials are fetched on-demand or via individual sync.
                const projects = await getProjects();
                console.log(`[QBO-SYNC] Lightweight bulk sync: fetched ${projects.length} projects (metadata only)`);
                liveProjects = projects;
            }
        } catch (error: any) {
            throw error;
        }

        console.log(`Fetched ${liveProjects.length} live project(s) from QuickBooks`);

        let addedCount = 0;
        let updatedCount = 0;

        // 2. Process each project
        for (const lp of liveProjects) {
            const updateData = {
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
                    memo: t.memo
                }))
            };

            // Extract Proposal Number from project name (digits before _)
            const projectName = lp.project || lp.DisplayName || '';
            const proposalMatch = projectName.match(/^([^_]+)_/);
            const extractedProposalNumber = proposalMatch ? proposalMatch[1].trim() : undefined;

            const existingProject = await DevcoQuickBooks.findOne({ projectId: lp.Id });
            
            // Only update proposalNumber if it's a new project or current proposalNumber is empty
            const finalUpdateData: any = { ...updateData };
            if (extractedProposalNumber && (!existingProject || !existingProject.proposalNumber)) {
                finalUpdateData.proposalNumber = extractedProposalNumber;
            }

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
