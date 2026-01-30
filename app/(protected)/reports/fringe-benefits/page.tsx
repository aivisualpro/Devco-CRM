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

// --- Local Utils ---
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
    regPay: number;
    otPay: number;
    dtPay: number;
    grossPay: number;
    subjectWages: number;
    compCost: number;
    scheduleId: string;
    item: string;
    fringe: string;
    dateLabel: string;
    title: string;
    estimateRef: string;
}

interface FringeGroup {
    id: string;
    label: string;
    totalAmount: number;
    totalHours: number;
    recordCount: number;
    color?: string;
    image?: string;
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
    let d = new Date(Date.UTC(year, 11, 31));
    const now = new Date();
    if (year === now.getUTCFullYear()) {
        d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    }
    let current = startOfWeek(d);
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
        if (weeks.length > 53) break;
    }
    return weeks;
};

export default function FringeBenefitsPage() {
    const { success: toastSuccess, error: toastError } = useToast();
    const [loading, setLoading] = useState(true);
    const [rawSchedules, setRawSchedules] = useState<any[]>([]);
    const [employeesMap, setEmployeesMap] = useState<Record<string, any>>({});
    const [estimatesMap, setEstimatesMap] = useState<Record<string, any>>({});
    const [fringeConstantsMap, setFringeConstantsMap] = useState<Record<string, any>>({});
    
    // Filters
    const [selectedYear, setSelectedYear] = useState(new Date().getUTCFullYear());
    const [selectedWeekLabel, setSelectedWeekLabel] = useState<string>('all');
    const [selectedFringe, setSelectedFringe] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
    const [visibleRows, setVisibleRows] = useState(50);
    
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false);

    // Derived Options
    const yearOptions = useMemo(() => {
        const current = new Date().getUTCFullYear();
        return [current, current - 1, current - 2].map(y => ({ value: y, label: String(y) }));
    }, []);

    const weekOptions = useMemo(() => {
        return generateWeeksForYear(selectedYear);
    }, [selectedYear]);

    // Data Fetching
    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'getSchedulesPage',
                    payload: { limit: 10000 } 
                }) 
            });
            const data = await res.json();
            
            if (data.success) {
                setRawSchedules(data.result.schedules || []);
                const emps = data.result.initialData?.employees || [];
                const eMap: Record<string, any> = {};
                emps.forEach((e: any) => eMap[e.value] = e);
                setEmployeesMap(eMap);

                const ests = data.result.initialData?.estimates || [];
                const estMap: Record<string, any> = {};
                ests.forEach((e: any) => estMap[e.value] = e);
                setEstimatesMap(estMap);

                const constants = data.result.initialData?.constants || [];
                const fMap: Record<string, any> = {};
                constants.forEach((c: any) => {
                    if (c.type === 'Fringe') {
                        fMap[c.description] = c;
                    }
                });
                setFringeConstantsMap(fMap);
            }
        } catch (err) {
            console.error(err);
            toastError("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Flatten and Filter Records
    const allRecords = useMemo(() => {
        const flat: TimesheetRecord[] = [];
        
        rawSchedules.forEach(sched => {
            if (!sched.timesheet || !Array.isArray(sched.timesheet)) return;
            
            sched.timesheet.forEach((ts: any) => {
                if (ts.type?.trim().toLowerCase() !== 'site time'.toLowerCase()) return;
                
                const clockInDate = new Date(robustNormalizeISO(ts.clockIn));
                if (isNaN(clockInDate.getTime())) return;
                
                if (clockInDate.getUTCFullYear() !== selectedYear) return;
                
                if (selectedWeekLabel !== 'all') {
                    const week = weekOptions.find(w => w.value === selectedWeekLabel);
                    if (week && (clockInDate < week.start || clockInDate > week.end)) return;
                }

                const { hours } = calculateTimesheetData(ts, sched.fromDate);
                const reg = Math.min(8, hours);
                const ot = Math.min(4, Math.max(0, hours - 8));
                const dt = Math.max(0, hours - 12);

                const empInfo = employeesMap[ts.employee.toLowerCase()] || {};
                const rate = parseFloat(empInfo.hourlyRateSITE || '45');
                const rRegPay = reg * rate;
                const rOtPay = ot * rate * 1.5;
                const rDtPay = dt * rate * 2.0;
                const grossPay = rRegPay + rOtPay + rDtPay;
                
                const subjectWages = hours * rate;
                const fringeVal = sched.fringe || estimatesMap[sched.estimate]?.fringe || 'No';

                flat.push({
                    _id: ts._id || ts.recordId,
                    employee: ts.employee,
                    type: ts.type,
                    clockIn: ts.clockIn,
                    clockOut: ts.clockOut,
                    hoursVal: hours,
                    regHrs: reg,
                    otHrs: ot,
                    dtHrs: dt,
                    regPay: rRegPay,
                    otPay: rOtPay,
                    dtPay: rDtPay,
                    grossPay: grossPay,
                    subjectWages: subjectWages,
                    compCost: 0, 
                    scheduleId: sched._id,
                    item: sched.item || 'Uncategorized',
                    fringe: fringeVal,
                    dateLabel: formatDateOnly(ts.clockIn),
                    title: sched.projectTitle || sched.title || sched.jobTitle || 'Unknown Project',
                    estimateRef: sched.estimate || sched.quoteNumber || sched.quote_number || '--'
                });
            });
        });

        return flat.sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
    }, [rawSchedules, selectedYear, selectedWeekLabel, weekOptions, employeesMap, estimatesMap]);

    // Grouping Data by Fringe
    const groups = useMemo(() => {
        const gMap: Record<string, FringeGroup> = {};
        
        allRecords.forEach(r => {
            const key = r.fringe;
            if (!gMap[key]) {
                const constant = fringeConstantsMap[key];
                gMap[key] = { 
                    id: key, 
                    label: key, 
                    totalAmount: 0, 
                    totalHours: 0, 
                    recordCount: 0,
                    color: constant?.color,
                    image: constant?.image
                };
            }
            gMap[key].totalAmount += r.grossPay;
            gMap[key].totalHours += r.hoursVal;
            gMap[key].recordCount += 1;
        });

        return Object.values(gMap).sort((a: any, b: any) => a.label.localeCompare(b.label));
    }, [allRecords, fringeConstantsMap]);

    useEffect(() => {
        setVisibleRows(50);
    }, [selectedFringe, searchQuery, selectedYear, selectedWeekLabel, expandedEmp]);

    const totals = useMemo(() => {
        return allRecords.reduce((acc, r: any) => ({
            hours: acc.hours + r.hoursVal,
            ot: acc.ot + r.otHrs,
            regPay: acc.regPay + r.regPay,
            otPay: acc.otPay + r.otPay,
            gross: acc.gross + r.grossPay
        }), { hours: 0, ot: 0, regPay: 0, otPay: 0, gross: 0 });
    }, [allRecords]);

    // Table Data
    const tableData = useMemo(() => {
        let filtered = allRecords;
        if (selectedFringe !== 'All') {
            filtered = filtered.filter(r => r.fringe === selectedFringe);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(r => 
                r.employee.toLowerCase().includes(q) || 
                r.title.toLowerCase().includes(q) ||
                r.estimateRef.toLowerCase().includes(q) ||
                (employeesMap[r.employee.toLowerCase()]?.label || '').toLowerCase().includes(q) ||
                r.fringe.toLowerCase().includes(q)
            );
        }
        return filtered;
    }, [allRecords, selectedFringe, searchQuery, employeesMap]);

    const employeeSummary = useMemo(() => {
        const summaryMap: Record<string, any> = {};

        tableData.forEach(r => {
            if (!summaryMap[r.employee]) {
                summaryMap[r.employee] = { 
                    reg: 0, ot: 0, 
                    regPay: 0, otPay: 0, 
                    gross: 0, 
                    count: 0,
                    employee: r.employee
                };
            }
            const s = summaryMap[r.employee];
            s.reg += r.regHrs;
            s.ot += r.otHrs;
            s.regPay += r.regPay;
            s.otPay += r.otPay;
            s.gross += r.grossPay;
            s.count += 1;
        });

        return Object.values(summaryMap).sort((a: any, b: any) => b.gross - a.gross);
    }, [tableData]);

    const displayData = (expandedEmp && expandedEmp !== '_all_')
        ? tableData.filter(r => r.employee === expandedEmp)
        : tableData;

    const downloadCSV = () => {
        const headers = ["Employee", "Date", "Title", "Estimate", "Fringe", "Hours"];
        const rows = tableData.map(r => [
            employeesMap[r.employee]?.label || r.employee,
            r.dateLabel,
            r.title,
            r.estimateRef,
            r.fringe,
            r.hoursVal.toFixed(2)
        ]);

        const content = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([content], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Fringe_Benefits_${selectedYear}.csv`;
        link.click();
    };

    if (loading) return <Loading />;

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
                
                {/* Filter & KPI Bar */}
                <div className="flex items-center mb-3 min-h-[40px] relative z-40">
                    <div className="w-[320px] flex items-center gap-2 shrink-0">
                        <div className="relative">
                            <button 
                                onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-xl border ${isYearDropdownOpen ? 'border-[#0F4C75] shadow-inner' : 'border-slate-100 shadow-sm'} transition-all`}
                            >
                                <CalendarIcon size={12} className="text-[#0F4C75]" />
                                <span className="text-[10px] font-bold text-slate-800">{selectedYear}</span>
                                <ChevronDown size={10} className={`text-slate-400 transition-transform ${isYearDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {isYearDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsYearDropdownOpen(false)} />
                                    <div className="absolute top-full mt-1.5 w-32 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                        {yearOptions.map(y => (
                                            <button 
                                                key={y.value}
                                                onClick={() => { setSelectedYear(y.value); setSelectedWeekLabel('all'); setIsYearDropdownOpen(false); }}
                                                className={`w-full px-3 py-2 text-left text-[11px] font-semibold hover:bg-slate-50 transition-colors ${selectedYear === y.value ? 'text-[#0F4C75] bg-blue-50/50' : 'text-slate-600'}`}
                                            >
                                                {y.label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="relative flex-1">
                            <button 
                                onClick={() => setIsWeekDropdownOpen(!isWeekDropdownOpen)}
                                className={`w-full flex items-center justify-between px-3 py-1.5 bg-white rounded-xl border ${isWeekDropdownOpen ? 'border-[#0F4C75] shadow-inner' : 'border-slate-100 shadow-sm'} transition-all`}
                            >
                                <div className="flex items-center gap-1.5">
                                    <Clock size={12} className="text-[#0F4C75]" />
                                    <span className="text-[10px] font-bold text-slate-800">
                                        {selectedWeekLabel === 'all' ? 'All Weeks' : weekOptions.find(w => w.value === selectedWeekLabel)?.label || 'All Weeks'}
                                    </span>
                                </div>
                                <ChevronDown size={10} className={`text-slate-400 transition-transform ${isWeekDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {isWeekDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsWeekDropdownOpen(false)} />
                                    <div className="absolute top-full mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-50 py-1.5 overflow-hidden max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 custom-scrollbar">
                                        <button 
                                            onClick={() => { setSelectedWeekLabel('all'); setIsWeekDropdownOpen(false); }}
                                            className={`w-full px-2.5 py-1.5 text-left text-[10px] font-semibold hover:bg-slate-50 transition-colors ${selectedWeekLabel === 'all' ? 'text-[#0F4C75] bg-blue-50/50' : 'text-slate-600'}`}
                                        >
                                            All Weeks
                                        </button>
                                        {weekOptions.map(w => (
                                            <button 
                                                key={w.value}
                                                onClick={() => { setSelectedWeekLabel(w.value); setIsWeekDropdownOpen(false); }}
                                                className={`w-full px-3 py-2 text-left text-[11px] font-semibold hover:bg-slate-50 transition-colors ${selectedWeekLabel === w.value ? 'text-[#0F4C75] bg-blue-50/50' : 'text-slate-600'}`}
                                            >
                                                {w.label}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="w-3" />

                    <div className="flex-1 flex items-center justify-between">
                        <div className="flex items-center gap-4 bg-white/50 px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-2">
                                <Clock size={12} className="text-blue-500" />
                                <div className="flex flex-col leading-none">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Hours</span>
                                    <span className="text-[11px] font-bold text-slate-800">{tableData.reduce((acc, r: any) => acc + r.hoursVal, 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
                                <RotateCcw size={12} className="text-orange-500" />
                                <div className="flex flex-col leading-none">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">OT</span>
                                    <span className="text-[11px] font-bold text-slate-800">{tableData.reduce((acc, r: any) => acc + r.otHrs, 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
                                <DollarSign size={12} className="text-emerald-500" />
                                <div className="flex flex-col leading-none">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Reg Amt</span>
                                    <span className="text-[11px] font-bold text-slate-800">${tableData.reduce((acc, r: any) => acc + r.regPay, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
                                <DollarSign size={12} className="text-orange-600" />
                                <div className="flex flex-col leading-none">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">OT Amt</span>
                                    <span className="text-[11px] font-bold text-slate-800">${tableData.reduce((acc, r: any) => acc + r.otPay, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
                                <DollarSign size={12} className="text-emerald-700" />
                                <div className="flex flex-col leading-none">
                                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Total Amt</span>
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
                        </div>

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
                    <aside className="w-[320px] bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden shrink-0">
                        <div className="p-3 border-b border-slate-50 bg-slate-50/30">
                            <h3 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Fringe Benefits</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-1.5">
                            <button 
                                onClick={() => setSelectedFringe('All')}
                                className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all group
                                    ${selectedFringe === 'All' 
                                        ? 'bg-[#0F4C75] text-white shadow-lg shadow-blue-900/10' 
                                        : 'text-slate-600 hover:bg-slate-50'}
                                `}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${selectedFringe === 'All' ? 'bg-white/20' : 'bg-slate-100'}`}>
                                        <List size={14} />
                                    </div>
                                    <span className="text-xs font-semibold">All Fringe Types</span>
                                </div>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg ${selectedFringe === 'All' ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                                    ${totals.gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            </button>

                            {groups.map(group => (
                                <button 
                                    key={group.id}
                                    onClick={() => setSelectedFringe(group.id)}
                                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all group
                                        ${selectedFringe === group.id 
                                            ? 'shadow-lg shadow-blue-900/10' 
                                            : 'text-slate-600 hover:bg-slate-50'}
                                    `}
                                    style={{ 
                                        backgroundColor: selectedFringe === group.id ? (group.color || '#059669') : '',
                                        color: selectedFringe === group.id ? 'white' : ''
                                    }}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${selectedFringe === group.id ? 'bg-white/20' : 'bg-slate-100'} overflow-hidden`}>
                                            {group.image ? (
                                                <img src={group.image} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <span className={`text-[10px] font-bold uppercase ${selectedFringe === group.id ? 'text-white' : 'text-slate-500'}`}>
                                                    {group.label.substring(0, 2)}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs font-semibold text-left leading-tight">{group.label}</span>
                                    </div>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-lg ${selectedFringe === group.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                                        ${group.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                </button>
                            ))}
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
                                                <TableHeader className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-right w-24">Reg Hrs</TableHeader>
                                                <TableHeader className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-right w-24">OT Hrs</TableHeader>
                                                <TableHeader className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-right w-28">Reg Amt</TableHeader>
                                                <TableHeader className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-right w-28">OT Amt</TableHeader>
                                                <TableHeader className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-right w-32">Total Amount</TableHeader>
                                            </>
                                        ) : (
                                            <>
                                                <TableHeader className="px-2 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-center w-20">Fringe</TableHeader>
                                                <TableHeader className="px-3 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] w-28">Employee</TableHeader>
                                                <TableHeader className="px-2 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-center w-20">Date</TableHeader>
                                                <TableHeader className="px-3 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] max-w-[150px]">Title</TableHeader>
                                                <TableHeader className="px-3 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] w-24">Estimate</TableHeader>
                                                <TableHeader className="px-3 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-right w-12">Reg</TableHeader>
                                                <TableHeader className="px-3 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-right w-12">OT</TableHeader>
                                                <TableHeader className="px-3 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-right w-20">Amount</TableHeader>
                                            </>
                                        )}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {!expandedEmp ? (
                                        <>
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
                                                    <TableCell className="px-4 py-3 text-right text-[11px] text-[#0F4C75] tabular-nums">
                                                        {employeeSummary.reduce((a,b)=>a+b.reg,0).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-right text-[11px] text-orange-500 tabular-nums">
                                                        {employeeSummary.reduce((a,b)=>a+b.ot,0).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-right text-[11px] text-emerald-600 tabular-nums">
                                                        ${employeeSummary.reduce((a,b)=>a+b.regPay,0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-right text-[11px] text-orange-600 tabular-nums">
                                                        ${employeeSummary.reduce((a,b)=>a+b.otPay,0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-right text-[12px] text-slate-900 tabular-nums">
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
                                                                <p className="text-[11px] font-bold text-slate-800">{employeesMap[emp.employee]?.label || emp.employee}</p>
                                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{emp.count} Records</p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="px-4 py-3 text-right text-[11px] font-semibold text-slate-600 tabular-nums">{emp.reg.toFixed(2)}</TableCell>
                                                    <TableCell className="px-4 py-3 text-right text-[11px] font-semibold text-orange-500/80 tabular-nums">{emp.ot > 0 ? emp.ot.toFixed(2) : '-'}</TableCell>
                                                    <TableCell className="px-4 py-3 text-right text-[11px] font-medium text-slate-600 tabular-nums">${emp.regPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                                                    <TableCell className="px-4 py-3 text-right text-[11px] font-medium text-slate-600 tabular-nums">${emp.otPay > 0 ? emp.otPay.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</TableCell>
                                                    <TableCell className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="text-[12px] font-black text-[#0F4C75] tabular-nums">
                                                                ${emp.gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                            </span>
                                                            <ChevronRight size={12} className="text-slate-300 group-hover:text-[#0F4C75] transition-colors" />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </>
                                    ) : (
                                        <>
                                            {displayData.length > 0 ? displayData.slice(0, visibleRows).map((record: any, idx) => (
                                                <TableRow key={`${record._id}-${idx}`} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50/50 last:border-0 text-[11px]">
                                                    <TableCell className="px-2 py-2 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div 
                                                                className="w-6 h-6 rounded-lg flex items-center justify-center overflow-hidden border border-slate-50 shadow-sm"
                                                                style={{ 
                                                                    backgroundColor: fringeConstantsMap[record.fringe]?.color ? `${fringeConstantsMap[record.fringe].color}20` : '#f8fafc',
                                                                }}
                                                            >
                                                                {fringeConstantsMap[record.fringe]?.image ? (
                                                                    <img src={fringeConstantsMap[record.fringe].image} className="w-full h-full object-cover" alt="" />
                                                                ) : (
                                                                    <span 
                                                                        className="text-[9px] font-black uppercase"
                                                                        style={{ color: fringeConstantsMap[record.fringe]?.color || '#0F4C75' }}
                                                                    >
                                                                        {record.fringe.substring(0, 2)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <Badge 
                                                                className="border-slate-100 text-[9px] font-bold px-1.5 py-0 shadow-none bg-transparent"
                                                                style={{ 
                                                                    color: fringeConstantsMap[record.fringe]?.color || '#0F4C75',
                                                                    borderColor: fringeConstantsMap[record.fringe]?.color ? `${fringeConstantsMap[record.fringe].color}40` : '#e2e8f0'
                                                                }}
                                                            >
                                                                {record.fringe}
                                                            </Badge>
                                                        </div>
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
                                                                <p className="text-[10px] font-semibold text-slate-800 leading-tight truncate w-24">
                                                                    {employeesMap[record.employee]?.label || record.employee}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="px-2 py-2 text-center text-slate-500">
                                                        {record.dateLabel}
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2 max-w-[150px]">
                                                        <p className="text-[10px] font-medium text-slate-700 truncate" title={record.title}>
                                                            {record.title}
                                                        </p>
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2 text-slate-400 font-bold uppercase tracking-tighter">
                                                        {record.estimateRef}
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2 text-right font-semibold text-[#0F4C75] tabular-nums">
                                                        {record.regHrs.toFixed(2)}
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2 text-right font-semibold text-orange-500 tabular-nums">
                                                        {record.otHrs > 0 ? record.otHrs.toFixed(2) : '-'}
                                                    </TableCell>
                                                    <TableCell className="px-3 py-2 text-right font-medium text-slate-600 tabular-nums">
                                                        ${record.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="py-20 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center">
                                                                <FileText size={20} className="text-slate-200" />
                                                            </div>
                                                            <p className="text-[11px] font-bold text-slate-400">No records found for this selection</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}

                                            {displayData.length > visibleRows && (
                                                <TableRow className="hover:bg-transparent">
                                                    <TableCell colSpan={8} className="py-6 text-center">
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
