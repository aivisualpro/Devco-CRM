import { NextRequest, NextResponse } from 'next/server';
import { resolveProjectIdsFromEntity, syncProjectToDb } from '@/lib/qbo-sync';

// Test endpoint: GET /api/webhooks/quickbooks/test?entityName=Customer&entityId=772917373
// This simulates what happens when a webhook arrives, so you can verify the full pipeline
export async function GET(req: NextRequest) {
    const entityName = req.nextUrl.searchParams.get('entityName') || 'Customer';
    const entityId = req.nextUrl.searchParams.get('entityId');

    if (!entityId) {
        return NextResponse.json({ error: 'entityId query param required' }, { status: 400 });
    }

    try {
        console.log(`[QBO-WEBHOOK-TEST] Testing webhook pipeline for ${entityName}/${entityId}`);
        
        // Step 1: Resolve project IDs (same as webhook handler does)
        const resolvedIds = await resolveProjectIdsFromEntity(entityName, entityId);
        console.log(`[QBO-WEBHOOK-TEST] Resolved project IDs:`, resolvedIds);

        if (resolvedIds.length === 0) {
            return NextResponse.json({ 
                success: false, 
                message: `No project IDs resolved for ${entityName}/${entityId}. This entity might not be a project.`,
                resolvedIds: []
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
            success: true, 
            message: `Processed ${results.length} project(s)`,
            resolvedIds,
            results 
        });
    } catch (error: any) {
        console.error(`[QBO-WEBHOOK-TEST] Error:`, error);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}
