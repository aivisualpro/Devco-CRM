
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

            case 'getDJTs': {
                const { page = 1, limit = 20, search = '' } = payload;
                const skip = (page - 1) * limit;

                // Build Query
                let query: any = {};
                if (search) {
                    const searchRegex = { $regex: search, $options: 'i' };
                    // We can search description, or we might need to search schedule fields (client, estimate)
                    // searching schedule fields requires aggregate usually, but let's start with local fields
                    query.$or = [
                        { dailyJobDescription: searchRegex },
                        // If we want to search by schedule fields, we'd need to fetch matching schedules first or use aggregate
                    ];
                }

                // 1. Get filtered DJTs (Paginated)
                const djts = await DailyJobTicket.find(query)
                    .sort({ date: -1, createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean();

                const total = await DailyJobTicket.countDocuments(query);

                // 2. Populate 'scheduleRef' manually (since schedule_id is string)
                // Get all schedule IDs
                const scheduleIds = djts.map((d: any) => d.schedule_id).filter(Boolean);
                
                // Fetch schedules
                const schedules = await Schedule.find({ _id: { $in: scheduleIds } }).lean();
                
                // Attach scheduleRef
                const djtsWithSchedule = djts.map((d: any) => {
                    const schedule = schedules.find((s: any) => String(s._id) === String(d.schedule_id));
                    return {
                        ...d,
                        scheduleRef: schedule || null
                    };
                });
                
                // Filter by search again if needed (e.g. if user searched for "Devco" which is in Schedule.customerName)
                // For now, let's assume basic search on DJT fields + client/estimate from fetched schedules if simple logic allows
                // (Implementing full joined search in Mongo without aggregate is complex, staying simple for now)

                return NextResponse.json({ 
                    success: true, 
                    result: {
                        djts: djtsWithSchedule,
                        total
                    }
                });
            }

            case 'deleteDJT': {
                const { id } = payload;
                if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });

                // Find DJT first to get schedule_id
                const djtToDelete = await DailyJobTicket.findById(id).lean();
                if (!djtToDelete) return NextResponse.json({ success: false, error: 'DJT not found' }, { status: 404 });

                // 1. Delete DJT
                await DailyJobTicket.deleteOne({ _id: id });

                // 2. Unlink from Schedule
                if (djtToDelete.schedule_id) {
                    await Schedule.updateOne(
                        { _id: djtToDelete.schedule_id },
                        { $unset: { djt: 1 } }
                    );
                }

                // 3. Log Activity
                const activityId = new mongoose.Types.ObjectId().toString();
                await Activity.create({
                    _id: activityId,
                    title: 'Daily Job Ticket Deleted',
                    type: 'job',
                    action: 'deleted',
                    entityId: id,
                    user: payload.user || 'system',
                    details: `Deleted Daily Job Ticket`,
                    metadata: { scheduleId: djtToDelete.schedule_id },
                    date: new Date(),
                    createdAt: new Date()
                });

                return NextResponse.json({ success: true });
            }
            
            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('DJT API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
