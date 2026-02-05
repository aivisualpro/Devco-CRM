'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
    ChevronRight, ChevronLeft, ChevronDown, User, Calendar as CalendarIcon,
    MapPin, Truck, Trash2, Edit, RotateCcw, FileText, Clock, RefreshCcw, Plus, CheckCircle2,
    Briefcase, Info, Search, List, Filter, Download, DollarSign
} from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { 
    Header, Loading, Modal, Tooltip, TooltipTrigger, TooltipContent,
    SearchableSelect, Card, Table, TableHead, TableBody, TableRow, TableHeader, TableCell,
    Badge
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { 
    calculateTimesheetData, 
    formatDateOnly, 
    formatTimeOnly, 
    robustNormalizeISO
} from '@/lib/timeCardUtils';

// --- Local Utils to fix build issues ---
const startOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff, 0, 0, 0, 0));
    return start;
};

const endOfWeek = (date: Date) => {
    const d = startOfWeek(date);
    const end = new Date(d);
    end.setUTCDate(d.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    return end;
};

const addWeeks = (date: Date, weeks: number) => {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + (weeks * 7));
    return d;
};

const subWeeks = (date: Date, weeks: number) => addWeeks(date, -weeks);

// --- Types ---

interface TimesheetRecord {
    _id: string;
    employee: string;
    type: string;
    clockIn: string;
    clockOut?: string;
    hoursVal: number;
    regHrs: number;
    otHrs: number;
    dtHrs: number;
    isSiteTime?: boolean;
    isDriveTime?: boolean;
    regPay: number;
    otPay: number;
    dtPay: number;
    travelPay: number;
    grossPay: number;
    subjectWages: number;
    compCost: number;
    scheduleId: string;
    item: string;
    dateLabel: string;
    title: string;
    estimateRef: string;
}

interface WorkerCompGroup {
    id: string;
    label: string;
    totalAmount: number;
    totalHours: number;
    recordCount: number;
}

// --- Helpers ---

const getWeekNumber = (d: Date) => {
    const utcDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - (utcDate.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
};

const formatMMDDYY = (date: Date) => {
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    const y = String(date.getUTCFullYear()).slice(-2);
    return `${m}/${d}/${y}`;
};

const generateWeeksForYear = (year: number) => {
    const weeks = [];
    // Start from end of year or current date if year is current
    let d = new Date(Date.UTC(year, 11, 31));
    const now = new Date();
    if (year === now.getUTCFullYear()) {
        d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }
    
    // Normalize to start of its week (Monday)
    let current = startOfWeek(d);
    
    // Go back until we hit the start of the year
    while (current.getUTCFullYear() >= year) {
        if (current.getUTCFullYear() === year) {
            const startStr = formatMMDDYY(current);
            const end = endOfWeek(current);
            const endStr = formatMMDDYY(end);
            const weekNum = getWeekNumber(current);
            
            weeks.push({
                value: `${startStr}-${endStr}`,
                label: `Week ${weekNum} (${startStr} - ${endStr})`,
                start: new Date(current),
                end: new Date(end)
            });
        }
        current = subWeeks(current, 1);
        if (weeks.length > 53) break; // Safety
    }
    return weeks;
};

// Skeleton components for loading states
const SidebarSkeleton = () => (
    <div className="p-3 space-y-2 animate-pulse">
        {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-100">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-200" />
                    <div className="w-24 h-3 bg-slate-200 rounded" />
                </div>
                <div className="w-12 h-4 bg-slate-200 rounded-lg" />
            </div>
        ))}
    </div>
);

const TableSkeleton = () => (
    <div className="p-4 space-y-2 animate-pulse">
        {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50">
                <div className="w-8 h-8 rounded-full bg-slate-200" />
                <div className="flex-1 space-y-2">
                    <div className="w-32 h-3 bg-slate-200 rounded" />
                    <div className="w-48 h-2 bg-slate-100 rounded" />
                </div>
                <div className="w-16 h-4 bg-slate-200 rounded" />
                <div className="w-16 h-4 bg-slate-200 rounded" />
                <div className="w-20 h-4 bg-slate-200 rounded" />
            </div>
        ))}
    </div>
);

