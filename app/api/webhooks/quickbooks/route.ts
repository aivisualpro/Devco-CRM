import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectToDatabase } from '@/lib/db';
import WebhookLog from '@/lib/models/WebhookLog';
import { resolveProjectIdsFromEntity, syncProjectToDb } from '@/lib/qbo-sync';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
    const receivedAt = new Date();
    let logEntry: any = null;

    try {
        await connectToDatabase();

        const payload = await req.text();
        const signature = req.headers.get('intuit-signature');
        const verifierToken = process.env.QBO_WEBHOOK_VERIFIER_TOKEN;

        // Log the incoming webhook immediately
        const headers: Record<string, string> = {};
        req.headers.forEach((value, key) => { headers[key] = value; });

        logEntry = await WebhookLog.create({
            source: 'quickbooks',
            payload: payload ? JSON.parse(payload) : null,
            headers: { 'intuit-signature': signature || 'none', 'content-type': headers['content-type'] || '' },
            status: 'received',
            receivedAt,
            entitiesProcessed: 0,
            projectsSynced: [],
        });

        console.log(`[QBO-WEBHOOK] Log ID: ${logEntry._id} - Received webhook at ${receivedAt.toISOString()}`);

        // Verify signature if token is provided
        if (verifierToken && signature) {
            const hash = crypto
                .createHmac('sha256', verifierToken)
                .update(payload)
                .digest('base64');

            if (hash !== signature) {
                console.error('[QBO-WEBHOOK] Invalid QuickBooks Webhook Signature');
                await WebhookLog.findByIdAndUpdate(logEntry._id, { status: 'failed', error: 'Invalid signature', processedAt: new Date() });
                return new NextResponse('Invalid signature', { status: 401 });
            }
        }

        const data = JSON.parse(payload);
        console.log('[QBO-WEBHOOK] Received:', JSON.stringify(data, null, 2));

        const syncedProjects: string[] = [];
        let totalEntities = 0;

        // Process events
        if (data.eventNotifications) {
            for (const notification of data.eventNotifications) {
                const realmId = notification.realmId;
                const entities = notification.dataChangeEvent?.entities || [];
                
                console.log(`[QBO-WEBHOOK] Realm ${realmId}: Processing ${entities.length} entities`);
                totalEntities += entities.length;

                if (entities.length === 0) {
                    console.warn('[QBO-WEBHOOK] No entities found. Raw notification keys:', Object.keys(notification));
                }

                const projectsToSync = new Set<string>();
                
                for (const entity of entities) {
                    console.log(`[QBO-WEBHOOK] Entity ${entity.name} ID=${entity.id} operation=${entity.operation}`);
                    
                    try {
                        if (entity.operation === 'Create') {
                            console.log(`[QBO-WEBHOOK] New entity, waiting 2s for QBO propagation...`);
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }

                        const resolvedIds = await resolveProjectIdsFromEntity(entity.name, entity.id);
                        console.log(`[QBO-WEBHOOK] Resolved project IDs for ${entity.name}/${entity.id}:`, resolvedIds);
                        resolvedIds.forEach(id => projectsToSync.add(id));
                    } catch (err) {
                        console.error(`[QBO-WEBHOOK] Failed to resolve projects for ${entity.name}/${entity.id}`, err);
                    }
                }
                
                if (projectsToSync.size > 0) {
                    console.log(`[QBO-WEBHOOK] Syncing ${projectsToSync.size} projects:`, Array.from(projectsToSync));
                    for (const projectId of Array.from(projectsToSync)) {
                        try {
                            await syncProjectToDb(projectId);
                            syncedProjects.push(projectId);
                            console.log(`[QBO-WEBHOOK] Successfully synced project ${projectId}`);
                        } catch (err) {
                            console.error(`[QBO-WEBHOOK] Failed to sync project ${projectId}:`, err);
                        }
                    }
                } else {
                    console.log('[QBO-WEBHOOK] No projects to sync from this notification');
                }
            }
        } else {
            console.warn('[QBO-WEBHOOK] No eventNotifications in payload. Keys:', Object.keys(data));
        }

        // --- Notifications & Live Push ---
        if (syncedProjects.length > 0) {
            const QBO_NOTIFY_RECIPIENTS = [
                'info@devco-inc.com',
                'dt@devco-inc.com', 
                'cd@devco-inc.com',
                'adeel@devco-inc.com'
            ];

            // Build human-readable summary
            const { DevcoQuickBooks } = await import('@/lib/models');
            const syncedDocs = await DevcoQuickBooks.find(
                { projectId: { $in: syncedProjects } },
                { project: 1, projectId: 1 }
            ).lean();
            const projectNames = syncedDocs.map((d: any) => d.project || d.projectId);
            const summary = projectNames.length <= 2 
                ? projectNames.join(' & ') 
                : `${projectNames[0]} and ${projectNames.length - 1} more`;

            // Entity types that triggered the sync
            const entityTypes = new Set<string>();
            data.eventNotifications?.forEach((n: any) => {
                (n.dataChangeEvent?.entities || []).forEach((e: any) => entityTypes.add(e.name));
            });
            const changeTypes = Array.from(entityTypes).join(', ') || 'Transaction';

            // Create bell notifications for each recipient
            const Notification = (await import('@/lib/models/Notification')).default;
            for (const email of QBO_NOTIFY_RECIPIENTS) {
                try {
                    const notif = await Notification.create({
                        recipientEmail: email,
                        type: 'qbo_sync',
                        title: 'QuickBooks Updated',
                        message: `${changeTypes} changed in ${summary}. WIP data has been refreshed.`,
                        link: `/reports/wip?project=${syncedDocs[0]?.project?.match(/^[^_]+/)?.[0] || ''}&tab=Summary`,
                        metadata: { projectIds: syncedProjects, entityTypes: Array.from(entityTypes) },
                        createdBy: 'quickbooks-webhook',
                        createdAt: new Date()
                    });

                    // Push real-time toast via Pusher
                    const { pushNotification } = await import('@/lib/pusher');
                    await pushNotification(email, {
                        title: 'QuickBooks Updated',
                        message: `${changeTypes} changed in ${summary}`,
                        link: notif.link,
                        type: 'qbo_sync',
                        notificationId: String(notif._id)
                    });
                } catch (err) {
                    console.error(`[QBO-WEBHOOK] Failed to notify ${email}:`, err);
                }
            }

            // Broadcast on a public channel so WIP dashboard auto-refreshes
            try {
                const { pusherServer } = await import('@/lib/pusher');
                await pusherServer.trigger('qbo-updates', 'projects-synced', {
                    projectIds: syncedProjects,
                    projectNames,
                    changeTypes: Array.from(entityTypes),
                    timestamp: new Date().toISOString()
                });
                console.log(`[QBO-WEBHOOK] Broadcast live update for ${syncedProjects.length} projects`);
            } catch (err) {
                console.error('[QBO-WEBHOOK] Pusher broadcast failed:', err);
            }
        }

        // Update log with final status
        await WebhookLog.findByIdAndUpdate(logEntry._id, {
            status: 'processed',
            entitiesProcessed: totalEntities,
            projectsSynced: syncedProjects,
            processedAt: new Date(),
        });

        return new NextResponse('OK', { status: 200 });
    } catch (error: any) {
        console.error('[QBO-WEBHOOK] Error:', error);
        
        if (logEntry?._id) {
            await WebhookLog.findByIdAndUpdate(logEntry._id, { 
                status: 'failed', 
                error: error.message, 
                processedAt: new Date() 
            }).catch(() => {});
        }

        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

export async function GET() {
    return new NextResponse('QuickBooks Webhook Endpoint Active', { status: 200 });
}
