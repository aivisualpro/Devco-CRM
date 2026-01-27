
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DailyJobTicket, Schedule, Activity, DJTSignature, Constant, OverheadItem } from '@/lib/models';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, payload } = body;
        
        await connectToDatabase();

        switch (action) {
// ...
            case 'saveDJT': {
                const djtData = payload;
                const idToUse = djtData._id || new mongoose.Types.ObjectId().toString();

                // Calculate Cost
                let totalCost = 0;
                
                // Equipment Cost
                if (djtData.equipmentUsed && Array.isArray(djtData.equipmentUsed)) {
                    djtData.equipmentUsed.forEach((eq: any) => {
                        if (eq.type?.toLowerCase() === 'owned') {
                            totalCost += (Number(eq.qty) || 0) * (Number(eq.cost) || 0);
                        }
                    });
                }

                // Overhead Cost
                const overheads = await OverheadItem.find().lean();
                const devcoOverhead = Number(overheads.find((c: any) => c.overhead?.trim().toLowerCase() === 'devco overhead')?.dailyRate) || 0;
                const riskFactor = Number(overheads.find((c: any) => c.overhead?.trim().toLowerCase() === 'risk factor')?.dailyRate) || 0;
                
                totalCost += (devcoOverhead + riskFactor);

                djtData.djtCost = totalCost;

                const { _id, ...rest } = djtData;

                // 1. Upsert DailyJobTicket
                const updatedDJT = await DailyJobTicket.findOneAndUpdate(
                    { _id: idToUse },
                    { 
                        $set: { ...rest }, 
                        $setOnInsert: { createdAt: new Date() } 
                    },
                    { upsert: true, new: true }
                );

                // 2. Sync to Schedule
                // Note: The frontend might be sending schedule_id or we rely on the one in djtData
                // If it's a new DJT, we need to make sure we link it to the schedule
                if (djtData.schedule_id) {
                    try {
                        await Schedule.updateOne(
                            { _id: String(djtData.schedule_id) },
                            { $set: { djt: updatedDJT.toObject() } }
                        );
                    } catch (syncError: any) {
                        console.error('Error syncing DJT to Schedule:', syncError);
                        // We still return true if the main DJT was saved, 
                        // as the sync is secondary, or we can choose to fail.
                    }

                    // Log Activity
                    const activityId = new mongoose.Types.ObjectId().toString();
                    await Activity.create({
                        _id: activityId,
                        title: 'Daily Job Ticket Updated',
                        type: 'job', // Changed from 'djt' to match likely schema enum if any, or general type
                        action: 'updated',
                        entityId: idToUse,
                        user: djtData.createdBy || 'system',
                        details: `Updated Daily Job Ticket for schedule`,
                        metadata: { scheduleId: djtData.schedule_id },
                        date: new Date(), // Many schemas use date or timestamp
                        createdAt: new Date()
                    });
                }

                return NextResponse.json({ success: true, result: updatedDJT });
            }
            
            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('DJT API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
