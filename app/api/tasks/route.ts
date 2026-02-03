import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { DevcoTask } from '@/lib/models';
import { getUserFromRequest } from '@/lib/permissions/middleware';
import { isSuperAdmin } from '@/lib/permissions/service';

export async function GET(req: NextRequest) {
    try {
        await connectToDatabase();
        const { searchParams } = new URL(req.url);
        const assignee = searchParams.get('assignee');
        
        let query = {};
        if (assignee) {
            query = { assignees: assignee };
        }
        
        const tasks = await DevcoTask.find(query).sort({ createdAt: -1 });
        
        // Debug: Log task owners to server console
        // console.log(`[API] Fetched ${tasks.length} tasks. Creators present:`, 
        //     Array.from(new Set(tasks.map((t: any) => t.createdBy || 'undefined')))
        // );

        return NextResponse.json({ success: true, tasks });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const body = await req.json();
        
        const taskData = {
            ...body,
            task: body.task || 'Untitled Task',
            status: body.status || 'todo',
            assignees: body.assignees || [],
            createdBy: user.email // Absolute priority: authenticated user
        };

        const task = await (DevcoTask as any).create(taskData);
        console.log(`[API] Task created by ${user.email}:`, task._id);
        
        return NextResponse.json({ success: true, task });
    } catch (error: any) {
        console.error('POST /api/tasks error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const body = await req.json();
        const { id, ...updates } = body;
        
        if (!id) {
            return NextResponse.json({ success: false, error: 'Task ID is required' }, { status: 400 });
        }

        const task = await DevcoTask.findById(id);
        if (!task) {
            return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
        }

        // Check if this is a status-only update
        const isStatusOnlyUpdate = Object.keys(updates).every(key => 
            ['status', 'lastUpdatedBy', 'lastUpdatedAt'].includes(key)
        );

        // Ownership Check: Only creator or Super Admin can do full edits
        // But anyone can change status
        const isOwner = task.createdBy?.toLowerCase().trim() === user.email?.toLowerCase().trim();
        const canFullEdit = isSuperAdmin(user.role) || isOwner;
        
        if (!isStatusOnlyUpdate && !canFullEdit) {
            const errorMsg = `Permission denied: Only the creator (${task.createdBy}) can edit this task. You are logged in as ${user.email}.`;
            console.log('Permission Denied - Full Edit:', {
                taskCreatedBy: task.createdBy,
                userEmail: user.email,
                userRole: user.role,
                updates: Object.keys(updates)
            });
            return NextResponse.json({ 
                success: false, 
                error: errorMsg
            }, { status: 403 });
        }
        
        const updatedTask = await DevcoTask.findByIdAndUpdate(id, { 
            ...updates,
            lastUpdatedBy: user.email,
            lastUpdatedAt: new Date()
        }, { new: true });
        
        return NextResponse.json({ success: true, task: updatedTask });
    } catch (error: any) {
        console.error('PATCH /api/tasks error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const user = await getUserFromRequest(req);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ success: false, error: 'Task ID is required' }, { status: 400 });
        }

        const task = await DevcoTask.findById(id);
        if (!task) {
            return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 });
        }

        // Ownership Check: Only creator or Super Admin can delete
        const canDelete = isSuperAdmin(user.role) || task.createdBy?.toLowerCase().trim() === user.email?.toLowerCase().trim();

        if (!canDelete) {
            const errorMsg = `Permission denied: Only the creator (${task.createdBy}) can delete this task. You are logged in as ${user.email}.`;
            console.log('Permission Denied Details:', {
                taskCreatedBy: task.createdBy,
                userEmail: user.email,
                userRole: user.role
            });
            return NextResponse.json({ 
                success: false, 
                error: errorMsg 
            }, { status: 403 });
        }
        
        await DevcoTask.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

