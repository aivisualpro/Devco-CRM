import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Notification from '@/lib/models/Notification';
import { getUserFromRequest } from '@/lib/permissions/middleware';

export async function GET(req: NextRequest) {
    try {
        const jwtUser = await getUserFromRequest(req);
        if (!jwtUser?.email) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const unreadOnly = searchParams.get('unread') === 'true';

        await connectToDatabase();

        const userEmail = jwtUser.email.toLowerCase().trim();
        const filter: any = { recipientEmail: { $regex: new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } };
        if (unreadOnly) filter.read = false;

        const [notifications, unreadCount, total] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Notification.countDocuments({ recipientEmail: { $regex: new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, read: false }),
            Notification.countDocuments(filter)
        ]);

        console.log(`[Notifications API] GET for ${userEmail}: found ${total} total, ${unreadCount} unread`);

        return NextResponse.json({
            success: true,
            result: notifications,
            unreadCount,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('[Notifications API] GET Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const jwtUser = await getUserFromRequest(req);
        if (!jwtUser?.email) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { action } = body;

        await connectToDatabase();

        switch (action) {
            case 'markRead': {
                const { notificationId } = body;
                if (notificationId) {
                    await Notification.findOneAndUpdate(
                        { _id: notificationId, recipientEmail: jwtUser.email },
                        { $set: { read: true, readAt: new Date() } }
                    );
                }
                return NextResponse.json({ success: true });
            }

            case 'markAllRead': {
                await Notification.updateMany(
                    { recipientEmail: jwtUser.email, read: false },
                    { $set: { read: true, readAt: new Date() } }
                );
                return NextResponse.json({ success: true });
            }

            case 'delete': {
                const { notificationId } = body;
                if (notificationId) {
                    await Notification.findOneAndDelete(
                        { _id: notificationId, recipientEmail: jwtUser.email }
                    );
                }
                return NextResponse.json({ success: true });
            }

            case 'clearAll': {
                await Notification.deleteMany({ recipientEmail: jwtUser.email });
                return NextResponse.json({ success: true });
            }

            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error) {
        console.error('[Notifications API] POST Error:', error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
