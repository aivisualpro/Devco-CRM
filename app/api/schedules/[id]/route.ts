
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import { Schedule, Estimate } from '@/lib/models';
import { getUserFromRequest } from '@/lib/permissions/middleware';

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
        
        const jwtUser = await getUserFromRequest(req);
        const loggedInEmail: string = jwtUser?.email || 'Unknown';

        const oldDoc = await Schedule.findById(params.id).lean();
        
        const changeLog: any = {};
        let hasChanges = false;
        
        if (oldDoc) {
            for (const key of Object.keys(body)) {
                if (
                    Array.isArray(body[key]) || 
                    (typeof body[key] === 'object' && body[key] !== null) || 
                    key === 'updatedAt' || 
                    key === 'historyLog' ||
                    key === 'syncedToAppSheet' ||
                    key === '$push' ||
                    key === '$set'
                ) continue;
                
                const oldValue = (oldDoc as any)[key];
                const newValue = body[key];

                if (String(oldValue) !== String(newValue) && (oldValue !== undefined || newValue !== undefined)) {
                    changeLog[key] = { oldValue, newValue };
                    hasChanges = true;
                }
            }
        }

        const updatePayload: any = { ...body, updatedAt: new Date() };
        const finalUpdate: any = { $set: updatePayload };

        if (hasChanges) {
            finalUpdate.$push = {
                historyLog: {
                    updatedBy: loggedInEmail,
                    updatedOn: new Date(),
                    ...changeLog
                }
            };
        }

        const schedule = await Schedule.findByIdAndUpdate(params.id, finalUpdate, { new: true }).lean();
        
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
