import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import mongoose from 'mongoose';
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

        const db = mongoose.connection.db;
        if (!db) {
            return NextResponse.json({ success: false, error: 'DB connection unavailable' }, { status: 500 });
        }

        const userEmail = jwtUser.email.toLowerCase().trim();
        const filter: any = { recipientEmail: userEmail };
        if (unreadOnly) filter.read = false;

        const col = db.collection('notifications');

        const [notifications, unreadCount, total] = await Promise.all([
            col.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
            col.countDocuments({ recipientEmail: userEmail, read: false }),
            col.countDocuments(filter)
        ]);

        console.log(`[Notifications API] GET for ${userEmail}: found ${total} total, ${unreadCount} unread`);

        return NextResponse.json({
            success: true,
            result: notifications,
            unreadCount,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        }, {
            headers: {
                'Cache-Control': 'private, no-store'
            }
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

        const db = mongoose.connection.db;
        if (!db) {
            return NextResponse.json({ success: false, error: 'DB connection unavailable' }, { status: 500 });
        }

        const col = db.collection('notifications');
        const userEmail = jwtUser.email.toLowerCase().trim();

        switch (action) {
            case 'markRead': {
                const { notificationId } = body;
                if (notificationId) {
                    await col.updateOne(
                        { _id: new mongoose.Types.ObjectId(notificationId), recipientEmail: userEmail },
                        { $set: { read: true, readAt: new Date() } }
                    );
                }
                return NextResponse.json({ success: true });
            }

            case 'markAllRead': {
                await col.updateMany(
                    { recipientEmail: userEmail, read: false },
                    { $set: { read: true, readAt: new Date() } }
                );
                return NextResponse.json({ success: true });
            }

            case 'delete': {
                const { notificationId } = body;
                if (notificationId) {
                    await col.deleteOne({ _id: new mongoose.Types.ObjectId(notificationId), recipientEmail: userEmail });
                }
                return NextResponse.json({ success: true });
            }

            case 'clearAll': {
                await col.deleteMany({ recipientEmail: userEmail });
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
