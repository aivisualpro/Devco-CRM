import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/db';
import { DevcoTask } from '@/lib/models';

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
        return NextResponse.json({ success: true, tasks });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await connectToDatabase();
        const body = await req.json();
        
        const task = await DevcoTask.create(body);
        return NextResponse.json({ success: true, task });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        await connectToDatabase();
        const body = await req.json();
        const { id, ...updates } = body;
        
        if (!id) {
            return NextResponse.json({ success: false, error: 'Task ID is required' }, { status: 400 });
        }
        
        const task = await DevcoTask.findByIdAndUpdate(id, { 
            ...updates,
            lastUpdatedAt: new Date()
        }, { new: true });
        
        return NextResponse.json({ success: true, task });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
