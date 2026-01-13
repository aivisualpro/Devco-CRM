import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import { Schedule, Client, Employee, Constant, Estimate, JHA } from '@/lib/models';
const getAppSheetConfig = () => ({
    appId: process.env.APPSHEET_APP_ID || "3a1353f3-966e-467d-8947-a4a4d0c4c0c5",
    accessKey: process.env.APPSHEET_ACCESS || "V2-lWtLA-VV7bn-bEktT-S5xM7-2WUIf-UQmIA-GY6qH-A1S3E",
    tableName: process.env.APSHEET_JOB_SCHEDULE_TABLE || "Job Schedule"
});

async function updateAppSheetSchedule(data: any | any[], action: "Add" | "Edit" | "Delete" = "Edit") {
    if (process.env.NODE_ENV !== 'production') return;

    const { appId, accessKey, tableName } = getAppSheetConfig();
    if (!appId || !accessKey) return;

    const items = Array.isArray(data) ? data : [data];
    if (items.length === 0) return;

    // Helper to format dates YYYY-MM-DD
    const fmtDate = (d: any) => {
        if (!d) return "";
        try {
            const date = new Date(d);
            // Check if valid
            if (isNaN(date.getTime())) return "";
            return date.toISOString().split('T')[0]; 
        } catch { return ""; }
    };

    const rows = items.map((item: any) => {
        // Fetch employee emails for assignees
        let assigneesList = "";
        if (item.assignees && Array.isArray(item.assignees) && item.assignees.length > 0) {
            try {
                // If it IS emails (which frontend sends), we just join them.
                assigneesList = item.assignees.join(', ');
            } catch (e) {
                assigneesList = String(item.assignees || "");
            }
        } else if (typeof item.assignees === 'string') {
            assigneesList = item.assignees;
        }

        return {
            "Record_ID": String(item._id || ""),
            "Title": String(item.title || ""),
            "From": fmtDate(item.fromDate),
            "To": fmtDate(item.toDate),
            "Customer": String(item.customerId || ""),
            "Proposal Number": String(item.estimate || ""),
            "Project Manager Name": String(item.projectManager || ""),
            "Foreman Name": String(item.foremanName || ""),
            "Assignees": assigneesList, 
            "Description": String(item.description || ""),
            "Service Item": String(item.service || ""),
            "Color": String(item.item || ""), // Mapped 'item' to 'Color'
            "Labor Agreement": String(item.fringe || ""),
            "Certified Payroll": String(item.certifiedPayroll || ""),
            "Notify Assignees": String(item.notifyAssignees || ""),
            "Per Diem": String(item.perDiem || "")
        };
    });

    const APPSHEET_URL = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(appId)}/tables/${encodeURIComponent(tableName)}/Action`;

    try {
        await fetch(APPSHEET_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ApplicationAccessKey": accessKey
            },
            body: JSON.stringify({
                Action: action,
                Properties: { Locale: "en-US", Timezone: "Pacific Standard Time" },
                Rows: rows
            })
        });
    } catch (error) {
        console.error("[AppSheet Schedule Doc] Error:", error);
    }
}
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
                // Sync to AppSheet
                await updateAppSheetSchedule(doc, "Add");
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
                // Sync to AppSheet
                if (result) await updateAppSheetSchedule(result, "Edit");
                return NextResponse.json({ success: true, result });
            }

            case 'deleteSchedule': {
                const { id } = payload || {};
                await Schedule.findByIdAndDelete(id);
                // Sync to AppSheet
                await updateAppSheetSchedule({ _id: id }, "Delete");
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
                
                // Sync imported schedules to AppSheet asynchronously
                const syncItems = schedules.map((item: any) => ({
                    ...item,
                    _id: item.recordId || item._id
                }));
                // Batch sync
                await updateAppSheetSchedule(syncItems, "Add");

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

            case 'saveIndividualTimesheet': {
                const { timesheet } = payload || {};
                if (!timesheet || !timesheet.scheduleId || !timesheet.employee) {
                    return NextResponse.json({ success: false, error: 'Missing required fields' });
                }

                // Check if timesheet already exists for this employee on this schedule
                const schedule = await Schedule.findById(timesheet.scheduleId);
                if (!schedule) return NextResponse.json({ success: false, error: 'Schedule not found' });

                const existingIndex = (schedule.timesheet || []).findIndex(ts => ts.employee === timesheet.employee);
                
                if (existingIndex > -1) {
                    // Update existing
                    const updateObj: any = {};
                    Object.keys(timesheet).forEach(key => {
                        updateObj[`timesheet.${existingIndex}.${key}`] = timesheet[key];
                    });
                    updateObj.updatedAt = new Date();
                    
                    await Schedule.updateOne(
                        { _id: timesheet.scheduleId },
                        { $set: updateObj }
                    );
                } else {
                    // Push new
                    if (!timesheet._id) timesheet._id = new mongoose.Types.ObjectId().toString();
                    await Schedule.updateOne(
                        { _id: timesheet.scheduleId },
                        { $push: { timesheet: { ...timesheet, createdAt: new Date() } } }
                    );
                }

                const updatedSchedule = await Schedule.findById(timesheet.scheduleId).lean();
                return NextResponse.json({ success: true, result: updatedSchedule });
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
                // Combined fetch for schedules + initial data (reduces API calls)
                // Using projections to only fetch what's actually rendered
                const [schedules, clients, employees, constants, estimates] = await Promise.all([
                    Schedule.find(query)
                        .select('title estimate customerId customerName fromDate toDate foremanName projectManager assignees service item perDiem fringe certifiedPayroll notifyAssignees description jobLocation aerialImage siteLayout jha djt timesheet JHASignatures DJTSignatures createdAt updatedAt')
                        .sort({ fromDate: -1 })
                        .lean(),
                    Client.find()
                        .select('name _id')
                        .sort({ name: 1 })
                        .lean(),
                    Employee.find()
                        .select('firstName lastName email profilePicture hourlyRateSITE hourlyRateDrive classification companyPosition designation isScheduleActive')
                        .lean(),
                    Constant.find()
                        .select('type description color image')
                        .lean(),
                    Estimate.find({ status: { $ne: 'deleted' } })
                        .select('estimate _id updatedAt createdAt customerId projectTitle projectName jobAddress contactName contactPhone contactEmail contact phone')
                        .lean()
                ]);

                // Determine hasJHA/hasDJT check based on embedded object
                const schedulesWithMetaData = schedules.map((s: any) => ({
                    ...s,
                    hasJHA: !!s.jha && Object.keys(s.jha).length > 0,
                    hasDJT: !!s.djt && Object.keys(s.djt).length > 0
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
                                jobAddress: e.jobAddress,
                                contactName: e.contactName || e.contact,
                                contactPhone: e.contactPhone || e.phone,
                                contactEmail: e.contactEmail
                            });
                        }
                    });

                return NextResponse.json({
                    success: true,
                    result: {
                        schedules: schedulesWithMetaData,
                        initialData: {
                            clients: Array.from(new Map(clients.filter(c => c?._id).map(c => [c._id.toString(), c])).values()),
                            employees: Array.from(new Map(employees.filter(e => e?.email).map(e => [e.email, { 
                                value: e.email, 
                                label: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email, 
                                image: e.profilePicture,
                                hourlyRateSITE: (e as any).hourlyRateSITE,
                                hourlyRateDrive: (e as any).hourlyRateDrive,
                                classification: (e as any).classification,
                                companyPosition: (e as any).companyPosition,
                                designation: (e as any).designation,
                                isScheduleActive: (e as any).isScheduleActive
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
                    Employee.find().select('firstName lastName email profilePicture hourlyRateSITE hourlyRateDrive classification companyPosition designation isScheduleActive').lean(),
                    Constant.find().lean(),
                    Estimate.find({ status: { $ne: 'deleted' } }).select('estimate _id updatedAt createdAt customerId projectTitle projectName jobAddress contactName contactPhone contactEmail contact phone').lean()
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
                                projectTitle: pName,
                                jobAddress: e.jobAddress,
                                contactName: e.contactName || e.contact,
                                contactPhone: e.contactPhone || e.phone,
                                contactEmail: e.contactEmail
                            });
                        }
                    });

                return NextResponse.json({
                    success: true,
                    result: {
                        clients: Array.from(new Map(clients.filter(c => c?._id).map(c => [c._id.toString(), c])).values()),
                        employees: Array.from(new Map(employees.filter(e => e?.email).map(e => [e.email, { 
                            value: e.email, 
                            label: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email, 
                            image: e.profilePicture,
                            classification: (e as any).classification,
                            companyPosition: (e as any).companyPosition,
                            designation: (e as any).designation,
                            isScheduleActive: (e as any).isScheduleActive
                        }])).values()),
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
