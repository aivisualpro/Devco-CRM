/**
 * MIGRATION: Fix timezone-shifted timesheet clockIn/clockOut/lunch values
 * 
 * ROOT CAUSE: The DJT signature handler (djt/route.ts) was using:
 *   new Date(schedule.fromDate) → which shifts nominal Z-suffixed times by timezone offset
 * 
 * STRATEGY:
 * For each schedule with Site Time entries:
 * 1. Get the schedule's fromDate as stored in MongoDB (Date type, always UTC)
 * 2. Normalize it to our nominal Z string format
 * 3. Compare with the stored clockIn
 * 4. If they differ by 1-12 whole hours (indicating timezone shift), compute the offset
 * 5. Apply that same offset to clockOut, lunchStart, lunchEnd (preserving relative durations)
 * 
 * SAFETY:
 * - DRY RUN by default — pass mode=apply to actually write
 * - Only touches Site Time entries where clockIn disagrees with fromDate
 * - Logs every change with before/after values
 * - Creates a backup log of all original values
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { Schedule } from '@/lib/models';
import { robustNormalizeISO } from '@/lib/timeCardUtils';

// Helper: shift a time string by a given number of milliseconds
function shiftISO(isoStr: string, offsetMs: number): string {
    if (!isoStr) return isoStr;
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return isoStr;
        return new Date(d.getTime() + offsetMs).toISOString();
    } catch {
        return isoStr;
    }
}

// Helper: extract just the time portion HH:mm from an ISO string
function extractTime(iso: string): string {
    if (!iso) return '';
    const match = iso.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : '';
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { mode = 'dryrun', scheduleId } = body;
        // mode: 'dryrun' (default) | 'apply'
        // scheduleId: optional - if provided, only process this one schedule

        if (mode !== 'dryrun' && mode !== 'apply') {
            return NextResponse.json({ success: false, error: 'mode must be "dryrun" or "apply"' });
        }

        await connectToDatabase();

        // Find schedules that have Site Time entries
        const query: any = {
            'timesheet.type': 'Site Time'
        };
        if (scheduleId) {
            query._id = scheduleId;
        }

        const schedules = await Schedule.find(query).lean();

        const results: any[] = [];
        let totalFixed = 0;
        let totalSkipped = 0;
        let totalSchedules = 0;
        const backup: any[] = [];

        for (const sched of schedules) {
            const schedAny = sched as any;
            if (!schedAny.timesheet || schedAny.timesheet.length === 0) continue;
            if (!schedAny.fromDate) continue;

            totalSchedules++;

            // Get the correct fromDate as nominal ISO string
            // MongoDB stores fromDate as Date type, so it comes as a JS Date object
            // .toISOString() gives us the UTC representation which IS our nominal time
            const correctFromDateISO = typeof schedAny.fromDate === 'string'
                ? robustNormalizeISO(schedAny.fromDate)
                : (schedAny.fromDate as Date).toISOString();

            const correctFromTime = extractTime(correctFromDateISO);

            for (let i = 0; i < schedAny.timesheet.length; i++) {
                const ts = schedAny.timesheet[i];

                // Only fix Site Time entries
                if (ts.type !== 'Site Time') continue;
                if (!ts.clockIn) continue;

                const storedClockIn = robustNormalizeISO(ts.clockIn);
                const storedClockInTime = extractTime(storedClockIn);

                // Check if the date part matches (same day)
                const correctDate = correctFromDateISO.split('T')[0];
                const storedDate = storedClockIn.split('T')[0];

                // Calculate the offset between what's stored and what should be correct
                // We only fix if the difference is a whole number of hours (1-12)
                const correctMs = new Date(correctFromDateISO).getTime();
                const storedMs = new Date(storedClockIn).getTime();
                const diffMs = correctMs - storedMs;
                const diffHours = diffMs / (1000 * 60 * 60);

                // Skip if already correct (diff is 0 or negligible)
                if (Math.abs(diffMs) < 60000) { // less than 1 minute
                    totalSkipped++;
                    results.push({
                        action: 'OK',
                        scheduleId: schedAny._id,
                        estimate: schedAny.estimate,
                        employee: ts.employee,
                        tsIndex: i,
                        fromDate: correctFromDateISO,
                        fromDateRaw: String(schedAny.fromDate),
                        fromDateType: typeof schedAny.fromDate,
                        clockIn: storedClockIn,
                        clockInRaw: ts.clockIn,
                        clockOut: ts.clockOut || null,
                        diffMs: diffMs,
                        diffHours: diffHours.toFixed(2)
                    });
                    continue;
                }

                // Only fix if the difference is a whole number of hours (1-12 range)
                // This confirms it's a timezone offset, not a legitimate time difference
                if (!Number.isInteger(diffHours) || Math.abs(diffHours) < 1 || Math.abs(diffHours) > 12) {
                    totalSkipped++;
                    results.push({
                        action: 'SKIPPED_NON_TZ',
                        scheduleId: schedAny._id,
                        employee: ts.employee,
                        tsIndex: i,
                        reason: `Difference is ${diffHours.toFixed(2)}h — not a clean timezone offset`,
                        storedClockIn: storedClockIn,
                        correctClockIn: correctFromDateISO
                    });
                    continue;
                }

                // Build the corrected values
                const newClockIn = correctFromDateISO;
                const newClockOut = ts.clockOut ? shiftISO(robustNormalizeISO(ts.clockOut), diffMs) : ts.clockOut;
                const newLunchStart = ts.lunchStart ? shiftISO(robustNormalizeISO(ts.lunchStart), diffMs) : ts.lunchStart;
                const newLunchEnd = ts.lunchEnd ? shiftISO(robustNormalizeISO(ts.lunchEnd), diffMs) : ts.lunchEnd;

                // Create backup entry
                backup.push({
                    scheduleId: schedAny._id,
                    tsId: ts._id,
                    tsIndex: i,
                    employee: ts.employee,
                    original: {
                        clockIn: ts.clockIn,
                        clockOut: ts.clockOut,
                        lunchStart: ts.lunchStart,
                        lunchEnd: ts.lunchEnd
                    }
                });

                const changeRecord = {
                    action: 'FIX',
                    scheduleId: schedAny._id,
                    estimate: schedAny.estimate,
                    employee: ts.employee,
                    tsId: ts._id,
                    tsIndex: i,
                    offsetHours: diffHours,
                    fromDate: correctFromDateISO,
                    before: {
                        clockIn: storedClockIn,
                        clockInTime: storedClockInTime,
                        clockOut: ts.clockOut ? robustNormalizeISO(ts.clockOut) : null,
                        lunchStart: ts.lunchStart ? robustNormalizeISO(ts.lunchStart) : null,
                        lunchEnd: ts.lunchEnd ? robustNormalizeISO(ts.lunchEnd) : null
                    },
                    after: {
                        clockIn: newClockIn,
                        clockInTime: extractTime(newClockIn),
                        clockOut: newClockOut,
                        lunchStart: newLunchStart,
                        lunchEnd: newLunchEnd
                    }
                };

                results.push(changeRecord);
                totalFixed++;

                // Apply the fix if in apply mode
                if (mode === 'apply') {
                    const updateObj: any = {};
                    updateObj[`timesheet.${i}.clockIn`] = newClockIn;
                    if (newClockOut) updateObj[`timesheet.${i}.clockOut`] = newClockOut;
                    if (newLunchStart) updateObj[`timesheet.${i}.lunchStart`] = newLunchStart;
                    if (newLunchEnd) updateObj[`timesheet.${i}.lunchEnd`] = newLunchEnd;
                    updateObj[`timesheet.${i}.migrationNote`] = `tz-fix-${new Date().toISOString().split('T')[0]}`;

                    await Schedule.updateOne(
                        { _id: schedAny._id },
                        { $set: updateObj }
                    );
                }
            }
        }

        return NextResponse.json({
            success: true,
            mode,
            summary: {
                totalSchedulesScanned: totalSchedules,
                totalEntriesFixed: totalFixed,
                totalEntriesSkipped: totalSkipped,
                message: mode === 'dryrun'
                    ? `DRY RUN — ${totalFixed} entries would be fixed. Call with mode="apply" to execute.`
                    : `APPLIED — ${totalFixed} entries have been fixed.`
            },
            changes: results,
            backup: mode === 'apply' ? backup : undefined
        });

    } catch (error: any) {
        console.error('Migration error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
