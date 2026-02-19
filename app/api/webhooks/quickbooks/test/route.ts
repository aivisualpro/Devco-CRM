import { NextRequest, NextResponse } from 'next/server';
import { qboQuery, QBO_REALM_ID, BASE_URL } from '@/lib/quickbooks';
import { resolveProjectIdsFromEntity, syncProjectToDb } from '@/lib/qbo-sync';

// Debug endpoint: GET /api/webhooks/quickbooks/test?entityId=772917373
export async function GET(req: NextRequest) {
    const entityId = req.nextUrl.searchParams.get('entityId');

    if (!entityId) {
        return NextResponse.json({ error: 'entityId query param required' }, { status: 400 });
    }

    try {
        const diagnostics: any = {
            realmId: QBO_REALM_ID,
            baseUrl: BASE_URL,
            timestamp: new Date().toISOString(),
        };

        // RAW QUERY: Show exactly what QBO returns for this customer
        try {
            const raw = await qboQuery(`SELECT * FROM Customer WHERE Id = '${entityId}'`);
            const customer = raw.QueryResponse?.Customer?.[0];
            diagnostics.customerFound = !!customer;
            if (customer) {
                diagnostics.rawCustomer = {
                    Id: customer.Id,
                    DisplayName: customer.DisplayName,
                    FullyQualifiedName: customer.FullyQualifiedName,
                    CompanyName: customer.CompanyName,
                    Job: customer.Job,
                    IsProject: customer.IsProject,
                    Active: customer.Active,
                    ParentRef: customer.ParentRef,
                    JobStatus: customer.JobStatus,
                    // Show all keys to find project indicator
                    allKeys: Object.keys(customer),
                };
            } else {
                diagnostics.message = `Customer ${entityId} NOT FOUND in realm ${QBO_REALM_ID}`;
            }
        } catch (err: any) {
            diagnostics.rawQueryError = err.message;
        }

        // RESOLVE: What the webhook handler would do
        const resolvedIds = await resolveProjectIdsFromEntity('Customer', entityId);
        diagnostics.resolvedProjectIds = resolvedIds;

        // If resolved, try syncing
        if (resolvedIds.length > 0) {
            const results = [];
            for (const pid of resolvedIds) {
                try {
                    const project = await syncProjectToDb(pid);
                    results.push({ projectId: pid, success: true, name: project.project || project.DisplayName });
                } catch (err: any) {
                    results.push({ projectId: pid, success: false, error: err.message });
                }
            }
            diagnostics.syncResults = results;
        }

        return NextResponse.json(diagnostics, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
