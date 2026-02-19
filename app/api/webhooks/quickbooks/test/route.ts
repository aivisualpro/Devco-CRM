import { NextRequest, NextResponse } from 'next/server';
import { qboQuery, QBO_REALM_ID, BASE_URL } from '@/lib/quickbooks';
import { connectToDatabase } from '@/lib/db';
import { DevcoQuickBooks } from '@/lib/models';
import { syncProjectToDb } from '@/lib/qbo-sync';

// Debug endpoint: GET /api/webhooks/quickbooks/test?search=Laguna
export async function GET(req: NextRequest) {
    const entityId = req.nextUrl.searchParams.get('entityId');
    const search = req.nextUrl.searchParams.get('search') || '0534';

    try {
        await connectToDatabase();

        const diagnostics: any = {
            realmId: QBO_REALM_ID,
            baseUrl: BASE_URL,
            timestamp: new Date().toISOString(),
        };

        // 1. Show DB records matching the search term to find the real project ID
        const dbProjects = await DevcoQuickBooks.find({
            $or: [
                { project: { $regex: search, $options: 'i' } },
                { proposalNumber: { $regex: search, $options: 'i' } }
            ]
        }).limit(5).lean();

        diagnostics.dbProjects = dbProjects.map((p: any) => ({
            _id: p._id,
            projectId: p.projectId,
            project: p.project,
            customer: p.customer,
            proposalNumber: p.proposalNumber,
            status: p.status,
        }));

        // 2. If entityId provided, check if it exists in QBO
        if (entityId) {
            try {
                const raw = await qboQuery(`SELECT * FROM Customer WHERE Id = '${entityId}'`);
                const customer = raw.QueryResponse?.Customer?.[0];
                diagnostics.qboLookup = {
                    entityId,
                    found: !!customer,
                    data: customer ? {
                        Id: customer.Id,
                        DisplayName: customer.DisplayName,
                        Job: customer.Job,
                        IsProject: customer.IsProject,
                    } : null,
                };
            } catch (err: any) {
                diagnostics.qboLookup = { entityId, error: err.message };
            }
        }

        // 3. If we found a DB project, try looking it up in QBO using the stored projectId
        if (dbProjects.length > 0) {
            const dbProjectId = (dbProjects[0] as any).projectId;
            diagnostics.dbProjectIdUsed = dbProjectId;
            
            try {
                const raw = await qboQuery(`SELECT * FROM Customer WHERE Id = '${dbProjectId}'`);
                const customer = raw.QueryResponse?.Customer?.[0];
                diagnostics.qboLookupByDbId = {
                    found: !!customer,
                    data: customer ? {
                        Id: customer.Id,
                        DisplayName: customer.DisplayName,
                        Job: customer.Job,
                        IsProject: customer.IsProject,
                        Active: customer.Active,
                    } : null,
                };

                // 4. If found, try a full sync
                if (customer) {
                    try {
                        const result = await syncProjectToDb(dbProjectId);
                        diagnostics.syncResult = {
                            success: true,
                            projectName: result.project || result.DisplayName,
                        };
                    } catch (err: any) {
                        diagnostics.syncResult = { success: false, error: err.message };
                    }
                }
            } catch (err: any) {
                diagnostics.qboLookupByDbId = { error: err.message };
            }
        }

        return NextResponse.json(diagnostics, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