export default function WorkersCompPage() {
    const { success: toastSuccess, error: toastError } = useToast();
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [rawSchedules, setRawSchedules] = useState<any[]>([]);
    const [employeesMap, setEmployeesMap] = useState<Record<string, any>>({});
    const [workersCompRates, setWorkersCompRates] = useState<Record<string, number>>({});
    
    const params = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    
    // Filters
    // Initialize with current week
    // Initialize from URL or defaults
    const [startDate, setStartDate] = useState<Date>(() => {
        const p = params.get('from');
        if (p) {
            const d = new Date(p);
            if (!isNaN(d.getTime())) return d;
        }
        return startOfWeek(new Date());
    });

    const [endDate, setEndDate] = useState<Date>(() => {
        const p = params.get('to');
        if (p) {
            const d = new Date(p);
            if (!isNaN(d.getTime())) return d;
        }
        return endOfWeek(new Date());
    });
    
    const [selectedItem, setSelectedItem] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [activityIcons, setActivityIcons] = useState<Record<string, string>>({});
    const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
    const [includeDriveTime, setIncludeDriveTime] = useState(() => {
        const p = params.get('driveTime');
        return p !== null ? p === 'true' : true;
    });
    const [visibleRows, setVisibleRows] = useState(50);
    const [prefsLoaded, setPrefsLoaded] = useState(false);

    // Data Fetching
    const fetchData = async (isInitial = false) => {
        if (isInitial) {
            setIsInitialLoad(true);
        } else {
            setIsRefreshing(true);
        }
        try {
            // Extend date range slightly to capture timesheets on boundary dates
            const extendedStart = new Date(startDate);
            extendedStart.setDate(extendedStart.getDate() - 7);
            const extendedEnd = new Date(endDate);
            extendedEnd.setDate(extendedEnd.getDate() + 7);

            // Fetch schedules with date range filtering
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'getSchedulesPage',
                    payload: { 
                        limit: 5000,
                        includeTimesheets: true,
                        startDate: extendedStart.toISOString(),
                        endDate: extendedEnd.toISOString()
                    } 
                }) 
            });
            const data = await res.json();
            
            // Fetch Constants for Workers Comp Rates
            const resConst = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getConstants' })
            });
            const dataConst = await resConst.json();
            if (dataConst.success) {
                const wcRates: Record<string, number> = {};
                const icons: Record<string, string> = {};
                (dataConst.result || []).forEach((c: any) => {
                    if (c.type === 'WComp') {
                        wcRates[String(c.description || '').toLowerCase()] = parseFloat(c.value || '0');
                    }
                    if (c.image) {
                        icons[String(c.description || '').toLowerCase()] = c.image;
                    }
                });
                setWorkersCompRates(wcRates);
                setActivityIcons(icons);
            }

            if (data.success) {
                setRawSchedules(data.result.schedules || []);
                const emps = data.result.initialData?.employees || [];
                const eMap: Record<string, any> = {};
                emps.forEach((e: any) => eMap[e.value] = e);
                setEmployeesMap(eMap);
            }
        } catch (err) {
            console.error(err);
            toastError("Failed to fetch data");
        } finally {
            setIsInitialLoad(false);
            setIsRefreshing(false);
        }
    };

    // Load Preferences
    useEffect(() => {
        const loadPrefs = async () => {
            try {
                const res = await fetch('/api/user/preferences');
                if (res.ok) {
                    const data = await res.json();
                    const filters = data.filters?.['workers-comp'];
                    if (filters) {
                         if (filters.includeDriveTime !== undefined && !params.get('driveTime')) {
                            setIncludeDriveTime(filters.includeDriveTime);
                         }
                         if (filters.selectedItem) setSelectedItem(filters.selectedItem);
                         
                         // Only restore saved dates if URL params are missing
                         if (!params.get('from') && !params.get('to')) {
                             if (filters.startStr) {
                                 const s = new Date(filters.startStr);
                                 if (!isNaN(s.getTime())) setStartDate(s);
                             }
                             if (filters.endStr) {
                                 const e = new Date(filters.endStr);
                                 if (!isNaN(e.getTime())) setEndDate(e);
                             }
                         }
                    }
                }
            } catch (e) {
                console.error("Failed to load preferences", e);
            } finally {
                setPrefsLoaded(true);
            }
        };
        loadPrefs();
    }, []);

    // Fetch data when preferences are loaded (initial load)
    useEffect(() => {
        if (prefsLoaded && isInitialLoad) {
            fetchData(true);
        }
    }, [prefsLoaded]);

    // Debounced fetch for date changes (refresh, not initial)
    useEffect(() => {
        if (!prefsLoaded || isInitialLoad) return;
        
        const timer = setTimeout(() => {
            fetchData(false);
        }, 300); // Debounce 300ms to avoid rapid refetches
        
        return () => clearTimeout(timer);
    }, [startDate, endDate]);

    // Save Preferences
    useEffect(() => {
        if (!prefsLoaded) return;
        
        const timer = setTimeout(() => {
            const filters = {
                includeDriveTime,
                selectedItem,
                startStr: startDate.toISOString(),
                endStr: endDate.toISOString()
            };
            
            fetch('/api/user/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportName: 'workers-comp',
                    filters
                })
            }).catch(console.error);
        }, 1000);

        return () => clearTimeout(timer);
    }, [prefsLoaded, includeDriveTime, selectedItem, startDate, endDate]);

    // Sync URL
    useEffect(() => {
        const currentParams = new URLSearchParams(params.toString());
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        const driveTimeStr = String(includeDriveTime);
        
        let needsUpdate = false;
        
        if (currentParams.get('from') !== startStr) {
            currentParams.set('from', startStr);
            needsUpdate = true;
        }
        if (currentParams.get('to') !== endStr) {
            currentParams.set('to', endStr);
            needsUpdate = true;
        }
        if (currentParams.get('driveTime') !== driveTimeStr) {
            currentParams.set('driveTime', driveTimeStr);
            needsUpdate = true;
        }

        if (needsUpdate) {
            router.replace(`${pathname}?${currentParams.toString()}`, { scroll: false });
        }
    }, [startDate, endDate, includeDriveTime, router, pathname, params]);

    // Flatten and Filter Records - MATCH PAYROLL EXACTLY
    // Key insight: OT/DT is calculated per EMPLOYEE per DAY, not per entry
    const allRecords = useMemo(() => {
        const filterStart = new Date(startDate);
        filterStart.setHours(0, 0, 0, 0);
        const filterEnd = new Date(endDate);
        filterEnd.setHours(23, 59, 59, 999);

        const parseRate = (val: any): number | null => {
            if (val === null || val === undefined) return null;
            const parsed = parseFloat(val);
            return isNaN(parsed) || parsed === 0 ? null : parsed;
        };

        // STEP 1: Group by employee + day (EXACTLY like Payroll)
        const employeeDays: Record<string, any> = {};

        rawSchedules.forEach(sched => {
            if (!sched.timesheet || !Array.isArray(sched.timesheet)) return;
            
            sched.timesheet.forEach((ts: any) => {
                const clockInDate = new Date(robustNormalizeISO(ts.clockIn));
                if (isNaN(clockInDate.getTime())) return;
                if (clockInDate < filterStart || clockInDate > filterEnd) return;

                const typeLower = ts.type?.trim().toLowerCase() || '';
                // Relaxed check to match Payroll's includes('site') logic
                const isSiteTime = typeLower.includes('site');
                const isDriveTime = typeLower.includes('drive');

                if (!isSiteTime && !(includeDriveTime && isDriveTime)) return;

                const { hours } = calculateTimesheetData(ts, sched.fromDate);
                const empKey = (ts.employee || '').toLowerCase();
                const dateKey = clockInDate.toISOString().split('T')[0];
                const dayKey = `${empKey}|${dateKey}`;

                if (!employeeDays[dayKey]) {
                    employeeDays[dayKey] = {
                        empKey,
                        dateKey,
                        siteHrs: 0,
                        travelHrs: 0,
                        dayRateSite: null as number | null,
                        dayRateDrive: null as number | null,
                        entries: []
                    };
                }

                // Aggregate daily hours (like Payroll lines 476-480)
                if (isSiteTime) {
                    employeeDays[dayKey].siteHrs += hours;
                } else if (isDriveTime) {
                    employeeDays[dayKey].travelHrs += hours;
                }

                // Capture entry rates (last one wins, like Payroll)
                const rateS = parseRate(ts.hourlyRateSITE);
                const rateD = parseRate(ts.hourlyRateDrive);
                if (rateS !== null) employeeDays[dayKey].dayRateSite = rateS;
                if (rateD !== null) employeeDays[dayKey].dayRateDrive = rateD;

                // Store entry for display
                employeeDays[dayKey].entries.push({
                    _id: ts._id || ts.recordId,
                    employee: ts.employee,
                    type: ts.type,
                    clockIn: ts.clockIn,
                    clockOut: ts.clockOut,
                    hoursVal: hours,
                    isSiteTime,
                    isDriveTime,
                    scheduleId: sched._id,
                    item: sched.item || 'Uncategorized',
                    dateLabel: formatDateOnly(ts.clockIn),
                    title: sched.projectTitle || sched.title || sched.jobTitle || 'Unknown Project',
                    estimateRef: sched.estimate || '--',
                    wcRatePer100: workersCompRates[String(sched.item || '').toLowerCase()] || 0
                });
            });
        });

        // STEP 2: Calculate per-day rates and OT/DT, then attribute to entries
        const flat: TimesheetRecord[] = [];

        Object.values(employeeDays).forEach((day: any) => {
            const empInfo = employeesMap[day.empKey] || {};
            
            // Profile rates (like Payroll lines 520-521)
            const profileRateSite = parseRate(empInfo.hourlyRateSITE) ?? 45;
            const profileRateTravel = parseRate(empInfo.hourlyRateDrive) ?? (profileRateSite * 0.75);
            
            // Day-specific rates override profile (like Payroll lines 548-549)
            const dayRateSite = day.dayRateSite ?? profileRateSite;
            const dayRateTravel = day.dayRateDrive ?? profileRateTravel;

            // DAILY OT/DT calculation (like Payroll lines 529-538)
            // This is the KEY difference - OT/DT is based on TOTAL daily siteHrs, not per-entry
            const dailyReg = Number(Math.min(8, day.siteHrs).toFixed(2));
            const dailyOt = Number(Math.min(4, Math.max(0, day.siteHrs - 8)).toFixed(2));
            const dailyDt = Number(Math.max(0, day.siteHrs - 12).toFixed(2));
            const dailyTravel = Number(day.travelHrs.toFixed(2));

            // DAILY amounts (like Payroll lines 551-554)
            const dailyRegAmount = dailyReg * dayRateSite;
            const dailyOtAmount = dailyOt * dayRateSite * 1.5;
            const dailyDtAmount = dailyDt * dayRateSite * 2.0;
            const dailyTravelAmount = dailyTravel * dayRateTravel;

            // Sort entries chronologically for progressive OT attribution
            day.entries.sort((a: any, b: any) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());

            // Attribute reg/OT/DT progressively to individual entries
            let siteTally = 0;
            day.entries.forEach((entry: any) => {
                let regHrs = 0, otHrs = 0, dtHrs = 0;
                let regPay = 0, otPay = 0, dtPay = 0, travelPay = 0;

                if (entry.isSiteTime) {
                    const startTally = siteTally;
                    const endTally = startTally + entry.hoursVal;
                    siteTally = endTally;

                    // Progressive attribution (like Payroll lines 567-569)
                    regHrs = Number(Math.max(0, Math.min(8, endTally) - Math.min(8, startTally)).toFixed(2));
                    otHrs = Number(Math.max(0, Math.min(12, endTally) - Math.min(12, Math.max(8, startTally))).toFixed(2));
                    dtHrs = Number(Math.max(0, endTally - Math.max(12, startTally)).toFixed(2));

                    regPay = regHrs * dayRateSite;
                    otPay = otHrs * dayRateSite * 1.5;
                    dtPay = dtHrs * dayRateSite * 2.0;
                } else if (entry.isDriveTime) {
                    // Travel time - separate from Regular Pay
                    const travelHrs = Number(entry.hoursVal.toFixed(2));
                    travelPay = travelHrs * dayRateTravel;
                }

                const grossPay = regPay + otPay + dtPay + travelPay;
                const rate = entry.isSiteTime ? dayRateSite : dayRateTravel;
                const subjectWages = entry.hoursVal * rate;
                const estimatedCompCost = (subjectWages * entry.wcRatePer100) / 100;

                flat.push({
                    _id: entry._id,
                    employee: entry.employee,
                    type: entry.type,
                    clockIn: entry.clockIn,
                    clockOut: entry.clockOut,
                    hoursVal: entry.hoursVal,
                    regHrs,
                    otHrs,
                    dtHrs,
                    regPay,
                    otPay,
                    dtPay,
                    travelPay,
                    grossPay,
                    subjectWages,
                    compCost: estimatedCompCost,
                    scheduleId: entry.scheduleId,
                    item: entry.item,
                    dateLabel: entry.dateLabel,
                    title: entry.title,
                    estimateRef: entry.estimateRef,
                    isSiteTime: entry.isSiteTime,
                    isDriveTime: entry.isDriveTime
                });
            });
        });

        // Debug: show total and per-employee breakdown
        const total = flat.reduce((s, r) => s + r.grossPay, 0);
        const totalSite = flat.reduce((s, r) => s + r.regPay + r.otPay + r.dtPay, 0);
        const totalTravel = flat.reduce((s, r) => s + r.travelPay, 0);
        
        // Group totals by employee for easy comparison
        const empTotals: Record<string, any> = {};
        flat.forEach(r => {
            const name = r.employee || 'Unknown';
            if (!empTotals[name]) empTotals[name] = { total: 0, site: 0, travel: 0, siteHrs: 0, travelHrs: 0 };
            empTotals[name].total += r.grossPay;
            empTotals[name].site += (r.regPay + r.otPay + r.dtPay);
            empTotals[name].travel += r.travelPay;
            // Accumulate hours based on type
            if (r.isSiteTime) {
                empTotals[name].siteHrs += r.hoursVal;
            } else if (r.isDriveTime) {
                empTotals[name].travelHrs += r.hoursVal;
            }
        });
        
        console.log('[WC] Total:', total.toFixed(2), '(Site:', totalSite.toFixed(2), 'Travel:', totalTravel.toFixed(2), ')', 'Records:', flat.length);
        console.log('[WC] Employee Breakdown:', Object.entries(empTotals)
            .sort(([,a], [,b]) => b.total - a.total)
            .map(([name, d]) => {
                const avgSiteRate = d.siteHrs ? (d.site / d.siteHrs).toFixed(2) : '0.00';
                return `${name}: $${d.userTotal ? d.userTotal.toFixed(2) : d.total.toFixed(2)} (S: $${d.site.toFixed(2)} @ ${d.siteHrs.toFixed(1)}h (Rate ~$${avgSiteRate}), T: $${d.travel.toFixed(2)})`;
            })
        );

        return flat.sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
    }, [rawSchedules, startDate, endDate, employeesMap, workersCompRates, includeDriveTime]);

    // Grouping Data
    const groups = useMemo(() => {
        const gMap: Record<string, WorkerCompGroup> = {};
        
        allRecords.forEach(r => {
            const key = r.item;
            if (!gMap[key]) {
                gMap[key] = { id: key, label: key, totalAmount: 0, totalHours: 0, recordCount: 0 };
            }
            gMap[key].totalAmount += r.grossPay;
            gMap[key].totalHours += r.hoursVal;
            gMap[key].recordCount += 1;
        });

        return Object.values(gMap).sort((a: any, b: any) => a.label.localeCompare(b.label));
    }, [allRecords]);

    // Reset pagination when filters change
    useEffect(() => {
        setVisibleRows(50);
    }, [selectedItem, searchQuery, startDate, endDate, expandedEmp, includeDriveTime]);

    const totals = useMemo(() => {
        return allRecords.reduce((acc, r: any) => ({
            hours: acc.hours + r.hoursVal,
            ot: acc.ot + r.otHrs,
            regPay: acc.regPay + r.regPay,
            otPay: acc.otPay + r.otPay,
            dtPay: acc.dtPay + r.dtPay,
            travelPay: (acc.travelPay || 0) + r.travelPay,
            gross: acc.gross + r.grossPay,
            comp: acc.comp + r.compCost,
            personnel: acc.personnel.add(r.employee)
        }), { hours: 0, ot: 0, regPay: 0, otPay: 0, dtPay: 0, travelPay: 0, gross: 0, comp: 0, personnel: new Set<string>() });
    }, [allRecords]);

    // Table Data
    const tableData = useMemo(() => {
        let filtered = allRecords;
        if (selectedItem !== 'All') {
            filtered = filtered.filter(r => r.item === selectedItem);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(r => 
                r.employee.toLowerCase().includes(q) || 
                r.title.toLowerCase().includes(q) ||
                r.estimateRef.toLowerCase().includes(q) ||
                (employeesMap[r.employee.toLowerCase()]?.label || '').toLowerCase().includes(q)
            );
        }
        return filtered;
    }, [allRecords, selectedItem, searchQuery, employeesMap]);

    const employeeSummary = useMemo(() => {
        const summaryMap: Record<string, any> = {};

        tableData.forEach(r => {
            if (!summaryMap[r.employee]) {
                summaryMap[r.employee] = { 
                    reg: 0, ot: 0, dt: 0,
                    totalHours: 0,
                    regPay: 0, otPay: 0, dtPay: 0,
                    gross: 0, 
                    count: 0,
                    employee: r.employee
                };
            }
            const s = summaryMap[r.employee];
            s.reg += r.regHrs;
            s.ot += r.otHrs;
            s.dt += r.dtHrs;
            s.totalHours += r.hoursVal;
            s.regPay += r.regPay;
            s.otPay += r.otPay;
            s.dtPay += r.dtPay;
            s.gross += r.grossPay;
            s.count += 1;
        });

        return Object.values(summaryMap).sort((a: any, b: any) => b.gross - a.gross);
    }, [tableData]);

    const displayData = (expandedEmp && expandedEmp !== '_all_')
        ? tableData.filter(r => r.employee === expandedEmp)
        : tableData;

    const downloadCSV = () => {
        const headers = ["Employee", "Date", "Title", "Estimate", "Classification", "Hours"];
        const rows = tableData.map(r => [
            employeesMap[r.employee]?.label || r.employee,
            r.dateLabel,
            r.title,
            r.estimateRef,
            r.item,
            r.hoursVal.toFixed(2)
        ]);

        const content = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Workers_Comp_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}_${selectedItem}.csv`;
        link.click();
    };

    // Only show full-page loading on initial load
    if (isInitialLoad && !rawSchedules.length) return <Loading />;

    return (
        <div className="flex flex-col h-full bg-[#f4f7fa]">
            <Header 
                hideLogo={false}
                rightContent={
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={downloadCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
                        >
                            <Download size={16} />
                            Export CSV
                        </button>
                    </div>
                }
            />

            <main className="flex-1 min-h-0 flex flex-col max-w-[1920px] w-full mx-auto p-4 overflow-hidden">
                
                {/* Filter & KPI Bar Combined */}
                <div className="flex items-center mb-3 min-h-[40px] relative z-40">
                    {/* Left: Sidebar-aligned Filters */}
                        <div className="w-[320px] flex items-center gap-2 shrink-0">
                             {/* Date Range Picker */}
                             <div className="flex items-center gap-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                 <div className="flex items-center gap-2 px-3 py-1.5 border-r border-slate-100">
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">From</span>
                                      <input 
                                         type="date"
                                         value={startDate.toISOString().split('T')[0]}
                                         onChange={(e) => {
                                             const d = new Date(e.target.value);
                                             if (!isNaN(d.getTime())) {
                                                 setStartDate(d);
                                                 // Auto-set End Date to (Start Date + 1 Month - 1 Day)
                                                 const next = new Date(d);
                                                 next.setMonth(next.getMonth() + 1);
                                                 next.setDate(next.getDate() - 1);
                                                 setEndDate(next);
                                             }
                                         }}
                                         className="text-[11px] font-bold text-slate-700 bg-transparent focus:outline-none font-mono"
                                      />
                                 </div>
                                 <div className="flex items-center gap-2 px-3 py-1.5">
                                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">To</span>
                                      <input 
                                         type="date"
                                         value={endDate.toISOString().split('T')[0]}
                                         onChange={(e) => {
                                             const d = new Date(e.target.value);
                                             if (!isNaN(d.getTime())) setEndDate(d);
                                         }}
                                         className="text-[11px] font-bold text-slate-700 bg-transparent focus:outline-none font-mono"
                                      />
                                 </div>
                             </div>
                        </div>

                        {/* Drive Time Toggle */}
                        <button 
                            onClick={() => setIncludeDriveTime(!includeDriveTime)}
                            className={`
                                w-[42px] h-[34px] flex items-center justify-center rounded-xl border shadow-sm transition-all
                                ${includeDriveTime 
                                    ? 'bg-blue-50 border-blue-200' 
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                                }
                            `}
                            title={includeDriveTime ? "Drive Time Included" : "Drive Time Excluded"}
                        >
                            <Truck size={16} className={includeDriveTime ? 'text-[#0F4C75]' : 'text-slate-300'} />
                        </button>

                    <div className="w-3" /> {/* Gap spacer */}

                    {/* Right: Table-aligned KPIs */}
                    <div className="flex-1 flex items-center justify-between">
                        <div className="flex items-center gap-4 bg-white/50 px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-2">
                                <DollarSign size={12} className="text-emerald-500" />
                                <div className="flex flex-col leading-none">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Reg $</span>
                                    <span className="text-[11px] font-bold text-slate-800">${tableData.reduce((acc, r: any) => acc + r.regPay, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
                                <DollarSign size={12} className="text-orange-600" />
                                <div className="flex flex-col leading-none">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">OT $</span>
                                    <span className="text-[11px] font-bold text-slate-800">${tableData.reduce((acc, r: any) => acc + r.otPay, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
                                <DollarSign size={12} className="text-red-600" />
                                <div className="flex flex-col leading-none">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">DT $</span>
                                    <span className="text-[11px] font-bold text-slate-800">${tableData.reduce((acc, r: any) => acc + r.dtPay, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
                                <DollarSign size={12} className="text-emerald-700" />
                                <div className="flex flex-col leading-none">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Total $</span>
                                    <span className="text-[11px] font-bold text-slate-800">${tableData.reduce((acc, r: any) => acc + r.grossPay, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
                                <User size={12} className="text-indigo-500" />
                                <div className="flex flex-col leading-none">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Staff</span>
                                    <span className="text-[11px] font-bold text-slate-800">{new Set(tableData.map((r: any) => r.employee)).size}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
                                <Briefcase size={12} className="text-violet-500" />
                                <div className="flex flex-col leading-none">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Estimates</span>
                                    <span className="text-[11px] font-bold text-slate-800">{new Set(tableData.map((r: any) => r.estimateRef)).size}</span>
                                </div>
                            </div>
                        </div>

                        {/* Search Filter - Right Aligned */}
                        <div className="relative w-48 mx-3">
                            <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Search records..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-7 pr-3 py-1.5 bg-white border border-slate-100 rounded-xl text-[10px] font-semibold text-slate-800 focus:outline-none focus:border-[#0F4C75] shadow-sm w-full transition-all"
                            />
                        </div>

                        {expandedEmp && (
                            <button 
                                onClick={() => setExpandedEmp(null)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-xl text-[10px] font-bold hover:bg-slate-700 transition-all shadow-lg shrink-0"
                            >
                                <ChevronLeft size={12} />
                                Back to All
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 flex gap-3 min-h-0">
                    
                    {/* Left Sidebar - Grouping */}
                    <aside className="w-[320px] bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden shrink-0">
                        <div className="p-3 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                            <h3 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Classes</h3>
                            {isRefreshing && (
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                    <span className="text-[8px] font-bold text-blue-500">Updating...</span>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-1.5">
                            {isRefreshing && !groups.length ? (
                                <SidebarSkeleton />
                            ) : (
                            <>
                            {/* All Categories Button */}
                            <button 
                                onClick={() => setSelectedItem('All')}
                                className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all group
                                    ${selectedItem === 'All' 
                                        ? 'bg-[#0F4C75] text-white shadow-lg shadow-blue-900/10' 
                                        : 'text-slate-600 hover:bg-slate-50'}
                                `}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${selectedItem === 'All' ? 'bg-white/20' : 'bg-slate-100'}`}>
                                        <List size={14} />
                                    </div>
                                    <span className="text-xs font-semibold">All Activities</span>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg ${selectedItem === 'All' ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                                    ${totals.gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            </button>

                            {/* Group List */}
                            {groups.map(group => (
                                <button 
                                    key={group.id}
                                    onClick={() => setSelectedItem(group.id)}
                                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all group
                                        ${selectedItem === group.id 
                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/10' 
                                            : 'text-slate-600 hover:bg-slate-50'}
                                    `}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${selectedItem === group.id ? 'bg-white/20' : 'bg-slate-100'}`}>
                                            {activityIcons[group.label.toLowerCase()] ? (
                                                <img 
                                                    src={activityIcons[group.label.toLowerCase()]} 
                                                    alt="" 
                                                    className="w-4 h-4 object-contain"
                                                />
                                            ) : (
                                                <Briefcase size={14} />
                                            )}
                                        </div>
                                        <span className="text-xs font-semibold text-left leading-tight">{group.label}</span>
                                    </div>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg ${selectedItem === group.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                                        ${group.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                </button>
                            ))}
                            </>
                            )}
                        </div>
                    </aside>

                    <div className="flex-1 flex flex-col min-w-0">
                        

                        <Card className="flex-1 min-h-0 overflow-hidden flex flex-col border-none shadow-sm rounded-2xl">
                            <Table containerClassName="h-full border-none shadow-none bg-transparent min-h-0">
                                <TableHead className="sticky top-0 z-10 bg-white/80 backdrop-blur-md">
                                    <TableRow className="border-b border-slate-50 hover:bg-transparent">
                                        {!expandedEmp ? (
                                            <>
                                                <TableHeader className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] w-12 text-center">#</TableHeader>
                                                <TableHeader className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Employee</TableHeader>
                                                <TableHeader className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-left w-24">Records</TableHeader>
                                                <TableHeader className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-left w-28">Reg Amt</TableHeader>
                                                <TableHeader className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-left w-28">OT Amt</TableHeader>
                                                <TableHeader className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-left w-28">DT Amt</TableHeader>
                                                <TableHeader className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-left w-32">Total Amount</TableHeader>
                                            </>
                                        ) : (
                                            <>
                                                <TableHeader className="px-2 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-center w-8">Tag</TableHeader>
                                                <TableHeader className="px-3 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-left w-28">Employee</TableHeader>
                                                <TableHeader className="px-2 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-center w-20">Date</TableHeader>
                                                <TableHeader className="px-3 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-left w-28">Estimate</TableHeader>
                                                <TableHeader className="px-3 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-left max-w-[150px]">Title</TableHeader>
                                                <TableHeader className="px-3 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-left w-16">Reg $</TableHeader>
                                                <TableHeader className="px-3 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-left w-16">OT $</TableHeader>
                                                <TableHeader className="px-3 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-left w-16">DT $</TableHeader>
                                                <TableHeader className="px-3 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-left w-20">Total $</TableHeader>
                                            </>
                                        )}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {!expandedEmp ? (
                                        <>
                                            {/* Summary "All" Row */}
                                            {employeeSummary.length > 0 && (
                                                <TableRow 
                                                    className="bg-slate-50/50 font-bold border-b border-slate-100 hover:bg-slate-100/50 transition-colors cursor-pointer group"
                                                    onClick={() => setExpandedEmp('_all_')}
                                                >
                                                    <TableCell className="px-4 py-3 text-center text-[10px] text-slate-400">#</TableCell>
                                                    <TableCell className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[11px] text-slate-900 uppercase tracking-wider">All Staff Combined</span>
                                                            <ChevronRight size={12} className="text-slate-300 group-hover:text-[#0F4C75] transition-transform group-hover:translate-x-0.5" />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-left">
                                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full tabular-nums">
                                                            {employeeSummary.reduce((a,b)=>a+b.count,0)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-left text-[11px] text-emerald-600 tabular-nums">
                                                        ${employeeSummary.reduce((a,b)=>a+b.regPay,0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-left text-[11px] text-orange-600 tabular-nums">
                                                        ${employeeSummary.reduce((a,b)=>a+b.otPay,0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-left text-[11px] text-red-600 tabular-nums">
                                                        ${employeeSummary.reduce((a,b)=>a+b.dtPay,0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-left text-[12px] text-slate-900 tabular-nums">
                                                        ${employeeSummary.reduce((a,b)=>a+b.gross,0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </TableCell>
                                                </TableRow>
                                            )}

                                            {employeeSummary.map((emp: any, idx) => (
                                                <TableRow
                                                    key={emp.employee}
                                                    className="group hover:bg-slate-50 transition-colors border-b border-slate-50/50 last:border-0 cursor-pointer"
                                                    onClick={() => setExpandedEmp(emp.employee)}
                                                >
                                                    <TableCell className="px-4 py-3 text-center text-[10px] text-slate-300 font-bold">{idx + 1}</TableCell>
                                                    <TableCell className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 border border-white shadow-sm overflow-hidden">
                                                                {employeesMap[emp.employee]?.image ? (
                                                                    <img src={employeesMap[emp.employee].image} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    (employeesMap[emp.employee]?.label || emp.employee).split(' ').map((n:any)=>n[0]).join('').substring(0,2).toUpperCase()
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-[11px] font-medium text-slate-800">{employeesMap[emp.employee]?.label || emp.employee}</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-left">
                                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full tabular-nums">
                                                            {emp.count}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-left text-[11px] font-medium text-slate-600 tabular-nums">${emp.regPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                                    <TableCell className="px-4 py-3 text-left text-[11px] font-medium text-slate-600 tabular-nums">{emp.otPay > 0 ? `$${emp.otPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}</TableCell>
                                                    <TableCell className="px-4 py-3 text-left text-[11px] font-medium text-slate-600 tabular-nums">{emp.dtPay > 0 ? `$${emp.dtPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}</TableCell>
                                                    <TableCell className="px-4 py-3 text-left">
                                                        <div className="flex items-center justify-start gap-2">
                                                            <span className="text-[12px] font-black text-[#0F4C75] tabular-nums">
                                                                ${emp.gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                            </span>
                                                            <ChevronRight size={12} className="text-slate-300 group-hover:text-[#0F4C75] transition-colors" />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {employeeSummary.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="py-20 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                                                                <Search size={20} className="text-slate-200" />
                                                            </div>
                                                            <p className="text-[11px] font-bold text-slate-400">No staff found for this period</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {displayData.length > 0 ? displayData.slice(0, visibleRows).map((record: any, idx) => (
                                                <TableRow key={`${record._id}-${idx}`} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50/50 last:border-0 text-[11px]">
                                                    <TableCell className="px-2 py-2 text-center">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className="w-6 h-6 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center p-0.5 mx-auto">
                                                                    {activityIcons[record.item.toLowerCase()] ? (
                                                                        <img
                                                                            src={activityIcons[record.item.toLowerCase()]}
                                                                            alt=""
                                                                            className="w-full h-full object-contain"
                                                                        />
                                                                    ) : (
                                                                        <Briefcase size={10} className="text-slate-400" />
                                                                    )}
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="right">
                                                                <p className="text-[10px] font-bold">{record.item}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500 border border-white shadow-sm overflow-hidden">
                                                                {employeesMap[record.employee]?.image ? (
                                                                    <img src={employeesMap[record.employee].image} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    (employeesMap[record.employee]?.label || record.employee).split(' ').map((n:any)=>n[0]).join('').substring(0,2).toUpperCase()
                                                                )}
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-medium text-slate-800 leading-tight truncate w-24" title={employeesMap[record.employee]?.label || record.employee}>
                                                                    {employeesMap[record.employee]?.label || record.employee}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="px-2 py-2 text-center">
                                                        <Badge className="bg-white border-slate-100 text-slate-500 text-[8px] font-medium px-1 py-0 shadow-none">
                                                            {record.dateLabel}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2">
                                                        <p className="text-[10px] font-bold text-slate-400 tracking-tighter uppercase whitespace-nowrap">
                                                            {record.estimateRef}
                                                        </p>
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2 max-w-[150px]">
                                                        <p className="text-[10px] font-medium text-slate-700 leading-snug truncate" title={record.title}>
                                                            {record.title}
                                                        </p>
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2 text-left">
                                                        <span className="text-[10px] font-medium text-emerald-600 tracking-tight tabular-nums">
                                                            ${record.regPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2 text-left">
                                                        <span className="text-[10px] font-medium text-orange-600 tracking-tight tabular-nums">
                                                            {record.otPay > 0 ? `$${record.otPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2 text-left">
                                                        <span className="text-[10px] font-medium text-red-600 tracking-tight tabular-nums">
                                                            {record.dtPay > 0 ? `$${record.dtPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2 text-left">
                                                        <span className="text-[10px] font-bold text-slate-800 tracking-tight tabular-nums">
                                                            ${record.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={9} className="py-20 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                                                                <FileText size={20} className="text-slate-200" />
                                                            </div>
                                                            <p className="text-[11px] font-bold text-slate-400">No records found for this selection</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}

                                            {/* Load More Button or Infinite Scroll Trigger */}
                                            {displayData.length > visibleRows && (
                                                <TableRow className="hover:bg-transparent">
                                                    <TableCell colSpan={9} className="py-6 text-center">
                                                        <button 
                                                            onClick={() => setVisibleRows(prev => prev + 50)}
                                                            className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm active:scale-95"
                                                        >
                                                            Load More Records ({displayData.length - visibleRows} remaining)
                                                        </button>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    )}
                                </TableBody>
                            </Table>
                        </Card>

                    </div>
                </div>
            </main>
        </div>
    );
}
