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
        // Fetch employee emails for assignees (AppSheet expects "email , email" format)
        let assigneesList = "";
        if (item.assignees && Array.isArray(item.assignees) && item.assignees.length > 0) {
             assigneesList = item.assignees.join(' , ');
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
            "Per Diem": String(item.perDiem || ""),
            "Aerial Image": String(item.aerialImage || ""),
            "Site Layout": String(item.siteLayout || ""),
            "todayObjectives": Array.isArray(item.todayObjectives) 
                ? item.todayObjectives.map((obj: any) => typeof obj === 'string' ? obj : obj.text).join(' , ') 
                : String(item.todayObjectives || "") 
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

                // Fetch the schedule
                const schedule = await Schedule.findById(timesheet.scheduleId);
                if (!schedule) return NextResponse.json({ success: false, error: 'Schedule not found' });

                // For Drive Time, we need to find an ACTIVE one (no clockOut) to update
                // OR create a new entry if none exists
                let existingIndex = -1;
                
                if (timesheet._id) {
                    // If we have an _id, find that specific timesheet
                    existingIndex = (schedule.timesheet || []).findIndex((ts: any) => 
                        String(ts._id) === String(timesheet._id)
                    );
                } else if (timesheet.type === 'Drive Time' && timesheet.clockIn && !timesheet.clockOut) {
                    // For new Drive Time entries, always push new (don't update existing)
                    existingIndex = -1;
                } else if (timesheet.type === 'Drive Time' && timesheet.clockOut) {
                    // Stopping Drive Time: find the active one for this employee
                    existingIndex = (schedule.timesheet || []).findIndex((ts: any) => 
                        ts.employee === timesheet.employee && 
                        ts.type === 'Drive Time' && 
                        (!ts.clockOut || ts.clockOut === '' || ts.clockOut === null)
                    );
                } else {
                    // For other types, find by employee and type
                    existingIndex = (schedule.timesheet || []).findIndex((ts: any) => 
                        ts.employee === timesheet.employee && ts.type === timesheet.type
                    );
                }
                
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

            case 'getScheduleActivity': {
                const { start, end, userEmail } = payload || {};
                const filters: any = {};
                
                if (start && end) {
                    filters.fromDate = { 
                        $gte: new Date(start), 
                        $lte: new Date(end) 
                    };
                }

                // User Permission Filter
                if (userEmail) {
                    const userFilter = [
                        { projectManager: userEmail },
                        { foremanName: userEmail },
                        { assignees: userEmail }
                    ];
                    filters.$or = userFilter;
                }

                // Fetch only fromDate
                const results = await Schedule.find(filters).select('fromDate').lean();
                return NextResponse.json({ success: true, result: results });
            }

            case 'getSchedulesPage': {
                const { 
                    page = 1, 
                    limit = 20, 
                    search = '', 
                    filters = {}, 
                    selectedDates = [], 
                    userEmail, 
                    skipInitialData,
                    startDate,
                    endDate
                } = payload || {};

                const matchStage: any = {};

                // 1. Date Filter (Range or Week View)
                if (startDate && endDate) {
                    matchStage.fromDate = {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    };
                } else if (selectedDates && selectedDates.length > 0) {
                     // Match fromDate stringified to YYYY-MM-DD in the selectedDates array
                     matchStage.$expr = {
                        $in: [
                            { $dateToString: { format: "%Y-%m-%d", date: "$fromDate", timezone: "America/Los_Angeles" } }, // Adjust timezone as needed or use UTC if dates are stored normalized
                            selectedDates
                        ]
                     };
                }

                // 2. Search Filter (Multi-field)
                if (search) {
                    const searchRegex = { $regex: search, $options: 'i' };
                    matchStage.$or = [
                        { title: searchRegex },
                        { customerName: searchRegex },
                        { estimate: searchRegex },
                        { jobLocation: searchRegex },
                        { service: searchRegex },
                        { item: searchRegex }
                    ];
                }

                // 3. User Permission Filter (Super Fast)
                if (userEmail) {
                    const userFilter = [
                        { projectManager: userEmail },
                        { foremanName: userEmail },
                        { assignees: userEmail }
                    ];
                     if (matchStage.$or) {
                        matchStage.$and = [
                            { $or: matchStage.$or },
                            { $or: userFilter }
                        ];
                        delete matchStage.$or;
                    } else {
                        matchStage.$or = userFilter;
                    }
                }

                // 4. Specific Dropdown Filters
                if (filters.estimate) matchStage.estimate = filters.estimate;
                if (filters.client) matchStage.customerId = filters.client; // Assuming client ID passed
                if (filters.service) matchStage.service = filters.service;
                if (filters.tag) matchStage.item = filters.tag;
                if (filters.certifiedPayroll) matchStage.certifiedPayroll = filters.certifiedPayroll;
                
                if (filters.employee) {
                     const empQuery = [
                        { projectManager: filters.employee },
                        { foremanName: filters.employee },
                        { assignees: filters.employee }
                    ];
                    // Merge with existing AND/OR structure if necessary, but usually this is standalone AND
                    // Simplest way for adding to TOP level AND:
                    if (matchStage.$or && !userEmail && !search) { 
                        // If only other $or exists (unlikely given logic above), rigorous merge needed.
                        // But here, filters.employee implies an AND requirement on top of others.
                        // So we use $and explicitly if there's potential conflict, or just implied AND key
                        // But we can't have duplicate keys in object.
                        // Let's use $and for safety if we already have complex logic
                         matchStage.$and = [
                            ...(matchStage.$and || []),
                            { $or: empQuery }
                         ];
                    } else {
                         // If we already have $and
                         if (matchStage.$and) {
                             matchStage.$and.push({ $or: empQuery });
                         } else {
                             // Create $and to combine with potential existing $or (from search/user) OR just standalone
                             // Wait, if matchStage.$or exists from search/user, we shouldn't overwrite it.
                             if (matchStage.$or) {
                                  matchStage.$and = [ { $or: matchStage.$or }, { $or: empQuery } ];
                                  delete matchStage.$or;
                             } else {
                                 matchStage.$or = empQuery;
                             }
                         }
                    }
                }

                const skip = (page - 1) * limit;

                const pipeline: any[] = [
                    { $match: matchStage },
                    {
                        $facet: {
                            metadata: [{ $count: "total" }],
                            data: [
                                { $sort: { fromDate: -1 } },
                                { $skip: skip },
                                { $limit: limit },
                                // Project fields needed for UI to reduce payload
                                { $project: {
                                    title: 1, estimate: 1, customerId: 1, customerName: 1, 
                                    fromDate: 1, toDate: 1, foremanName: 1, projectManager: 1, 
                                    assignees: 1, service: 1, item: 1, perDiem: 1, fringe: 1, 
                                    certifiedPayroll: 1, notifyAssignees: 1, description: 1, 
                                    jobLocation: 1, aerialImage: 1, siteLayout: 1, 
                                    jha: 1, djt: 1, timesheet: 1, JHASignatures: 1, DJTSignatures: 1,
                                    todayObjectives: 1,
                                    createdAt: 1, updatedAt: 1
                                }}
                            ]
                        }
                    }
                ];

                const [aggResult, ...metadata] = await Promise.all([
                    Schedule.aggregate(pipeline),
                    !skipInitialData ? Client.find().select('name _id').sort({ name: 1 }).lean() : Promise.resolve([]),
                    !skipInitialData ? Employee.find().select('firstName lastName email profilePicture hourlyRateSITE hourlyRateDrive classification companyPosition designation isScheduleActive').lean() : Promise.resolve([]),
                    !skipInitialData ? Constant.find().select('type description color image').lean() : Promise.resolve([]),
                    !skipInitialData ? Estimate.find({ status: { $ne: 'deleted' } }).select('estimate _id updatedAt createdAt customerId projectTitle projectName jobAddress contactName contactPhone contactEmail contact phone scopeOfWork proposal services fringe certifiedPayroll projectDescription proposals').lean() : Promise.resolve([])
                ]);

                const resultDocs = aggResult[0].data;
                const totalCount = aggResult[0].metadata[0]?.total || 0;

                // Process initial data... (Same as before)
                const [clients, employees, constants, estimates] = metadata;

                const schedulesWithMetaData = resultDocs.map((s: any) => ({
                    ...s,
                    hasJHA: !!s.jha && Object.keys(s.jha).length > 0,
                    hasDJT: !!s.djt && Object.keys(s.djt).length > 0
                }));

                const finalResult: any = { 
                    schedules: schedulesWithMetaData,
                    total: totalCount,
                    page,
                    totalPages: Math.ceil(totalCount / limit)
                };

                 if (!skipInitialData) {
                    // Process estimates to keep unique estimate numbers (Latest first)
                    const uniqueEstimates = new Map();
                    estimates
                        ?.sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
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
                                    contactEmail: e.contactEmail,
                                    // New fields
                                    scopeOfWork: (() => {
                                        if (e.projectDescription) return e.projectDescription;
                                        // Fallback to latest proposal content
                                        if (e.proposals && e.proposals.length > 0) {
                                            const latest = e.proposals.sort((a: any, b: any) => new Date(b.generatedAt || 0).getTime() - new Date(a.generatedAt || 0).getTime())[0];
                                            let html = '';
                                            if (latest?.customPages?.[0]?.content) {
                                                html = latest.customPages[0].content;
                                            } else if (latest?.htmlContent) {
                                                html = latest.htmlContent;
                                            }

                                            if (html) {
                                                // 1. Locate "PROJECT SCOPE OF WORK" and ignore everything before it
                                                // We look for the phrase in a case-insensitive way
                                                const scopeIndex = html.toLowerCase().indexOf('project scope of work');
                                                if (scopeIndex !== -1) {
                                                    html = html.substring(scopeIndex + 'project scope of work'.length);
                                                }

                                                // 2. Convert <p> and <br> to newlines to preserve spacing
                                                // Replace block tags with double newlines for paragraph separation
                                                html = html.replace(/<\/p>/gi, '\n\n')
                                                           .replace(/<br\s*\/?>/gi, '\n')
                                                           .replace(/<\/div>/gi, '\n')
                                                           .replace(/<\/tr>/gi, '\n');
                                                
                                                // 3. Strip remaining HTML tags
                                                let text = html.replace(/<[^>]*>/g, '');

                                                // 4. Remove "Lump Sum" line if present
                                                const lumpSumIndex = text.indexOf('{{aggregations.grandTotal}}');
                                                if (lumpSumIndex !== -1) {
                                                    text = text.substring(0, lumpSumIndex);
                                                }

                                                // 5. Decode HTML entities (basic ones)
                                                text = text.replace(/&nbsp;/g, ' ')
                                                           .replace(/&amp;/g, '&')
                                                           .replace(/&lt;/g, '<')
                                                           .replace(/&gt;/g, '>');

                                                // 6. Clean up excessive whitespace
                                                // We want to keep newlines but merge multiple spaces
                                                // Split by newline, trim lines, rejoin
                                                text = text.split('\n').map((line: string) => line.trim()).filter((line: string) => line).join('\n').trim();

                                                // 6. Format as bullet points based on periods
                                                // Split by period. If a period exists, it creates a new line.
                                                // We will replace every period that has text after it with a newline and bullet.
                                                
                                                // First, split by period.
                                                const segments = text.split('.');
                                                
                                                // Filter out empty segments and trim
                                                const cleanSegments = segments.map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                                                
                                                if (cleanSegments.length > 0) {
                                                    // Join with period + newline + bullet
                                                    return '• ' + cleanSegments.join('.\n\n• ') + '.';
                                                }
                                                
                                                return text;
                                            }
                                        }
                                        return e.scopeOfWork || '';
                                    })(),
                                    services: e.services || [],
                                    fringe: e.fringe || 'No',
                                    certifiedPayroll: e.certifiedPayroll || 'No'
                                });
                            }
                        });

                    finalResult.initialData = {
                        clients: Array.from(new Map(clients?.filter((c: any) => c?._id).map((c: any) => [c._id.toString(), c]) || []).values()),
                        employees: Array.from(new Map(employees?.filter((e: any) => e?.email).map((e: any) => [e.email, { 
                            value: e.email, 
                            label: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email, 
                            image: e.profilePicture,
                            hourlyRateSITE: (e as any).hourlyRateSITE,
                            hourlyRateDrive: (e as any).hourlyRateDrive,
                            classification: (e as any).classification,
                            companyPosition: (e as any).companyPosition,
                            designation: (e as any).designation,
                            isScheduleActive: (e as any).isScheduleActive
                        }]) || []).values()),
                        constants: Array.from(new Map(constants?.filter((c: any) => c?.type && c?.description).map((c: any) => [`${c.type}-${c.description}`, c]) || []).values()),
                        estimates: Array.from(uniqueEstimates.values())
                    };
                }

                return NextResponse.json({ success: true, result: finalResult });
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
