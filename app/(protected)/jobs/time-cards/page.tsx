'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import {
    ChevronRight, ChevronLeft, ChevronDown, User, Calendar as CalendarIcon,
    MapPin, Truck, Trash2, Edit, RotateCcw, FileText, Clock
} from 'lucide-react';
import Link from 'next/link';
import {
    Header, Loading, Modal,
    SearchableSelect, Card, Pagination,
    Table, TableHead, TableBody, TableRow, TableHeader, TableCell,
    Badge, Tooltip, TooltipTrigger, TooltipContent,
    ConfirmModal
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';

// --- Types ---

interface TimesheetEntry {
    _id?: string;
    recordId?: string; // Legacy
    employee: string;
    type: string;
    clockIn: string; // ISO String
    clockOut?: string;
    lunchStart?: string;
    lunchEnd?: string;
    locationIn?: string;
    locationOut?: string;
    dumpWashout?: boolean | string;
    shopTime?: boolean | string;
    scheduleId: string; // Parent Schedule ID
    estimate?: string; // From parent
    comments?: string; 
    manualDistance?: string | number;
    manualDuration?: string | number;
    distance?: number;
    hours?: number;
    
    // Computed locally
    hoursVal?: number;
    distanceVal?: number;
    projectName?: string;
}

interface ScheduleDoc {
    _id: string;
    estimate: string;
    timesheet?: TimesheetEntry[];
    fromDate: string;
    // ... other fields irrelevant for this specific view
}

// --- Constants ---
const SPEED_MPH = 55;
const ROAD_ADJUSTMENT_FACTOR = 1.0; // No longer needed as we're following spreadsheet logic
const EARTH_RADIUS_MI = 3958.8; // Radius of the earth in miles
const FORMULA_CUTOFF_DATE = new Date('2026-01-12T00:00:00');
const DRIVING_FACTOR = 1.19;

// --- Helpers ---

const getWeekNumber = (d: Date) => {
    // Copy date so don't modify original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    // Get first day of year
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
};

const getWeekRangeString = (dateObj: Date) => {
    const curr = new Date(dateObj);
    const first = curr.getDate() - curr.getDay(); // First day is the day of the month - the day of the week
    const last = first + 6; // last day is the first day + 6

    const firstday = new Date(curr.setDate(first));
    const lastday = new Date(curr.setDate(last));

    const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
    return `${fmt(firstday)} to ${fmt(lastday)}`;
};

const formatTimeOnly = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        return time === 'Invalid Date' ? dateStr : time;
    } catch (e) {
        return dateStr;
    }
};

const formatDateOnly = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString();
    } catch (e) {
        return dateStr;
    }
};

const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = EARTH_RADIUS_MI; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Matches spreadsheet result (e.g. 276 for the test coords)
};

const toLocalISO = (iso?: string) => {
    if (!iso) return "";
    const clean = iso.split('.')[0];
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const offset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - offset);
    return local.toISOString().slice(0, 16);
};

