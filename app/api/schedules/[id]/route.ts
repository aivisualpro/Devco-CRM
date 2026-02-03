
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import { Schedule, Estimate } from '@/lib/models';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        await connectToDatabase();
        
        const schedule = await Schedule.findById(params.id).lean();
        if (!schedule) {
            return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
        }

        let fullEstimate = null;
        if (schedule.estimate) {
            // schedule.estimate might be an ObjectId or an Estimate Number string
            const estVal = schedule.estimate;
            if (mongoose.Types.ObjectId.isValid(estVal)) {
                 fullEstimate = await Estimate.findById(estVal).lean();
            }
            
            if (!fullEstimate) {
                 // Try finding by 'estimate' field (number/string)
                 fullEstimate = await Estimate.findOne({ estimate: estVal }).lean();
            }
        }

        return NextResponse.json({ 
            success: true, 
            schedule,
            estimate: fullEstimate 
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        await connectToDatabase();
        const body = await req.json();
        
        const schedule = await Schedule.findByIdAndUpdate(params.id, body, { new: true }).lean();
        
        if (!schedule) {
            return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, schedule });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const params = await props.params;
        await connectToDatabase();
        await Schedule.findByIdAndDelete(params.id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
