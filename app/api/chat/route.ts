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

        const { PermissionChecker } = await import('@/lib/permissions/service');
        const { MODULES, ACTIONS, DATA_SCOPE } = await import('@/lib/permissions/types');

        const checker = new PermissionChecker(user.userId);
        await checker.load();

        console.log('DEBUG CHAT PERMS:', {
            userEmail: user.email,
            role: user.role,
            canView: checker.can(MODULES.CHAT, ACTIONS.VIEW),
            scope: checker.getScope(MODULES.CHAT),
            allRef: DATA_SCOPE.ALL,
            perms: JSON.stringify(checker.getPermissions()?.modules.find(m => m.module === MODULES.CHAT))
        });

        if (!checker.can(MODULES.CHAT, ACTIONS.VIEW)) {
             return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
        }

        await connectToDatabase();
        
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        
        let query: any = {};
        const andConditions: any[] = [];
        
        // Scope Check: Restrict if not View All
        const scope = checker.getScope(MODULES.CHAT);
        if (scope !== DATA_SCOPE.ALL) {
            const escapedEmail = user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const userEmailRegex = new RegExp(escapedEmail, 'i'); // Case insensitive, partial match allowed for robustness against whitespace
            
            // User must be sender OR assignee
            andConditions.push({
                 $or: [
                     { sender: { $regex: userEmailRegex } },
                     { assignees: { $regex: userEmailRegex } }, // Matches string in array
                     { 'assignees.email': { $regex: userEmailRegex } },
                     { 'assignees.value': { $regex: userEmailRegex } },
                     { 'assignees.id': { $regex: userEmailRegex } }, 
                     { 'assignees.userId': { $regex: userEmailRegex } }
                 ]
            });
        }

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
            andConditions.push({
                $or: [
                    { message: { $regex: filterStr, $options: 'i' } },
                    { estimate: { $regex: filterStr, $options: 'i' } },
                    { sender: { $regex: filterStr, $options: 'i' } },
                    { assignees: { $regex: filterStr, $options: 'i' } }, // Searches string assignees
                    { 'assignees.name': { $regex: filterStr, $options: 'i' } }, // Searches object assignee names
                    { 'assignees.email': { $regex: filterStr, $options: 'i' } } // Searches object assignee emails
                ]
            });
        }

        if (andConditions.length > 0) {
            query.$and = andConditions;
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
