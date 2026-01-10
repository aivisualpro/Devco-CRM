import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Activity } from '@/lib/models';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
    try {
        await connectToDatabase();
        
        const { searchParams } = new URL(request.url);
        const user = searchParams.get('user');
        const type = searchParams.get('type');
        const days = parseInt(searchParams.get('days') || '7');
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);
        
        const query: any = {
            createdAt: { $gte: startDate }
        };
        
        if (user) query.user = user;
        if (type) query.type = type;
        
        const activities = await Activity.find(query)
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        
        return NextResponse.json({ success: true, activities });
    } catch (error: any) {
        console.error('Activity API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();
        
        const body = await request.json();
        const { user, action, type, title, entityId, metadata } = body;
        
        if (!user || !action || !type || !title) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }
        
        const newId = new mongoose.Types.ObjectId().toString();
        
        const activity = await Activity.create({
            _id: newId,
            user,
            action,
            type,
            title,
            entityId,
            metadata,
            createdAt: new Date()
        });
        
        return NextResponse.json({ success: true, activity });
    } catch (error: any) {
        console.error('Activity API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
