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

        // Step 1: Resolve project IDs (same as webhook handler does)
        const resolvedIds = await resolveProjectIdsFromEntity('Customer', entityId);
        diagnostics.resolvedProjectIds = resolvedIds;

        if (resolvedIds.length === 0) {
            return NextResponse.json({ 
                ...diagnostics,
                success: false, 
                message: `No project IDs resolved for Customer/${entityId}. Checking raw data...`,
            });
        }

        // Step 2: Sync each resolved project
        const results = [];
        for (const projectId of resolvedIds) {
            try {
                const project = await syncProjectToDb(projectId);
                results.push({ projectId, success: true, projectName: project.project || project.DisplayName });
            } catch (err: any) {
                results.push({ projectId, success: false, error: err.message });
            }
        }

        return NextResponse.json({ 
            ...diagnostics,
            success: true, 
            message: `Synced ${results.length} project(s)`,
            resolvedIds,
            results 
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
