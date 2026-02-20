import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import { Schedule, Client, Employee, Constant, Estimate, JHA, EquipmentItem, OverheadItem } from '@/lib/models';
import { calculateTimesheetData } from '@/lib/timeCardUtils';
import { getLocalNowISO } from '@/lib/scheduleUtils';
import { getUserFromRequest } from '@/lib/permissions/middleware';
import { getUserPermissions, getDataScope, isSuperAdmin } from '@/lib/permissions/service';
import { MODULES } from '@/lib/permissions/types';
import { sendSMS } from '@/lib/signalwire';
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

        // ── Data Scope Enforcement ──
        // For read actions, determine if the user's role restricts them
        // to only viewing their own records (dataScope === 'self').
        let timeCardsScope: 'self' | 'department' | 'all' = 'all';
        let schedulesScope: 'self' | 'department' | 'all' = 'all';
        let currentUserEmail: string | null = null;
        if (action === 'getSchedulesPage' || action === 'getScheduleStats' || action === 'getScheduleActivity') {
            const jwtUser = await getUserFromRequest(request);
            if (jwtUser) {
                currentUserEmail = jwtUser.email;
                if (!isSuperAdmin(jwtUser.role)) {
                    const perms = await getUserPermissions(jwtUser.userId);
                    timeCardsScope = getDataScope(perms, MODULES.TIME_CARDS);
                    schedulesScope = getDataScope(perms, MODULES.SCHEDULES);
                }
            }
        }

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
                // Schema uses _id: String, so Mongoose can't auto-generate — provide one if missing
                const { _id: providedId, ...createData } = payload || {};
                const scheduleId = providedId || new mongoose.Types.ObjectId().toString();
                const doc = await Schedule.create({
                    ...createData,
                    _id: scheduleId,
                    syncedToAppSheet: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                // ── SMS Notification (must be awaited on Vercel serverless) ──
                const docAny = doc as any;
                if (docAny.notifyAssignees === true || docAny.notifyAssignees === 'Yes' || docAny.notifyAssignees === 'true') {
                    if (Array.isArray(docAny.assignees) && docAny.assignees.length > 0) {
                        const fmtDate = docAny.fromDate ? new Date(docAny.fromDate).toLocaleDateString() : 'N/A';
                        const messageBody = `You have been assigned to a new devco schedule: ${docAny.title || docAny.jobLocation || 'Job Schedule'}. Date: ${fmtDate}`;
                        
                        try {
                            const assigneesDocs = await Employee.find({ email: { $in: docAny.assignees } }).lean();
                            const smsPromises = assigneesDocs
                                .map(emp => emp.phone || emp.mobile)
                                .filter(Boolean)
                                .map(phone => sendSMS(phone!, messageBody).catch(err => console.error('[SMS] Failed for', phone, err)));
                            await Promise.all(smsPromises);
                            console.log(`[SMS] Sent ${smsPromises.length} notification(s) for schedule ${scheduleId}`);
                        } catch (smsErr) {
                            console.error('[SMS] Error sending notifications:', smsErr);
                        }
                    }
                }

                // Propagate images to associated estimates (all versions)
                if (payload.estimate) {
                    const estimateUpdate: any = {};
                    if (payload.aerialImage !== undefined) estimateUpdate.aerialImage = payload.aerialImage;
                    if (payload.siteLayout !== undefined) estimateUpdate.siteLayout = payload.siteLayout;
                    
                    if (Object.keys(estimateUpdate).length > 0) {
                        try {
                            await Estimate.updateMany({ estimate: payload.estimate }, { $set: estimateUpdate });
                        } catch (e) {
                            console.error('[Schedule API] Failed to propagate images to estimates:', e);
                        }
                    }
                }

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

                // Propagate images to associated estimates (all versions)
                if (data.estimate) {
                    const estimateUpdate: any = {};
                    if (data.aerialImage !== undefined) estimateUpdate.aerialImage = data.aerialImage;
                    if (data.siteLayout !== undefined) estimateUpdate.siteLayout = data.siteLayout;
                    
                    if (Object.keys(estimateUpdate).length > 0) {
                        try {
                            await Estimate.updateMany({ estimate: data.estimate }, { $set: estimateUpdate });
                        } catch (e) {
                            console.error('[Schedule API] Failed to propagate images to estimates:', e);
                        }
                    }
                }
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
                // Batch sync to AppSheet
                await updateAppSheetSchedule(syncItems, "Add");

                // Propagate images to associated estimates (all versions)
                const estimatesToUpdate = new Map<string, any>();
                schedules.forEach((s: any) => {
                    if (s.estimate && (s.aerialImage !== undefined || s.siteLayout !== undefined)) {
                        const current = estimatesToUpdate.get(s.estimate) || {};
                        if (s.aerialImage !== undefined) current.aerialImage = s.aerialImage;
                        if (s.siteLayout !== undefined) current.siteLayout = s.siteLayout;
                        estimatesToUpdate.set(s.estimate, current);
                    }
                });

                if (estimatesToUpdate.size > 0) {
                    try {
                        const updatePromises = Array.from(estimatesToUpdate.entries()).map(([estNum, updateData]) => 
                            Estimate.updateMany({ estimate: estNum }, { $set: updateData })
                        );
                        await Promise.all(updatePromises);
                    } catch (e) {
                         console.error('[Schedule API] Bulk image propagation failed:', e);
                    }
                }

                return NextResponse.json({ success: true, result });
            }

            case 'importTimesheets': {
                const { timesheets } = payload || {};
                if (!Array.isArray(timesheets)) return NextResponse.json({ success: false, error: 'Invalid timesheets array' });

                // Group timesheets by scheduleId for efficient processing
                const bySchedule: Record<string, any[]> = {};
                
                timesheets.forEach((ts: any) => {
                    const schedId = ts.scheduleId || ts.schedule_id;
                    if (!schedId) return;
                    
                    const normalizedSchedId = String(schedId).trim();

                    // Ensure _id exists for the timesheet subdocument
                    if (!ts._id) {
                        if (ts.recordId) ts._id = ts.recordId;
                        else ts._id = new mongoose.Types.ObjectId().toString();
                    }
                    
                    if (!bySchedule[normalizedSchedId]) bySchedule[normalizedSchedId] = [];
                    bySchedule[normalizedSchedId].push(ts);
                });

                if (Object.keys(bySchedule).length === 0) {
                    return NextResponse.json({ success: false, error: 'No valid timesheets to import (missing scheduleId)' });
                }

                // Two-pass approach to prevent duplicates:
                // 1. First, remove any existing timesheets with matching _ids
                // 2. Then push the new/updated timesheets
                const pullOps: any[] = [];
                const pushOps: any[] = [];

                for (const [schedId, tsList] of Object.entries(bySchedule)) {
                    const tsIds = tsList.map(ts => ts._id).filter(Boolean);
                    
                    if (tsIds.length > 0) {
                        // Pull existing timesheets with these _ids
                        pullOps.push({
                            updateOne: {
                                filter: { _id: schedId },
                                update: {
                                    $pull: { timesheet: { _id: { $in: tsIds } } }
                                }
                            }
                        });
                    }
                    
                    // Push all timesheets for this schedule
                    pushOps.push({
                        updateOne: {
                            filter: { _id: schedId },
                            update: {
                                $push: { timesheet: { $each: tsList } }
                            }
                        }
                    });
                }

                try {
                    // First remove existing duplicates
                    if (pullOps.length > 0) {
                        await Schedule.bulkWrite(pullOps);
                    }
                    
                    // Then push all the imported timesheets
                    const result = await Schedule.bulkWrite(pushOps);
                    
                    // Sync imported timesheets to AppSheet
                    await updateAppSheetTimesheet(timesheets, "Add");
                    
                    return NextResponse.json({ 
                        success: true, 
                        result,
                        matched: result.matchedCount, 
                        modified: result.modifiedCount,
                        message: `Imported ${timesheets.length} timesheets (duplicates replaced)`
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

                // Look up employee's hourly rates and embed them for payroll integrity
                const empDoc = await Employee.findOne({ email: timesheet.employee }).lean();
                if (empDoc) {
                    const tsType = String(timesheet.type || '').toLowerCase();
                    if (tsType.includes('site') && empDoc.hourlyRateSITE && !timesheet.hourlyRateSITE) {
                        timesheet.hourlyRateSITE = empDoc.hourlyRateSITE;
                    } else if (tsType.includes('drive') && empDoc.hourlyRateDrive && !timesheet.hourlyRateDrive) {
                        timesheet.hourlyRateDrive = empDoc.hourlyRateDrive;
                    }
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
                const { scheduleId, employee, type, date, dumpQty, shopQty } = payload || {};
                const scheduleQt = await Schedule.findById(scheduleId);
                if (!scheduleQt) return NextResponse.json({ success: false, error: 'Schedule not found' });

                const empEmailQt = String(employee).toLowerCase();

                // Look up employee's hourly rate for drive time (dump/shop are Drive Time entries)
                const empDocQt = await Employee.findOne({ email: employee }).lean();
                const driveRate = empDocQt?.hourlyRateDrive || null;
                
                // Find existing record for this employee acting as Dump/Shop container
                const existingIndexQt = (scheduleQt.timesheet || []).findIndex((ts: any) => 
                    String(ts.employee).toLowerCase() === empEmailQt && 
                    ((String(ts.dumpWashout).toLowerCase() === 'true' || ts.dumpWashout === true) ||
                     (String(ts.shopTime).toLowerCase() === 'true' || ts.shopTime === true))
                );

                const clockOut = new Date(date || new Date()).toISOString();
                let finalDumpQty = (dumpQty !== undefined) ? dumpQty : 0;
                let finalShopQty = (shopQty !== undefined) ? shopQty : 0;
                
                // If specific quantities not provided in payload (legacy call?), fallback to increment logic (simplified)
                if (dumpQty === undefined && shopQty === undefined) {
                     // Fallback for safety, though frontend sends them now
                     if (type === 'Dump Washout') finalDumpQty = 1; 
                }

                if (existingIndexQt > -1 && scheduleQt.timesheet) {
                    const ts = scheduleQt.timesheet[existingIndexQt];
                    
                    const newDumpQty = (dumpQty !== undefined) ? dumpQty : (ts.dumpQty || (ts.dumpWashout ? 1 : 0));
                    const newShopQty = (shopQty !== undefined) ? shopQty : (ts.shopQty || (ts.shopTime ? 1 : 0));

                    const totalHours = (newDumpQty * 0.50) + (newShopQty * 0.25);
                    const newQty = newDumpQty + newShopQty;
                    // Recalculate clockIn based on new duration ending at clockOut
                    const clockIn = new Date(new Date(clockOut).getTime() - (totalHours * 60 * 60 * 1000)).toISOString();

                    const updateObj: any = {};
                    updateObj[`timesheet.${existingIndexQt}.qty`] = newQty;
                    updateObj[`timesheet.${existingIndexQt}.dumpQty`] = newDumpQty;
                    updateObj[`timesheet.${existingIndexQt}.shopQty`] = newShopQty;
                    updateObj[`timesheet.${existingIndexQt}.dumpWashout`] = newDumpQty > 0 ? 'true' : undefined;
                    updateObj[`timesheet.${existingIndexQt}.shopTime`] = newShopQty > 0 ? 'true' : undefined;
                    updateObj[`timesheet.${existingIndexQt}.hours`] = parseFloat(totalHours.toFixed(2));
                    updateObj[`timesheet.${existingIndexQt}.clockOut`] = clockOut;
                    updateObj[`timesheet.${existingIndexQt}.clockIn`] = clockIn;
                    updateObj[`timesheet.${existingIndexQt}.updatedAt`] = new Date().toISOString();
                    // Embed hourly rate for payroll integrity
                    if (driveRate) updateObj[`timesheet.${existingIndexQt}.hourlyRateDrive`] = driveRate;
                    updateObj.updatedAt = new Date();
                    
                    await Schedule.updateOne({ _id: scheduleId }, { $set: updateObj, $unset: { [`timesheet.${existingIndexQt}.dumpWashout`]: newDumpQty <= 0 ? "" : undefined, [`timesheet.${existingIndexQt}.shopTime`]: newShopQty <= 0 ? "" : undefined } });
                    
                    const updatedTs = { 
                        ...ts, 
                        qty: newQty, 
                        hours: parseFloat(totalHours.toFixed(2)), 
                        dumpQty: newDumpQty, 
                        shopQty: newShopQty,
                        clockIn,
                        clockOut,
                        dumpWashout: newDumpQty > 0 ? 'true' : undefined,
                        shopTime: newShopQty > 0 ? 'true' : undefined,
                        hourlyRateDrive: driveRate || ts.hourlyRateDrive
                    };
                    updateAppSheetTimesheet(updatedTs, "Edit");
                    return NextResponse.json({ success: true, result: updatedTs });
                } else {
                    const newDumpQty = (dumpQty !== undefined) ? dumpQty : (type === 'Dump Washout' ? 1 : 0);
                    const newShopQty = (shopQty !== undefined) ? shopQty : (type === 'Shop Time' ? 1 : 0);
                    
                    const totalHours = (newDumpQty * 0.50) + (newShopQty * 0.25);
                    const clockIn = new Date(new Date(clockOut).getTime() - (totalHours * 60 * 60 * 1000)).toISOString();

                    const newTs: any = {
                        _id: new mongoose.Types.ObjectId().toString(),
                        scheduleId,
                        employee,
                        clockIn,
                        clockOut,
                        type: 'Drive Time',
                        hours: parseFloat(totalHours.toFixed(2)),
                        qty: newDumpQty + newShopQty,
                        dumpWashout: newDumpQty > 0 ? 'true' : undefined,
                        shopTime: newShopQty > 0 ? 'true' : undefined,
                        dumpQty: newDumpQty,
                        shopQty: newShopQty,
                        status: 'Pending',
                        createdAt: new Date().toISOString()
                    };
                    // Embed hourly rate for payroll integrity
                    if (driveRate) newTs.hourlyRateDrive = driveRate;

                    await Schedule.updateOne({ _id: scheduleId }, { $push: { timesheet: newTs } });
                    updateAppSheetTimesheet(newTs, "Add");
                    return NextResponse.json({ success: true, result: newTs });
                }
            }

            case 'toggleDriveTime': {
                const { scheduleId, employee, timesheetId, date, location } = payload || {};
                const schedule = await Schedule.findById(scheduleId);
                if (!schedule) return NextResponse.json({ success: false, error: 'Schedule not found' });

                if (timesheetId) {
                    // Stopping existing
                    const tsIndex = (schedule.timesheet || []).findIndex(t => String(t._id) === String(timesheetId));
                    if (tsIndex > -1) {
                        const updateObj: any = {};
                        updateObj[`timesheet.${tsIndex}.clockOut`] = date || getLocalNowISO();
                        if (location) updateObj[`timesheet.${tsIndex}.locationOut`] = location;
                        updateObj.updatedAt = new Date();
                        await Schedule.updateOne({ _id: scheduleId }, { $set: updateObj });
                        
                        const updated = await Schedule.findById(scheduleId).lean();
                        const ts = updated?.timesheet?.[tsIndex];
                        if (ts) updateAppSheetTimesheet(ts, "Edit");
                        return NextResponse.json({ success: true, result: ts });
                    } else {
                        return NextResponse.json({ success: false, error: 'Timesheet not found' });
                    }
                } else {
                    // Starting new
                    const newTs = {
                        _id: new mongoose.Types.ObjectId().toString(),
                        scheduleId,
                        employee,
                        clockIn: date || getLocalNowISO(),
                        locationIn: location,
                        type: 'Drive Time',
                        status: 'Pending',
                        createdAt: getLocalNowISO()
                    };
                    await Schedule.updateOne({ _id: scheduleId }, { $push: { timesheet: newTs } });
                    updateAppSheetTimesheet(newTs, "Add");
                    return NextResponse.json({ success: true, result: newTs });
                }
                return NextResponse.json({ success: false, error: 'Unknown state' });
            }

            case 'recalculateAll': {
                const schedules = await Schedule.find({ "timesheet.0": { $exists: true } }).lean();
                let count = 0;
                const bulkOps = [];
                
                for (const doc of (schedules as any[])) {
                    let modified = false;
                    const newTimesheets = (doc.timesheet || []).map((ts: any) => {
                        // Pass doc.fromDate as string/date for calculation context
                        const stats = calculateTimesheetData(ts, doc.fromDate);
                        
                        // Overwrite with fresh calculation
                        // We use inequality check to avoid writing if nothing changed
                        if (ts.hours !== stats.hours || ts.distance !== stats.distance) {
                            modified = true;
                            return { ...ts, hours: stats.hours, distance: stats.distance };
                        }
                        return ts;
                    });
                    
                    if (modified) {
                        bulkOps.push({
                            updateOne: {
                                filter: { _id: doc._id },
                                update: { $set: { timesheet: newTimesheets } }
                            }
                        });
                        count++;
                    }
                }
                
                if (bulkOps.length > 0) {
                    await Schedule.bulkWrite(bulkOps);
                }
                
                return NextResponse.json({ success: true, message: `Updated ${count} schedules` });
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

                // User Permission Filter (client-side or server-enforced scope)
                const activityFilterEmail = (schedulesScope === 'self' && currentUserEmail) ? currentUserEmail : userEmail;
                if (activityFilterEmail) {
                    const userFilter = [
                        { projectManager: activityFilterEmail },
                        { foremanName: activityFilterEmail },
                        { assignees: activityFilterEmail }
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
                    endDate,
                    includeTimesheets = false // NEW: Only include timesheets when explicitly requested
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

                // 3. User Permission / Schedules Data Scope Filter
                // If schedulesScope is 'self', always enforce the user filter using the JWT email
                // (server-side enforcement, ignoring any client-sent userEmail).
                // Otherwise, respect the optional client userEmail filter if provided.
                const effectiveUserEmail = (schedulesScope === 'self' && currentUserEmail) ? currentUserEmail : userEmail;
                if (effectiveUserEmail) {
                    const userFilter = [
                        { projectManager: effectiveUserEmail },
                        { foremanName: effectiveUserEmail },
                        { assignees: effectiveUserEmail }
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
                // Note: certifiedPayroll filter is handled via $lookup on Estimate collection (see pipeline below)
                
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

                // Build pipeline stages
                const pipelineStages: any[] = [
                    { $match: matchStage }
                ];

                // If filtering by certifiedPayroll, lookup from Estimate collection
                if (filters.certifiedPayroll) {
                    pipelineStages.push(
                        // Lookup estimate by estimate field (schedule.estimate matches estimate.estimate)
                        {
                            $lookup: {
                                from: 'estimatesdb',
                                let: { scheduleEstimate: '$estimate' },
                                pipeline: [
                                    { $match: { $expr: { $eq: ['$estimate', '$$scheduleEstimate'] } } },
                                    { $project: { certifiedPayroll: 1 } }
                                ],
                                as: 'estimateLookup'
                            }
                        },
                        // Unwind the lookup result (single match expected)
                        { $unwind: { path: '$estimateLookup', preserveNullAndEmptyArrays: true } },
                        // Filter by certifiedPayroll from estimate
                        {
                            $match: {
                                $or: [
                                    { 'estimateLookup.certifiedPayroll': filters.certifiedPayroll },
                                    // Also match schedule's own certifiedPayroll as fallback
                                    { certifiedPayroll: filters.certifiedPayroll }
                                ]
                            }
                        },
                        // Remove the lookup field to not bloat response
                        { $project: { estimateLookup: 0 } }
                    );
                }

                const pipeline: any[] = [
                    ...pipelineStages,
                    {
                        $facet: {
                            metadata: [{ $count: "total" }],
                            data: [
                                { $sort: { fromDate: -1, _id: 1 } },
                                { $skip: skip },
                                { $limit: limit },
                                // Project fields needed for UI to reduce payload
                                // CRITICAL: Conditionally include timesheet array based on includeTimesheets parameter
                                // For schedule list view: exclude massive timesheet arrays
                                // For time-cards view: include ONLY timesheets, exclude other heavy data
                                { $project: includeTimesheets ? {
                                    // REPORTS/TIME-CARDS MODE: Include timesheet + fields needed for reports
                                    estimate: 1, fromDate: 1, toDate: 1,  
                                    timesheet: 1,
                                    // Additional fields needed for payroll/fringe/workers-comp reports
                                    title: 1, projectTitle: 1, jobTitle: 1,
                                    item: 1, fringe: 1, certifiedPayroll: 1,
                                    customerName: 1, customerId: 1,
                                    createdAt: 1, updatedAt: 1
                                } : {
                                    // SCHEDULE LIST MODE: Exclude timesheet array and heavy signature data
                                    title: 1, estimate: 1, customerId: 1, customerName: 1, 
                                    fromDate: 1, toDate: 1, foremanName: 1, projectManager: 1, 
                                    assignees: 1, service: 1, item: 1, perDiem: 1, fringe: 1, 
                                    certifiedPayroll: 1, notifyAssignees: 1, description: 1, 
                                    jobLocation: 1, aerialImage: 1, siteLayout: 1, 
                                    // Project heavy objects partially
                                    jha: { 
                                        _id: 1, 
                                        status: 1, 
                                        // Exclude signatures and images 
                                    }, 
                                    djt: { 
                                        _id: 1, 
                                        dailyJobDescription: 1,
                                        equipmentUsed: 1,
                                        // Exclude signatures and images
                                    }, 
                                    timesheet: 1, // Included for status icons & assignee colors
                                    // Exclude top-level signature arrays
                                    // JHASignatures: 0, 
                                    // DJTSignatures: 0,
                                    todayObjectives: 1, syncedToAppSheet: 1, isDayOffApproved: 1,
                                    createdAt: 1, updatedAt: 1,
                                    hasTimesheet: { $gt: [{ $size: { $ifNull: ['$timesheet', []] } }, 0] },
                                    hasJHA: { $and: [{ $ifNull: ['$jha', false] }, { $ne: ['$jha', {}] }] },
                                    hasDJT: { $and: [{ $ifNull: ['$djt', false] }, { $ne: ['$djt', {}] }] }
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
                    !skipInitialData ? Employee.find({ status: { $ne: 'Inactive' } }).select('firstName lastName email profilePicture hourlyRateSITE hourlyRateDrive classification companyPosition designation isScheduleActive address ssNumber').lean() : Promise.resolve([]), 
                    !skipInitialData ? Constant.find().select('type description color value image').lean() : Promise.resolve([]),
                    !skipInitialData ? Estimate.find({ status: { $ne: 'deleted' } })
                        .select('estimate _id updatedAt createdAt customer customerName customerId projectTitle projectName projectId jobAddress contactName contactPhone contactEmail contact phone fringe certifiedPayroll')
                        .sort({ updatedAt: -1 })
                        .limit(1000)
                        .lean() : Promise.resolve([]),
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

                // Apply time_cards data scope: filter timesheet entries to current user only
                const schedulesWithMetaData = resultDocs.map((s: any) => {
                    let filteredTimesheet = s.timesheet;
                    if (timeCardsScope === 'self' && currentUserEmail && Array.isArray(s.timesheet)) {
                        filteredTimesheet = s.timesheet.filter((ts: any) =>
                            String(ts.employee).toLowerCase() === currentUserEmail!.toLowerCase()
                        );
                    }
                    return {
                        ...s,
                        timesheet: filteredTimesheet,
                        hasJHA: !!s.jha && Object.keys(s.jha).length > 0,
                        hasDJT: !!s.djt && Object.keys(s.djt).length > 0
                    };
                });

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
                                    customerName: (() => {
                                        const client = clients?.find((c: any) => String(c._id) === String(e.customerId));
                                        return client?.name || e.customerName || e.customer || '';
                                    })(),
                                    projectTitle: pName,
                                    projectName: pName,
                                    projectId: e.projectId,
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
                                    certifiedPayroll: e.certifiedPayroll || 'No',
                                    aerialImage: e.aerialImage || '',
                                    siteLayout: e.siteLayout || ''
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
                            isScheduleActive: (e as any).isScheduleActive,
                            address: (e as any).address || '',
                            ssNumber: (e as any).ssNumber || ''
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
                    Employee.find({ status: { $ne: 'Inactive' } }).select('firstName lastName email profilePicture hourlyRateSITE hourlyRateDrive classification companyPosition designation isScheduleActive address ssNumber').lean(),
                    Constant.find().select('type description color value image').lean(),
                    Estimate.find({ status: { $ne: 'deleted' } })
                        .select('estimate _id updatedAt createdAt customer customerName customerId projectTitle projectName projectId jobAddress contactName contactPhone contactEmail contact phone')
                        .sort({ updatedAt: -1 })
                        .limit(1000)
                        .lean(),
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
                                customerName: (() => {
                                    const client = clients?.find((c: any) => String(c._id) === String(e.customerId));
                                    return client?.name || e.customerName || e.customer || '';
                                })(),
                                projectTitle: pName,
                                projectName: pName,
                                projectId: e.projectId,
                                jobAddress: e.jobAddress,
                                contactName: e.contactName || e.contact,
                                contactPhone: e.contactPhone || e.phone,
                                contactEmail: e.contactEmail,
                                aerialImage: e.aerialImage || '',
                                siteLayout: e.siteLayout || ''
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
                            isScheduleActive: (e as any).isScheduleActive,
                            address: (e as any).address || '',
                            ssNumber: (e as any).ssNumber || ''
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

            case 'getScheduleStats': {
                await connectToDatabase();

                // Build the initial match + optional employee filter for data scope
                const statsMatchStage: any = { "timesheet.0": { $exists: true } };

                const results = await Schedule.aggregate([
                    { $match: statsMatchStage },
                    { $unwind: "$timesheet" },
                    // Apply time_cards data scope: if 'self', only include current user's timesheet entries
                    ...(timeCardsScope === 'self' && currentUserEmail ? [
                        { $match: { "timesheet.employee": { $regex: new RegExp(`^${currentUserEmail.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`, 'i') } } }
                    ] : []),
                    // First, extract the clockIn as a Date object and determine type/location info
                    { $addFields: {
                        // Convert clockIn string to Date object for date operations
                        clockInDate: { $convert: { input: "$timesheet.clockIn", to: "date", onError: null, onNull: null } },
                        // Determine if this is drive time
                        isDriveTime: { $regexMatch: { input: { $toLower: { $ifNull: ["$timesheet.type", ""] } }, regex: /drive/ } },
                        // Check if locationIn contains valid coordinates (has a comma with numbers)
                        hasLocationIn: { $regexMatch: { input: { $toString: { $ifNull: ["$timesheet.locationIn", ""] } }, regex: /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/ } },
                        // Check if locationOut contains valid coordinates
                        hasLocationOut: { $regexMatch: { input: { $toString: { $ifNull: ["$timesheet.locationOut", ""] } }, regex: /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/ } },
                        // Check for manual distance
                        hasManualDistance: { $gt: [{ $convert: { input: { $ifNull: ["$timesheet.manualDistance", 0] }, to: "double", onError: 0, onNull: 0 } }, 0] },
                        // Calculate dump washout hours: qty * 0.5
                        // Uses dumpQty numeric field (saved by frontend), falls back to checking dumpWashout truthy value
                        dumpHrs: { $multiply: [
                            { $cond: {
                                if: { $and: [{ $ne: [{ $ifNull: ["$timesheet.dumpQty", null] }, null] }, { $gt: ["$timesheet.dumpQty", 0] }] },
                                then: "$timesheet.dumpQty",
                                else: { $cond: {
                                    // Fallback: if dumpWashout is truthy (true, "true", "yes", or any non-empty string containing "qty"), count as 1
                                    if: { $or: [
                                        { $eq: ["$timesheet.dumpWashout", true] },
                                        { $eq: [{ $toLower: { $toString: { $ifNull: ["$timesheet.dumpWashout", ""] } } }, "true"] },
                                        { $eq: [{ $toLower: { $toString: { $ifNull: ["$timesheet.dumpWashout", ""] } } }, "yes"] },
                                        { $regexMatch: { input: { $toString: { $ifNull: ["$timesheet.dumpWashout", ""] } }, regex: /qty/ } }
                                    ]},
                                    then: 1,
                                    else: 0
                                }}
                            }},
                            0.5
                        ]},
                        // Calculate shop hours: qty * 0.25
                        shopHrs: { $multiply: [
                            { $cond: {
                                if: { $and: [{ $ne: [{ $ifNull: ["$timesheet.shopQty", null] }, null] }, { $gt: ["$timesheet.shopQty", 0] }] },
                                then: "$timesheet.shopQty",
                                else: { $cond: {
                                    if: { $or: [
                                        { $eq: ["$timesheet.shopTime", true] },
                                        { $eq: [{ $toLower: { $toString: { $ifNull: ["$timesheet.shopTime", ""] } } }, "true"] },
                                        { $eq: [{ $toLower: { $toString: { $ifNull: ["$timesheet.shopTime", ""] } } }, "yes"] },
                                        { $regexMatch: { input: { $toString: { $ifNull: ["$timesheet.shopTime", ""] } }, regex: /qty/ } }
                                    ]},
                                    then: 1,
                                    else: 0
                                }}
                            }},
                            0.25
                        ]}
                    }},
                    // For drive time with coordinates, calculate haversine distance
                    // Split locationIn/Out strings into lat/lon components
                    { $addFields: {
                        _locInParts: { $cond: { if: "$hasLocationIn", then: { $split: ["$timesheet.locationIn", ","] }, else: ["0", "0"] } },
                        _locOutParts: { $cond: { if: "$hasLocationOut", then: { $split: ["$timesheet.locationOut", ","] }, else: ["0", "0"] } }
                    }},
                    { $addFields: {
                        _lat1Rad: { $multiply: [{ $convert: { input: { $trim: { input: { $arrayElemAt: ["$_locInParts", 0] } } }, to: "double", onError: 0, onNull: 0 } }, { $divide: [Math.PI, 180] }] },
                        _lon1Rad: { $multiply: [{ $convert: { input: { $trim: { input: { $arrayElemAt: ["$_locInParts", 1] } } }, to: "double", onError: 0, onNull: 0 } }, { $divide: [Math.PI, 180] }] },
                        _lat2Rad: { $multiply: [{ $convert: { input: { $trim: { input: { $arrayElemAt: ["$_locOutParts", 0] } } }, to: "double", onError: 0, onNull: 0 } }, { $divide: [Math.PI, 180] }] },
                        _lon2Rad: { $multiply: [{ $convert: { input: { $trim: { input: { $arrayElemAt: ["$_locOutParts", 1] } } }, to: "double", onError: 0, onNull: 0 } }, { $divide: [Math.PI, 180] }] }
                    }},
                    { $addFields: {
                        _dLat: { $subtract: ["$_lat2Rad", "$_lat1Rad"] },
                        _dLon: { $subtract: ["$_lon2Rad", "$_lon1Rad"] }
                    }},
                    { $addFields: {
                        // Haversine 'a' = sin²(dLat/2) + cos(lat1) * cos(lat2) * sin²(dLon/2)
                        _haversineA: { $add: [
                            { $multiply: [{ $sin: { $divide: ["$_dLat", 2] } }, { $sin: { $divide: ["$_dLat", 2] } }] },
                            { $multiply: [
                                { $cos: "$_lat1Rad" },
                                { $cos: "$_lat2Rad" },
                                { $sin: { $divide: ["$_dLon", 2] } },
                                { $sin: { $divide: ["$_dLon", 2] } }
                            ]}
                        ]}
                    }},
                    { $addFields: {
                        // Distance in miles = R * 2 * atan2(sqrt(a), sqrt(1 - a)) * DRIVING_FACTOR
                        // R = 3958.8 miles, DRIVING_FACTOR = 1.5
                        _haversineDist: { $multiply: [
                            3958.8,
                            { $multiply: [2, { $atan2: [{ $sqrt: "$_haversineA" }, { $sqrt: { $subtract: [1, "$_haversineA"] } }] }] },
                            1.5  // Driving factor (same as frontend)
                        ]},
                        // Manual distance (if set)
                        _manualDist: { $convert: { input: { $ifNull: ["$timesheet.manualDistance", 0] }, to: "double", onError: 0, onNull: 0 } }
                    }},
                    { $addFields: {
                        // Final drive distance: manual distance takes priority, then haversine
                        _driveDistance: { $cond: {
                            if: { $gt: ["$_manualDist", 0] },
                            then: "$_manualDist",
                            else: { $cond: {
                                if: { $and: ["$hasLocationIn", "$hasLocationOut"] },
                                then: "$_haversineDist",
                                else: 0
                            }}
                        }}
                    }},
                    // Calculate raw hoursNum based on type and location availability
                    { $addFields: {
                        _rawHoursNum: {
                            $cond: {
                                // ALL Drive Time: calculate from distance + dump/shop, or manual hours override
                                if: "$isDriveTime",
                                then: {
                                    $cond: {
                                        // Manual duration override (manualDuration field) — always takes priority
                                        if: { $gt: [{ $convert: { input: { $ifNull: ["$timesheet.manualDuration", 0] }, to: "double", onError: 0, onNull: 0 } }, 0] },
                                        then: { $convert: { input: "$timesheet.manualDuration", to: "double", onError: 0, onNull: 0 } },
                                        else: {
                                            $cond: {
                                                // Has distance (locations or manual) → distance/55 + dump + shop
                                                if: { $gt: ["$_driveDistance", 0] },
                                                then: { $add: [
                                                    { $divide: ["$_driveDistance", 55] },
                                                    { $ifNull: ["$dumpHrs", 0] },
                                                    { $ifNull: ["$shopHrs", 0] }
                                                ]},
                                                // No distance, no locations → dump + shop only
                                                else: { $add: [{ $ifNull: ["$dumpHrs", 0] }, { $ifNull: ["$shopHrs", 0] }] }
                                            }
                                        }
                                    }
                                },
                                // Site Time: manualDuration → stored hours → calculate from clockIn/clockOut
                                else: {
                                    $cond: {
                                        // Priority 1: Manual duration override
                                        if: { $gt: [{ $convert: { input: { $ifNull: ["$timesheet.manualDuration", 0] }, to: "double", onError: 0, onNull: 0 } }, 0] },
                                        then: { $convert: { input: "$timesheet.manualDuration", to: "double", onError: 0, onNull: 0 } },
                                        else: {
                                            // Priority 2: Calculate from clockIn/clockOut (will be rounded in next stage)
                                            $let: {
                                                vars: {
                                                    dStart: { $convert: { input: "$timesheet.clockIn", to: "date", onError: null, onNull: null } },
                                                    dEnd: { $convert: { input: "$timesheet.clockOut", to: "date", onError: null, onNull: null } },
                                                    lStart: { $convert: { input: "$timesheet.lunchStart", to: "date", onError: null, onNull: null } },
                                                    lEnd: { $convert: { input: "$timesheet.lunchEnd", to: "date", onError: null, onNull: null } }
                                                },
                                                in: {
                                                    $cond: {
                                                        if: { $and: ["$$dStart", "$$dEnd"] },
                                                        then: {
                                                            $divide: [
                                                                { $subtract: [
                                                                    { $subtract: ["$$dEnd", "$$dStart"] },
                                                                    { $cond: { 
                                                                        if: { $and: ["$$lStart", "$$lEnd"] }, 
                                                                        then: { $subtract: ["$$lEnd", "$$lStart"] },
                                                                        else: 0 
                                                                    }}
                                                                ]},
                                                                3600000
                                                            ]
                                                        },
                                                        else: 0
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        // Flag: is this a manual duration override for site time? (skip rounding)
                        _isSiteManualDuration: {
                            $and: [
                                { $not: "$isDriveTime" },
                                { $gt: [{ $convert: { input: { $ifNull: ["$timesheet.manualDuration", 0] }, to: "double", onError: 0, onNull: 0 } }, 0] }
                            ]
                        }
                    }},
                    // Apply quarter-hour rounding for site time (same logic as frontend calculateTimesheetData)
                    // Rounding only applies to site time calculated from clockIn/clockOut (not drive time, not manual duration)
                    { $addFields: {
                        hoursNum: {
                            $cond: {
                                // Drive time or manual duration site time: no rounding needed
                                if: { $or: ["$isDriveTime", "$_isSiteManualDuration"] },
                                then: "$_rawHoursNum",
                                else: {
                                    $cond: {
                                        // If raw hours is 0 or negative, return 0
                                        if: { $lte: ["$_rawHoursNum", 0] },
                                        then: 0,
                                        else: {
                                            $cond: {
                                                // Cutoff: entries before 2025-10-26 don't get rounding
                                                if: { $lt: ["$clockInDate", new Date('2025-10-26T00:00:00.000Z')] },
                                                then: "$_rawHoursNum",
                                                else: {
                                                    $cond: {
                                                        // 7.75–8.0 snap to 8.0
                                                        if: { $and: [
                                                            { $gte: ["$_rawHoursNum", 7.75] },
                                                            { $lt: ["$_rawHoursNum", 8.0] }
                                                        ]},
                                                        then: 8.0,
                                                        else: {
                                                            // Quarter-hour rounding: extract whole hours + round minutes to 0/15/30/45
                                                            $let: {
                                                                vars: {
                                                                    wholeHours: { $floor: "$_rawHoursNum" },
                                                                    rawMinutes: { $round: [{ $multiply: [{ $subtract: ["$_rawHoursNum", { $floor: "$_rawHoursNum" }] }, 60] }, 0] }
                                                                },
                                                                in: {
                                                                    $add: [
                                                                        "$$wholeHours",
                                                                        { $divide: [
                                                                            { $switch: {
                                                                                branches: [
                                                                                    // m <= 1 → 0 (essentially 0 or 1 minute → round down)
                                                                                    { case: { $lte: ["$$rawMinutes", 1] }, then: 0 },
                                                                                    // m > 1 && m <= 14 → 0
                                                                                    { case: { $lte: ["$$rawMinutes", 14] }, then: 0 },
                                                                                    // m > 14 && m <= 29 → 15
                                                                                    { case: { $lte: ["$$rawMinutes", 29] }, then: 15 },
                                                                                    // m > 29 && m <= 44 → 30
                                                                                    { case: { $lte: ["$$rawMinutes", 44] }, then: 30 },
                                                                                    // m > 44 && m <= 59 → 45
                                                                                    { case: { $lte: ["$$rawMinutes", 59] }, then: 45 }
                                                                                ],
                                                                                default: 0
                                                                            }},
                                                                            60
                                                                        ]}
                                                                    ]
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }},
                    // Use clockIn for year/week/date grouping instead of fromDate
                    { $addFields: {
                        // Use clockIn date for year/week calculations (fallback to fromDate if clockIn is null)
                        dateForGrouping: { $ifNull: ["$clockInDate", { $convert: { input: "$fromDate", to: "date", onError: new Date(), onNull: new Date() } }] }
                    }},
                    { $addFields: {
                        // Extract ISO week year and isoWeek from the clockIn date
                        // Use $isoWeekYear instead of $year to properly handle year boundaries
                        // (e.g., 12/29/2025 is week 1 of 2026, so isoWeekYear should be 2026)
                        year: { $isoWeekYear: "$dateForGrouping" },
                        week: { $isoWeek: "$dateForGrouping" },
                        // Use $dateToString on the converted Date object to get YYYY-MM-DD
                        // This handles ALL clockIn formats (M/D/YYYY, ISO, etc.) correctly
                        // Previously used $substrCP on raw string which broke for non-ISO formats
                        dateStr: { $dateToString: { format: "%Y-%m-%d", date: "$dateForGrouping", timezone: "UTC" } }
                    }},
                    { $group: {
                        _id: {
                            year: "$year",
                            week: "$week",
                            employee: "$timesheet.employee",
                            date: "$dateStr"
                        },
                        totalHours: { $sum: "$hoursNum" },
                        driveHours: { $sum: { $cond: { if: "$isDriveTime", then: "$hoursNum", else: 0 } } },
                        refDate: { $min: "$dateForGrouping" }
                    }},
                    { $sort: { 
                        "_id.year": -1, 
                        "_id.week": -1, 
                        "_id.employee": 1,
                        "_id.date": 1
                    }}
                ]);
                return NextResponse.json({ success: true, result: results });
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
