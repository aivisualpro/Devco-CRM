import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Chat from '@/lib/models/Chat';
import { getUserFromRequest } from '@/lib/permissions/middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        
        let query: any = {};

        // Filter by estimate if provided
        const estimateFilter = searchParams.get('estimate');
        if (estimateFilter) {
            query.estimate = estimateFilter;
        }

        // Filter by assignee if provided (check if email is in assignees array)
        const assigneeFilter = searchParams.get('assignee');
        if (assigneeFilter) {
            query.assignees = assigneeFilter;
        }

        // General text search filter
        const filterStr = searchParams.get('filter');
        if (filterStr) {
            query.$or = [
                { message: { $regex: filterStr, $options: 'i' } },
                { estimate: { $regex: filterStr, $options: 'i' } },
                { sender: { $regex: filterStr, $options: 'i' } },
                { assignees: { $regex: filterStr, $options: 'i' } }, // Searches string assignees
                { 'assignees.name': { $regex: filterStr, $options: 'i' } }, // Searches object assignee names
                { 'assignees.email': { $regex: filterStr, $options: 'i' } } // Searches object assignee emails
            ];
        }

        const messages = await Chat.find(query)
            .sort({ createdAt: -1 }) // Newest first
            .limit(limit)
            .lean();

        return NextResponse.json({ success: true, messages: messages.reverse() }); // Return oldest first for chat flow
    } catch (error) {
        console.error('Chat GET Error:', error instanceof Error ? error.message : error);
        return NextResponse.json({ success: false, error: 'Failed to fetch messages' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const body = await request.json();
        const { message, estimate, assignees, replyTo } = body;

        if (!message) {
            return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
        }

        const newChat = await Chat.create({
            sender: user.email,
            message,
            estimate: estimate || undefined,
            assignees: assignees || [],
            replyTo: replyTo || undefined,
        });

        return NextResponse.json({ success: true, message: newChat });
    } catch (error) {
        console.error('Chat POST Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 });
    }
}
