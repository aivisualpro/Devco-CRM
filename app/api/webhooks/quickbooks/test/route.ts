import { NextRequest, NextResponse } from 'next/server';
import { qboQuery, getProjects, QBO_REALM_ID } from '@/lib/quickbooks';
import { resolveProjectIdsFromEntity, syncProjectToDb } from '@/lib/qbo-sync';

// Debug endpoint: GET /api/webhooks/quickbooks/test?entityName=Customer&entityId=772917373
export async function GET(req: NextRequest) {
    const entityName = req.nextUrl.searchParams.get('entityName') || 'Customer';
    const entityId = req.nextUrl.searchParams.get('entityId');

    try {
        const diagnostics: any = {
            realmId: QBO_REALM_ID,
            timestamp: new Date().toISOString(),
        };

        // If entityId provided, query that specific customer
        if (entityId) {
            console.log(`[QBO-TEST] Querying Customer ${entityId} in realm ${QBO_REALM_ID}...`);
            
            // Raw query to see exactly what QBO returns
            const rawResult = await qboQuery(`SELECT Id, DisplayName, FullyQualifiedName, Job, IsProject, Active, ParentRef FROM Customer WHERE Id = '${entityId}'`);
            diagnostics.rawQueryResult = rawResult;
            
            const customer = rawResult.QueryResponse?.Customer?.[0];
            diagnostics.customerFound = !!customer;
            
            if (customer) {
                diagnostics.customer = {
                    Id: customer.Id,
                    DisplayName: customer.DisplayName,
                    FullyQualifiedName: customer.FullyQualifiedName,
                    Job: customer.Job,
                    IsProject: customer.IsProject,
                    Active: customer.Active,
                    ParentRef: customer.ParentRef,
                };
                diagnostics.isProjectOrJob = customer.Job === true || customer.IsProject === true;
            }

            // Also try resolving project IDs
            try {
                const resolvedIds = await resolveProjectIdsFromEntity(entityName, entityId);
                diagnostics.resolvedProjectIds = resolvedIds;
            } catch (err: any) {
                diagnostics.resolveError = err.message;
            }
        }

        // Also list the first 5 projects to verify API is working
        try {
            console.log(`[QBO-TEST] Fetching projects list from realm ${QBO_REALM_ID}...`);
            const allProjectsRaw = await qboQuery(`SELECT Id, DisplayName, Job, IsProject FROM Customer WHERE IsProject = true MAXRESULTS 5`);
            diagnostics.sampleProjects = allProjectsRaw.QueryResponse?.Customer?.map((c: any) => ({
                Id: c.Id,
                DisplayName: c.DisplayName,
                Job: c.Job,
                IsProject: c.IsProject,
            })) || [];
            diagnostics.totalProjectsReturned = allProjectsRaw.QueryResponse?.totalCount || allProjectsRaw.QueryResponse?.Customer?.length || 0;
        } catch (err: any) {
            diagnostics.projectListError = err.message;
        }

        return NextResponse.json(diagnostics, { status: 200 });
    } catch (error: any) {
        console.error(`[QBO-TEST] Error:`, error);
        return NextResponse.json({ 
            success: false, 
            error: error.message,
            realmId: QBO_REALM_ID,
        }, { status: 500 });
    }
}
