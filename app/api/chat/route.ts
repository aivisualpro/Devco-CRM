import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Chat from '@/lib/models/Chat';
import { getUserFromRequest } from '@/lib/permissions/middleware';

export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        
        const { searchParams } = new URL(request.url);
        const filterStr = searchParams.get('filter') || '';
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        
        let query: any = {};

        if (filterStr) {
            // Primitive search: if it looks like an estimate # (starts with digit), search references
            // If it looks like a name or email, search mentions or sender
            // Or just search deeply across everything
            query = {
                $or: [
                    { message: { $regex: filterStr, $options: 'i' } },
                    { references: { $regex: filterStr, $options: 'i' } }, // Simple string match on refs
                    { senderName: { $regex: filterStr, $options: 'i' } },
                    // If filter is explicitly an estimate like '#123', stripping '#' might be needed or handled in frontend
                ]
            };
        }

        // If the user specifically filters for an estimate
        const estimateFilter = searchParams.get('estimate');
        if (estimateFilter) {
            // If we already have a filterStr query, we should AND it. But for now, let's prioritize the specific estimate filter
            // or merge it. 
            if (Object.keys(query).length > 0) {
                 query = {
                     $and: [
                         query,
                         { references: estimateFilter }
                     ]
                 };
            } else {
                query = { references: estimateFilter };
            }
        }

        const messages = await Chat.find(query)
            .sort({ createdAt: -1 }) // Newest first
            .limit(limit)
            .lean();

        return NextResponse.json({ success: true, messages: messages.reverse() }); // Return oldest first for chat flow
    } catch (error) {
        console.error('Chat GET Error:', error);
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
        const { message, mentions, references, senderName, senderImage } = body;

        if (!message) {
            return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
        }

        const newChat = await Chat.create({
            sender: user.email,
            senderName: senderName || user.email.split('@')[0], // Fallback
            senderImage,
            message,
            mentions: mentions || [],
            references: references || [],
        });

        return NextResponse.json({ success: true, message: newChat });
    } catch (error) {
        console.error('Chat POST Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to send message' }, { status: 500 });
    }
}