const calculateTimesheetData = (ts: TimesheetEntry, scheduleDate?: string) => {
    const typeLower = (ts.type || '').toLowerCase();
    
    // Prioritize persisted numerical values from the app/database
    let distance = typeof ts.distance === 'number' ? ts.distance : (parseFloat(String(ts.distance)) || 0);
    let hours = typeof ts.hours === 'number' ? ts.hours : (parseFloat(String(ts.hours)) || 0);

    const parseLoc = (val: any) => {
        const str = String(val || '').trim();
        if (str.includes(',')) {
            const parts = str.split(',').map(p => parseFloat(p.trim()));
            if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                return { lat: parts[0], lon: parts[1] };
            }
        }
        const num = parseFloat(str.replace(/,/g, ''));
        return isNaN(num) ? 0 : num;
    };

    const locIn = parseLoc(ts.locationIn);
    const locOut = parseLoc(ts.locationOut);
    const tsDateStr = ts.clockIn || scheduleDate || new Date().toISOString();
    const tsDate = new Date(tsDateStr);

    const calcTimeHours = () => {
        if (!ts.clockIn || !ts.clockOut) return hours;
        const start = new Date(ts.clockIn).getTime();
        const end = new Date(ts.clockOut).getTime();
        let durationMs = end - start;

        if (ts.lunchStart && ts.lunchEnd) {
            const lStart = new Date(ts.lunchStart).getTime();
            const lEnd = new Date(ts.lunchEnd).getTime();
            if (lEnd > lStart) durationMs -= (lEnd - lStart);
        }
        if (durationMs <= 0) return hours;
        
        const totalHoursRaw = durationMs / (1000 * 60 * 60);

        // Pre-2025 cutoff (existing logic)
        const cutoff2025 = new Date('2025-10-26T00:00:00');
        if (tsDate < cutoff2025) return totalHoursRaw;
        if (totalHoursRaw >= 7.75 && totalHoursRaw < 8.0) return 8.0;

        const h = Math.floor(totalHoursRaw);
        const m = Math.round((totalHoursRaw - h) * 60);
        let roundedM = 0;
        if (m > 1 && m <= 14) roundedM = 0;
        else if (m > 14 && m <= 29) roundedM = 15;
        else if (m > 29 && m <= 44) roundedM = 30;
        else if (m > 44 && m <= 59) roundedM = 45;
        return h + (roundedM / 60);
    };

    // Distance & Hours Calculation Logic
    if (typeLower.includes('drive')) {
        if (tsDate < FORMULA_CUTOFF_DATE) {
            // Before Cutoff: Distance derived from hours
            hours = typeof ts.hours === 'number' ? ts.hours : (parseFloat(String(ts.hours)) || 0);
            distance = hours * SPEED_MPH;
        } else {
            // After Cutoff: Calculate Driving distance
            if (distance === 0) {
                if (typeof locIn === 'object' && typeof locOut === 'object') {
                    // Applied Driving Factor 1.19 for Road Miles Approximation
                    distance = haversine(locIn.lat, locIn.lon, locOut.lat, locOut.lon) * DRIVING_FACTOR;
                } else if (typeof locIn === 'number' && typeof locOut === 'number' && locOut > locIn) {
                    distance = locOut - locIn;
                }
            }

            // Derive Hours from distance
            if (distance > 0) {
                hours = distance / SPEED_MPH;
            } else {
                const dw = String(ts.dumpWashout).toLowerCase();
                const st = String(ts.shopTime).toLowerCase();
                if (dw === 'yes' || dw === 'true' || ts.dumpWashout === true) {
                    hours = 0.5;
                } else if (st === 'yes' || st === 'true' || ts.shopTime === true) {
                    hours = 0.25;
                } else {
                    hours = calcTimeHours();
                }
            }
        }
    } else {
        // Site time always uses clock time
        hours = calcTimeHours();
    }

    return { hours, distance };
};

const normalizeEst = (val: string | undefined) => {
    if (!val) return '';
    return val.split('-V')[0].split('-v')[0].trim();
};

// --- Components ---

