
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

                // Calculate Cost - Sum of owned equipment costs only
                let totalCost = 0;
                
                // Fetch equipment items to get official rates
                const equipmentItems = await EquipmentItem.find().lean();

                // Equipment Cost - Only sum where type="owned"
                if (djtData.equipmentUsed && Array.isArray(djtData.equipmentUsed)) {
                    djtData.equipmentUsed = djtData.equipmentUsed.map((eq: any) => {
                        // Find matching equipment item in DB to get official rate
                        const dbItem = equipmentItems.find((i: any) => 
                            String(i._id) === String(eq.equipment) || 
                            String(i.equipmentMachine) === String(eq.equipment) ||
                            String(i.value) === String(eq.equipment)
                        );
                        const dailyRate = dbItem ? (Number(dbItem.dailyCost) || 0) : (Number(eq.cost) || 0);

                        // Only add to total cost if type is "owned" and qty > 0
                        if (eq.type?.toLowerCase() === 'owned' && Number(eq.qty) > 0) {
                            totalCost += (Number(eq.qty) || 0) * dailyRate;
                        }
                        
                        // Preserve the cost in the saved record for historical accuracy
                        return { ...eq, cost: dailyRate };
                    });
                }

                // djtCost is ONLY the sum of owned equipment costs
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

                if (!search) {
                    // OPTIMIZED PATH: No Search - fast find + manual join
                    const totalPromise = DailyJobTicket.countDocuments({});
                    const djts = await DailyJobTicket.find({})
                        .sort({ date: -1, createdAt: -1 })
                        .skip(skip)
                        .limit(limit)
                        .lean();

                    const total = await totalPromise;

                    if (djts.length === 0) {
                        return NextResponse.json({ success: true, result: { djts: [], total: 0 } });
                    }

                    const scheduleIds = djts.map((d: any) => d.schedule_id).filter(Boolean);
                    const schedules = await Schedule.find({ _id: { $in: scheduleIds } }).lean();
                    
                    const djtsWithSchedule = djts.map((d: any) => {
                        const schedule = schedules.find((s: any) => String(s._id) === String(d.schedule_id));
                        return { ...d, scheduleRef: schedule || null };
                    });

                    return NextResponse.json({ success: true, result: { djts: djtsWithSchedule, total } });
                } else {
                    // SEARCH PATH: Aggregation with $lookup to search across joined fields
                    const pipeline: any[] = [
                        {
                            $lookup: {
                                from: 'devcoschedules',
                                let: { schedId: "$schedule_id" },
                                pipeline: [
                                    { $match: { $expr: { $eq: [{ $toString: "$_id" }, { $toString: { $ifNull: ["$$schedId", "000000000000000000000000"] } }] } } }
                                ],
                                as: 'scheduleDocs'
                            }
                        },
                        { $unwind: { path: '$scheduleDocs', preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: 'clients',
                                let: { cid: "$scheduleDocs.customerId" },
                                pipeline: [
                                    { $match: { $expr: { $eq: [{ $toString: "$_id" }, { $toString: { $ifNull: ["$$cid", "000000000000000000000000"] } }] } } }
                                ],
                                as: 'clientDocs'
                            }
                        },
                        { $unwind: { path: '$clientDocs', preserveNullAndEmptyArrays: true } },
                        {
                            $addFields: {
                                computedCustomerName: { 
                                    $ifNull: ['$scheduleDocs.customerName', '$clientDocs.name', '-'] 
                                },
                                computedEstimate: { $ifNull: ['$scheduleDocs.estimate', 'No Est'] },
                                dateStr: { $dateToString: { format: "%m/%d/%Y", date: "$date" } }
                            }
                        },
                        {
                            $match: {
                                $or: [
                                    { dailyJobDescription: { $regex: search, $options: 'i' } },
                                    { createdBy: { $regex: search, $options: 'i' } },
                                    { computedCustomerName: { $regex: search, $options: 'i' } },
                                    { computedEstimate: { $regex: search, $options: 'i' } },
                                    { dateStr: { $regex: search, $options: 'i' } }
                                ]
                            }
                        },
                        { $sort: { date: -1, createdAt: -1 } },
                        {
                            $facet: {
                                metadata: [{ $count: "total" }],
                                data: [
                                    { $skip: skip },
                                    { $limit: limit },
                                    {
                                        $addFields: {
                                            scheduleRef: {
                                                $mergeObjects: [
                                                    '$scheduleDocs',
                                                    { customerName: '$computedCustomerName' }
                                                ]
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    ];

                    const result = await DailyJobTicket.aggregate(pipeline).allowDiskUse(true);
                    const data = result[0].data;
                    const total = result[0].metadata[0]?.total || 0;

                    return NextResponse.json({ success: true, result: { djts: data, total } });
                }
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
                const { schedule_id, employee, signature, lunchStart, lunchEnd, createdBy, clientNow } = payload;
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

                // Use the client's local time (timezone-agnostic) if provided, otherwise fall back to server time
                // The clientNow is an ISO string representing the user's literal local time
                const clockOutTime = clientNow ? new Date(clientNow) : new Date();

                // Create signature object with all required fields
                const newSignature = {
                    employee,           // employeeEmail
                    signature,          // signature base64 image
                    lunchStart: lunchStart || null,
                    lunchEnd: lunchEnd || null,
                    clockOut: clockOutTime.toISOString(),
                    date: clockOutTime,
                    signedBy: createdBy || employee
                };

                // Remove existing signature for this employee if any
                const existingSignatures = djt.signatures || [];
                const updatedSignatures = existingSignatures.filter((s: any) => s.employee !== employee);
                updatedSignatures.push(newSignature);

                djt.signatures = updatedSignatures;
                await djt.save();

                // Fetch the schedule to get fromDate for clockIn
                const schedule = await Schedule.findById(djt.schedule_id).lean();
                
                if (schedule) {
                    // Create clockIn from schedule's fromDate
                    const clockInTime = schedule.fromDate ? new Date(schedule.fromDate) : clockOutTime;

                    // Combine date from schedule with lunch times if provided
                    const scheduleDate = clockInTime.toISOString().split('T')[0];
                    let lunchStartDateTime = null;
                    let lunchEndDateTime = null;
                    
                    if (lunchStart) {
                        lunchStartDateTime = new Date(`${scheduleDate}T${lunchStart}:00`).toISOString();
                    }
                    if (lunchEnd) {
                        lunchEndDateTime = new Date(`${scheduleDate}T${lunchEnd}:00`).toISOString();
                    }

                    // Create "Site Time" timesheet record for this employee
                    const timesheetRecord = {
                        _id: new mongoose.Types.ObjectId().toString(),
                        scheduleId: djt.schedule_id,
                        employee: employee,
                        type: 'Site Time',
                        clockIn: clockInTime.toISOString(),
                        clockOut: clockOutTime.toISOString(),
                        lunchStart: lunchStartDateTime,
                        lunchEnd: lunchEndDateTime,
                        status: 'Pending',
                        createdAt: clockOutTime.toISOString(),
                        createdBy: createdBy || employee
                    };

                    // Check if a "Site Time" record already exists for this employee on this schedule
                    const existingTimesheets = (schedule as any).timesheet || [];
                    const existingIndex = existingTimesheets.findIndex((ts: any) => 
                        ts.employee?.toLowerCase() === employee.toLowerCase() && 
                        ts.type === 'Site Time'
                    );

                    if (existingIndex > -1) {
                        // Update existing timesheet
                        const updateObj: any = {};
                        updateObj[`timesheet.${existingIndex}.clockOut`] = clockOutTime.toISOString();
                        if (lunchStartDateTime) updateObj[`timesheet.${existingIndex}.lunchStart`] = lunchStartDateTime;
                        if (lunchEndDateTime) updateObj[`timesheet.${existingIndex}.lunchEnd`] = lunchEndDateTime;
                        updateObj[`timesheet.${existingIndex}.updatedAt`] = clockOutTime.toISOString();

                        await Schedule.updateOne(
                            { _id: djt.schedule_id },
                            { 
                                $set: { 
                                    ...updateObj,
                                    'djt.signatures': updatedSignatures,
                                    'DJTSignatures': updatedSignatures 
                                } 
                            }
                        );
                    } else {
                        // Push new timesheet record
                        await Schedule.updateOne(
                            { _id: djt.schedule_id },
                            { 
                                $push: { timesheet: timesheetRecord },
                                $set: { 
                                    'djt.signatures': updatedSignatures,
                                    'DJTSignatures': updatedSignatures 
                                } 
                            }
                        );
                    }
                } else {
                    // No schedule found, just sync signatures
                    if (djt.schedule_id) {
                        await Schedule.updateOne(
                            { _id: djt.schedule_id },
                            { $set: { 
                                'djt.signatures': updatedSignatures,
                                'DJTSignatures': updatedSignatures 
                            } }
                        );
                    }
                }

                // Return the updated DJT with signatures
                const resultDJT = djt.toObject ? djt.toObject() : djt;
                resultDJT.signatures = updatedSignatures;
                
                return NextResponse.json({ success: true, result: resultDJT });
            }

            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('DJT API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
