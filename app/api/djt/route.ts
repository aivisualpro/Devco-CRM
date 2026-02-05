
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DailyJobTicket, Schedule, Activity, DJTSignature, Constant, OverheadItem, EquipmentItem } from '@/lib/models';
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

                // Calculate Cost - Fetch fresh rates from DB to ensuring accuracy
                let totalCost = 0;
                
                // Fetch all overheads and equipment first
                const [overheads, equipmentItems] = await Promise.all([
                    OverheadItem.find().lean(),
                    EquipmentItem.find().lean()
                ]);

                // Equipment Cost
                if (djtData.equipmentUsed && Array.isArray(djtData.equipmentUsed)) {
                    djtData.equipmentUsed = djtData.equipmentUsed.map((eq: any) => {
                        // Find matching equipment item in DB to get official rate
                        const dbItem = equipmentItems.find((i: any) => String(i._id) === String(eq.equipment) || String(i.value) === String(eq.equipment));
                        const dailyRate = dbItem ? (Number(dbItem.dailyCost) || 0) : (Number(eq.cost) || 0);

                        if (eq.type?.toLowerCase() === 'owned') {
                            totalCost += (Number(eq.qty) || 0) * dailyRate;
                        }
                        
                        // Preserve the cost in the saved record for historical accuracy
                        return { ...eq, cost: dailyRate };
                    });
                }

                // Overhead Cost
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
            
            case 'saveDJTSignature': {
                const { schedule_id, employee, signature, location, createdBy } = payload;
                if (!schedule_id || !employee || !signature) {
                    return NextResponse.json({ success: false, error: 'Missing required signature data' }, { status: 400 });
                }

                // Find DJT by schedule_id or _id
                let djt = await DailyJobTicket.findOne({ 
                    $or: [{ _id: schedule_id }, { schedule_id: schedule_id }] 
                });

                if (!djt) {
                     // If standard save hasn't happened yet, we might have an issue.
                     // But usually DJT is created before signing.
                     return NextResponse.json({ success: false, error: 'Daily Job Ticket not found. Please save the ticket content first.' }, { status: 404 });
                }

                // Patch missing createdBy if needed (legacy docs or incomplete creations)
                if (!djt.createdBy) {
                    djt.createdBy = createdBy || employee || 'system';
                }

                // Update Signature
                const newSignature = {
                    employee,
                    signature,
                    date: new Date(),
                    location: location || 'Unknown',
                    signedBy: createdBy
                };

                // Remove existing signature for this employee if any
                const existingSignatures = djt.signatures || [];
                const updatedSignatures = existingSignatures.filter((s: any) => s.employee !== employee);
                updatedSignatures.push(newSignature);

                djt.signatures = updatedSignatures;
                await djt.save();

                // Sync to Schedule
                if (djt.schedule_id) {
                    await Schedule.updateOne(
                        { _id: djt.schedule_id },
                        { $set: { 
                            'djt.signatures': updatedSignatures,
                            'DJTSignatures': updatedSignatures 
                        } }
                    );
                }

                return NextResponse.json({ success: true, result: djt });
            }

            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('DJT API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
