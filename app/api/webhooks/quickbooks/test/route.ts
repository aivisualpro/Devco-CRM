import { NextRequest, NextResponse } from 'next/server';
import { qboQuery, QBO_REALM_ID, BASE_URL } from '@/lib/quickbooks';

// Debug endpoint: GET /api/webhooks/quickbooks/test?entityId=772917373
export async function GET(req: NextRequest) {
    const entityId = req.nextUrl.searchParams.get('entityId');

    try {
        const diagnostics: any = {
            realmId: QBO_REALM_ID,
            baseUrl: BASE_URL,
            qboIsProduction: process.env.QBO_IS_PRODUCTION,
            nodeEnv: process.env.NODE_ENV,
            timestamp: new Date().toISOString(),
        };

        // Query 1: Simple customer query WITHOUT IsProject (to test basic connectivity)
        if (entityId) {
            try {
                const simpleResult = await qboQuery(`SELECT Id, DisplayName, FullyQualifiedName, Job, Active FROM Customer WHERE Id = '${entityId}'`);
                diagnostics.simpleQuery = {
                    success: true,
                    customer: simpleResult.QueryResponse?.Customer?.[0] || null,
                    totalCount: simpleResult.QueryResponse?.totalCount || 0
                };
            } catch (err: any) {
                diagnostics.simpleQuery = { success: false, error: err.message };
            }
        }

        // Query 2: Try with IsProject - the one that failed before
        try {
            const projectQuery = await qboQuery(`SELECT Id, DisplayName, Job FROM Customer WHERE Job = true MAXRESULTS 5`);
            diagnostics.jobQuery = {
                success: true,
                results: projectQuery.QueryResponse?.Customer?.map((c: any) => ({
                    Id: c.Id,
                    DisplayName: c.DisplayName,
                    Job: c.Job,
                })) || [],
                totalCount: projectQuery.QueryResponse?.totalCount || 0
            };
        } catch (err: any) {
            diagnostics.jobQuery = { success: false, error: err.message };
        }

        // Query 3: Try IsProject query separately
        try {
            const isProjectQuery = await qboQuery(`SELECT Id, DisplayName, IsProject FROM Customer WHERE IsProject = true MAXRESULTS 5`);
            diagnostics.isProjectQuery = {
                success: true,
                results: isProjectQuery.QueryResponse?.Customer?.map((c: any) => ({
                    Id: c.Id,
                    DisplayName: c.DisplayName,
                    IsProject: c.IsProject,
                })) || [],
                totalCount: isProjectQuery.QueryResponse?.totalCount || 0
            };
        } catch (err: any) {
            diagnostics.isProjectQuery = { success: false, error: err.message };
        }

        return NextResponse.json(diagnostics, { status: 200 });
    } catch (error: any) {
        console.error(`[QBO-TEST] Error:`, error);
        return NextResponse.json({ 
            success: false, 
            error: error.message,
            realmId: QBO_REALM_ID,
            baseUrl: BASE_URL,
            qboIsProduction: process.env.QBO_IS_PRODUCTION,
            nodeEnv: process.env.NODE_ENV,
        }, { status: 500 });
    }
}
