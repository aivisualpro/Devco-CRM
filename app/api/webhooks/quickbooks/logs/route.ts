import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import WebhookLog from '@/lib/models/WebhookLog';

// GET /api/webhooks/quickbooks/logs — view recent webhook deliveries
export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();

        const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');
        
        const logs = await WebhookLog.find({ source: 'quickbooks' })
            .sort({ receivedAt: -1 })
            .limit(limit)
            .lean();

        const summary = {
            totalLogs: await WebhookLog.countDocuments({ source: 'quickbooks' }),
            recentLogs: logs.map((log: any) => ({
                id: log._id,
                status: log.status,
                receivedAt: log.receivedAt,
                processedAt: log.processedAt,
                entitiesProcessed: log.entitiesProcessed,
                projectsSynced: log.projectsSynced,
                error: log.error,
                entities: log.payload?.eventNotifications?.flatMap((n: any) => 
                    (n.dataChangeEvent?.entities || []).map((e: any) => `${e.operation} ${e.name}/${e.id}`)
                ) || [],
            })),
        };

        return NextResponse.json(summary, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
