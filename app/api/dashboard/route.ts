import { NextRequest, NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/db';
import { Schedule, DevcoTask, Estimate } from '@/lib/models';
import { getUserFromRequest } from '@/lib/permissions/middleware';

export const revalidate = 60;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const week = searchParams.get('week');
        const scope = searchParams.get('scope') || 'all';
        const section = searchParams.get('section') || 'all'; // 'all', 'schedules', 'tasks', 'stats', 'activities'
        const estimateFilter = searchParams.get('estimateFilter') || 'this_month';

        if (!week) {
            return NextResponse.json({ success: false, error: 'Week parameter is required' }, { status: 400 });
        }

        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const userEmail = user.email;

        // Parse week MM/DD-MM/DD
        const currentYear = new Date().getFullYear();
        const [startStr, endStr] = week.split('-');
        
        let startDateStr = '';
        let endDateStr = '';

        if (startStr && endStr) {
            const [startMonth, startDay] = startStr.split('/');
            const [endMonth, endDay] = endStr.split('/');

            let startYear = currentYear;
            let endYear = currentYear;
            // Handle cross-year week
            if (parseInt(startMonth) === 12 && parseInt(endMonth) === 1) {
                endYear = currentYear + 1; // Or check if current month is Dec or Jan
                // Assuming current year based on month context is tricky, let's just create dates relative to today
                // For simplicity, just use Date objects
            }

            // Using ISO strings to avoid timezone drift
            startDateStr = `${startYear}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}T00:00:00.000Z`;
            endDateStr = `${endYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}T23:59:59.999Z`;
        }

        const weekId = week;

        // Plain async function — avoids Next.js unstable_cache 2MB limit
        // (timecardSchedules payloads can exceed 3MB). HTTP-level caching
        // is handled by `export const revalidate = 60` above.
        const getDashboardData = async (weekParam: string, scopeParam: string, email: string, filterParam: string) => {
            await connectToDatabase();

            const startDate = startDateStr ? new Date(startDateStr) : new Date();
            const endDate = endDateStr ? new Date(endDateStr) : new Date();

            // 1. Schedules
            const pad2 = (n: number) => String(n).padStart(2, '0');
            const startYMD = `${startDate.getUTCFullYear()}-${pad2(startDate.getUTCMonth() + 1)}-${pad2(startDate.getUTCDate())}`;
            const endYMD = `${endDate.getUTCFullYear()}-${pad2(endDate.getUTCMonth() + 1)}-${pad2(endDate.getUTCDate())}`;

            let scheduleQuery: any = {
                fromDate: { $gte: startDate, $lte: endDate }
            };
            
            if (scopeParam === 'self') {
                scheduleQuery.$or = [
                    { projectManager: email },
                    { foremanName: email },
                    { assignees: email }
                ];
            }

            // Optional fetching based on section
            const schedulesPromise = (section === 'all' || section === 'schedules') 
                ? Schedule.find(scheduleQuery).lean({ virtuals: true }).select('_id title fromDate toDate customerName jobAddress status service item assignees assigneeCount foremanName projectManager estimate description jha djt hasJHA hasDJT isRequiredDJT isRequiredJHA changeOfScope timesheet timesheetSummary fringe certifiedPayroll perDiem notifyAssignees todayObjectives aerialImage siteLayout')
                : Promise.resolve([]);

            // 1b. Timecard Schedules
            const startMinus30 = new Date(startDate);
            startMinus30.setDate(startMinus30.getDate() - 30);
            const timecardSchedulesPromise = (section === 'all' || section === 'timecards')
                ? Schedule.find({
                    fromDate: { $gte: startMinus30, $lte: endDate },
                    'timesheet.0': { $exists: true }
                  }).lean().select('_id title fromDate toDate customerName jobAddress status service item assignees assigneeCount foremanName projectManager estimate description timesheet jha djt changeOfScope fringe certifiedPayroll perDiem notifyAssignees todayObjectives aerialImage siteLayout')
                : Promise.resolve([]);

            // 2. Estimate Stats
            let estMatch: any = {};
            const now = new Date();
            
            if (filterParam === 'this_month') {
                const estStart = new Date(now.getFullYear(), now.getMonth(), 1);
                const estEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                estMatch = { createdAt: { $gte: estStart, $lte: estEnd } };
            } else if (filterParam === 'last_month') {
                const estStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const estEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                estMatch = { createdAt: { $gte: estStart, $lte: estEnd } };
            } else if (filterParam === 'ytd') {
                const estStart = new Date(now.getFullYear(), 0, 1);
                const estEnd = new Date();
                estMatch = { createdAt: { $gte: estStart, $lte: estEnd } };
            } else if (filterParam === 'last_year') {
                const estStart = new Date(now.getFullYear() - 1, 0, 1);
                const estEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
                estMatch = { createdAt: { $gte: estStart, $lte: estEnd } };
            } else if (filterParam === 'this_week') {
                estMatch = { createdAt: { $gte: startDate, $lte: endDate } };
            }

            const estimateStatsPromise = (section === 'all' || section === 'stats')
                ? Estimate.aggregate([
                    { $match: estMatch },
                    {
                        $group: {
                            _id: { $toLower: "$status" },
                            count: { $sum: 1 },
                            total: { $sum: { $convert: { input: { $ifNull: ["$grandTotal", "$totalPrice"] }, to: "double", onError: 0, onNull: 0 } } }
                        }
                    }
                ])
                : Promise.resolve([]);

            // 3. Tasks
            const tasksPromise = (section === 'all' || section === 'tasks')
                ? DevcoTask.find({
                    $or: [
                        { status: { $ne: 'done' } },
                        { status: 'done', lastUpdatedAt: { $gte: startDate, $lte: endDate } }
                    ]
                }).limit(100).sort({ createdAt: -1 }).lean()
                : Promise.resolve([]);

            // 4. Timesheet Aggregation
            const timesheetPromise = (section === 'all' || section === 'stats' || section === 'schedules')
                ? Schedule.aggregate([
                    { $match: { 'timesheet.clockIn': { $gte: startDateStr, $lte: endDateStr } } },
                    { $unwind: "$timesheet" },
                    { $match: { 'timesheet.clockIn': { $gte: startDateStr, $lte: endDateStr } } },
                    {
                        $group: {
                            _id: null,
                            totalHours: { $sum: { $toDouble: "$timesheet.hours" } }
                        }
                    }
                ])
                : Promise.resolve([]);

            // 5. Activities — disabled (collection removed)
            const activitiesPromise = Promise.resolve([]);

            const [schedules, timecardSchedules, rawEstimateStats, tasks, timesheetAgg, activities] = await Promise.all([
                schedulesPromise,
                timecardSchedulesPromise,
                estimateStatsPromise,
                tasksPromise,
                timesheetPromise,
                activitiesPromise
            ]);

            // Format Estimate Stats
            const estimateStatsMap: Record<string, any> = {
                'pending': { status: 'Pending', count: 0, total: 0 },
                'won': { status: 'Won', count: 0, total: 0 },
                'lost': { status: 'Lost', count: 0, total: 0 },
                'completed': { status: 'Completed', count: 0, total: 0 },
                'expired': { status: 'Expired', count: 0, total: 0 },
            };

            rawEstimateStats.forEach((stat: any) => {
                const s = stat._id === 'in progress' ? 'pending' : stat._id;
                if (estimateStatsMap[s]) {
                    estimateStatsMap[s].count += stat.count;
                    estimateStatsMap[s].total += stat.total || 0;
                } else {
                    estimateStatsMap[s] = { status: s.charAt(0).toUpperCase() + s.slice(1), count: stat.count, total: stat.total || 0 };
                }
            });

            const estimateStats = Object.values(estimateStatsMap);

            return {
                schedules,
                timecardSchedules,
                estimateStats,
                tasks,
                timesheet: timesheetAgg[0] || { totalHours: 0 },
                activities,
                trainings: [],
                weekRange: { startISO: startDateStr, endISO: endDateStr },
                generatedAt: new Date().toISOString()
            };
        };

        const data = await getDashboardData(weekId, scope, userEmail, estimateFilter);

        return NextResponse.json({ success: true, ...data });

    } catch (error: any) {
        console.error('Dashboard API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
