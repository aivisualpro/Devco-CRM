'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { 
    Printer, Download,
    Users, Calendar as CalendarIcon, MapPin,
    FileText, Briefcase, Info, ChevronDown, Search,
    Clock, Truck, BadgeDollarSign
} from 'lucide-react';
import { 
    Header, Loading, Modal, Tooltip, TooltipTrigger, TooltipContent,
    SearchableSelect
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { 
    calculateTimesheetData, 
    formatDateOnly, 
    formatTimeOnly, 
    robustNormalizeISO,
    SPEED_MPH,
    EARTH_RADIUS_MI,
    DRIVING_FACTOR 
} from '@/lib/timeCardUtils';


// --- Custom Date Helpers ---

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

const formatDate = (date: Date, pattern: string) => {
    if (pattern === 'MMM d') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    }
    if (pattern === 'MMM d, yyyy') {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    }
    if (pattern === 'EEEE') {
        return date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    }
    if (pattern === 'MM-dd-yy') {
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        const y = String(date.getUTCFullYear()).slice(-2);
        return `${m}/${d}/${y}`;
    }
    return date.toLocaleDateString('en-US', { timeZone: 'UTC' });
};

const getWeekNumber = (d: Date) => {
    // Ensure we use UTC components for week calculation
    const utcDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - (utcDate.getUTCDay() || 7));
    // Get first day of year
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
};

// (Constants and calculateTimesheetData imported from @/lib/timeCardUtils)
const FORMULA_CUTOFF_DATE = new Date('2026-01-12T00:00:00.000Z');

const normalizeEst = (val: any) => {
    const s = String(val || '').toLowerCase().trim();
    if (s.startsWith('job #')) return s.replace('job #', '').trim();
    return s;
};

const parseRate = (val: any) => {
    if (typeof val === 'number') return val;
    if (!val || val === '') return null;
    const cleaned = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
};

const generateWeeks = (year: number) => {
    const weeks = [];
    // Start from current or end of year
    let d = startOfWeek(new Date());
    if (d.getUTCFullYear() > year) {
        d = startOfWeek(new Date(Date.UTC(year, 11, 31)));
    }
    
    for (let i = 0; i < 20; i++) {
        const start = d;
        const end = endOfWeek(d);
        weeks.push({
            start,
            end,
            weekNum: getWeekNumber(start),
            label: `(${getWeekNumber(start)}) ${formatDate(start, 'MM-dd-yy')} to ${formatDate(end, 'MM-dd-yy')}`
        });
        d = subWeeks(d, 1);
    }
    return weeks;
};

// --- Types ---

interface DayReport {
    date: Date;
    estimates: string[];
    projectNames: string[];
    certified: boolean;
    reg: number;
    ot: number;
    dt: number;
    travel: number;
    diem: number;
    total: number;
    entries: any[]; // Store raw timesheet objects for detail view
}

interface EmployeeReport {
    employee: string;
    name: string;
    address: string;
    phone: string;
    position: string;
    classification: string;
    days: DayReport[];
    totalReg: number;
    totalOt: number;
    totalDt: number;
    totalTravel: number;
    totalRegAmount: number;
    totalOtAmount: number;
    totalDtAmount: number;
    totalTravelAmount: number;
    totalDiem: number;
    totalHrs: number;
    rateSite: number;
    rateTravel: number;
    totalAmount: number;
    rawEntries: {
        site: any[];
        drive: any[];
    };
}

