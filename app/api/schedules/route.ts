import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import { Schedule, Client, Employee, Constant, Estimate, JHA, EquipmentItem, OverheadItem } from '@/lib/models';
const getAppSheetConfig = () => ({
    appId: process.env.APPSHEET_APP_ID || "3a1353f3-966e-467d-8947-a4a4d0c4c0c5",
    accessKey: process.env.APPSHEET_ACCESS || "V2-lWtLA-VV7bn-bEktT-S5xM7-2WUIf-UQmIA-GY6qH-A1S3E",
    tableName: process.env.APSHEET_JOB_SCHEDULE_TABLE || "Job Schedule"
});

async function updateAppSheetSchedule(data: any | any[], action: "Add" | "Edit" | "Delete" = "Edit") {
    // Only sync to AppSheet on production (Vercel)
    if (process.env.NODE_ENV !== 'production') return;

    const { appId, accessKey, tableName } = getAppSheetConfig();
    if (!appId || !accessKey) return;

    const items = Array.isArray(data) ? data : [data];
    if (items.length === 0) return;

    // Helper to format dates for AppSheet - preserves local time without timezone conversion
    // Input is expected to be a local ISO string like "2026-01-22T07:00:00"
    const fmtDate = (d: any) => {
        if (!d) return "";
        try {
            const str = String(d);
            // If it's already in ISO-like format (YYYY-MM-DDTHH:mm), extract and reformat
            const match = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
            if (match) {
                const [, year, month, day, hour, minute] = match;
                // Format: MM/DD/YYYY HH:mm:ss (AppSheet expects this format)
                return `${month}/${day}/${year} ${hour}:${minute}:00`;
            }
            // Fallback: try parsing as Date (may still cause timezone issues for old data)
            const date = new Date(d);
            if (isNaN(date.getTime())) return "";
            // Use local time components to avoid UTC conversion
            const pad = (n: number) => n < 10 ? '0' + n : n;
            return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
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
            "Job Location": String(item.jobLocation || ""),
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

async function updateAppSheetTimesheet(data: any | any[], action: "Add" | "Edit" | "Delete" = "Edit") {
    // Only sync to AppSheet on production (Vercel)
    if (process.env.NODE_ENV !== 'production') return;

    const { appId, accessKey } = getAppSheetConfig();
    const tableName = "TimeSheet"; // Explicitly set as requested
    if (!appId || !accessKey) return;

    const items = Array.isArray(data) ? data : [data];
    if (items.length === 0) return;

    // Helper to format timestamps for AppSheet
    const fmtDateTime = (d: any) => {
        if (!d) return "";
        try {
            // If d is a string like "9/8/2024 5:06:07 PM", Date constructor might struggle in some envs
            // but usually works. However, AppSheet needs "YYYY-MM-DD HH:MM:SS"
            const date = new Date(d);
            if (isNaN(date.getTime())) return String(d); // Fallback to original string if invalid
            
            // Format to YYYY-MM-DD HH:MM:SS
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const mins = String(date.getMinutes()).padStart(2, '0');
            const secs = String(date.getSeconds()).padStart(2, '0');
            
            return `${year}-${month}-${day} ${hours}:${mins}:${secs}`;
        } catch { return String(d || ""); }
    };

    const parseNum = (val: any) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        // Remove $ and commas, then parse
        const clean = String(val).replace(/[$,]/g, '');
        const n = parseFloat(clean);
        return isNaN(n) ? 0 : n;
    };

    const rows = items.map((item: any) => {
        return {
            "Record_ID": String(item._id || item.recordId || ""),
            "Employee_ID": String(item.employee || ""),
            "Schedule_ID": String(item.scheduleId || item.schedule_id || ""),
            "Type": String(item.type || ""),
            "ClockIn": fmtDateTime(item.clockIn),
            "Lunch Start": fmtDateTime(item.lunchStart),
            "Lunch End": fmtDateTime(item.lunchEnd),
            "LocationIn": String(item.locationIn || ""),
            "ClockOut": fmtDateTime(item.clockOut),
            "LocationOut": String(item.locationOut || ""),
            "Duration in Decimal": Number(item.hours || item.hoursVal || 0),
            "Distance": Number(item.distance || item.distanceVal || 0),
            "Hourly Rate (SITE)": parseNum(item.hourlyRateSITE),
            "Hourly Rate (Drive)": parseNum(item.hourlyRateDrive),
            "Create By": String(item.createdBy || ""),
            "TimeStamp": fmtDateTime(item.createdAt || new Date()),
            "Comments": String(item.comments || ""),
            "dumpWashout": String(item.dumpWashout || ""),
            "shopTime": String(item.shopTime || "")
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
        console.error("[AppSheet Timesheet Sync] Error:", error);
    }
}
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, payload } = body;
        
        await connectToDatabase();

        switch (action) {
            case 'getSchedules': {
                const results = await Schedule.find().sort({ fromDate: -1, _id: 1 }).lean();
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
                    syncedToAppSheet: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                // Sync to AppSheet
                await updateAppSheetSchedule(doc, "Add");
                return NextResponse.json({ success: true, result: doc });
            }

            case 'updateSchedule': {
                const { id, ...data } = payload || {};
                const oldDoc = await Schedule.findById(id).lean();
                const result = await Schedule.findByIdAndUpdate(
                    id,
                    { ...data, updatedAt: new Date() },
                    { new: true }
                );
                // Sync to AppSheet (Background)
                if (result) {
                    updateAppSheetSchedule(result, "Edit");
                    // Also sync individual timesheets if modified
                    if (data.timesheet && Array.isArray(data.timesheet)) {
                        const oldTs = oldDoc?.timesheet || [];
                        const newTs = result.timesheet || [];
                        
                        const oldIds = oldTs.map((t: any) => String(t._id || t.recordId));
                        const newIds = newTs.map((t: any) => String(t._id || t.recordId));
                        
                        // Deletions: In old but not in new
                        const deleted = oldTs.filter((t: any) => !newIds.includes(String(t._id || t.recordId)));
                        if (deleted.length > 0) updateAppSheetTimesheet(deleted, "Delete");
                        
                        // Additions: In new but not in old
                        const added = newTs.filter((t: any) => !oldIds.includes(String(t._id || t.recordId)));
                        if (added.length > 0) updateAppSheetTimesheet(added, "Add");
                        
                        // Updates: In both (we'll just send all as Edit for simplicity, or we could diff)
                        const updated = newTs.filter((t: any) => oldIds.includes(String(t._id || t.recordId)));
                        if (updated.length > 0) updateAppSheetTimesheet(updated, "Edit");
                    }
                }
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
                    const idToUse = recordId || item._id || new mongoose.Types.ObjectId();

                    return {
                        updateOne: {
                            filter: { _id: idToUse },
                            update: {
                                $set: { ...rest, _id: idToUse, syncedToAppSheet: true },
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
                    const schedId = ts.scheduleId || ts.schedule_id;
                    if (!schedId) return null;
                    
                    const normalizedSchedId = String(schedId).trim();

                    // Ensure _id exists for the timesheet subdocument
                    if (!ts._id) {
                        if (ts.recordId) ts._id = ts.recordId;
                        else ts._id = new mongoose.Types.ObjectId().toString(); // Generate if missing
                    }
                    
                    return {
                        updateOne: {
                            filter: { _id: normalizedSchedId },
                            update: {
                                $push: { timesheet: ts }
                            }
                        }
                    };
                }).filter(Boolean);

                if (ops.length === 0) return NextResponse.json({ success: false, error: 'No valid timesheets to import (missing scheduleId)' });

                // Debug: Check first ID
                try {
                     const testId = ops[0]!.updateOne.filter._id;
                     const example = await Schedule.findById(testId).select('_id').lean();
                     console.log(`[Import Debug] Testing First ID: "${testId}". Found: ${!!example}`);
                     if (!example) {
                         const random = await Schedule.findOne().select('_id').lean();
                         console.log(`[Import Debug] Sample Existing ID from DB: "${random?._id}"`);
                     }
                } catch (e) { console.error("Debug check failed", e); }

                try {
                    const result = await Schedule.bulkWrite(ops as any);
                    
                    // Sync imported timesheets to AppSheet
                    await updateAppSheetTimesheet(timesheets, "Add");
                    
                    return NextResponse.json({ 
                        success: true, 
                        result,
                        matched: result.matchedCount, 
                        modified: result.modifiedCount 
                    });
                } catch (e: any) {
                    console.error("Timesheet Import Error:", e);
                    return NextResponse.json({ success: false, error: e.message || "Import failed during bulkWrite" });
                }
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
                    const empEmail = String(timesheet.employee).toLowerCase();
                    existingIndex = (schedule.timesheet || []).findIndex((ts: any) => 
                        String(ts.employee).toLowerCase() === empEmail && 
                        ts.type === 'Drive Time' && 
                        (!ts.clockOut || ts.clockOut === '' || ts.clockOut === null)
                    );
                } else {
                    // For other types, find by employee and type
                    const empEmail = String(timesheet.employee).toLowerCase();
                    existingIndex = (schedule.timesheet || []).findIndex((ts: any) => 
                        String(ts.employee).toLowerCase() === empEmail && ts.type === timesheet.type
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
                
                // Sync the specific timesheet to AppSheet (Background)
                updateAppSheetTimesheet(timesheet, existingIndex > -1 ? "Edit" : "Add");

                return NextResponse.json({ success: true, result: updatedSchedule });
            }

            case 'quickTimesheet': {
                const { scheduleId, employee, type, date } = payload || {};
                const schedule = await Schedule.findById(scheduleId);
                if (!schedule) return NextResponse.json({ success: false, error: 'Schedule not found' });

                const unitHours = type === 'Dump Washout' ? 0.50 : 0.25;
                const empEmail = String(employee).toLowerCase();
                
                // Find existing record for this employee and type within this schedule
                const existingIndex = (schedule.timesheet || []).findIndex((ts: any) => 
                    String(ts.employee).toLowerCase() === empEmail && 
                    ((type === 'Dump Washout' && (String(ts.dumpWashout).toLowerCase() === 'true')) ||
                     (type === 'Shop Time' && (String(ts.shopTime).toLowerCase() === 'true')))
                );

                if (existingIndex > -1 && schedule.timesheet) {
                    const ts = schedule.timesheet[existingIndex];
                    const newQty = (ts.qty || 1) + 1;
                    const newHours = parseFloat(((ts.hours || 0) + unitHours).toFixed(2));
                    
                    const updateObj: any = {};
                    updateObj[`timesheet.${existingIndex}.qty`] = newQty;
                    updateObj[`timesheet.${existingIndex}.hours`] = newHours;
                    updateObj[`timesheet.${existingIndex}.updatedAt`] = new Date().toISOString();
                    updateObj.updatedAt = new Date();
                    
                    await Schedule.updateOne({ _id: scheduleId }, { $set: updateObj });
                    
                    const updatedTs = { ...ts, qty: newQty, hours: newHours };
                    updateAppSheetTimesheet(updatedTs, "Edit");
                    return NextResponse.json({ success: true, result: updatedTs });
                } else {
                    const clockOut = new Date(date || new Date()).toISOString();
                    const clockIn = new Date(new Date(clockOut).getTime() - (unitHours * 60 * 60 * 1000)).toISOString();

                    const newTs = {
                        _id: new mongoose.Types.ObjectId().toString(),
                        scheduleId,
                        employee,
                        clockIn,
                        clockOut,
                        type: 'Drive Time',
                        hours: unitHours,
                        qty: 1,
                        dumpWashout: type === 'Dump Washout' ? 'true' : undefined,
                        shopTime: type === 'Shop Time' ? 'true' : undefined,
                        status: 'Pending',
                        createdAt: new Date().toISOString()
                    };

                    await Schedule.updateOne({ _id: scheduleId }, { $push: { timesheet: newTs } });
                    updateAppSheetTimesheet(newTs, "Add");
                    return NextResponse.json({ success: true, result: newTs });
                }
            }

            case 'toggleDriveTime': {
                const { scheduleId, employee, timesheetId, date } = payload || {};
                const schedule = await Schedule.findById(scheduleId);
                if (!schedule) return NextResponse.json({ success: false, error: 'Schedule not found' });

                if (timesheetId) {
                    // Stopping existing
                    const tsIndex = (schedule.timesheet || []).findIndex(t => String(t._id) === String(timesheetId));
                    if (tsIndex > -1) {
                        const updateObj: any = {};
                        updateObj[`timesheet.${tsIndex}.clockOut`] = date || new Date().toISOString();
                        updateObj.updatedAt = new Date();
                        await Schedule.updateOne({ _id: scheduleId }, { $set: updateObj });
                        
                        const updated = await Schedule.findById(scheduleId).lean();
                        const ts = updated?.timesheet?.[tsIndex];
                        if (ts) updateAppSheetTimesheet(ts, "Edit");
                    }
                } else {
                    // Starting new
                    const newTs = {
                        _id: new mongoose.Types.ObjectId().toString(),
                        scheduleId,
                        employee,
                        clockIn: date || new Date().toISOString(),
                        type: 'Drive Time',
                        status: 'Pending',
                        createdAt: new Date().toISOString()
                    };
                    await Schedule.updateOne({ _id: scheduleId }, { $push: { timesheet: newTs } });
                    updateAppSheetTimesheet(newTs, "Add");
                }
                return NextResponse.json({ success: true });
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
                    const startD = new Date(startDate);
                    const endD = new Date(endDate);
                    console.log('[API] Schedule date filter:', { 
                        startDate, 
                        endDate, 
                        parsedStart: startD.toISOString(), 
                        parsedEnd: endD.toISOString() 
                    });
                    matchStage.fromDate = {
                        $gte: startD,
                        $lte: endD
                    };
                } else if (selectedDates && selectedDates.length > 0) {
                     // Match fromDate stringified to YYYY-MM-DD in the selectedDates array
                     matchStage.$expr = {
                        $in: [
                            { $dateToString: { format: "%Y-%m-%d", date: "$fromDate", timezone: "UTC" } },
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

                if (filters.estimate) {
                    // MRelaxed Match: Match any estimate STARTING with the filter value
                    // This handles 25-0358 matching 25-0358-V1, 25-0358-Rev1, etc.
                    const esc = filters.estimate.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    matchStage.estimate = { $regex: `^${esc}`, $options: 'i' };
                }
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
                                { $sort: { fromDate: 1, _id: 1 } },
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
                                    todayObjectives: 1, syncedToAppSheet: 1, isDayOffApproved: 1,
                                    createdAt: 1, updatedAt: 1
                                }}
                            ],
                            counts: [
                                { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$fromDate", timezone: "UTC" } }, count: { $sum: 1 } } }
                            ],
                            assigneeStats: [
                                { $project: { count: { $size: { $ifNull: ["$assignees", []] } } } },
                                { $group: { _id: null, total: { $sum: "$count" } } }
                            ]
                        }
                    }
                ];

                const [aggResult, ...metadata] = await Promise.all([
                    Schedule.aggregate(pipeline),
                    !skipInitialData ? Client.find().select('name _id').sort({ name: 1 }).lean() : Promise.resolve([]),
                    !skipInitialData ? Employee.find().select('firstName lastName email profilePicture hourlyRateSITE hourlyRateDrive classification companyPosition designation isScheduleActive').lean() : Promise.resolve([]),
                    !skipInitialData ? Constant.find().select('type description color image').lean() : Promise.resolve([]),
                    !skipInitialData ? Estimate.find({ status: { $ne: 'deleted' } }).select('estimate _id updatedAt createdAt customer customerName customerId projectTitle projectName jobAddress contactName contactPhone contactEmail contact phone scopeOfWork proposal services fringe certifiedPayroll projectDescription proposals').lean() : Promise.resolve([]),
                    !skipInitialData ? EquipmentItem.find().select('equipmentMachine dailyCost uom classification').sort({ equipmentMachine: 1 }).lean() : Promise.resolve([]),
                    !skipInitialData ? OverheadItem.find().sort({ overhead: 1 }).lean() : Promise.resolve([])
                ]);

                const resultDocs = aggResult[0].data;
                const totalCount = aggResult[0].metadata[0]?.total || 0;
                const dailyCounts = aggResult[0].counts || [];
                const totalAssignees = aggResult[0].assigneeStats[0]?.total || 0;
                
                const totalActiveEmployees = await Employee.countDocuments({ isScheduleActive: true });
                
                let days = 7;
                if (selectedDates && selectedDates.length > 0) days = selectedDates.length;
                else if (startDate && endDate) {
                     const start = new Date(startDate);
                     const end = new Date(endDate);
                     days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                }
                
                const capacity = (totalActiveEmployees > 0 && days > 0) ? Math.round((totalAssignees / (totalActiveEmployees * days)) * 100) : 0;

                // Process initial data... (Same as before)
                const [clients, employees, constants, estimates, equipmentItems, overheadItems] = metadata;

                const schedulesWithMetaData = resultDocs.map((s: any) => ({
                    ...s,
                    hasJHA: !!s.jha && Object.keys(s.jha).length > 0,
                    hasDJT: !!s.djt && Object.keys(s.djt).length > 0
                }));

                const finalResult: any = { 
                    schedules: schedulesWithMetaData,
                    total: totalCount,
                    counts: dailyCounts,
                    capacity,
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
                                    customerName: e.customerName || e.customer || '',
                                    projectTitle: pName,
                                    projectName: pName,
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
                        estimates: Array.from(uniqueEstimates.values()),
                        equipmentItems: equipmentItems.map((e: any) => ({
                            value: e._id.toString(),
                            label: e.equipmentMachine,
                            dailyCost: e.dailyCost,
                            uom: e.uom
                        })),
                        overheadItems: overheadItems || []
                    };
                }

                return NextResponse.json({ success: true, result: finalResult });
            }

            case 'getInitialData': {
                const [clients, employees, constants, estimates, equipmentItems, overheadItems] = await Promise.all([
                    Client.find().select('name _id').sort({ name: 1 }).lean(),
                    Employee.find().select('firstName lastName email profilePicture hourlyRateSITE hourlyRateDrive classification companyPosition designation isScheduleActive').lean(),
                    Constant.find().lean(),
                    Estimate.find({ status: { $ne: 'deleted' } }).select('estimate _id updatedAt createdAt customer customerName customerId projectTitle projectName jobAddress contactName contactPhone contactEmail contact phone').lean(),
                    EquipmentItem.find().select('equipmentMachine dailyCost uom classification').sort({ equipmentMachine: 1 }).lean(),
                    OverheadItem.find().sort({ overhead: 1 }).lean()
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
                                customerName: e.customerName || e.customer || '',
                                projectTitle: pName,
                                projectName: pName,
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
                        estimates: Array.from(uniqueEstimates.values()),
                        equipmentItems: equipmentItems.map((e: any) => ({
                            value: e._id.toString(),
                            label: e.equipmentMachine,
                            dailyCost: e.dailyCost,
                            uom: e.uom
                        })),
                        overheadItems: overheadItems || []
                    }
                });
            }

            case 'syncToAppSheet': {
                // Only sync to AppSheet on production (Vercel)
                if (process.env.NODE_ENV !== 'production') {
                    return NextResponse.json({ success: false, error: 'AppSheet sync only works on production' });
                }

                const { id } = payload || {};
                if (!id) return NextResponse.json({ success: false, error: 'Schedule ID is required' });
                
                const schedule = await Schedule.findById(id).lean();
                if (!schedule) return NextResponse.json({ success: false, error: 'Schedule not found' });

                // Sync to AppSheet
                const { appId, accessKey, tableName } = getAppSheetConfig();
                if (!appId || !accessKey) {
                    return NextResponse.json({ success: false, error: 'AppSheet configuration missing' });
                }

                const fmtDate = (d: any) => {
                    if (!d) return "";
                    try {
                        const date = new Date(d);
                        if (isNaN(date.getTime())) return "";
                        return date.toISOString().split('T')[0]; 
                    } catch { return ""; }
                };

                let assigneesList = "";
                if (schedule.assignees && Array.isArray(schedule.assignees) && schedule.assignees.length > 0) {
                    assigneesList = schedule.assignees.join(' , ');
                } else if (typeof schedule.assignees === 'string') {
                    assigneesList = schedule.assignees;
                }

                const row = {
                    "Record_ID": String(schedule._id || ""),
                    "Title": String(schedule.title || ""),
                    "From": fmtDate(schedule.fromDate),
                    "To": fmtDate(schedule.toDate),
                    "Customer": String(schedule.customerId || ""),
                    "Proposal Number": String(schedule.estimate || ""),
                    "Project Manager Name": String(schedule.projectManager || ""),
                    "Foreman Name": String(schedule.foremanName || ""),
                    "Assignees": assigneesList, 
                    "Description": String(schedule.description || ""),
                    "Service Item": String(schedule.service || ""),
                    "Color": String(schedule.item || ""),
                    "Labor Agreement": String(schedule.fringe || ""),
                    "Certified Payroll": String(schedule.certifiedPayroll || ""),
                    "Notify Assignees": String(schedule.notifyAssignees || ""),
                    "Per Diem": String(schedule.perDiem || ""),
                    "Aerial Image": String(schedule.aerialImage || ""),
                    "Site Layout": String(schedule.siteLayout || ""),
                    "todayObjectives": Array.isArray(schedule.todayObjectives) 
                        ? schedule.todayObjectives.map((obj: any) => typeof obj === 'string' ? obj : obj.text).join(' , ') 
                        : String(schedule.todayObjectives || "") 
                };

                const APPSHEET_URL = `https://api.appsheet.com/api/v2/apps/${encodeURIComponent(appId)}/tables/${encodeURIComponent(tableName)}/Action`;

                try {
                    console.log("[AppSheet Sync] Attempting to Add record:", id);
                    
                    // First try to Add the record (for new records)
                    let response = await fetch(APPSHEET_URL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "ApplicationAccessKey": accessKey
                        },
                        body: JSON.stringify({
                            Action: "Add",
                            Properties: { Locale: "en-US", Timezone: "Pacific Standard Time" },
                            Rows: [row]
                        })
                    });

                    let responseText = await response.text();
                    console.log("[AppSheet Sync] Add response:", response.status, responseText);
                    
                    // Check if Add was successful
                    let success = response.ok;
                    
                    // Parse response to check for errors in body
                    try {
                        const jsonResponse = JSON.parse(responseText);
                        // AppSheet returns Rows array on success, or Errors on failure
                        if (jsonResponse.Errors) {
                            success = false;
                        }
                    } catch (e) {
                        // Not JSON, check if response is OK
                    }
                    

                    // If Add failed, try Edit (record might already exist in AppSheet)
                    if (!success) {
                        const addErrorText = responseText; // Save the Add error
                        console.log("[AppSheet Sync] Add failed, trying Edit...", addErrorText);
                        
                        response = await fetch(APPSHEET_URL, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "ApplicationAccessKey": accessKey
                            },
                            body: JSON.stringify({
                                Action: "Edit",
                                Properties: { Locale: "en-US", Timezone: "Pacific Standard Time" },
                                Rows: [row]
                            })
                        });
                        
                        responseText = await response.text();
                        console.log("[AppSheet Sync] Edit response:", response.status, responseText);
                        
                        // Check Edit result
                        let editSuccess = response.ok;
                        try {
                            const jsonResponse = JSON.parse(responseText);
                            if (jsonResponse.Errors) {
                                editSuccess = false;
                            }
                        } catch (e) {}
                        
                        if (!editSuccess) {
                            console.error("[AppSheet Sync] Both Add and Edit failed.");
                            // Return BOTH errors to help debug
                            return NextResponse.json({ 
                                success: false, 
                                error: `Sync Failed. ADD Error: ${addErrorText}. EDIT Error: ${responseText}` 
                            });
                        }
                    }

                    // Mark the schedule as synced to AppSheet
                    await Schedule.findByIdAndUpdate(id, { syncedToAppSheet: true });

                    return NextResponse.json({ success: true, message: 'Schedule synced to AppSheet successfully' });
                } catch (error: any) {
                    console.error("[AppSheet Sync] Error:", error);
                    return NextResponse.json({ success: false, error: error.message });
                }
            }

            case 'syncAllTimesheets': {
                // Only sync to AppSheet on production (Vercel)
                if (process.env.NODE_ENV !== 'production') {
                    return NextResponse.json({ success: false, error: 'AppSheet sync only works on production' });
                }

                const schedules = await Schedule.find({ 'timesheet.0': { $exists: true } }).lean();
                let allTimesheets: any[] = [];
                schedules.forEach(s => {
                    if (s.timesheet && Array.isArray(s.timesheet)) {
                        allTimesheets = allTimesheets.concat(s.timesheet.map(ts => ({
                            ...ts,
                            scheduleId: String(s._id)
                        })));
                    }
                });

                if (allTimesheets.length === 0) {
                    return NextResponse.json({ success: true, message: 'No timesheets found to sync' });
                }

                console.log(`[SyncAllTimesheets] Attempting to sync ${allTimesheets.length} records...`);

                // Batch sync in chunks
                const CHUNK_SIZE = 100;
                let processedCount = 0;
                
                for (let i = 0; i < allTimesheets.length; i += CHUNK_SIZE) {
                    const chunk = allTimesheets.slice(i, i + CHUNK_SIZE);
                    // Try "Add" first
                    await updateAppSheetTimesheet(chunk, "Add");
                    processedCount += chunk.length;
                }

                return NextResponse.json({ 
                    success: true, 
                    message: `Sync initiated for ${processedCount} records. Check AppSheet for results.` 
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

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });
        }

        await connectToDatabase();
        await Schedule.findByIdAndDelete(id);
        
        // Sync to AppSheet
        await updateAppSheetSchedule({ _id: id }, "Delete");

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('DELETE Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
