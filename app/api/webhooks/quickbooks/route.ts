import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { resolveProjectIdsFromEntity, syncProjectToDb } from '@/lib/qbo-sync';

export async function POST(req: NextRequest) {
    try {
        const payload = await req.text();
        const signature = req.headers.get('intuit-signature');
        const verifierToken = process.env.QBO_WEBHOOK_VERIFIER_TOKEN;

        // Verify signature if token is provided
        if (verifierToken && signature) {
            const hash = crypto
                .createHmac('sha256', verifierToken)
                .update(payload)
                .digest('base64');

            if (hash !== signature) {
                console.error('[QBO-WEBHOOK] Invalid QuickBooks Webhook Signature');
                return new NextResponse('Invalid signature', { status: 401 });
            }
        }

        const data = JSON.parse(payload);
        console.log('[QBO-WEBHOOK] Received:', JSON.stringify(data, null, 2));

        // Process events
        if (data.eventNotifications) {
            for (const notification of data.eventNotifications) {
                const realmId = notification.realmId;

                // FIX: QuickBooks webhook payload uses "dataChangeEvent" (singular), NOT "dataEvents"
                // See: https://developer.intuit.com/app/developer/qbo/docs/develop/webhooks
                const entities = notification.dataChangeEvent?.entities || [];
                
                console.log(`[QBO-WEBHOOK] Realm ${realmId}: Processing ${entities.length} entities`);
                
                if (entities.length === 0) {
                    console.warn('[QBO-WEBHOOK] No entities found in notification. Raw notification keys:', Object.keys(notification));
                }

                // We use a set to avoid double-syncing the same project if multiple updates come in one batch
                const projectsToSync = new Set<string>();
                
                for (const entity of entities) {
                    console.log(`[QBO-WEBHOOK] Realm ${realmId}: Entity ${entity.name} with ID ${entity.id} was ${entity.operation}d`);
                    
                    try {
                        // For newly created entities, add a small delay to allow QBO to fully propagate
                        if (entity.operation === 'Create') {
                            console.log(`[QBO-WEBHOOK] New entity created, waiting 2s for QBO propagation...`);
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }

                        const resolvedIds = await resolveProjectIdsFromEntity(entity.name, entity.id);
                        console.log(`[QBO-WEBHOOK] Resolved project IDs for ${entity.name}/${entity.id}:`, resolvedIds);
                        resolvedIds.forEach(id => projectsToSync.add(id));
                    } catch (err) {
                        console.error(`[QBO-WEBHOOK] Failed to resolve projects for ${entity.name}/${entity.id}`, err);
                    }
                }
                
                // Trigger Syncs
                if (projectsToSync.size > 0) {
                    console.log(`[QBO-WEBHOOK] Triggering sync for ${projectsToSync.size} projects:`, Array.from(projectsToSync));
                    for (const projectId of Array.from(projectsToSync)) {
                        try {
                             await syncProjectToDb(projectId);
                             console.log(`[QBO-WEBHOOK] Successfully synced project ${projectId}`);
                        } catch (err) {
                             console.error(`[QBO-WEBHOOK] Failed to sync project ${projectId} from webhook:`, err);
                        }
                    }
                } else {
                    console.log('[QBO-WEBHOOK] No projects to sync from this notification');
                }
            }
        } else {
            console.warn('[QBO-WEBHOOK] No eventNotifications in payload. Keys:', Object.keys(data));
        }

        // QuickBooks requires a 200 response within 5 seconds
        return new NextResponse('OK', { status: 200 });
    } catch (error) {
        console.error('[QBO-WEBHOOK] Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

// QBO might send a GET request to verify the endpoint during setup (though usually it's just a POST)
export async function GET() {
    return new NextResponse('QuickBooks Webhook Endpoint Active', { status: 200 });
}