function PayrollReportContent() {
    const { success: toastSuccess, error: toastError } = useToast();
    const [loading, setLoading] = useState(true);
    const [rawSchedules, setRawSchedules] = useState<any[]>([]);
    const [employeesMap, setEmployeesMap] = useState<Record<string, any>>({});
    const [estimatesMap, setEstimatesMap] = useState<Record<string, any>>({});
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    // Initialize to current week (client-side state only, no URL dependency for week)
    const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date()));

    const [filterEmployee, setFilterEmployee] = useState<string>(() => {
        return searchParams.get('employee') || 'all';
    });

    const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false);
    const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
    const [employeeSearch, setEmployeeSearch] = useState('');
    const [selectedDetail, setSelectedDetail] = useState<{ 
        employee: EmployeeReport, 
        type: 'Regular' | 'Overtime' | 'Double Time' | 'Travel' | 'Per Diem' | 'General' 
    } | null>(null);

    // Sync only employee filter with URL (removed week to avoid date parsing issues)
    useEffect(() => {
        const params = new URLSearchParams();
        params.set('employee', filterEmployee);
        const newUrl = `${pathname}?${params.toString()}`;
        if (window.location.search !== `?${params.toString()}`) {
            router.replace(newUrl);
        }
    }, [filterEmployee, pathname, router]);

    const [editingRecord, setEditingRecord] = useState<any | null>(null);
    const [editForm, setEditForm] = useState<any>({});

    const weekOptions = useMemo(() => generateWeeks(currentWeekStart.getFullYear()), [currentWeekStart]);
    
    const estimatesOptions = useMemo(() => {
        return Object.entries(estimatesMap).map(([id, e]: [string, any]) => ({
            value: id,
            label: `${e.value}${e.projectTitle ? ' - ' + e.projectTitle : ''}`,
            estimate: e.value
        }));
    }, [estimatesMap]);

    const editingCalculated = useMemo(() => {
        if (!editingRecord) return { hours: 0, distance: 0 };
        return calculateTimesheetData(editForm, editingRecord.clockIn);
    }, [editForm, editingRecord]);
    
    const employeeOptions = useMemo(() => {
        const emps = Object.values(employeesMap).map(e => ({
            label: e.label || e.value,
            value: e.value,
            image: e.image,
            initials: e.initials || (e.label ? e.label.split(' ').map((n:string)=>n[0]).join('').substring(0,2) : '??')
        }));
        return emps;
    }, [employeesMap]);

    const filteredEmployeeOptions = useMemo(() => {
        if (!employeeSearch) return employeeOptions;
        return employeeOptions.filter(e => 
            e.label.toLowerCase().includes(employeeSearch.toLowerCase())
        );
    }, [employeeOptions, employeeSearch]);

    const fetchData = async (weekStart: Date) => {
        setLoading(true);
        const weekEnd = endOfWeek(weekStart);
        
        // Extend date range by 1 week in each direction to capture timesheets
        // whose schedule fromDate might be in adjacent weeks but clockIn is in selected week
        const extendedStartDate = subWeeks(weekStart, 1);
        const extendedEndDate = addWeeks(weekEnd, 1);

        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'getSchedulesPage',
                    payload: {
                        startDate: extendedStartDate.toISOString(),
                        endDate: extendedEndDate.toISOString(),
                        limit: 10000 // Fetch all schedules for payroll report (no pagination)
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                setRawSchedules(data.result.schedules || []);
                const emps = data.result.initialData?.employees || [];
                const eMap: Record<string, any> = {};
                emps.forEach((e: any) => eMap[e.value] = e);
                setEmployeesMap(eMap);

                const estimates = data.result.initialData?.estimates || [];
                const estMap: Record<string, any> = {};
                estimates.forEach((e: any) => estMap[e.value] = e);
                setEstimatesMap(estMap);
            }
        } catch (err) {
            console.error(err);
            toastError("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    };

    // Timezone-agnostic: Parse ISO string directly using regex to avoid Date object timezone conversion
    const toLocalISO = (isoStr?: string) => {
        if (!isoStr) return '';
        // Parse ISO string directly using regex to extract components without timezone conversion
        const match = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (match) {
            const [, year, month, day, hour, minute] = match;
            return `${year}-${month}-${day}T${hour}:${minute}`;
        }
        // Fallback: just slice the first 16 characters (YYYY-MM-DDTHH:MM)
        return isoStr.slice(0, 16);
    };

    const handleEditClick = (ts: any) => {
        setEditingRecord(ts);
        setEditForm({ ...ts });
    };

    const handleSaveEdit = async () => {
        if (!editingRecord || !editForm.scheduleId) return;
        
        try {
            setLoading(true);
            // 1. Get Schedule
            const resGet = await fetch('/api/schedules', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'getScheduleById', payload: { id: editingRecord.scheduleId } })
            });
            const dataGet = await resGet.json();
            if (!dataGet.success) throw new Error("Schedule not found");
            
            const schedule = dataGet.result;
            
            // 2. Update the specific timesheet in the array
            const updatedTimesheets = (schedule.timesheet || []).map((t: any) => {
                if ((t._id || t.recordId) === (editingRecord._id || editingRecord.recordId)) {
                    const { calcHours, calcDistance, scheduleId, ...rest } = editForm;
                    return { ...t, ...rest };
                }
                return t;
            });
            
            // 3. Save
            const resSave = await fetch('/api/schedules', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    action: 'updateSchedule', 
                    payload: { id: editingRecord.scheduleId, timesheet: updatedTimesheets }
                })
            });
            
            const saveResult = await resSave.json();
            if (saveResult.success) {
                toastSuccess("Timesheet updated");
                setEditingRecord(null);
                setEditForm({});
                fetchData(currentWeekStart); 
            } else {
                throw new Error("Failed to save");
            }

        } catch (e) {
            console.error(e);
            toastError("Failed to update timesheet");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(currentWeekStart);
    }, [currentWeekStart]);

    const reportData = useMemo(() => {
        const weekEnd = endOfWeek(currentWeekStart);

        const employeesWork: Record<string, any> = {};

        rawSchedules.forEach(sched => {
            if (!sched.timesheet) return;
            // Get certified payroll from estimate (source of truth), fallback to schedule
            const estCertified = estimatesMap[sched.estimate]?.certifiedPayroll === 'Yes';
            
            sched.timesheet.forEach((ts: any) => {
                const clockInDate = new Date(robustNormalizeISO(ts.clockIn));
                if (clockInDate >= currentWeekStart && clockInDate <= weekEnd) {
                    const empEmail = ts.employee;
                    if (!employeesWork[empEmail]) {
                        employeesWork[empEmail] = {
                            email: empEmail,
                            days: Array.from({ length: 7 }, (_, i) => {
                                const d = new Date(currentWeekStart);
                                d.setDate(d.getDate() + i);
                                return {
                                    date: d,
                                    estimates: new Set<string>(),
                                    projectNames: new Set<string>(),
                                    certified: false,
                                    siteHrs: 0,
                                    driveHrs: 0,
                                    travelHrs: 0,
                                    diem: 0,
                                    dayRateSite: null as number | null,
                                    dayRateDrive: null as number | null,
                                    entries: []
                                };
                            })
                        };
                    }

                    const dayIdx = (clockInDate.getUTCDay() + 6) % 7; 
                    const { hours, distance } = calculateTimesheetData(ts, sched.fromDate);
                    
                    const enrichedTs = { ...ts, scheduleId: sched._id, calcHours: hours, calcDistance: distance, estimate: sched.estimate };
                    employeesWork[empEmail].days[dayIdx].entries.push(enrichedTs);
                    employeesWork[empEmail].days[dayIdx].estimates.add(sched.estimate);
                    
                    const pName = estimatesMap[sched.estimate]?.projectTitle || sched.title;
                    if (pName) employeesWork[empEmail].days[dayIdx].projectNames.add(pName);
                    if (estCertified) employeesWork[empEmail].days[dayIdx].certified = true;

                    if (ts.type?.toLowerCase().includes('site')) {
                        employeesWork[empEmail].days[dayIdx].siteHrs += hours;
                    } else if (ts.type?.toLowerCase().includes('drive')) {
                        employeesWork[empEmail].days[dayIdx].travelHrs += hours;
                    }

                    // Handle Per Diem if present
                    if (ts.perDiem) {
                        employeesWork[empEmail].days[dayIdx].diem = (employeesWork[empEmail].days[dayIdx].diem || 0) + (parseFloat(ts.perDiem) || 0);
                    }

                    // Capture daily rates from entries if present
                    const rateS = parseRate(ts.hourlyRateSITE);
                    const rateD = parseRate(ts.hourlyRateDrive);
                    if (rateS !== null) employeesWork[empEmail].days[dayIdx].dayRateSite = rateS;
                    if (rateD !== null) employeesWork[empEmail].days[dayIdx].dayRateDrive = rateD;
                }
            });
        });

        const filtered = Object.values(employeesWork).filter((ew: any) => {
            if (filterEmployee === 'all') return true;
            return ew.email === filterEmployee;
        });

        return filtered.map((ew: any) => {
            const empInfo = employeesMap[ew.email] || {};
            
            // Robust rate parsing


            // Use employee profile rate, but check for zero accurately
            const rateSite = parseRate(empInfo.hourlyRateSITE) ?? 45; 
            const rateTravel = parseRate(empInfo.hourlyRateDrive) ?? (rateSite * 0.75);

            let totalReg = 0, totalOt = 0, totalDt = 0, totalTravel = 0, totalDiem = 0;
            let totalRegAmount = 0, totalOtAmount = 0, totalDtAmount = 0, totalTravelAmount = 0;
            const rawSiteEntries: any[] = [];
            const rawDriveEntries: any[] = [];

            const days = ew.days.map((d: any) => {
                const reg = Math.min(8, d.siteHrs);
                const ot = Math.min(4, Math.max(0, d.siteHrs - 8));
                const dt = Math.max(0, d.siteHrs - 12);
                const travel = d.travelHrs;
                const total = reg + ot + dt + travel;

                totalReg += reg;
                totalOt += ot;
                totalDt += dt;
                totalTravel += travel;
                totalDiem += d.diem;
                
                const dayRateSite = d.dayRateSite ?? rateSite;
                const dayRateTravel = d.dayRateDrive ?? rateTravel;

                totalRegAmount += reg * dayRateSite;
                totalOtAmount += ot * dayRateSite * 1.5;
                totalDtAmount += dt * dayRateSite * 2.0;
                totalTravelAmount += travel * dayRateTravel;

                // Sort entries to ensure progressive tallying for Reg/OT attribution
                d.entries.sort((a: any, b: any) => new Date(robustNormalizeISO(a.clockIn)).getTime() - new Date(robustNormalizeISO(b.clockIn)).getTime());
                
                let dayTally = 0;
                d.entries.forEach((ent: any) => {
                    if (ent.type?.toLowerCase().includes('site')) {
                        const h = ent.calcHours;
                        const startTally = dayTally;
                        dayTally += h;

                        // Attribution
                        ent.attrReg = Math.max(0, Math.min(8, dayTally) - Math.min(8, startTally));
                        ent.attrOt = Math.max(0, Math.min(12, dayTally) - Math.min(12, Math.max(8, startTally)));
                        ent.attrDt = Math.max(0, dayTally - Math.max(12, startTally));

                        rawSiteEntries.push({ ...ent, hourlyRateSITE: ent.hourlyRateSITE || dayRateSite });
                    }
                    else if (ent.type?.toLowerCase().includes('drive')) {
                        rawDriveEntries.push({ ...ent, hourlyRateDrive: ent.hourlyRateDrive || dayRateTravel });
                    }
                });

                return {
                    ...d,
                    estimates: Array.from(d.estimates as Set<string>),
                    projectNames: Array.from(d.projectNames as Set<string>),
                    reg,
                    ot,
                    dt,
                    travel,
                    total
                };
            });

            const totalAmount = totalRegAmount + totalOtAmount + totalDtAmount + totalTravelAmount + totalDiem;

            return {
                employee: ew.email,
                name: empInfo.label || ew.email,
                address: empInfo.address || 'N/A',
                phone: empInfo.phone || 'N/A',
                position: empInfo.companyPosition || 'Technician',
                classification: empInfo.classification || 'N/A',
                days,
                totalReg,
                totalOt,
                totalDt,
                totalTravel,
                totalRegAmount,
                totalOtAmount,
                totalDtAmount,
                totalTravelAmount,
                totalDiem,
                totalHrs: totalReg + totalOt + totalDt + totalTravel,
                rateSite,
                rateTravel,
                totalAmount,
                rawEntries: {
                    site: rawSiteEntries,
                    drive: rawDriveEntries
                }
            } as EmployeeReport;
        });
    }, [rawSchedules, currentWeekStart, employeesMap, estimatesMap, filterEmployee]);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(currentWeekStart.getTime());
        d.setUTCDate(d.getUTCDate() + i);
        return d;
    });

    const handleExportCSV = () => {
        if (!reportData || reportData.length === 0) {
            toastError("No data to export");
            return;
        }

        const weekHeaders = weekDays.map(d => `${formatDate(d, 'EEEE')} ${formatDate(d, 'MM/dd/yy')}`).join(',');
        // Removed Position column, Added Category column
        const headers = `Employee,Category,${weekHeaders},Total,Rate,Subtotal`;
        
        const rows: string[] = [];
        const safe = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;

        reportData.forEach(emp => {
            // Helper to create a row
            const createRow = (category: string, dayValues: any[], total: any, rate: any, subtotal: any) => {
                const dayCols = dayValues.map(v => safe(v)).join(',');
                return [
                    safe(emp.name),
                    safe(category),
                    dayCols,
                    safe(total),
                    safe(rate),
                    safe(subtotal)
                ].join(',');

            };

            // 1. Project Row (Combined Job ID & Project Name)
            const projValues = emp.days.map(d => {
                const est = d.estimates.length > 0 ? d.estimates.join(' | ') : '';
                const proj = d.projectNames.length > 0 ? d.projectNames.join(' | ') : '';
                if (est && proj) return `${est} (${proj})`;
                return est || proj || '';
            });
            rows.push(createRow('Project', projValues, '', '', ''));

            // 2. Certified Row
            const certValues = emp.days.map(d => d.certified ? 'YES' : 'NO');
            rows.push(createRow('Certified', certValues, '', '', ''));

            // 3. Regular Row
            const regValues = emp.days.map(d => d.reg > 0 ? d.reg.toFixed(2) : '');
            rows.push(createRow(
                'Regular', 
                regValues, 
                emp.totalReg.toFixed(2), 
                emp.totalReg > 0 ? `$${(emp.totalRegAmount / emp.totalReg).toFixed(2)}` : `$${emp.rateSite.toFixed(2)}`, 
                `$${emp.totalRegAmount.toFixed(2)}`
            ));

            // 4. Overtime Row
            const otValues = emp.days.map(d => d.ot > 0 ? d.ot.toFixed(2) : '');
            rows.push(createRow(
                'Overtime', 
                otValues, 
                emp.totalOt.toFixed(2), 
                emp.totalOt > 0 ? `$${(emp.totalOtAmount / emp.totalOt).toFixed(2)}` : `$${(emp.rateSite * 1.5).toFixed(2)}`, 
                `$${emp.totalOtAmount.toFixed(2)}`
            ));

            // 5. Double Time Row
            const dtValues = emp.days.map(d => d.dt > 0 ? d.dt.toFixed(2) : '');
            rows.push(createRow(
                'Double Time', 
                dtValues, 
                emp.totalDt.toFixed(2), 
                emp.totalDt > 0 ? `$${(emp.totalDtAmount / emp.totalDt).toFixed(2)}` : `$${(emp.rateSite * 2.0).toFixed(2)}`, 
                `$${emp.totalDtAmount.toFixed(2)}`
            ));

            // 6. Travel Row
            const travelValues = emp.days.map(d => d.travel > 0 ? d.travel.toFixed(2) : '');
            rows.push(createRow(
                'Travel', 
                travelValues, 
                emp.totalTravel.toFixed(2), 
                emp.totalTravel > 0 ? `$${(emp.totalTravelAmount / emp.totalTravel).toFixed(2)}` : `$${emp.rateTravel.toFixed(2)}`, 
                `$${emp.totalTravelAmount.toFixed(2)}`
            ));

            // 7. Per Diem Row
            const diemValues = emp.days.map(d => d.diem > 0 ? `$${d.diem.toFixed(2)}` : '');
            rows.push(createRow(
                'Per Diem', 
                diemValues, 
                `$${emp.totalDiem.toFixed(2)}`, 
                '', 
                `$${emp.totalDiem.toFixed(2)}`
            ));

            // 8. Total Net Row (Hours and Amounts)
            const totalValues = emp.days.map(d => d.total > 0 ? d.total.toFixed(2) : ''); // Daily Total Hours
            rows.push(createRow(
                'Total Net', 
                totalValues, 
                emp.totalHrs.toFixed(2), // Total Hours for week
                '', 
                `$${emp.totalAmount.toFixed(2)}` // Total Amount for week
            ));
        });

        const csvContent = [headers, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Payroll_Report_${formatDate(currentWeekStart, 'MM-dd-yy')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    return (
        <div className="flex flex-col h-full bg-[#F4F7FA]">
            {/* Minimal Header */}
            <div className="flex-none">
                <Header 
                    leftContent={null}
                    rightContent={
                        <div className="flex items-center gap-4">
                            {/* Week Selection - Neumorphic Dropdown */}
                            <div className="relative">
                                <button 
                                    onClick={() => {
                                        setIsWeekDropdownOpen(!isWeekDropdownOpen);
                                        setIsEmployeeDropdownOpen(false);
                                    }}
                                    className={`p-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center ${isWeekDropdownOpen ? 'neu-pressed text-[#0F4C75] bg-[#F4F7FA]' : 'neu-outset text-slate-500 bg-[#F4F7FA]'}`}
                                >
                                    <CalendarIcon size={18} />
                                    {isWeekDropdownOpen && <ChevronDown size={14} className="ml-1 opacity-50" />}
                                </button>

                                {isWeekDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[100]" onClick={() => setIsWeekDropdownOpen(false)} />
                                        <div className="absolute top-full right-0 mt-4 w-80 bg-[#F4F7FA] rounded-3xl p-2 z-[101] animate-in fade-in zoom-in-95 duration-100 neu-dropdown">
                                            <div className="max-h-[350px] overflow-y-auto custom-scrollbar p-2">
                                                {weekOptions.map((week, idx) => {
                                                    const isActive = week.start.getTime() === currentWeekStart.getTime();
                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                setCurrentWeekStart(week.start);
                                                                setIsWeekDropdownOpen(false);
                                                            }}
                                                            className={`w-full px-6 py-4 text-left text-sm font-bold transition-all rounded-2xl mb-1 ${isActive ? 'text-[#00CC00] neu-pressed bg-white/50' : 'text-slate-800 hover:neu-pressed'}`}
                                                        >
                                                            {week.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Employee Selection - Neumorphic Search Dropdown */}
                            <div className="relative">
                                <button 
                                    onClick={() => {
                                        setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen);
                                        setIsWeekDropdownOpen(false);
                                        setEmployeeSearch('');
                                    }}
                                    className={`p-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center relative ${isEmployeeDropdownOpen ? 'neu-pressed text-[#0F4C75] bg-[#F4F7FA]' : 'neu-outset text-slate-500 bg-[#F4F7FA]'}`}
                                >
                                    <Users size={18} />
                                    {isEmployeeDropdownOpen && <ChevronDown size={14} className="ml-1 opacity-50" />}
                                    {filterEmployee !== 'all' && !isEmployeeDropdownOpen && (
                                        <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#F4F7FA]" />
                                    )}
                                </button>

                                {isEmployeeDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-[100]" onClick={() => setIsEmployeeDropdownOpen(false)} />
                                        <div className="absolute top-full right-0 mt-4 w-80 bg-[#F4F7FA] rounded-3xl p-4 z-[101] animate-in fade-in zoom-in-95 duration-100 neu-dropdown">
                                            {/* Search Bar - Neumorphic Style */}
                                            <div className="relative mb-4">
                                                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                                    <Search size={16} className="text-slate-400" />
                                                </div>
                                                <input 
                                                    autoFocus
                                                    type="text"
                                                    placeholder="Search Employees..."
                                                    value={employeeSearch}
                                                    onChange={(e) => setEmployeeSearch(e.target.value)}
                                                    className="w-full bg-[#f0f3f8] border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none neu-pressed"
                                                />
                                            </div>

                                            <div className="max-h-[350px] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                                <button
                                                    onClick={() => {
                                                        setFilterEmployee('all');
                                                        setIsEmployeeDropdownOpen(false);
                                                    }}
                                                    className={`w-full px-4 py-3 text-left text-sm font-bold transition-all rounded-2xl flex items-center gap-3 ${filterEmployee === 'all' ? 'text-[#00CC00] neu-pressed bg-white/50' : 'text-slate-800 hover:neu-pressed'}`}
                                                >
                                                    <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-xs text-slate-500 font-bold">
                                                        ALL
                                                    </div>
                                                    All Employees
                                                </button>
                                                
                                                {filteredEmployeeOptions.map((emp, idx) => {
                                                    const isActive = emp.value === filterEmployee;
                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                setFilterEmployee(emp.value);
                                                                setIsEmployeeDropdownOpen(false);
                                                            }}
                                                            className={`w-full px-4 py-3 text-left text-sm font-bold transition-all rounded-2xl flex items-center gap-3 ${isActive ? 'text-[#00CC00] neu-pressed bg-white/50' : 'text-slate-800 hover:neu-pressed'}`}
                                                        >
                                                            {emp.image ? (
                                                                <img src={emp.image} alt={emp.label} className="w-10 h-10 rounded-full border-2 border-white object-cover" />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-xs text-[#0F4C75] font-black">
                                                                    {emp.initials}
                                                                </div>
                                                            )}
                                                            <span className="truncate">{emp.label}</span>
                                                        </button>
                                                    );
                                                })}
                                                
                                                {filteredEmployeeOptions.length === 0 && (
                                                    <div className="p-8 text-center text-xs font-bold text-slate-400">No results found</div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="h-8 w-px bg-slate-200/50 mx-1" />

                            {/* Action Icons - Neumorphic */}
                            {/* Action Icons - Neumorphic */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button onClick={handleExportCSV} className="p-3 bg-[#F4F7FA] rounded-2xl text-[#0F4C75] transition-all neu-outset hover:neu-pressed active:scale-95">
                                        <Download size={18} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Export CSV</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    }
                />
            </div>

            <main className="flex-1 overflow-y-auto w-full max-w-[2400px] mx-auto p-2 pb-28 bg-[#F4F7FA]">
                {loading ? (
                    <div className="h-[70vh] flex flex-col items-center justify-center gap-4">
                        <Loading />
                        <p className="text-slate-400 font-bold text-sm animate-pulse">Loading Payroll Data...</p>
                    </div>
                ) : (
                    <>
                {/* Payroll Content Container */}
                <div className="neu-outset rounded-[32px] overflow-hidden p-4 bg-[#F4F7FA]">
                    {reportData.length === 0 ? (
                        <div className="h-[50vh] flex flex-col items-center justify-center">
                            <FileText className="w-16 h-16 text-slate-300 mb-6" />
                            <h3 className="text-xl font-black text-slate-500">No Records Found</h3>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-[32px] bg-[#F4F7FA]">
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 z-50">
                                    <tr className="bg-[#F4F7FA]">
                                        <th className="sticky left-0 z-50 bg-[#F4F7FA] text-left px-4 py-4 min-w-[170px]">
                                            <span className="text-[9px] font-black text-[#0F4C75] uppercase tracking-[0.2em] opacity-60">Identity</span>
                                        </th>
                                        <th className="text-left px-4 py-4 min-w-[80px]">
                                            <span className="text-[9px] font-black text-[#0F4C75] uppercase tracking-[0.2em] opacity-60">Category</span>
                                        </th>
                                        {weekDays.map((date, idx) => (
                                            <th key={idx} className="px-2 py-4 text-center min-w-[80px]">
                                                <p className="text-[9px] font-black text-[#0F4C75] uppercase tracking-tighter leading-none">{formatDate(date, 'EEEE')}</p>
                                                <p className="text-[10px] font-black text-slate-700 mt-1">{formatDate(date, 'MM/dd/yy')}</p>
                                            </th>
                                        ))}
                                        <th className="px-4 py-4 text-center min-w-[85px]">
                                            <span className="text-[9px] font-black text-[#0F4C75] uppercase tracking-[0.2em] opacity-60">Total</span>
                                        </th>
                                        <th className="px-4 py-4 text-right min-w-[85px]">
                                            <span className="text-[9px] font-black text-[#0F4C75] uppercase tracking-[0.2em] opacity-60">Rate</span>
                                        </th>
                                        <th className="px-4 py-4 text-right min-w-[100px]">
                                            <span className="text-[9px] font-black text-[#0F4C75] uppercase tracking-[0.2em] opacity-60">Subtotal</span>
                                        </th>
                                    </tr>
                                </thead>
                                
                                {reportData.map((emp) => (
                                    <tbody key={emp.employee} className="border-t-[10px] border-transparent">
                                        {/* Compact Identity Row Block */}
                                        <tr className="hover:bg-white/30 transition-colors group cursor-pointer" onClick={() => setSelectedDetail({ employee: emp, type: 'General' })}>
                                            <td rowSpan={8} className="sticky left-0 z-40 bg-[#F4F7FA] px-2 py-4 align-top border-r border-slate-100/50">
                                                <div className="space-y-2 max-w-[155px]">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center shrink-0">
                                                            <span className="text-[10px] font-black text-[#0F4C75]">
                                                                {emp.name.split(' ').map((n:string)=>n[0]).join('').substring(0,2).toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <h3 className="text-xs font-black text-slate-900 leading-tight truncate" title={emp.name}>{emp.name}</h3>
                                                    </div>
                                                    
                                                    <div className="flex flex-col gap-1 pl-1">
                                                        <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase tracking-tight" title={emp.address}>
                                                            <MapPin size={10} className="text-[#0F4C75] opacity-50 shrink-0" />
                                                            <span className="truncate">{emp.address}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase tracking-tight">
                                                            <Info size={10} className="text-[#0F4C75] opacity-50 shrink-0" />
                                                            <span>***-**-6020</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase tracking-tight truncate">
                                                            <Briefcase size={10} className="text-[#0F4C75] opacity-50 shrink-0" />
                                                            <span className="truncate">{emp.classification}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            
                                            <td className="px-4 py-2 font-black text-[9px] uppercase tracking-wider text-[#0F4C75]/60 border-b border-white/40">Project</td>
                                            {emp.days.map((d, i) => (
                                                <td key={i} className="px-2 py-2 text-center border-b border-white/40">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[9px] font-black text-[#0F4C75] leading-tight">
                                                            {d.estimates.length > 0 ? d.estimates.join(', ') : ''}
                                                        </span>
                                                        <span className="text-[8px] font-bold text-[#0F4C75]/70 italic leading-tight">
                                                            {d.projectNames.length > 0 ? d.projectNames.join(', ') : ''}
                                                        </span>
                                                    </div>
                                                </td>
                                            ))}
                                            <td colSpan={2} className="border-b border-white/40"></td>
                                            <td className="px-4 py-2 border-b border-white/40"></td>
                                        </tr>

                                        <tr>
                                            <td className="px-4 py-2 font-black text-[9px] uppercase tracking-wider text-[#0F4C75]/60 border-b border-white/40">Certified</td>
                                            {emp.days.map((d, i) => (
                                                <td key={i} className={`px-2 py-2 text-[9px] font-black text-center tracking-[0.2em] border-b border-white/40 ${d.certified ? 'text-[#00CC00]' : 'text-red-300'}`}>
                                                    {d.certified ? 'YES' : 'NO'}
                                                </td>
                                            ))}
                                            <td colSpan={2} className="border-b border-white/40"></td>
                                            <td className="border-b border-white/40 px-4 py-2"></td>
                                        </tr>

                                        <tr className="hover:bg-blue-50/50 transition-colors cursor-help" onClick={() => setSelectedDetail({ employee: emp, type: 'Regular' })}>
                                            <td className="px-4 py-2 font-black text-[9px] uppercase tracking-wider text-orange-500/80 border-b border-white/40">Regular</td>
                                            {emp.days.map((d, i) => (
                                                <td key={i} className="px-2 py-2 text-[11px] font-black text-slate-700 text-center border-b border-white/40">
                                                    {d.reg > 0 ? d.reg.toFixed(2) : '--'}
                                                </td>
                                            ))}
                                            <td className="px-4 py-2 text-center text-[11px] font-black text-slate-900 bg-white/40 border-b border-white/40">{emp.totalReg.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right text-[11px] font-bold text-slate-400 bg-white/40 border-b border-white/40">
                                                ${emp.totalReg > 0 ? (emp.totalRegAmount / emp.totalReg).toFixed(2) : emp.rateSite.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-2 text-right text-[12px] font-black text-slate-900 bg-white/40 border-b border-white/40">
                                                ${emp.totalRegAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>

                                        <tr className="hover:bg-blue-50/50 transition-colors cursor-help" onClick={() => setSelectedDetail({ employee: emp, type: 'Overtime' })}>
                                            <td className="px-4 py-2 font-black text-[9px] uppercase tracking-wider text-amber-500/80 border-b border-white/40">Overtime</td>
                                            {emp.days.map((d, i) => (
                                                <td key={i} className="px-2 py-2 text-[11px] font-black text-slate-400 text-center border-b border-white/40">
                                                    {d.ot > 0 ? d.ot.toFixed(2) : '--'}
                                                </td>
                                            ))}
                                            <td className="px-4 py-2 text-center text-[11px] font-black text-slate-700 border-b border-white/40">{emp.totalOt.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right text-[11px] font-bold text-slate-400 border-b border-white/40">
                                                ${emp.totalOt > 0 ? (emp.totalOtAmount / emp.totalOt).toFixed(2) : (emp.rateSite * 1.5).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-2 text-right text-[12px] font-black text-slate-800 border-b border-white/40">
                                                ${emp.totalOtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>

                                        <tr className="hover:bg-blue-50/50 transition-colors cursor-help" onClick={() => setSelectedDetail({ employee: emp, type: 'Double Time' })}>
                                            <td className="px-4 py-2 font-black text-[9px] uppercase tracking-wider text-teal-500/80 border-b border-white/40">Double Time</td>
                                            {emp.days.map((d, i) => (
                                                <td key={i} className="px-2 py-2 text-[11px] font-black text-slate-400 text-center border-b border-white/40">
                                                    {d.dt > 0 ? d.dt.toFixed(2) : '--'}
                                                </td>
                                            ))}
                                            <td className="px-4 py-2 text-center text-[11px] font-black text-slate-700 border-b border-white/40">{emp.totalDt.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right text-[11px] font-bold text-slate-400 border-b border-white/40">
                                                ${emp.totalDt > 0 ? (emp.totalDtAmount / emp.totalDt).toFixed(2) : (emp.rateSite * 2.0).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-2 text-right text-[12px] font-black text-slate-800 border-b border-white/40">
                                                ${emp.totalDtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>

                                        <tr className="hover:bg-blue-50/50 transition-colors cursor-help" onClick={() => setSelectedDetail({ employee: emp, type: 'Travel' })}>
                                            <td className="px-4 py-2 font-black text-[9px] uppercase tracking-wider text-blue-500/80 border-b border-white/40">Travel</td>
                                            {emp.days.map((d, i) => (
                                                <td key={i} className="px-2 py-2 text-[11px] font-black text-slate-400 text-center border-b border-white/40">
                                                    {d.travel > 0 ? d.travel.toFixed(2) : '--'}
                                                </td>
                                            ))}
                                            <td className="px-4 py-2 text-center text-[11px] font-black text-slate-700 border-b border-white/40">{emp.totalTravel.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right text-[11px] font-bold text-slate-400 border-b border-white/40">
                                                ${emp.totalTravel > 0 ? (emp.totalTravelAmount / emp.totalTravel).toFixed(2) : emp.rateTravel.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-2 text-right text-[12px] font-black text-slate-800 border-b border-white/40">
                                                ${emp.totalTravelAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>

                                        <tr className="hover:bg-blue-50/50 transition-colors cursor-help" onClick={() => setSelectedDetail({ employee: emp, type: 'Per Diem' })}>
                                            <td className="px-4 py-2 font-black text-[9px] uppercase tracking-wider text-slate-500/80 border-b border-white/40">Per Diem</td>
                                            {emp.days.map((d, i) => (
                                                <td key={i} className="px-2 py-2 text-[11px] font-black text-slate-400 text-center border-b border-white/40">
                                                    {d.diem > 0 ? d.diem.toFixed(2) : '--'}
                                                </td>
                                            ))}
                                            <td className="px-4 py-2 border-b border-white/40"></td>
                                            <td className="px-4 py-2 border-b border-white/40"></td>
                                            <td className="px-4 py-2 text-right text-[12px] font-black text-slate-800 border-b border-white/40">
                                                ${emp.totalDiem.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>

                                        <tr className="bg-[#F4F7FA]">
                                            <td className="px-4 py-4 font-black text-[11px] uppercase tracking-[0.2em] italic text-[#0F4C75] border-b-[20px] border-transparent">Total Net</td>
                                            {emp.days.map((d, i) => (
                                                <td key={i} className="px-2 py-4 text-[12px] font-black text-center text-slate-900 border-b-[20px] border-transparent">
                                                    {d.total > 0 ? d.total.toFixed(2) : '--'}
                                                </td>
                                            ))}
                                            <td className="px-4 py-4 text-center text-[13px] font-black text-slate-900 bg-white/20 border-b-[20px] border-transparent">{emp.totalHrs.toFixed(2)}</td>
                                            <td className="px-4 py-4 bg-white/20 border-b-[20px] border-transparent"></td>
                                            <td className="px-4 py-4 text-right text-xl font-black bg-white/40 text-[#00CC00] tracking-tighter italic border-b-[20px] border-transparent">
                                                ${emp.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    </tbody>
                                ))}
                            </table>
                        </div>
                    )}
                </div>
            </>
        )}
    </main>

            {/* Fixed Footer Summary */}
            {!loading && reportData.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-[#F4F7FA]/95 backdrop-blur-sm border-t border-slate-200/50">
                    <div className="max-w-[2400px] mx-auto px-4">
                        <div className="p-4 bg-white/80 neu-outset rounded-2xl flex flex-col md:flex-row items-center justify-start gap-8">
                            <div className="flex items-center gap-8">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-black text-[#0F4C75] uppercase tracking-[0.3em] opacity-50">Global Expense</span>
                                    <div className="text-3xl font-black text-slate-900 tracking-tighter">
                                        ${reportData.reduce((acc, curr) => acc + curr.totalAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="w-[1px] h-10 bg-slate-200 hidden md:block"></div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-black text-[#0F4C75] uppercase tracking-[0.3em] opacity-50">Operating Hours</span>
                                    <div className="text-3xl font-black text-[#0F4C75] tracking-tighter">
                                        {reportData.reduce((acc, curr) => acc + curr.totalHrs, 0).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            <Modal
                isOpen={!!selectedDetail}
                onClose={() => setSelectedDetail(null)}
                title={`Payroll Audit Trail: ${selectedDetail?.employee.name || ''}`}
                maxWidth="4xl"
            >
                {selectedDetail && (
                    <div className="p-4 space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-[#0F4C75] uppercase tracking-widest opacity-40">Detail Category</p>
                                <h2 className="text-2xl font-black text-slate-900 italic tracking-tighter">{selectedDetail.type} Logic</h2>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-[#0F4C75] uppercase tracking-widest opacity-40">Base Rate</p>
                                <p className="text-2xl font-black text-[#00CC00] tracking-tighter italic">
                                    ${(
                                        selectedDetail.type === 'Travel' ? selectedDetail.employee.rateTravel : 
                                        selectedDetail.type === 'Overtime' ? selectedDetail.employee.rateSite * 1.5 :
                                        selectedDetail.type === 'Double Time' ? selectedDetail.employee.rateSite * 2.0 :
                                        selectedDetail.employee.rateSite
                                    ).toFixed(2)}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {(selectedDetail.type === 'Regular' || selectedDetail.type === 'Overtime' || selectedDetail.type === 'Double Time' || selectedDetail.type === 'General') && (
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-[#0F4C75] uppercase tracking-widest flex items-center gap-2">
                                        <Clock size={14} /> Site Entries (Weekly)
                                    </h4>
                                    <div className="overflow-hidden rounded-3xl neu-pressed bg-white/30">
                                        <table className="w-full text-left">
                                            <thead className="bg-[#F4F7FA]/50 border-b border-white/40">
                                                <tr>
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400">Date</th>
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400">Estimate</th>
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400">Clock In/Out</th>
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 text-center">Lunch</th>
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 text-right">Computed Hrs</th>
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 text-right">
                                                        {selectedDetail.type === 'Overtime' ? 'OT Hrs' : selectedDetail.type === 'Double Time' ? 'DT Hrs' : 'Reg Hrs'}
                                                    </th>
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 text-right">Rate</th>
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 text-right">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/20">
                                                {selectedDetail.employee.rawEntries.site.map((ent, i) => (
                                                    <tr key={i} 
                                                        onClick={() => handleEditClick(ent)}
                                                        className="text-[11px] font-bold text-slate-700 hover:bg-white/50 cursor-pointer transition-colors"
                                                    >
                                                        <td className="px-4 py-3">{new Date(ent.clockIn).toLocaleDateString('en-US', { timeZone: 'UTC' })}</td>
                                                        <td className="px-4 py-3 font-black text-[#0F4C75]">{ent.estimate}</td>
                                                        <td className="px-4 py-3 opacity-60">
                                                            {new Date(ent.clockIn).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', timeZone: 'UTC'})} - {ent.clockOut ? new Date(ent.clockOut).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit', timeZone: 'UTC'}) : '--'}
                                                        </td>
                                                        <td className="px-4 py-3 text-center opacity-40">
                                                            {ent.lunchStart ? '30m' : '--'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-slate-400">{ent.calcHours.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-right font-black text-[#0F4C75]">
                                                            {(selectedDetail.type === 'Overtime' ? ent.attrOt : selectedDetail.type === 'Double Time' ? ent.attrDt : ent.attrReg).toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-medium text-slate-400 italic">
                                                            ${(
                                                                (parseRate(ent.hourlyRateSITE) || 0) * 
                                                                (selectedDetail.type === 'Overtime' ? 1.5 : selectedDetail.type === 'Double Time' ? 2.0 : 1.0)
                                                            ).toFixed(2)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-black text-slate-900">
                                                            ${(
                                                                (selectedDetail.type === 'Overtime' ? ent.attrOt : selectedDetail.type === 'Double Time' ? ent.attrDt : ent.attrReg) * 
                                                                (parseRate(ent.hourlyRateSITE) || 0) * 
                                                                (selectedDetail.type === 'Overtime' ? 1.5 : selectedDetail.type === 'Double Time' ? 2.0 : 1.0)
                                                            ).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {selectedDetail.employee.rawEntries.site.length === 0 && (
                                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-300 font-black italic">No Site Entries Found</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {(selectedDetail.type === 'Travel' || selectedDetail.type === 'General') && (
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-[#0F4C75] uppercase tracking-widest flex items-center gap-2">
                                        <Truck size={14} /> Travel & Drive Entries (Weekly)
                                    </h4>
                                    <div className="overflow-hidden rounded-3xl neu-pressed bg-white/30">
                                        <table className="w-full text-left">
                                            <thead className="bg-[#F4F7FA]/50 border-b border-white/40">
                                                <tr>
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400">Date</th>
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400">Type</th>
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400">Method</th>
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 text-right">Miles</th>
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 text-right">Rate</th>
                                                    <th className="px-4 py-3 text-[9px] font-black uppercase text-slate-400 text-right">Computed Hrs</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/20">
                                                {selectedDetail.employee.rawEntries.drive.map((ent, i) => (
                                                    <tr key={i} 
                                                        onClick={() => handleEditClick(ent)}
                                                        className="text-[11px] font-bold text-slate-700 hover:bg-white/50 cursor-pointer transition-colors"
                                                    >
                                                        <td className="px-4 py-3">{new Date(ent.clockIn).toLocaleDateString('en-US', { timeZone: 'UTC' })}</td>
                                                        <td className="px-4 py-3 opacity-60">{ent.type}</td>
                                                        <td className="px-4 py-3 font-medium">
                                                            {ent.locationIn?.includes(',') ? 'GPS Haversine' : (ent.locationIn ? 'Odometer' : 'Manual/Time')}
                                                        </td>
                                                        <td className="px-4 py-3 text-right opacity-60">{ent.calcDistance.toFixed(1)}mi</td>
                                                        <td className="px-4 py-3 text-right font-medium text-slate-400 italic">${parseRate(ent.hourlyRateDrive)?.toFixed(2) || '--'}</td>
                                                        <td className="px-4 py-3 text-right font-black text-slate-900">{ent.calcHours.toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                                {selectedDetail.employee.rawEntries.drive.length === 0 && (
                                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-300 font-black italic">No Travel Entries Found</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {selectedDetail.type === 'Per Diem' && (
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-[#0F4C75] uppercase tracking-widest flex items-center gap-2">
                                        <BadgeDollarSign size={14} /> Per Diem Breakdown
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {selectedDetail.employee.days.map((d, i) => (
                                            <div key={i} className="p-4 rounded-2xl neu-outset bg-white/50 text-center">
                                                <p className="text-[8px] font-black uppercase text-slate-400 mb-1">{formatDate(d.date, 'EEEE')}</p>
                                                <p className="text-lg font-black text-slate-900">${d.diem.toFixed(2)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-6 border-t border-white/20">
                            <div className="p-4 rounded-[32px] bg-[#0F4C75] text-white flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/10 rounded-2xl">
                                        <Info size={24} className="text-blue-300" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                            {selectedDetail.type === 'Regular' ? 'Regular Total' : 
                                             selectedDetail.type === 'Overtime' ? 'Overtime Total' :
                                             selectedDetail.type === 'Double Time' ? 'Double Time Total' :
                                             selectedDetail.type === 'Travel' ? 'Travel Total' : 'Breakdown Total'}
                                        </p>
                                        <p className="text-xl font-black text-white italic">
                                            ${(
                                                selectedDetail.type === 'Regular' ? selectedDetail.employee.totalRegAmount :
                                                selectedDetail.type === 'Overtime' ? selectedDetail.employee.totalOtAmount :
                                                selectedDetail.type === 'Double Time' ? selectedDetail.employee.totalDtAmount :
                                                selectedDetail.type === 'Travel' ? selectedDetail.employee.totalTravelAmount :
                                                selectedDetail.type === 'Per Diem' ? selectedDetail.employee.totalDiem : 0
                                            ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Net for Week</p>
                                    <p className="text-3xl font-black italic tracking-tighter">
                                        ${selectedDetail.employee.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Edit Timecard Modal */}
            <Modal
                isOpen={!!editingRecord}
                onClose={() => setEditingRecord(null)}
                title="Edit Timecard Record"
                maxWidth="2xl"
                noBlur={true}
                footer={
                    <>
                        <button 
                            onClick={() => setEditingRecord(null)}
                            className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-bold text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveEdit}
                            className="px-6 py-2 rounded-xl bg-[#0F4C75] text-white font-bold text-sm shadow-lg hover:shadow-xl hover:bg-[#0b3c5d] transition-all"
                        >
                            Save Changes
                        </button>
                    </>
                }
            >
                {editingRecord && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-2">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Select Employee</label>
                            <SearchableSelect 
                                options={employeeOptions}
                                value={editForm.employee || ''}
                                onChange={(val) => setEditForm((prev:any) => ({...prev, employee: val}))}
                                placeholder="Search & Select Employee"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Estimate #</label>
                            <SearchableSelect 
                                options={estimatesOptions}
                                value={editForm.estimate || ''}
                                onChange={(val) => {
                                    setEditForm((prev:any) => ({
                                        ...prev, 
                                        estimate: val,
                                        scheduleId: '' 
                                    }));
                                }}
                                placeholder="Select Estimate"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Schedule Date</label>
                            <SearchableSelect 
                                options={(() => {
                                    if (!editForm.estimate) return [];
                                    const estNorm = normalizeEst(editForm.estimate);
                                    return rawSchedules
                                        .filter(s => normalizeEst(s.estimate) === estNorm && s.item !== 'Day Off')
                                        .sort((a, b) => new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime())
                                        .map(s => ({
                                            value: s._id,
                                            label: `${new Date(s.fromDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}`,
                                            estimate: s.estimate
                                        }));
                                })()}
                                value={editForm.scheduleId || ''}
                                onChange={(val) => setEditForm((prev:any) => ({...prev, scheduleId: val}))}
                                placeholder={editForm.estimate ? "Select Schedule Date" : "Select Estimate First"}
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Entry Type</label>
                            <div className="flex gap-3">
                                {['Drive Time', 'Site Time'].map(t => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setEditForm((prev:any) => ({...prev, type: t}))}
                                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 ${
                                            editForm.type?.trim().toLowerCase() === t.trim().toLowerCase()
                                            ? 'bg-[#0F4C75] border-[#0F4C75] text-white shadow-lg' 
                                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {editForm.type?.trim().toLowerCase() !== 'drive time' && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Clock In</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                                        value={toLocalISO(editForm.clockIn)}
                                        onChange={e => {
                                            // Store the value directly with Z suffix to preserve exact time (timezone-agnostic)
                                            const val = e.target.value;
                                            if (val) {
                                                setEditForm((prev:any) => ({...prev, clockIn: val + ':00.000Z'}));
                                            }
                                        }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Lunch Start</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                                        value={toLocalISO(editForm.lunchStart)}
                                        onChange={e => {
                                            // Store the value directly with Z suffix to preserve exact time (timezone-agnostic)
                                            const val = e.target.value;
                                            if (val) {
                                                setEditForm((prev:any) => ({...prev, lunchStart: val + ':00.000Z'}));
                                            }
                                        }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Lunch End</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                                        value={toLocalISO(editForm.lunchEnd)}
                                        onChange={e => {
                                            // Store the value directly with Z suffix to preserve exact time (timezone-agnostic)
                                            const val = e.target.value;
                                            if (val) {
                                                setEditForm((prev:any) => ({...prev, lunchEnd: val + ':00.000Z'}));
                                            }
                                        }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Clock Out</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                                        value={toLocalISO(editForm.clockOut)}
                                        onChange={e => {
                                            // Store the value directly with Z suffix to preserve exact time (timezone-agnostic)
                                            const val = e.target.value;
                                            if (val) {
                                                setEditForm((prev:any) => ({...prev, clockOut: val + ':00.000Z'}));
                                            }
                                        }}
                                    />
                                </div>
                            </>
                        )}

                        {editForm.type?.trim().toLowerCase() === 'drive time' && (
                            <>
                                <div className="col-span-2 grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Distance (Mi)</label>
                                        <input 
                                            type="number"
                                            placeholder="Manual"
                                            className="w-full px-4 py-3 rounded-xl bg-blue-50/50 border border-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                                            value={editForm.manualDistance || ''}
                                            onChange={e => setEditForm((prev:any) => ({...prev, manualDistance: e.target.value}))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Location In</label>
                                        <input 
                                            type="text"
                                            placeholder="Start loc"
                                            disabled={!!editForm.manualDistance}
                                            className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700 ${
                                                editForm.manualDistance ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200'
                                            }`}
                                            value={editForm.locationIn || ''}
                                            onChange={e => setEditForm((prev:any) => ({...prev, locationIn: e.target.value}))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Location Out</label>
                                        <input 
                                            type="text"
                                            placeholder="End loc"
                                            disabled={!!editForm.manualDistance}
                                            className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700 ${
                                                editForm.manualDistance ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200'
                                            }`}
                                            value={editForm.locationOut || ''}
                                            onChange={e => setEditForm((prev:any) => ({...prev, locationOut: e.target.value}))}
                                        />
                                    </div>
                                </div>

                                <div className="col-span-2 grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-100">
                                        <label className="block text-[10px] font-black text-orange-400 uppercase mb-1 tracking-widest pl-1">Washout Qty</label>
                                        <input 
                                            type="number"
                                            className="w-full px-2 py-1.5 rounded-lg bg-white border border-orange-200 font-black text-slate-700 text-sm"
                                            placeholder="0"
                                            value={(() => {
                                                const match = String(editForm.dumpWashout || '').match(/\((\d+)\s+qty\)/);
                                                return match ? match[1] : (editForm.dumpWashout === true || String(editForm.dumpWashout).toLowerCase() === 'true' || String(editForm.dumpWashout).toLowerCase() === 'yes' ? "1" : "");
                                            })()}
                                            onChange={e => {
                                                const qty = parseFloat(e.target.value);
                                                if (isNaN(qty) || qty <= 0) {
                                                    setEditForm((prev:any) => ({...prev, dumpWashout: ""}));
                                                } else {
                                                    const val = `${(qty * 0.5).toFixed(2)} hrs (${qty} qty)`;
                                                    setEditForm((prev:any) => ({...prev, dumpWashout: val}));
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100">
                                        <label className="block text-[10px] font-black text-amber-400 uppercase mb-1 tracking-widest pl-1">Shop Qty</label>
                                        <input 
                                            type="number"
                                            className="w-full px-2 py-1.5 rounded-lg bg-white border border-amber-200 font-black text-slate-700 text-sm"
                                            placeholder="0"
                                            value={(() => {
                                                const match = String(editForm.shopTime || '').match(/\((\d+)\s+qty\)/);
                                                return match ? match[1] : (editForm.shopTime === true || String(editForm.shopTime).toLowerCase() === 'true' || String(editForm.shopTime).toLowerCase() === 'yes' ? "1" : "");
                                            })()}
                                            onChange={e => {
                                                const qty = parseFloat(e.target.value);
                                                if (isNaN(qty) || qty <= 0) {
                                                    setEditForm((prev:any) => ({...prev, shopTime: ""}));
                                                } else {
                                                    const val = `${(qty * 0.25).toFixed(2)} hrs (${qty} qty)`;
                                                    setEditForm((prev:any) => ({...prev, shopTime: val}));
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="col-span-2 flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl mt-4 relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-black text-white tabular-nums tracking-tighter">{editingCalculated.hours.toFixed(2)}</span>
                                    <span className="text-xl font-bold text-slate-600">HRS</span>
                                </div>
                            </div>
                            {editForm.type?.trim().toLowerCase() === 'drive time' && (
                                <div className="relative z-10 text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Distance</p>
                                    <div className="flex items-baseline gap-1 justify-end">
                                        <span className="text-3xl font-black text-blue-400 tabular-nums tracking-tighter">{editingCalculated.distance.toFixed(1)}</span>
                                        <span className="text-sm font-bold text-slate-600">MI</span>
                                    </div>
                                </div>
                            )}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#0F4C75]/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Comments</label>
                            <textarea 
                                rows={2}
                                placeholder="Add any notes here..."
                                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700 resize-none transition-all"
                                value={editForm.comments || ''}
                                onChange={e => setEditForm((prev:any) => ({...prev, comments: e.target.value}))}
                            />
                        </div>
                    </div>
                )}
            </Modal>

            <style jsx global>{`
                :root {
                    --bg: #F4F7FA;
                    --neu-light: rgba(255, 255, 255, 0.9);
                    --neu-dark: rgba(209, 217, 230, 0.6);
                }
                .neu-outset {
                    background: var(--bg);
                    box-shadow: 12px 12px 24px var(--neu-dark), -12px -12px 24px var(--neu-light);
                }
                .neu-pressed {
                    background: var(--bg);
                    box-shadow: inset 6px 6px 12px var(--neu-dark), inset -6px -6px 12px var(--neu-light);
                }
                .neu-dropdown {
                    background: var(--bg);
                    box-shadow: 20px 20px 40px var(--neu-dark), -10px -10px 30px var(--neu-light);
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: var(--neu-dark);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e0;
                }
                
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e0;
                }
            `}</style>
        </div>
    );
}

export default function PayrollReportPage() {
    return (
        <Suspense fallback={<Loading />}>
            <PayrollReportContent />
        </Suspense>
    );
}
