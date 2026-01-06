
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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
                console.error('Invalid QuickBooks Webhook Signature');
                return new NextResponse('Invalid signature', { status: 401 });
            }
        }

        const data = JSON.parse(payload);
        console.log('QuickBooks Webhook Received:', JSON.stringify(data, null, 2));

        // Process events
        if (data.eventNotifications) {
            for (const notification of data.eventNotifications) {
                const realmId = notification.realmId;
                const entities = notification.dataEvents?.entities || [];
                
                for (const entity of entities) {
                    console.log(`Realm ${realmId}: Entity ${entity.name} with ID ${entity.id} was ${entity.operation}d`);
                    // Here you would typically trigger some internal sync or notification
                }
            }
        }

        return new NextResponse('OK', { status: 200 });
    } catch (error) {
        console.error('QuickBooks Webhook Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

// QBO might send a GET request to verify the endpoint during setup (though usually it's just a POST)
export async function GET() {
    return new NextResponse('QuickBooks Webhook Endpoint Active', { status: 200 });
}
