import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Chat from '@/lib/models/Chat';
import { getUserFromRequest } from '@/lib/permissions/middleware';

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const { message } = await request.json();

        await connectToDatabase();
        
        const chat = await Chat.findById(id);
        if (!chat) {
            return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
        }

        // Only sender can edit
        if (chat.sender.toLowerCase() !== user.email.toLowerCase()) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        chat.message = message;
        await chat.save();

        return NextResponse.json({ success: true, message: chat });
    } catch (error) {
        console.error('Chat PATCH Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to update message' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        await connectToDatabase();
        
        const chat = await Chat.findById(id);
        if (!chat) {
            return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
        }

        // Only sender can delete
        if (chat.sender.toLowerCase() !== user.email.toLowerCase()) {
            return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
        }

        await Chat.findByIdAndDelete(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Chat DELETE Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete message' }, { status: 500 });
    }
}
