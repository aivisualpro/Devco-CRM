import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Message, Channel, Estimate, Employee } from '@/lib/models';

/**
 * Devco Communication API
 * Handles real-time chat data, sidebar fetching, and channel management.
 */

export async function GET(request: NextRequest) {
    try {
        await connectToDatabase();
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'getSidebarData') {
            let channels = await Channel.find({}).sort({ name: 1 }).lean();

            if (channels.length === 0) {
                // Seed default channels
                await Channel.insertMany([
                    { name: 'General', description: 'General company discussion', createdBy: 'system' },
                    { name: 'Projects', description: 'Discussion about ongoing projects', createdBy: 'system' },
                    { name: 'Urgent', description: 'Urgent matters only', createdBy: 'system' }
                ]);
                channels = await Channel.find({}).sort({ name: 1 }).lean();
            }

            const [estimates, employees] = await Promise.all([
                Estimate.find({}).sort({ updatedAt: -1 }).limit(20).lean(),
                Employee.find({ status: 'Active' }).sort({ firstName: 1 }).lean()
            ]);

            return NextResponse.json({
                success: true,
                result: {
                    estimates,
                    channels,
                    employees: (employees as any[]).map(e => ({
                        _id: e._id,
                        firstName: e.firstName,
                        lastName: e.lastName,
                        email: e.email
                    }))
                }
            });
        }

        if (action === 'getMessages') {
            const type = searchParams.get('type');
            const targetId = searchParams.get('targetId');

            if (!type || !targetId) {
                return NextResponse.json({ success: false, error: 'Missing type or targetId' }, { status: 400 });
            }

            const messages = await Message.find({ type, targetId }).sort({ createdAt: 1 }).lean();
            return NextResponse.json({ success: true, result: messages });
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Communication API Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        const body = await request.json();
        const { action, payload } = body;

        if (action === 'sendMessage') {
            const newMessage = await Message.create({
                ...payload,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return NextResponse.json({ success: true, result: newMessage });
        }

        if (action === 'createChannel') {
            const newChannel = await Channel.create({
                ...payload,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return NextResponse.json({ success: true, result: newChannel });
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('Communication API Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