export default function TimeCardPage() {
    const { success, error: toastError } = useToast();
    const [loading, setLoading] = useState(true);
    const [rawSchedules, setRawSchedules] = useState<ScheduleDoc[]>([]);
    const [employeesMap, setEmployeesMap] = useState<Record<string, any>>({});
    const [estimatesOptions, setEstimatesOptions] = useState<any[]>([]);
    
    // Filters
    const [filEmployee, setFilEmployee] = useState('');
    const [filEstimate, setFilEstimate] = useState('');
    const [filType, setFilType] = useState('');

    // Tree Selection
    // nodeType: 'ROOT' | 'YEAR' | 'WEEK' | 'EMPLOYEE'
    // nodeValue: identifying string (e.g. '2025', '2025-52', '2025-52-email@co.com')
    const [selectedNode, setSelectedNode] = useState<{ type: string, value: string }>({ type: 'ROOT', value: 'All' });
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [isMobile, setIsMobile] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [mobileSelectedDate, setMobileSelectedDate] = useState(new Date());
    const dateInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        const userStr = localStorage.getItem('devco_user');
        if (userStr) {
            try {
                setCurrentUser(JSON.parse(userStr));
            } catch (e) {
                console.error("Failed to parse user", e);
            }
        }
        
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;

    // Delete Confirm State
    const [deleteTs, setDeleteTs] = useState<TimesheetEntry | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Edit State
    const [editingRecord, setEditingRecord] = useState<TimesheetEntry | null>(null);
    const [editForm, setEditForm] = useState<Partial<TimesheetEntry>>({});

    const clearFilters = () => {
        setFilEmployee('');
        setFilEstimate('');
        setFilType('');
        setCurrentPage(1);
    };

    const hasFilters = filEmployee || filEstimate || filType;

    const allRecords = useMemo(() => {
        const flat: TimesheetEntry[] = [];
        const estMap = new Map();
        estimatesOptions.forEach(e => {
            const base = normalizeEst(e.value);
            if (!estMap.has(base)) estMap.set(base, e.projectTitle);
        });

        rawSchedules.forEach(sched => {
            if (sched.timesheet && Array.isArray(sched.timesheet)) {
                sched.timesheet.forEach(ts => {
                    const { hours, distance } = calculateTimesheetData(ts as any, sched.fromDate);
                    const scheduleBase = normalizeEst(sched.estimate);
                    const pName = (sched as any).projectName || (sched as any).project || estMap.get(scheduleBase) || '';
                    
                    flat.push({
                        ...ts,
                        scheduleId: sched._id,
                        estimate: sched.estimate,
                        projectName: pName,
                        hoursVal: hours,
                        distanceVal: distance
                    });
                });
            }
        });
        return flat.sort((a, b) => new Date(b.clockIn || 0).getTime() - new Date(a.clockIn || 0).getTime());
    }, [rawSchedules, estimatesOptions]);

    const toLocalISO = (isoStr?: string) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '';
        const pad = (n: number) => n < 10 ? '0' + n : n;
        return d.getFullYear() + '-' +
            pad(d.getMonth() + 1) + '-' +
            pad(d.getDate()) + 'T' +
            pad(d.getHours()) + ':' +
            pad(d.getMinutes());
    };


    // Data Fetching
    const fetchTimeCards = async () => {
        setLoading(true);
        try {
            // Reusing the getSchedulesPage action to get source data + employees
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getSchedulesPage' }) 
            });
            const data = await res.json();
            
            if (data.success) {
                setRawSchedules(data.result.schedules || []);
                const emps = data.result.initialData?.employees || [];
                
                // Create map and save options
                const eMap: Record<string, any> = {};
                emps.forEach((e: any) => eMap[e.value] = e);
                setEmployeesMap(eMap);
                setEstimatesOptions(data.result.initialData?.estimates || []);
            }
        } catch (err) {
            console.error(err);
            toastError("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimeCards();
    }, []);

    // --- Derived Data & Tree Structure ---

    // 1. Apply Top Filters first
    const filteredRecords = useMemo(() => {
        return allRecords.filter(r => {
            // Mobile specific filtering: Only show current user's records for the selected date
            if (isMobile) {
                if (currentUser && r.employee !== currentUser.email) return false;
                
                if (r.clockIn) {
                    const recordDate = new Date(r.clockIn).toLocaleDateString();
                    const selectedDateStr = mobileSelectedDate.toLocaleDateString();
                    if (recordDate !== selectedDateStr) return false;
                } else {
                    return false;
                }
            } else {
                // Desktop filters
                if (filEmployee && r.employee !== filEmployee) return false;
                if (filType && r.type !== filType) return false;
            }

            if (filEstimate) {
                const baseRecord = normalizeEst(r.estimate);
                const baseFilter = normalizeEst(filEstimate);
                if (baseRecord !== baseFilter) return false;
            }
            
            return true;
        });
    }, [allRecords, filEmployee, filEstimate, filType, isMobile, currentUser, mobileSelectedDate]);

    // 2. Build Tree Structure
    const treeData = useMemo(() => {
        const root: any = { years: {} };
        
        filteredRecords.forEach(r => {
            if (!r.clockIn) return;
            const d = new Date(r.clockIn);
            const year = d.getFullYear();
            const weekNo = getWeekNumber(d);
            const weekRange = getWeekRangeString(d);
            
            // Year Node
            if (!root.years[year]) root.years[year] = { 
                id: `Y-${year}`, label: `${year}`, totalHours: 0, weeks: {} 
            };
            root.years[year].totalHours += (r.hoursVal || 0);

            // Week Node
            const weekKey = `${year}-${weekNo}`;
            if (!root.years[year].weeks[weekKey]) root.years[year].weeks[weekKey] = {
                id: `W-${weekKey}`, label: `(${weekNo}) ${weekRange}`, totalHours: 0, employees: {}, weekNo // Add weekNo for sorting
            };
            root.years[year].weeks[weekKey].totalHours += (r.hoursVal || 0);

            // Employee Node
            const empKey = r.employee;
            const empLabel = employeesMap[empKey]?.label || empKey; // Lookup name
            
            if (!root.years[year].weeks[weekKey].employees[empKey]) {
                root.years[year].weeks[weekKey].employees[empKey] = {
                    id: `E-${weekKey}-${empKey}`, label: empLabel, totalHours: 0, records: []
                };
            }
            root.years[year].weeks[weekKey].employees[empKey].totalHours += (r.hoursVal || 0);
            root.years[year].weeks[weekKey].employees[empKey].records.push(r);
        });

        return root;
    }, [filteredRecords, employeesMap]);

    // 3. Filter Table based on Tree Selection
    const tableData = useMemo(() => {
        if (selectedNode.type === 'ROOT') return filteredRecords;
        return filteredRecords.filter(r => {
            if (!r.clockIn) return false;
            const d = new Date(r.clockIn);
            const year = d.getFullYear();
            const weekNo = getWeekNumber(d);
            const weekKey = `${year}-${weekNo}`;

            if (selectedNode.type === 'YEAR') return `Y-${year}` === selectedNode.value;
            if (selectedNode.type === 'WEEK') return `W-${weekKey}` === selectedNode.value;
            if (selectedNode.type === 'EMPLOYEE') return `E-${weekKey}-${r.employee}` === selectedNode.value;
            return true;
        });
    }, [filteredRecords, selectedNode]);

    // Reset pagination
    useEffect(() => {
        setCurrentPage(1);
    }, [filEmployee, filEstimate, filType, selectedNode]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return tableData.slice(start, start + ITEMS_PER_PAGE);
    }, [tableData, currentPage]);

    const totalPages = Math.ceil(tableData.length / ITEMS_PER_PAGE);


    // --- Actions ---
    
    const handleDeleteClick = (ts: TimesheetEntry) => {
        setDeleteTs(ts);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteTs) return;
        const ts = deleteTs;
        
        // Optimistic UI Update: Remove the record immediately from the frontend
        const originalSchedules = [...rawSchedules];
        setRawSchedules(prev => prev.map(s => {
            if (s._id !== ts.scheduleId) return s;
            return {
                ...s,
                timesheet: (s.timesheet || []).filter((t: any) => (t._id || t.recordId) !== (ts._id || ts.recordId))
            };
        }));

        try {
            // Proceed with backend deletion in the background
            const resGet = await fetch('/api/schedules', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'getScheduleById', payload: { id: ts.scheduleId } })
            });
            const dataGet = await resGet.json();
            if (!dataGet.success) throw new Error("Schedule not found");
            
            const schedule = dataGet.result;
            const newTimesheets = (schedule.timesheet || []).filter((t: any) => (t._id || t.recordId) !== (ts._id || ts.recordId));
            
            const resSave = await fetch('/api/schedules', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    action: 'updateSchedule', 
                    payload: { id: ts.scheduleId, timesheet: newTimesheets }
                })
            });
            
            const saveRes = await resSave.json();
            if (saveRes.success) {
                success("Timesheet deleted");
                // No need to fetchTimeCards() here because we already updated the state optimistically
            } else {
                throw new Error("Failed to save");
            }
            
        } catch (e) {
            console.error(e);
            toastError("Error deleting timesheet");
            // Rollback optimistic update on error
            setRawSchedules(originalSchedules);
        } finally {
            setDeleteTs(null);
            setIsDeleteModalOpen(false);
        }
    };

    const handleEditClick = (ts: TimesheetEntry) => {
        setEditingRecord(ts);
        setEditForm({ ...ts });
    };

    const handleSaveEdit = async () => {
        if (!editingRecord || !editForm.scheduleId) return;
        
        const originalSchedules = [...rawSchedules];
        
        // Optimistic UI Update
        setRawSchedules(prev => prev.map(s => {
            if (s._id !== editForm.scheduleId) return s;
            return {
                ...s,
                timesheet: (s.timesheet || []).map((t: any) => {
                    if ((t._id || t.recordId) === (editingRecord._id || editingRecord.recordId)) {
                        return { ...t, ...editForm };
                    }
                    return t;
                })
            };
        }));

        try {
            // Close modal immediately
            setEditingRecord(null);
            setEditForm({});

            // Background update
            const resGet = await fetch('/api/schedules', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'getScheduleById', payload: { id: editForm.scheduleId } })
            });
            const dataGet = await resGet.json();
            if (!dataGet.success) throw new Error("Schedule not found");
            
            const schedule = dataGet.result;
            const updatedTimesheets = (schedule.timesheet || []).map((t: any) => {
                if ((t._id || t.recordId) === (editingRecord._id || editingRecord.recordId)) {
                    const { hoursVal, distanceVal, ...rest } = editForm;
                    return { ...t, ...rest };
                }
                return t;
            });
            
            const resSave = await fetch('/api/schedules', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    action: 'updateSchedule', 
                    payload: { id: editForm.scheduleId, timesheet: updatedTimesheets }
                })
            });
            
            const saveResult = await resSave.json();
            if (saveResult.success) {
                success("Timesheet updated");
            } else {
                throw new Error("Failed to save");
            }
            
        } catch (e) {
            console.error(e);
            toastError("Failed to update timesheet");
            // Rollback on error
            setRawSchedules(originalSchedules);
        }
    };

    const toggleNode = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectNode = (type: string, value: string) => {
        setSelectedNode({ type, value });
    };

    // Lists for Filters
    const uniqueEmployees = useMemo(() => Array.from(new Set(allRecords.map(r => r.employee))).sort(), [allRecords]);
    
    const uniqueEstimates = useMemo(() => estimatesOptions, [estimatesOptions]);

    const uniqueTypes = ["Drive Time", "Site Time"];

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            {!isMobile && (
                <div className="flex-none">
                    <Header 
                        rightContent={
                            <div className="flex items-center gap-3">
                                <Link 
                                    href="/reports/payroll"
                                    className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95"
                                >
                                    <FileText size={16} />
                                    Payroll Report
                                </Link>
                            </div>
                        }
                    />
                </div>
            )}

            <main className={`flex-1 min-h-0 flex flex-col max-w-[1920px] w-full mx-auto overflow-hidden ${isMobile ? 'pt-8' : 'p-4'}`}>
                {isMobile ? (
                    <div className="flex-1 bg-white rounded-t-[48px] shadow-2xl border-t border-slate-100 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto px-6 pt-10 pb-20 space-y-6">
                            {/* Premium Date Selector */}
                            <div className="flex items-center justify-between mb-8 px-2">
                                <button 
                                    onClick={() => {
                                        const d = new Date(mobileSelectedDate);
                                        d.setDate(d.getDate() - 1);
                                        setMobileSelectedDate(d);
                                    }}
                                    className="w-12 h-12 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all active:scale-90"
                                >
                                    <ChevronLeft size={24} />
                                </button>
                                
                                <div className="text-center cursor-pointer relative group flex-1" onClick={() => dateInputRef.current?.showPicker()}>
                                    <h3 className="text-[28px] font-black text-slate-900 mb-1 tracking-tight">
                                        {mobileSelectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                                    </h3>
                                    <p className="text-sm font-bold text-slate-400 tracking-wide">
                                        {mobileSelectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </p>
                                    <input 
                                        type="date"
                                        ref={dateInputRef}
                                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                        value={mobileSelectedDate.toISOString().split('T')[0]}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                const [y, m, d] = e.target.value.split('-').map(Number);
                                                setMobileSelectedDate(new Date(y, m - 1, d));
                                            }
                                        }} 
                                    />
                                </div>

                                <button 
                                    onClick={() => {
                                        const d = new Date(mobileSelectedDate);
                                        d.setDate(d.getDate() + 1);
                                        setMobileSelectedDate(d);
                                    }}
                                    className="w-12 h-12 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all active:scale-90"
                                >
                                    <ChevronRight size={24} />
                                </button>
                            </div>

                            {paginatedData.length > 0 ? (
                            paginatedData.map((ts, idx) => (
                                <div 
                                    key={`${ts._id || 'ts'}-${idx}-${ts.clockIn}`}
                                    className={`relative overflow-hidden rounded-[24px] border shadow-sm transition-all active:scale-[0.98] ${
                                        ts.type?.toLowerCase().includes('drive') 
                                            ? 'bg-blue-50/50 border-blue-100' 
                                            : 'bg-emerald-50/50 border-emerald-100'
                                    }`}
                                >
                                    <div className={`absolute top-0 left-0 bottom-0 w-2 ${
                                        ts.type?.toLowerCase().includes('drive') ? 'bg-blue-500' : 'bg-emerald-500'
                                    }`} />
                                    
                                    <div className="p-5">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    {ts.type?.toLowerCase().includes('drive') ? (
                                                        <Truck size={16} className="text-blue-600" />
                                                    ) : (
                                                        <MapPin size={16} className="text-emerald-600" />
                                                    )}
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                        {ts.type}
                                                    </span>
                                                </div>
                                                <h3 className="text-lg font-black text-slate-800 leading-tight">
                                                    {ts.projectName || 'Internal Work'}
                                                </h3>
                                                <p className="text-xs font-bold text-[#0F4C75]">
                                                    {ts.estimate || 'No Estimate'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-2xl font-black text-slate-900 leading-none">
                                                    {(ts.hoursVal || 0).toFixed(2)}
                                                </div>
                                                <div className="text-[10px] font-bold text-slate-500 uppercase">Hours</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/50">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Clock In</span>
                                                <span className="text-sm font-black text-slate-700">{formatTimeOnly(ts.clockIn)}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Clock Out</span>
                                                <span className="text-sm font-black text-slate-700">{formatTimeOnly(ts.clockOut)}</span>
                                            </div>
                                        </div>

                                        {(ts.distanceVal || 0) > 0 && (
                                            <div className="mt-4 flex items-center gap-2 px-3 py-1.5 bg-white/60 rounded-xl w-fit border border-white">
                                                <span className="text-xs font-black text-blue-600">
                                                    {(ts.distanceVal || 0).toFixed(1)} miles driven
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                        <Clock className="text-slate-300" size={32} />
                                    </div>
                                    <h4 className="text-slate-400 font-bold">No entries found for this date</h4>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex gap-4 min-h-0">
                    
                    {/* Left Sidebar - Tree View */}
                    <div className="w-[300px] bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col overflow-hidden shrink-0">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Grouping</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                            
                            {/* All Node */}
                            <div 
                                onClick={() => selectNode('ROOT', 'All')}
                                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors mb-1
                                    ${selectedNode.value === 'All' ? 'bg-[#0F4C75] text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}
                                `}
                            >
                                <span className="text-sm font-bold">All</span>
                            </div>

                            {/* Years */}
                            {Object.values(treeData.years).sort((a: any, b: any) => b.label.localeCompare(a.label)).map((year: any) => {
                                const isExpanded = expandedNodes.has(year.id);
                                return (
                                    <div key={year.id} className="mb-1">
                                        <div 
                                            className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors group
                                                ${selectedNode.value === year.id ? 'bg-blue-50 text-[#0F4C75]' : 'text-slate-600 hover:bg-slate-50'}
                                            `}
                                            onClick={() => selectNode('YEAR', year.id)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={(e) => toggleNode(year.id, e)}
                                                    className="p-1 hover:bg-black/5 rounded text-slate-400"
                                                >
                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </button>
                                                <span className="text-sm font-bold">{year.label}</span>
                                            </div>
                                            <span className="text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                                                {year.totalHours.toLocaleString()}
                                            </span>
                                        </div>

                                        {/* Weeks */}
                                        {isExpanded && (
                                            <div className="pl-4 mt-1 space-y-1">
                                                {Object.values(year.weeks).sort((a: any, b: any) => b.weekNo - a.weekNo).map((week: any) => {
                                                    const isWeekExpanded = expandedNodes.has(week.id);

                                                    const isWeekSelected = selectedNode.value === week.id;
                                                    
                                                    return (
                                                        <div key={week.id}>
                                                            <div 
                                                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors
                                                                    ${isWeekSelected ? 'bg-green-50 text-green-700' : 'text-slate-600 hover:bg-slate-50'}
                                                                `}
                                                                onClick={() => selectNode('WEEK', week.id)}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                     <button 
                                                                        onClick={(e) => toggleNode(week.id, e)}
                                                                        className="p-1 hover:bg-black/5 rounded text-slate-400"
                                                                    >
                                                                        {isWeekExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                    </button>
                                                                    <span className="text-xs font-bold whitespace-nowrap">{week.label}</span>
                                                                </div>
                                                                <span className="text-[10px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                                                                    {week.totalHours.toFixed(2)}
                                                                </span>
                                                            </div>

                                                            {/* Employees */}
                                                            {isWeekExpanded && (
                                                                <div className="pl-6 mt-1 space-y-0.5 border-l border-slate-200 ml-2">
                                                                    {Object.values(week.employees).sort((a: any, b: any) => a.label.localeCompare(b.label)).map((emp: any) => (
                                                                        <div 
                                                                            key={emp.id}
                                                                            onClick={() => selectNode('EMPLOYEE', emp.id)}
                                                                            className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-colors
                                                                                ${selectedNode.value === emp.id ? 'bg-[#0F4C75] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}
                                                                            `}
                                                                        >
                                                                             <div className="flex items-center gap-2 min-w-0">
                                                                                <User size={12} className={selectedNode.value === emp.id ? 'text-white' : 'text-slate-400'} />
                                                                                <span className="text-[11px] font-bold truncate">{emp.label}</span>
                                                                             </div>
                                                                             <span className={`text-[9px] font-mono font-bold px-1.5 rounded ${selectedNode.value === emp.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                                                {emp.totalHours.toFixed(2)}
                                                                             </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Content - Table */}
                    <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col relative z-20">
                        <div className="px-5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-3xl relative z-30">
                            <div className="flex items-baseline gap-3">
                                <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                    Records
                                </h2>
                                <p className="text-[10px] text-slate-400 font-bold">
                                    {tableData.length} entries
                                </p>
                            </div>
                            
                            <div className="flex gap-3 items-center whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Employee</span>
                                    <SearchableSelect 
                                         id="filEmp" 
                                         placeholder="All Employees" 
                                         value={filEmployee} 
                                         onChange={setFilEmployee} 
                                         options={uniqueEmployees.map(e => ({label: employeesMap[e]?.label || e || '', value: e}))}
                                         className="w-[170px]"
                                    />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Project</span>
                                    <SearchableSelect 
                                         id="filEst" 
                                         placeholder="All Projects" 
                                         value={filEstimate} 
                                         onChange={setFilEstimate} 
                                         options={uniqueEstimates}
                                         className="w-[280px]"
                                    />
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Type</span>
                                    <SearchableSelect 
                                         id="filType" 
                                         placeholder="All Types" 
                                         value={filType} 
                                         onChange={setFilType} 
                                         options={uniqueTypes.map(e => ({label: e, value: e}))}
                                         className="w-[130px]"
                                         align="right"
                                    />
                                </div>

                                {hasFilters && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button 
                                                onClick={clearFilters}
                                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                            >
                                                <RotateCcw size={16} />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Clear all filters</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto custom-scrollbar p-0 rounded-b-3xl">
                            <Table containerClassName="flex-1">
                                <TableHead className="bg-white/80 backdrop-blur-md shadow-sm">
                                    <TableRow>
                                        <TableHeader className="text-xs uppercase font-black text-slate-500 w-[20%]">Employee</TableHeader>
                                        <TableHeader className="text-xs uppercase font-black text-slate-500 text-center">Date</TableHeader>
                                        <TableHeader className="text-xs uppercase font-black text-slate-500 text-center w-[60px]">Type</TableHeader>
                                        <TableHeader className="text-xs uppercase font-black text-slate-500">Estimate #</TableHeader>
                                        <TableHeader className="text-xs uppercase font-black text-slate-500 text-center">In</TableHeader>
                                        <TableHeader className="text-xs uppercase font-black text-slate-500 text-center">Out</TableHeader>
                                        <TableHeader className="text-xs uppercase font-black text-slate-500 text-right">Dist (Mi)</TableHeader>
                                        <TableHeader className="text-xs uppercase font-black text-slate-500 text-right w-16">Hrs</TableHeader>
                                        <TableHeader className="text-xs uppercase font-black text-slate-500 text-right">Actions</TableHeader>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginatedData.length > 0 ? paginatedData.map((ts, idx) => (
                                        <TableRow key={`${ts._id || 'ts'}-${idx}-${ts.clockIn}`} className="group hover:bg-[#F1F5F9] transition-all cursor-default">
                                            <TableCell className="relative overflow-hidden">
                                                <div className="absolute left-0 top-0 bottom-0 w-0 group-hover:w-1 bg-[#0F4C75] transition-all" />
                                                <div className="flex items-center gap-2.5">
                                                     <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500 overflow-hidden shrink-0 border border-white shadow-sm">
                                                        {employeesMap[ts.employee]?.image ? (
                                                            <img src={employeesMap[ts.employee].image} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            (employeesMap[ts.employee]?.initials || ts.employee.substring(0, 2)).toUpperCase()
                                                        )}
                                                     </div>
                                                     <span className="text-xs font-semibold text-slate-700">{employeesMap[ts.employee]?.label || ts.employee}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className="text-xs font-medium text-slate-500">{formatDateOnly(ts.clockIn)}</span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="flex justify-center">
                                                            {ts.type?.toLowerCase().includes('drive') ? (
                                                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                                                    <Truck size={14} />
                                                                </div>
                                                            ) : ts.type?.toLowerCase().includes('site') ? (
                                                                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                                                                    <MapPin size={14} />
                                                                </div>
                                                            ) : (
                                                                <div className="w-4 h-4 rounded-full bg-slate-100" />
                                                            )}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{ts.type}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell className="font-bold text-[#0F4C75] text-xs">
                                                {ts.estimate || '-'}
                                            </TableCell>
                                            <TableCell className="text-center text-xs text-slate-500">
                                                {formatTimeOnly(ts.clockIn)}
                                            </TableCell>
                                            <TableCell className="text-center text-xs text-slate-500">
                                                {formatTimeOnly(ts.clockOut)}
                                            </TableCell>
                                            <TableCell className="text-right text-xs font-medium text-slate-500">
                                                {(ts.distanceVal || 0) > 0 ? (ts.distanceVal || 0).toFixed(1) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right text-xs font-black text-slate-700">
                                                {(ts.hoursVal || 0).toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-1">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button 
                                                                onClick={() => handleEditClick(ts)}
                                                                className="p-1.5 hover:bg-white text-slate-400 hover:text-[#0F4C75] rounded-lg shadow-sm hover:shadow transition-all"
                                                            >
                                                                <Edit size={12} />
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Edit</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button 
                                                                onClick={() => handleDeleteClick(ts)}
                                                                className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>Delete</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={9} className="p-12 text-center text-slate-400">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center">
                                                        <CalendarIcon size={20} className="text-slate-300" />
                                                    </div>
                                                    <p className="text-sm font-medium">No records found for this selection.</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="p-1">
                            <Pagination 
                                currentPage={currentPage} 
                                totalPages={totalPages || 1} 
                                onPageChange={setCurrentPage} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </main>

            <Modal
                isOpen={!!editingRecord}
                onClose={() => setEditingRecord(null)}
                title="Edit Timesheet Record"
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
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Employee</label>
                        <input 
                            disabled
                            className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 font-medium"
                            value={employeesMap[editForm.employee || '']?.label || editForm.employee}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Estimate #</label>
                        <input 
                            className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                            value={editForm.estimate || ''}
                            onChange={e => setEditForm(prev => ({...prev, estimate: e.target.value}))}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Type</label>
                        <select 
                            className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700 appearance-none"
                            value={editForm.type || ''}
                            onChange={e => setEditForm(prev => ({...prev, type: e.target.value}))}
                        >
                            <option value="Drive Time">Drive Time</option>
                            <option value="Site Time">Site Time</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Clock In</label>
                        <input 
                            type="datetime-local"
                            className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                            value={toLocalISO(editForm.clockIn)}
                            onChange={e => {
                                const date = new Date(e.target.value);
                                if (!isNaN(date.getTime())) {
                                    setEditForm(prev => ({...prev, clockIn: date.toISOString()}));
                                }
                            }}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Clock Out</label>
                        <input 
                            type="datetime-local"
                            className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                            value={toLocalISO(editForm.clockOut)}
                            onChange={e => {
                                const date = new Date(e.target.value);
                                if (!isNaN(date.getTime())) {
                                    setEditForm(prev => ({...prev, clockOut: date.toISOString()}));
                                }
                            }}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Lunch Start</label>
                        <input 
                            type="datetime-local"
                            className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                            value={toLocalISO(editForm.lunchStart)}
                            onChange={e => {
                                const date = new Date(e.target.value);
                                if (!isNaN(date.getTime())) {
                                    setEditForm(prev => ({...prev, lunchStart: date.toISOString()}));
                                }
                            }}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Lunch End</label>
                        <input 
                            type="datetime-local"
                            className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                            value={toLocalISO(editForm.lunchEnd)}
                            onChange={e => {
                                const date = new Date(e.target.value);
                                if (!isNaN(date.getTime())) {
                                    setEditForm(prev => ({...prev, lunchEnd: date.toISOString()}));
                                }
                            }}
                        />
                    </div>

                        {editForm.type?.toLowerCase().includes('drive') && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Manual Distance (Mi)</label>
                                    <input 
                                        type="number"
                                        placeholder="Bypass calc with manual miles"
                                        className="w-full px-4 py-2 rounded-xl bg-blue-50/50 border border-blue-100 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-black text-slate-700"
                                        value={editForm.manualDistance || ''}
                                        onChange={e => setEditForm(prev => ({...prev, manualDistance: e.target.value}))}
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Location In</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                                        value={editForm.locationIn || ''}
                                        onChange={e => setEditForm(prev => ({...prev, locationIn: e.target.value}))}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Location Out</label>
                                    <input 
                                        type="text"
                                        className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                                        value={editForm.locationOut || ''}
                                        onChange={e => setEditForm(prev => ({...prev, locationOut: e.target.value}))}
                                    />
                                </div>
                            </>
                        )}
                        
                        {editForm.type?.toLowerCase().includes('site') && (
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Manual Duration (Hrs)</label>
                                <input 
                                    type="number"
                                    step="0.01"
                                    placeholder="Bypass calc with manual hours"
                                    className="w-full px-4 py-2 rounded-xl bg-emerald-50/50 border border-emerald-100 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-black text-slate-700"
                                    value={editForm.manualDuration || ''}
                                    onChange={e => setEditForm(prev => ({...prev, manualDuration: e.target.value}))}
                                />
                            </div>
                        )}

                             <div className="col-span-2 flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                                <input 
                                    type="checkbox"
                                    id="dumpWashout"
                                    className="w-5 h-5 rounded border-slate-300 text-[#0F4C75] focus:ring-[#0F4C75]"
                                    checked={editForm.dumpWashout === true || String(editForm.dumpWashout).toLowerCase() === 'true' || String(editForm.dumpWashout).toLowerCase() === 'yes'}
                                    onChange={e => setEditForm(prev => ({...prev, dumpWashout: e.target.checked}))}
                                />
                                <label htmlFor="dumpWashout" className="text-sm font-bold text-slate-700">Dump / Washout</label>
                            </div>

                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Comments</label>
                        <textarea 
                            rows={3}
                            className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700 resize-none"
                            value={editForm.comments || ''}
                            onChange={e => setEditForm(prev => ({...prev, comments: e.target.value}))}
                        />
                    </div>
                </div>
            </Modal>
            <ConfirmModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Timesheet"
                message="Are you sure you want to delete this timesheet? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
            />

        </div>
    );
}
