
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { DailyJobTicket, Schedule, Activity, DJTSignature, Constant, OverheadItem, EquipmentItem } from '@/lib/models';
import mongoose from 'mongoose';
import { robustNormalizeISO } from '@/lib/timeCardUtils';
import { getWeekIdFromDate } from '@/lib/scheduleUtils';
import { revalidateTag } from 'next/cache';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, payload } = body;

        await connectToDatabase();

        switch (action) {
            // ...
            case 'saveDJT': {
                const djtData = payload;

                // CRITICAL: Prevent duplicate DJTs per schedule.
                // If no _id is provided, check if a DJT already exists for this schedule_id.
                // This prevents creating a new document every time a new DJT form is saved.
                let idToUse = djtData._id;
                if (!idToUse && djtData.schedule_id) {
                    const existing = await DailyJobTicket.findOne({ schedule_id: djtData.schedule_id }, { _id: 1 }).lean();
                    idToUse = existing ? String(existing._id) : new mongoose.Types.ObjectId().toString();
                } else if (!idToUse) {
                    idToUse = new mongoose.Types.ObjectId().toString();
                }

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

                if ((updatedDJT as any)?.date || updatedDJT?.createdAt) {
                    revalidateTag(`dashboard-${getWeekIdFromDate((updatedDJT as any)?.date || updatedDJT.createdAt)}`, undefined as any);
                }

                return NextResponse.json({ success: true, result: updatedDJT });
            }

            case 'getDJT': {
                const { schedule_id, id } = payload || {};
                if (!schedule_id && !id) return NextResponse.json({ success: false, error: 'Missing schedule_id or id' });

                const query = schedule_id
                    ? { $or: [{ schedule_id }, { _id: schedule_id }] }
                    : { _id: id };

                const djt = await DailyJobTicket.findOne(query).lean();
                if (!djt) return NextResponse.json({ success: false, error: 'DJT not found' });

                // Also fetch the schedule for context
                const scheduleId = (djt as any).schedule_id || schedule_id;
                let scheduleDoc = null;
                if (scheduleId) {
                    scheduleDoc = await Schedule.findById(scheduleId).lean();
                }

                return NextResponse.json({
                    success: true,
                    result: {
                        ...djt,
                        signatures: (scheduleDoc as any)?.DJTSignatures || (djt as any).signatures || [],
                        scheduleRef: scheduleDoc
                    }
                });
            }

            case 'getDJTs': {
                const { page = 1, limit = 20, search = '', scheduleIds: filterScheduleIds, estimate: filterEstimate } = payload;
                const skip = (page - 1) * limit;

                // Build base query - optionally filter by scheduleIds or estimate
                const baseQuery: any = {};
                if (filterEstimate) {
                    // Look up all schedule IDs for this estimate, then filter DJTs by those
                    const estSchedules = await Schedule.find({ estimate: filterEstimate }, { _id: 1 }).lean();
                    const estScheduleIds = estSchedules.map((s: any) => String(s._id));
                    baseQuery.schedule_id = { $in: estScheduleIds };
                } else if (filterScheduleIds && Array.isArray(filterScheduleIds) && filterScheduleIds.length > 0) {
                    baseQuery.schedule_id = { $in: filterScheduleIds };
                }

                if (!search) {
                    // OPTIMIZED PATH: No Search - fast find + manual join
                    const totalPromise = DailyJobTicket.countDocuments(baseQuery);
                    const djts = await DailyJobTicket.find(baseQuery)
                        .sort({ date: -1, createdAt: -1 })
                        .skip(skip)
                        .limit(limit)
                        .lean();

                    const total = await totalPromise;

                    if (djts.length === 0) {
                        return NextResponse.json({ success: true, result: { djts: [], total: 0 } });
                    }

                    const scheduleIds = djts.map((d: any) => d.schedule_id).filter(Boolean);
                    const schedules = await Schedule.find({ _id: { $in: scheduleIds } })
                        .select('_id title estimate customerId customerName fromDate toDate foremanName projectManager assignees jobLocation DJTSignatures')
                        .lean();

                    const djtsWithSchedule = djts.map((d: any) => {
                        const schedule = schedules.find((s: any) => String(s._id) === String(d.schedule_id));
                        return { ...d, scheduleRef: schedule || null };
                    });

                    return NextResponse.json({ success: true, result: { djts: djtsWithSchedule, total } });
                } else {
                    // SEARCH PATH: Aggregation with $lookup to search across joined fields
                    const searchRegex = { $regex: search, $options: 'i' };
                    const pipeline: any[] = [
                        // Schedule lookup — direct string match, no $toString needed
                        {
                            $lookup: {
                                from: 'devcoschedules',
                                localField: 'schedule_id',
                                foreignField: '_id',
                                pipeline: [
                                    { $project: {
                                        _id: 1, title: 1, estimate: 1, customerId: 1, customerName: 1,
                                        fromDate: 1, toDate: 1, foremanName: 1, projectManager: 1,
                                        assignees: 1, jobLocation: 1, DJTSignatures: 1
                                    }}
                                ],
                                as: 'scheduleDocs'
                            }
                        },
                        { $unwind: { path: '$scheduleDocs', preserveNullAndEmptyArrays: true } },
                        // Client lookup — direct string match
                        {
                            $lookup: {
                                from: 'clients',
                                localField: 'scheduleDocs.customerId',
                                foreignField: '_id',
                                pipeline: [{ $project: { name: 1 } }],
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
                                    { dailyJobDescription: searchRegex },
                                    { createdBy: searchRegex },
                                    { computedCustomerName: searchRegex },
                                    { computedEstimate: searchRegex },
                                    { dateStr: searchRegex }
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

                if ((djtToDelete as any)?.date || djtToDelete?.createdAt) {
                    revalidateTag(`dashboard-${getWeekIdFromDate((djtToDelete as any)?.date || djtToDelete.createdAt)}`, undefined as any);
                }

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
                    // Automatically create a new DJT on the fly if it doesn't exist yet
                    djt = new DailyJobTicket({
                        _id: new mongoose.Types.ObjectId().toString(),
                        schedule_id: schedule_id,
                        createdBy: createdBy || employee || 'system',
                        createdAt: new Date(),
                        signatures: []
                    });
                }

                // Patch missing createdBy if needed (legacy docs or incomplete creations)
                if (!djt.createdBy) {
                    djt.createdBy = createdBy || employee || 'system';
                }

                // TIMEZONE-SAFE: Use robustNormalizeISO for all date handling
                // Never use new Date() to parse schedule dates — it converts to UTC,
                // shifting times by the server's timezone offset.
                // clientNow should already be a nominal ISO string from the client.
                const clockOutISO = clientNow
                    ? robustNormalizeISO(clientNow)
                    : (() => {
                        // Fallback: use server's local time AS-IS (nominal, no UTC conversion)
                        const now = new Date();
                        const y = now.getFullYear();
                        const mo = String(now.getMonth() + 1).padStart(2, '0');
                        const d = String(now.getDate()).padStart(2, '0');
                        const h = String(now.getHours()).padStart(2, '0');
                        const mi = String(now.getMinutes()).padStart(2, '0');
                        const s = String(now.getSeconds()).padStart(2, '0');
                        return `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`;
                    })();

                // Create signature object with all required fields
                const newSignature = {
                    employee,           // employeeEmail
                    signature,          // signature base64 image
                    lunchStart: lunchStart || null,
                    lunchEnd: lunchEnd || null,
                    clockOut: clockOutISO,
                    date: new Date(clockOutISO),
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
                    // TIMEZONE-SAFE: Use robustNormalizeISO to get the nominal ISO string
                    // This ensures "2026-02-04T07:00" stays as "2026-02-04T07:00:00.000Z"
                    // instead of being shifted by new Date() parsing
                    const clockInISO = schedule.fromDate
                        ? new Date(schedule.fromDate).toISOString()
                        : clockOutISO;

                    // Extract date part from the normalized ISO string (YYYY-MM-DD)
                    const scheduleDate = clockInISO.split('T')[0];
                    let lunchStartDateTime = null;
                    let lunchEndDateTime = null;

                    // TIMEZONE-SAFE: Build lunch ISO strings via string concatenation, not new Date()
                    if (lunchStart) {
                        lunchStartDateTime = `${scheduleDate}T${lunchStart}:00.000Z`;
                    }
                    if (lunchEnd) {
                        lunchEndDateTime = `${scheduleDate}T${lunchEnd}:00.000Z`;
                    }

                    // Create "Site Time" timesheet record for this employee
                    const timesheetRecord = {
                        _id: new mongoose.Types.ObjectId().toString(),
                        scheduleId: djt.schedule_id,
                        employee: employee,
                        type: 'Site Time',
                        clockIn: clockInISO,
                        clockOut: clockOutISO,
                        lunchStart: lunchStartDateTime,
                        lunchEnd: lunchEndDateTime,
                        status: 'Pending',
                        createdAt: clockOutISO,
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
                        updateObj[`timesheet.${existingIndex}.clockOut`] = clockOutISO;
                        if (lunchStartDateTime) updateObj[`timesheet.${existingIndex}.lunchStart`] = lunchStartDateTime;
                        if (lunchEndDateTime) updateObj[`timesheet.${existingIndex}.lunchEnd`] = lunchEndDateTime;
                        updateObj[`timesheet.${existingIndex}.updatedAt`] = clockOutISO;
                        
                        updateObj['DJTSignatures'] = updatedSignatures;
                        if (schedule?.djt) {
                            updateObj['djt.signatures'] = updatedSignatures;
                        }

                        await Schedule.updateOne(
                            { _id: djt.schedule_id },
                            { $set: updateObj }
                        );
                    } else {
                        // Push new timesheet record
                        const setObj: any = { 'DJTSignatures': updatedSignatures };
                        if (schedule?.djt) {
                            setObj['djt.signatures'] = updatedSignatures;
                        }

                        await Schedule.updateOne(
                            { _id: djt.schedule_id },
                            {
                                $push: { timesheet: timesheetRecord },
                                $set: setObj
                            }
                        );
                    }
                } else {
                    // No schedule found, just sync signatures
                    if (djt.schedule_id) {
                        // Use a find operation to check if djt is null before updating, or just set DJTSignatures
                        // Since we don't have the schedule object here, it's safer to just set DJTSignatures
                        // to avoid the {djt: null} error on an unknown schedule.
                        await Schedule.updateOne(
                            { _id: djt.schedule_id },
                            { $set: { 'DJTSignatures': updatedSignatures } }
                        );
                    }
                }

                // Return the updated DJT with signatures
                const resultDJT = djt.toObject ? djt.toObject() : djt;
                resultDJT.signatures = updatedSignatures;

                if (schedule?.fromDate) {
                    revalidateTag(`dashboard-${getWeekIdFromDate(schedule.fromDate)}`, undefined as any);
                } else if ((djt as any)?.date || djt?.createdAt) {
                    revalidateTag(`dashboard-${getWeekIdFromDate((djt as any)?.date || djt.createdAt)}`, undefined as any);
                }

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
