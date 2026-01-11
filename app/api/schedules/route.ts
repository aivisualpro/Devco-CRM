import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Schedule, Client, Employee, Constant, Estimate, JHA } from '@/lib/models';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, payload } = body;
        
        await connectToDatabase();

        switch (action) {
            case 'getSchedules': {
                const results = await Schedule.find().sort({ fromDate: -1 }).lean();
                return NextResponse.json({ success: true, result: results });
            }

            case 'getScheduleById': {
                const { id } = payload || {};
                const result = await Schedule.findById(id).lean();
                console.log('FETCHED SCHEDULE:', id, JSON.stringify(result?.timesheet?.[0], null, 2));
                return NextResponse.json({ success: true, result });
            }

            case 'createSchedule': {
                const doc = await Schedule.create({
                    ...payload,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                return NextResponse.json({ success: true, result: doc });
            }

            case 'updateSchedule': {
                const { id, ...data } = payload || {};
                console.log('UPDATING SCHEDULE:', id, JSON.stringify(data.timesheet?.[0], null, 2));
                const result = await Schedule.findByIdAndUpdate(
                    id,
                    { ...data, updatedAt: new Date() },
                    { new: true }
                );
                return NextResponse.json({ success: true, result });
            }

            case 'deleteSchedule': {
                const { id } = payload || {};
                await Schedule.findByIdAndDelete(id);
                return NextResponse.json({ success: true });
            }

            case 'importSchedules': {
                const { schedules } = payload || {};
                if (!Array.isArray(schedules)) return NextResponse.json({ success: false, error: 'Invalid array' });

                const ops = schedules.map((item: any) => {
                    // Extract recordId to use as _id, delete from item payload so it doesn't fail schema validation
                    const { recordId, ...rest } = item;
                    const idToUse = recordId || item._id;

                    return {
                        updateOne: {
                            filter: { _id: idToUse },
                            update: {
                                $set: { ...rest, _id: idToUse },
                                $setOnInsert: { createdAt: new Date() }
                            },
                            upsert: true
                        }
                    };
                });

                const result = await Schedule.bulkWrite(ops);
                return NextResponse.json({ success: true, result });
            }

            case 'importTimesheets': {
                const { timesheets } = payload || {};
                if (!Array.isArray(timesheets)) return NextResponse.json({ success: false, error: 'Invalid timesheets array' });

                const ops = timesheets.map((ts: any) => {
                    if (!ts.scheduleId) return null;
                    
                    // Ensure _id exists for the timesheet subdocument
                    if (!ts._id && ts.recordId) ts._id = ts.recordId;
                    
                    return {
                        updateOne: {
                            filter: { _id: ts.scheduleId },
                            update: {
                                $push: { timesheet: ts }
                            }
                        }
                    };
                }).filter(Boolean);

                if (ops.length === 0) return NextResponse.json({ success: false, error: 'No valid timesheets to import (missing scheduleId)' });

                const result = await Schedule.bulkWrite(ops as any);
                return NextResponse.json({ success: true, result });
            }

            case 'getSchedulesPage': {
                const { startDate, endDate } = payload || {};
                const query: any = {};
                
                // If no dates provided, limit to last 60 days to keep things snappy
                if (!startDate && !endDate) {
                    const sixtyDaysAgo = new Date();
                    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
                    query.fromDate = { $gte: sixtyDaysAgo.toISOString() };
                } else {
                    if (startDate || endDate) {
                        query.fromDate = {};
                        if (startDate) query.fromDate.$gte = startDate;
                        if (endDate) query.fromDate.$lte = endDate;
                    }
                }

                // Combined fetch for schedules + initial data (reduces API calls)
                // Using projections to only fetch what's actually rendered
                const [schedules, clients, employees, constants, estimates] = await Promise.all([
                    Schedule.find(query)
                        .select('estimate customerId customerName fromDate toDate foremanName projectManager assignees service item perDiem certifiedPayroll description aerialImage siteLayout jha timesheet')
                        .sort({ fromDate: -1 })
                        .lean(),
                    Client.find()
                        .select('name _id')
                        .sort({ name: 1 })
                        .lean(),
                    Employee.find()
                        .select('firstName lastName email profilePicture hourlyRateSITE hourlyRateDrive classification companyPosition')
                        .lean(),
                    Constant.find()
                        .select('type description color image')
                        .lean(),
                    Estimate.find({ status: { $ne: 'deleted' } })
                        .select('estimate _id updatedAt createdAt customerId projectTitle projectName jobAddress')
                        .lean()
                ]);

                // Determine hasJHA check based on embedded object
                const schedulesWithJHA = schedules.map((s: any) => ({
                    ...s,
                    hasJHA: !!s.jha && Object.keys(s.jha).length > 0
                }));

                // Process estimates to keep unique estimate numbers
                const uniqueEstimates = new Map();
                estimates
                    .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
                    .forEach((e: any) => {
                        if (e.estimate && !uniqueEstimates.has(e.estimate)) {
                            const pName = e.projectTitle || e.projectName || '';
                            uniqueEstimates.set(e.estimate, { 
                                value: e.estimate, 
                                label: pName ? `${e.estimate} - ${pName}` : e.estimate, 
                                customerId: e.customerId,
                                projectTitle: pName,
                                jobAddress: e.jobAddress
                            });
                        }
                    });

                return NextResponse.json({
                    success: true,
                    result: {
                        schedules: schedulesWithJHA,
                        initialData: {
                            clients: Array.from(new Map(clients.filter(c => c?._id).map(c => [c._id.toString(), c])).values()),
                            employees: Array.from(new Map(employees.filter(e => e?.email).map(e => [e.email, { 
                                value: e.email, 
                                label: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email, 
                                image: e.profilePicture,
                                hourlyRateSITE: (e as any).hourlyRateSITE,
                                hourlyRateDrive: (e as any).hourlyRateDrive,
                                classification: (e as any).classification,
                                companyPosition: (e as any).companyPosition
                            }])).values()),
                            constants: Array.from(new Map(constants.filter(c => c?.type && c?.description).map(c => [`${c.type}-${c.description}`, c])).values()),
                            estimates: Array.from(uniqueEstimates.values())
                        }
                    }
                });
            }

            case 'getInitialData': {
                const [clients, employees, constants, estimates] = await Promise.all([
                    Client.find().select('name _id').sort({ name: 1 }).lean(),
                    Employee.find().select('firstName lastName email profilePicture hourlyRateSITE hourlyRateDrive').lean(),
                    Constant.find().lean(),
                    Estimate.find({ status: { $ne: 'deleted' } }).select('estimate _id updatedAt createdAt customerId projectTitle projectName').lean()
                ]);

                // Process estimates to keep unique estimate numbers but preserve customerId (from latest version)
                const uniqueEstimates = new Map();
                estimates
                    .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
                    .forEach((e: any) => {
                        if (e.estimate && !uniqueEstimates.has(e.estimate)) {
                            const pName = e.projectTitle || e.projectName || '';
                            uniqueEstimates.set(e.estimate, { 
                                value: e.estimate, 
                                label: pName ? `${e.estimate} - ${pName}` : e.estimate, 
                                customerId: e.customerId,
                                projectTitle: pName
                            });
                        }
                    });

                return NextResponse.json({
                    success: true,
                    result: {
                        clients: Array.from(new Map(clients.filter(c => c?._id).map(c => [c._id.toString(), c])).values()),
                        employees: Array.from(new Map(employees.filter(e => e?.email).map(e => [e.email, { value: e.email, label: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email, image: e.profilePicture }])).values()),
                        constants: Array.from(new Map(constants.filter(c => c?.type && c?.description).map(c => [`${c.type}-${c.description}`, c])).values()),
                        estimates: Array.from(uniqueEstimates.values())
                    }
                });
            }

            default:
                return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
