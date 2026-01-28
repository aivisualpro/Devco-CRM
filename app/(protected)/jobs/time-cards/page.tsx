'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import {
    ChevronRight, ChevronLeft, ChevronDown, User, Calendar as CalendarIcon,
    MapPin, Truck, Trash2, Edit, RotateCcw, FileText, Clock, RefreshCcw, Plus
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
    rawDistanceVal?: number;
    projectName?: string;
}

interface ScheduleDoc {
    _id: string;
    estimate: string;
    timesheet?: TimesheetEntry[];
    fromDate: string;
    toDate: string;
    item?: string; // Tag field - used to filter out "Day Off" schedules
    // ... other fields
}

// --- Constants ---
import { calculateTimesheetData, formatDateOnly, formatTimeOnly, robustNormalizeISO, SPEED_MPH, EARTH_RADIUS_MI, DRIVING_FACTOR } from '@/lib/timeCardUtils';

// --- Constants ---
const FORMULA_CUTOFF_DATE = new Date('2026-01-12T00:00:00.000Z');

// Week utilities
const getWeekRange = (date: Date = new Date()): { start: Date; end: Date; label: string } => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    
    const start = new Date(d);
    start.setDate(d.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    start.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    const fmt = (dt: Date) => `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
    return { start, end, label: `${fmt(start)} ~ ${fmt(end)}` };
};

const shiftWeek = (current: Date, direction: number): Date => {
    const newDate = new Date(current);
    newDate.setDate(newDate.getDate() + (direction * 7));
    return newDate;
};

const getDayName = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    } catch { return ''; }
};

const toLocalISO = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
        // Assume dateStr is UTC/ISO. We want to display it as is in local time inputs, locally adjusted or just sliced
        if (dateStr.endsWith('Z')) {
             return dateStr.slice(0, 16);
        }
        return new Date(dateStr).toISOString().slice(0, 16);
    } catch { return ''; }
};

const normalizeEst = (val: string | undefined) => {
    if (!val) return '';
    return val.split('-V')[0].split('-v')[0].trim();
};

// --- Helpers ---

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

const getWeekRangeString = (dateObj: Date) => {
    // Use UTC components to ensure consistent week range calculation across timezones
    const dayOfWeek = dateObj.getUTCDay();
    // Get the day of week where Monday = 0, Sunday = 6
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    // Calculate Monday (first day of week) in UTC
    const monday = new Date(dateObj);
    monday.setUTCDate(dateObj.getUTCDate() - daysSinceMonday);
    
    // Calculate Sunday (last day of week) in UTC
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    // Format as MM/DD ~ MM/DD using UTC components
    const fmt = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    return `${fmt(monday)} ~ ${fmt(sunday)}`;
};



// Timezone-agnostic: Parse ISO string directly without Date object conversion
// This preserves the exact date/time values regardless of user's timezone
// const toLocalISO = (iso?: string) => {
//     if (!iso) return "";
//     const normalized = robustNormalizeISO(iso);
//     const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
//     if (match) {
//         return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`;
//     }
//     return "";
// };

// const calculateTimesheetData = (ts: TimesheetEntry, scheduleDate?: string) => {
//     const typeLower = (ts.type || '').toLowerCase();
//     const isDrive = typeLower.includes('drive');

//     // Parse location coordinates for distance calculation
//     const parseLoc = (val: any) => {
//         const str = String(val || '').trim();
//         if (str.includes(',')) {
//             const parts = str.split(',').map(p => parseFloat(p.trim()));
//             if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
//                 return { lat: parts[0], lon: parts[1] };
//             }
//         }
//         return null;
//     };

//     const locIn = parseLoc(ts.locationIn);
//     const locOut = parseLoc(ts.locationOut);
//     let calculatedDistance = 0;
//     if (locIn && locOut) {
//         // Haversine gives straight-line distance; multiply by DRIVING_FACTOR (1.19) for approximate driving distance
//         calculatedDistance = haversine(locIn.lat, locIn.lon, locOut.lat, locOut.lon) * DRIVING_FACTOR;
//     }

//     let distance = 0;
//     let hours = 0;

//     if (isDrive) {
//         // ========== DRIVE TIME CALCULATION ==========
//         // Ignores clock in/out completely
//         // Uses: Manual Distance (priority) OR Calculated Distance + Washout + Shop

//         // Helper to extract qty from "0.50 hrs (2 qty)" format
//         const getQty = (val: any) => {
//             const str = String(val || '');
//             const match = str.match(/\((\d+)\s+qty\)/);
//             if (match) return parseFloat(match[1]);
//             if (val === true || str.toLowerCase() === 'true' || str.toLowerCase() === 'yes') return 1;
//             return 0;
//         };

//         const washoutQty = getQty(ts.dumpWashout);
//         const shopQty = getQty(ts.shopTime);
//         const specialHrs = (washoutQty * 0.5) + (shopQty * 0.25);

//         // Priority 1: Manual Distance (ignores calculated if set)
//         const manualDist = ts.manualDistance ? parseFloat(String(ts.manualDistance)) : 0;
//         if (manualDist > 0) {
//             distance = manualDist;
//         } else {
//             // Priority 2: Calculated Distance from Location In/Out
//             distance = calculatedDistance;
//         }

//         // Manual Hours override
//         const manualHrs = ts.manualDuration ? parseFloat(String(ts.manualDuration)) : 0;
//         if (manualHrs > 0) {
//             hours = manualHrs;
//         } else {
//             // Formula: (Distance / Speed) + Washout Hours + Shop Hours
//             hours = (distance / SPEED_MPH) + specialHrs;
//         }
//     } else {
//         // ========== SITE TIME CALCULATION ==========
//         // Ignores: distance, washout qty, shop qty
//         // Uses: Clock In/Out with optional Manual Duration Override

//         const manualHrs = ts.manualDuration ? parseFloat(String(ts.manualDuration)) : 0;
//         if (manualHrs > 0) {
//             hours = manualHrs;
//         } else {
//             const calcTimeHours = () => {
//                 if (!ts.clockIn || !ts.clockOut) return 0;
                
//                 // Use robust normalization to anchor to UTC Nominal
//                 const startStr = robustNormalizeISO(ts.clockIn);
//                 const endStr = robustNormalizeISO(ts.clockOut);
                
//                 const start = new Date(startStr).getTime();
//                 const end = new Date(endStr).getTime();
//                 let durationMs = end - start;

//                 if (ts.lunchStart && ts.lunchEnd) {
//                     const lStartStr = robustNormalizeISO(ts.lunchStart);
//                     const lEndStr = robustNormalizeISO(ts.lunchEnd);
//                     const lStart = new Date(lStartStr).getTime();
//                     const lEnd = new Date(lEndStr).getTime();
//                     if (lEnd > lStart) durationMs -= (lEnd - lStart);
//                 }
//                 if (durationMs <= 0) return 0;
                
//                 const totalHoursRaw = durationMs / (1000 * 60 * 60);

//                 // Cutoff rounding logic - Ensure UTC comparison
//                 const cutoff2025 = new Date('2025-10-26T00:00:00.000Z');
//                 if (new Date(robustNormalizeISO(ts.clockIn)) < cutoff2025) return totalHoursRaw;
//                 if (totalHoursRaw >= 7.75 && totalHoursRaw < 8.0) return 8.0;

//                 const h = Math.floor(totalHoursRaw);
//                 const m = Math.round((totalHoursRaw - h) * 60);
//                 let roundedM = 0;
//                 if (m > 1 && m <= 14) roundedM = 0;
//                 else if (m > 14 && m <= 29) roundedM = 15;
//                 else if (m > 29 && m <= 44) roundedM = 30;
//                 else if (m > 44 && m <= 59) roundedM = 45;
//                 return h + (roundedM / 60);
//             };
//             hours = calcTimeHours();
//         }
//         // Site time ignores distance
//         distance = 0;
//     }

//     return { hours, distance, calculatedDistance };
// };



// --- Components ---

export default function TimeCardPage() {
    const { success, error: toastError } = useToast();
    const [loading, setLoading] = useState(true);
    const [rawSchedules, setRawSchedules] = useState<ScheduleDoc[]>([]);
    const [employeesMap, setEmployeesMap] = useState<Record<string, any>>({});
    const [estimatesOptions, setEstimatesOptions] = useState<any[]>([]);
    const [employeesOptions, setEmployeesOptions] = useState<any[]>([]);
    
    // Filters
    const [filEmployee, setFilEmployee] = useState('');
    const [filEstimate, setFilEstimate] = useState('');
    const [filType, setFilType] = useState('');

    // Tree Selection
    // nodeType: 'ROOT' | 'YEAR' | 'WEEK' | 'EMPLOYEE' | 'DATE'
    // nodeValue: identifying string (e.g. '2025', '2025-52', '2025-52-email@co.com', 'D-2025-52-email@co.com-01/23/2026')
    const [selectedNode, setSelectedNode] = useState<{ type: string, value: string }>({ type: 'ROOT', value: 'All' });
    const [selectedEmployeeEmail, setSelectedEmployeeEmail] = useState<string>(''); // Track selected employee for Add modal
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [isMobile, setIsMobile] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    
    // Week Selection (Dashboard Style)
    const router = useRouter();
    const searchParams = useSearchParams();

    const [currentWeekDate, setCurrentWeekDate] = useState(() => {
        const week = searchParams.get('week');
        if (week) {
            const d = new Date(week);
            if (!isNaN(d.getTime())) return d;
        }
        return new Date();
    });
    const weekRange = useMemo(() => getWeekRange(currentWeekDate), [currentWeekDate]);

    // Update URL when currentWeekDate changes
    useEffect(() => {
        const dateStr = currentWeekDate.toISOString().split('T')[0];
        const currentWeekParam = searchParams.get('week');
        
        if (dateStr !== currentWeekParam) {
            const params = new URLSearchParams(searchParams.toString());
            params.set('week', dateStr);
            router.replace(`?${params.toString()}`, { scroll: false });
        }
    }, [currentWeekDate, router, searchParams]);

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
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addForm, setAddForm] = useState<Partial<TimesheetEntry>>({});
    const [quickEditingId, setQuickEditingId] = useState<string | null>(null);
    const [quickEditForm, setQuickEditForm] = useState<Partial<TimesheetEntry>>({});

    // Special Field Modal (Washout/Shop)
    const [specialFieldModal, setSpecialFieldModal] = useState<{ ts: TimesheetEntry | null, field: 'dumpWashout' | 'shopTime' | null }>({ ts: null, field: null });
    const [specialQty, setSpecialQty] = useState("1");
    const [isSpecialLoading, setIsSpecialLoading] = useState(false);

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
                    const { hours, distance, calculatedDistance } = calculateTimesheetData(ts as any, sched.fromDate);
                    const scheduleBase = normalizeEst(sched.estimate);
                    const pName = (sched as any).projectName || (sched as any).project || estMap.get(scheduleBase) || '';
                    
                    flat.push({
                        ...ts,
                        scheduleId: sched._id,
                        estimate: sched.estimate,
                        projectName: pName,
                        hoursVal: hours,
                        distanceVal: distance,
                        rawDistanceVal: calculatedDistance
                    });
                });
            }
        });
        return flat.sort((a, b) => new Date(b.clockIn || 0).getTime() - new Date(a.clockIn || 0).getTime());
    }, [rawSchedules, estimatesOptions]);

    // Note: Using the global toLocalISO function defined above (timezone-agnostic)


    // Data Fetching
    const fetchTimeCards = async () => {
        setLoading(true);
        try {
            // Reusing the getSchedulesPage action to get source data + employees
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'getSchedulesPage',
                    payload: { limit: 10000 } // Fetch all schedules (no pagination for time-cards)
                }) 
            });
            const data = await res.json();
            
            if (data.success) {
                setRawSchedules(data.result.schedules || []);
                const emps = data.result.initialData?.employees || [];
                
                // Create map and save options
                const eMap: Record<string, any> = {};
                emps.forEach((e: any) => eMap[e.value] = e);
                setEmployeesMap(eMap);
                setEmployeesOptions(emps);
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
            // Mobile specific filtering: Only show current user's records for the selected week
            if (isMobile) {
                if (currentUser && r.employee !== currentUser.email) return false;
                
                if (r.clockIn) {
                    const recordDate = new Date(r.clockIn);
                    return recordDate >= weekRange.start && recordDate <= weekRange.end;
                }
                return false;
            } else {
                // Desktop filters
                if (filEmployee && r.employee !== filEmployee) return false;
                if (filType && r.type?.trim().toLowerCase() !== filType.trim().toLowerCase()) return false;
            }

            if (filEstimate) {
                const baseRecord = normalizeEst(r.estimate);
                const baseFilter = normalizeEst(filEstimate);
                if (baseRecord !== baseFilter) return false;
            }
            
            return true;
        });
    }, [allRecords, filEmployee, filEstimate, filType, isMobile, currentUser, weekRange]);

    // 2. Build Tree Structure
    const treeData = useMemo(() => {
        const root: any = { years: {} };
        
        filteredRecords.forEach(r => {
            if (!r.clockIn) return;
            // Use robust normalization for consistent parsing
            const dStr = robustNormalizeISO(r.clockIn);
            const d = new Date(dStr);
            if (isNaN(d.getTime())) return;

            const year = d.getUTCFullYear();
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
                    id: `E-${weekKey}-${empKey}`, label: empLabel, email: empKey, totalHours: 0, dates: {}, records: []
                };
            }
            root.years[year].weeks[weekKey].employees[empKey].totalHours += (r.hoursVal || 0);
            root.years[year].weeks[weekKey].employees[empKey].records.push(r);

            // Date Node under Employee
            const dateStr = formatDateOnly(r.clockIn); // MM/DD/YYYY format
            const dateKey = `${empKey}-${dateStr}`;
            if (!root.years[year].weeks[weekKey].employees[empKey].dates[dateKey]) {
                root.years[year].weeks[weekKey].employees[empKey].dates[dateKey] = {
                    id: `D-${weekKey}-${dateKey}`, label: dateStr, totalHours: 0, records: []
                };
            }
            root.years[year].weeks[weekKey].employees[empKey].dates[dateKey].totalHours += (r.hoursVal || 0);
            root.years[year].weeks[weekKey].employees[empKey].dates[dateKey].records.push(r);
        });

        return root;
    }, [filteredRecords, employeesMap]);

    // 3. Filter Table based on Tree Selection
    const tableData = useMemo(() => {
        if (selectedNode.type === 'ROOT') return filteredRecords;
        return filteredRecords.filter(r => {
            if (!r.clockIn) return false;
            const dStr = robustNormalizeISO(r.clockIn);
            const d = new Date(dStr);
            if (isNaN(d.getTime())) return false;
            
            const year = d.getUTCFullYear();
            const weekNo = getWeekNumber(d);
            const weekKey = `${year}-${weekNo}`;

            if (selectedNode.type === 'YEAR') return `Y-${year}` === selectedNode.value;
            if (selectedNode.type === 'WEEK') return `W-${weekKey}` === selectedNode.value;
            if (selectedNode.type === 'EMPLOYEE') return `E-${weekKey}-${r.employee}` === selectedNode.value;
            if (selectedNode.type === 'DATE') {
                const dateStr = formatDateOnly(r.clockIn);
                const dateKey = `${r.employee}-${dateStr}`;
                return `D-${weekKey}-${dateKey}` === selectedNode.value;
            }
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


    const triggerSpecialFieldModal = (ts: TimesheetEntry, field: 'dumpWashout' | 'shopTime') => {
        setSpecialFieldModal({ ts, field });
        // Try to pre-fill qty if it exists
        const existing = String(field === 'dumpWashout' ? ts.dumpWashout : ts.shopTime);
        const match = existing.match(/\((\d+)\s+qty\)/);
        setSpecialQty(match ? match[1] : "1");
    };

    const handleSpecialQtyChange = (val: string) => {
        setSpecialQty(val);
        const { ts, field } = specialFieldModal;
        if (!ts || !field) return;

        const qty = parseFloat(val);
        if (isNaN(qty)) return;

        const multiplier = field === 'dumpWashout' ? 0.5 : 0.25;
        const calculatedValue = `${(qty * multiplier).toFixed(2)} hrs (${qty} qty)`;
        const recordId = ts._id || ts.recordId;

        setRawSchedules(prev => prev.map(s => {
            if (s._id !== ts.scheduleId) return s;
            return {
                ...s,
                timesheet: (s.timesheet || []).map((t: any) => {
                    if ((t._id || t.recordId) === recordId) {
                        return { ...t, [field]: calculatedValue };
                    }
                    return t;
                })
            };
        }));
    };

    const confirmSpecialField = async () => {
        const { ts, field } = specialFieldModal;
        if (!ts || !field) return;

        const qty = parseFloat(specialQty);
        if (isNaN(qty)) return toastError("Please enter a valid numeric quantity");

        setIsSpecialLoading(true);
        const multiplier = field === 'dumpWashout' ? 0.5 : 0.25;
        const calculatedValue = `${(qty * multiplier).toFixed(2)} hrs (${qty} qty)`;

        const originalSchedules = [...rawSchedules];
        const recordId = ts._id || ts.recordId;

        // Optimistic UI
        setRawSchedules(prev => prev.map(s => {
            if (s._id !== ts.scheduleId) return s;
            return {
                ...s,
                timesheet: (s.timesheet || []).map((t: any) => {
                    if ((t._id || t.recordId) === recordId) {
                        return { ...t, [field]: calculatedValue };
                    }
                    return t;
                })
            };
        }));

        try {
            const resGet = await fetch('/api/schedules', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'getScheduleById', payload: { id: ts.scheduleId } })
            });
            const dataGet = await resGet.json();
            if (!dataGet.success) throw new Error("Schedule not found");
            
            const schedule = dataGet.result;
            const updatedTimesheets = (schedule.timesheet || []).map((t: any) => {
                if ((t._id || t.recordId) === recordId) {
                    return { ...t, [field]: calculatedValue };
                }
                return t;
            });
            
            const resSave = await fetch('/api/schedules', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    action: 'updateSchedule', 
                    payload: { id: ts.scheduleId, timesheet: updatedTimesheets }
                })
            });
            
            const saveResult = await resSave.json();
            if (saveResult.success) {
                success(`${field === 'dumpWashout' ? 'Dump Washout' : 'Shop Time'} updated`);
                setSpecialFieldModal({ ts: null, field: null });
            } else {
                throw new Error("Failed to save");
            }
        } catch (e) {
            console.error(e);
            toastError("Failed to update record");
            setRawSchedules(originalSchedules);
        } finally {
            setIsSpecialLoading(false);
        }
    };

    const removeSpecialField = async () => {
        const { ts, field } = specialFieldModal;
        if (!ts || !field) return;

        setIsSpecialLoading(true);
        const originalSchedules = [...rawSchedules];
        const recordId = ts._id || ts.recordId;

        // Optimistic UI - clear the field
        setRawSchedules(prev => prev.map(s => {
            if (s._id !== ts.scheduleId) return s;
            return {
                ...s,
                timesheet: (s.timesheet || []).map((t: any) => {
                    if ((t._id || t.recordId) === recordId) {
                        return { ...t, [field]: '' };
                    }
                    return t;
                })
            };
        }));

        try {
            const resGet = await fetch('/api/schedules', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'getScheduleById', payload: { id: ts.scheduleId } })
            });
            const dataGet = await resGet.json();
            if (!dataGet.success) throw new Error("Schedule not found");
            
            const schedule = dataGet.result;
            const updatedTimesheets = (schedule.timesheet || []).map((t: any) => {
                if ((t._id || t.recordId) === recordId) {
                    return { ...t, [field]: '' };
                }
                return t;
            });
            
            const resSave = await fetch('/api/schedules', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    action: 'updateSchedule', 
                    payload: { id: ts.scheduleId, timesheet: updatedTimesheets }
                })
            });
            
            const saveResult = await resSave.json();
            if (saveResult.success) {
                success(`${field === 'dumpWashout' ? 'Dump Washout' : 'Shop Time'} removed`);
                setSpecialFieldModal({ ts: null, field: null });
            } else {
                throw new Error("Failed to save");
            }
        } catch (e) {
            console.error(e);
            toastError("Failed to remove");
            setRawSchedules(originalSchedules);
        } finally {
            setIsSpecialLoading(false);
        }
    };

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

    const editingCalculated = useMemo(() => {
        if (!editingRecord) return { hours: 0, distance: 0 };
        return calculateTimesheetData(editForm as any, editingRecord.clockIn);
    }, [editForm, editingRecord]);

    const addCalculated = useMemo(() => {
        if (!isAddModalOpen) return { hours: 0, distance: 0 };
        return calculateTimesheetData(addForm as any, addForm.clockIn);
    }, [addForm, isAddModalOpen]);

    const handleEditClick = (ts: TimesheetEntry) => {
        setEditingRecord(ts);
        setEditForm({ ...ts });
    };

    // Live update for Full Edit in background
    useEffect(() => {
        if (!editingRecord) return;
        
        setRawSchedules(prev => prev.map(s => {
            if (s._id !== editForm.scheduleId) return s;
            return {
                ...s,
                timesheet: (s.timesheet || []).map((t: any) => {
                    if ((t._id || t.recordId) === (editingRecord._id || editingRecord.recordId)) {
                        const { hoursVal, distanceVal, rawDistanceVal, projectName, ...rest } = editForm;
                        return { ...t, ...rest };
                    }
                    return t;
                })
            };
        }));
    }, [editForm, editingRecord]);

    const handleSaveEdit = async () => {
        if (!editingRecord || !editForm.scheduleId) return;
        
        const originalSchedules = [...rawSchedules];
        
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
            
            const schedule = dataGet.result as ScheduleDoc;
            const updatedTimesheets = (schedule.timesheet || []).map((t: any) => {
                if ((t._id || t.recordId) === (editingRecord._id || editingRecord.recordId)) {
                    const { hoursVal, distanceVal, rawDistanceVal, projectName, ...rest } = editForm;
                    return { ...t, ...rest } as TimesheetEntry;
                }
                return t as TimesheetEntry;
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
            setRawSchedules(originalSchedules);
        }
    };

    const openAddModal = () => {
        setAddForm({
            type: 'Drive Time',
            employee: selectedEmployeeEmail || '' // Auto-fill employee if selected in tree
        });
        setIsAddModalOpen(true);
    };

    const handleSaveAdd = async () => {
        const isDriveTime = addForm.type === 'Drive Time';
        
        // For Site Time, clockIn is required. For Drive Time, we get date from schedule.
        if (!addForm.employee || !addForm.scheduleId) {
            return toastError("Employee and Schedule are required");
        }
        if (!isDriveTime && !addForm.clockIn) {
            return toastError("Clock In is required for Site Time");
        }
        
        // Find the selected schedule to get its fromDate
        const selectedSchedule = rawSchedules.find(s => s._id === addForm.scheduleId);
        const scheduleFromDate = selectedSchedule?.fromDate;
        
        // For Drive Time, use schedule's fromDate; for Site Time, use provided clockIn
        const recordClockIn = isDriveTime ? (scheduleFromDate || new Date().toISOString()) : (addForm.clockIn as string);
        
        const originalSchedules = [...rawSchedules];
        const newRecord: TimesheetEntry = { 
            ...addForm, 
            _id: 'ts_' + Math.random().toString(36).substr(2, 9),
            employee: addForm.employee as string,
            scheduleId: addForm.scheduleId as string,
            clockIn: recordClockIn,
            createdAt: new Date().toISOString()
        } as TimesheetEntry;

        // Optimistic UI
        setRawSchedules(prev => prev.map(s => {
            if (s._id !== addForm.scheduleId) return s;
            return {
                ...s,
                timesheet: [...(s.timesheet || []), newRecord]
            } as ScheduleDoc;
        }));

        try {
            setIsAddModalOpen(false);
            setAddForm({ type: 'Drive Time' });

            const resGet = await fetch('/api/schedules', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'getScheduleById', payload: { id: addForm.scheduleId } })
            });
            const dataGet = await resGet.json();
            if (!dataGet.success) throw new Error("Schedule not found");
            
            const schedule = dataGet.result;
            const updatedTimesheets = [...(schedule.timesheet || []), newRecord];
            
            const resSave = await fetch('/api/schedules', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    action: 'updateSchedule', 
                    payload: { id: addForm.scheduleId, timesheet: updatedTimesheets }
                })
            });
            
            const saveResult = await resSave.json();
            if (saveResult.success) {
                success("Timesheet created");
            } else {
                throw new Error("Failed to save");
            }
        } catch (e) {
            console.error(e);
            toastError("Failed to create timesheet");
            setRawSchedules(originalSchedules);
        }
    };
    
    const handleQuickEditClick = (ts: TimesheetEntry) => {
        const id = ts._id || ts.recordId || '';
        setQuickEditingId(id);
        setQuickEditForm({ ...ts });
    };

    const handleQuickSave = async () => {
        if (!quickEditForm.scheduleId || !quickEditingId) return;
        
        const originalSchedules = [...rawSchedules];
        const recordId = quickEditingId;
        
        // Optimistic UI Update
        setRawSchedules(prev => prev.map(s => {
            if (s._id !== quickEditForm.scheduleId) return s;
            return {
                ...s,
                timesheet: (s.timesheet || []).map((t: any) => {
                    const tid = t._id || t.recordId;
                    if (tid === recordId) {
                        return { ...t, ...quickEditForm };
                    }
                    return t;
                })
            };
        }));

        try {
            setQuickEditingId(null);

            const resGet = await fetch('/api/schedules', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'getScheduleById', payload: { id: quickEditForm.scheduleId } })
            });
            const dataGet = await resGet.json();
            if (!dataGet.success) throw new Error("Schedule not found");
            
            const schedule = dataGet.result;
            const stats = calculateTimesheetData(quickEditForm as any);

            const updatedTimesheets = (schedule.timesheet || []).map((t: any) => {
                const tid = t._id || t.recordId;
                if (tid === recordId) {
                    const { hoursVal, distanceVal, ...rest } = quickEditForm;
                    return { ...t, ...rest, hours: stats.hours, distance: stats.distance };
                }
                return t;
            });
            
            const resSave = await fetch('/api/schedules', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    action: 'updateSchedule', 
                    payload: { id: quickEditForm.scheduleId, timesheet: updatedTimesheets }
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
            setRawSchedules(originalSchedules);
        }
    };

    const quickEditLiveStats = useMemo(() => {
        if (!quickEditingId) return null;
        return calculateTimesheetData(quickEditForm as any);
    }, [quickEditForm, quickEditingId]);

    const toggleNode = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectNode = (type: string, value: string, employeeEmail?: string) => {
        setSelectedNode({ type, value });
        // Track employee email for auto-fill when adding new records
        if (type === 'EMPLOYEE' || type === 'DATE') {
            setSelectedEmployeeEmail(employeeEmail || '');
        } else {
            setSelectedEmployeeEmail('');
        }
    };

    // Lists for Filters
    const uniqueEmployees = useMemo(() => Array.from(new Set(allRecords.map(r => r.employee))).sort(), [allRecords]);
    
    const uniqueEstimates = useMemo(() => estimatesOptions, [estimatesOptions]);

    const uniqueTypes = ["Drive Time", "Site Time"];

    if (isMobile) {
        return (
            <div className="flex flex-col h-full bg-slate-50">
                    <Header 
                        hideLogo={false}
                        rightContent={
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm border border-slate-200">
                                    <button 
                                        onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, -1))}
                                        className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4 text-slate-600" />
                                    </button>
                                    <div className="flex items-center gap-2 px-2">
                                        <CalendarIcon className="w-4 h-4 text-blue-600" />
                                        <span className="font-semibold text-sm text-slate-800">{weekRange.label}</span>
                                    </div>
                                    <button 
                                        onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, 1))}
                                        className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4 text-slate-600" />
                                    </button>
                                    <button 
                                        onClick={() => setCurrentWeekDate(new Date())}
                                        className="text-xs font-medium text-blue-600 hover:text-blue-700 ml-2"
                                    >
                                        Today
                                    </button>
                                </div>
                            </div>
                        }
                    />
                    <div className="flex-1 overflow-auto p-4">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-hidden">
                             <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-teal-600" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-900">Time Cards</h2>
                                    <p className="text-xs text-slate-500">Your recent activity</p>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHead>
                                        <TableRow className="hover:bg-transparent border-slate-100">
                                            <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center w-[90px]">Date</TableHeader>
                                            <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center w-[50px]">Type</TableHeader>
                                            <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center w-[100px]">Estimate #</TableHeader>
                                            <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center w-[90px]">In</TableHeader>
                                            <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center w-[90px]">Out</TableHeader>
                                            <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-right w-[70px]">Dist (Mi)</TableHeader>
                                            <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-right w-[60px]">Hrs</TableHeader>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredRecords.length > 0 ? filteredRecords.map((ts, idx) => (
                                            <TableRow key={`${ts._id || idx}`} className="hover:bg-slate-50">
                                                <TableCell className="text-center text-[11px] font-medium text-slate-600">
                                                    {formatDateOnly(ts.clockIn)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex justify-center">
                                                        {ts.type?.toLowerCase().includes('drive') ? (
                                                            <div className="p-1 text-blue-600 bg-blue-50 rounded">
                                                                <Truck size={14} />
                                                            </div>
                                                        ) : (
                                                            <div className="p-1 text-emerald-600 bg-emerald-50 rounded">
                                                                <MapPin size={14} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">
                                                        {ts.estimate ? ts.estimate.replace(/-[vV]\d+$/, '') : '-'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {ts.type?.toLowerCase().includes('drive') ? (
                                                        ts.dumpWashout ? (
                                                            <span className="text-[9px] font-black uppercase bg-orange-500 text-white px-2 py-0.5 rounded shadow-sm">
                                                                Washout
                                                                {String(ts.dumpWashout).includes('qty') && ' ✓'}
                                                            </span>
                                                        ) : <span className="text-slate-300">-</span>
                                                    ) : (
                                                        <span className="text-[10px] font-medium text-slate-600">
                                                            {formatTimeOnly(ts.clockIn)}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {ts.type?.toLowerCase().includes('drive') ? (
                                                        ts.shopTime ? (
                                                            <span className="text-[9px] font-black uppercase bg-blue-500 text-white px-2 py-0.5 rounded shadow-sm">
                                                                Shop
                                                                {String(ts.shopTime).includes('qty') && ' ✓'}
                                                            </span>
                                                        ) : <span className="text-slate-300">-</span>
                                                    ) : (
                                                        <span className="text-[10px] font-medium text-slate-600">
                                                            {formatTimeOnly(ts.clockOut)}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-[11px] font-medium text-slate-600">
                                                    {(ts.distanceVal || 0) > 0 ? (ts.distanceVal || 0).toFixed(1) : '-'}
                                                </TableCell>
                                                <TableCell className="text-right text-[11px] font-black text-slate-800">
                                                    {(ts.hoursVal || 0).toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-400">
                                                    No time cards found for this week
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Desktop View */}
            <Header 
                hideLogo={false}
                rightContent={
                <div className="flex items-center gap-4">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button 
                                            onClick={openAddModal}
                                            className="w-10 h-10 flex items-center justify-center bg-[#0F4C75] text-white rounded-xl shadow-lg hover:shadow-xl hover:bg-[#0b3c5d] transition-all active:scale-95"
                                        >
                                            <Plus size={20} />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Add Timecard Record</p>
                                    </TooltipContent>
                                </Tooltip>
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


            <main className="flex-1 min-h-0 flex flex-col max-w-[1920px] w-full mx-auto overflow-hidden p-4">
                    <div className="flex-1 flex gap-4 min-h-0">
                    
                    {/* Left Sidebar - Tree View */}
                    <div className="w-[230px] bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col overflow-hidden shrink-0">
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
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                     <button 
                                                                        onClick={(e) => toggleNode(week.id, e)}
                                                                        className="p-1 hover:bg-black/5 rounded text-slate-400 shrink-0"
                                                                     >
                                                                        {isWeekExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                                    </button>
                                                                    <span className="text-[10px] font-bold whitespace-nowrap truncate">{week.label}</span>
                                                                </div>
                                                                <span className="text-[9px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 shrink-0 ml-1">
                                                                    {week.totalHours.toFixed(2)}
                                                                </span>
                                                            </div>

                                                            {/* Employees */}
                                                            {isWeekExpanded && (
                                                                <div className="pl-6 mt-1 space-y-0.5 border-l border-slate-200 ml-2">
                                                                    {Object.values(week.employees).sort((a: any, b: any) => a.label.localeCompare(b.label)).map((emp: any) => {
                                                                        const isEmpExpanded = expandedNodes.has(emp.id);
                                                                        const isEmpSelected = selectedNode.value === emp.id;
                                                                        
                                                                        return (
                                                                            <div key={emp.id}>
                                                                                <div 
                                                                                    onClick={() => selectNode('EMPLOYEE', emp.id, emp.email)}
                                                                                    className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-colors
                                                                                        ${isEmpSelected ? 'bg-[#0F4C75] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}
                                                                                    `}
                                                                                >
                                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                                        <button 
                                                                                            onClick={(e) => toggleNode(emp.id, e)}
                                                                                            className={`p-0.5 hover:bg-black/5 rounded shrink-0 ${isEmpSelected ? 'text-white/70' : 'text-slate-400'}`}
                                                                                        >
                                                                                            {isEmpExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                                                                        </button>
                                                                                        <User size={12} className={isEmpSelected ? 'text-white' : 'text-slate-400'} />
                                                                                        <span className="text-[11px] font-bold truncate">{emp.label}</span>
                                                                                    </div>
                                                                                    <span className={`text-[9px] font-mono font-bold px-1.5 rounded ${isEmpSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                                                        {emp.totalHours.toFixed(2)}
                                                                                    </span>
                                                                                </div>
                                                                                
                                                                                {/* Dates under Employee */}
                                                                                {isEmpExpanded && (
                                                                                    <div className="pl-6 mt-1 space-y-0.5 border-l border-slate-100 ml-2">
                                                                                        {Object.values(emp.dates).sort((a: any, b: any) => {
                                                                                            // Sort dates descending (newest first)
                                                                                            const dateA = new Date(a.label.split('/').reverse().join('-'));
                                                                                            const dateB = new Date(b.label.split('/').reverse().join('-'));
                                                                                            return dateB.getTime() - dateA.getTime();
                                                                                        }).map((dateNode: any) => {
                                                                                            const isDateSelected = selectedNode.value === dateNode.id;
                                                                                            return (
                                                                                                <div 
                                                                                                    key={dateNode.id}
                                                                                                    onClick={() => selectNode('DATE', dateNode.id, emp.email)}
                                                                                                    className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-colors
                                                                                                        ${isDateSelected ? 'bg-green-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}
                                                                                                    `}
                                                                                                >
                                                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                                                        <CalendarIcon size={10} className={isDateSelected ? 'text-white' : 'text-slate-300'} />
                                                                                                        <span className="text-[10px] font-bold">{dateNode.label}</span>
                                                                                                    </div>
                                                                                                    <span className={`text-[8px] font-mono font-bold px-1 rounded ${isDateSelected ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400'}`}>
                                                                                                        {dateNode.totalHours.toFixed(2)}
                                                                                                    </span>
                                                                                                </div>
                                                                                            );
                                                                                        })}
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
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Content - Table */}
                    <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col relative z-20">
                        <div className="px-4 py-1 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-3xl relative z-30">
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
                                         options={uniqueEmployees.map(e => ({
                                             label: employeesMap[e]?.label || e || '', 
                                             value: e,
                                             image: employeesMap[e]?.image,
                                             initials: employeesMap[e]?.initials
                                         }))}
                                         className="w-[180px]"
                                         size="sm"
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
                                         className="w-[260px]"
                                         size="sm"
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
                                         className="w-[160px]"
                                         align="right"
                                         size="sm"
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
                                        <TableHeader className="text-[9px] uppercase font-bold text-slate-400 w-[160px] text-left">Employee</TableHeader>
                                        <TableHeader className="text-[9px] uppercase font-bold text-slate-400 text-center w-[100px]">Date</TableHeader>
                                        <TableHeader className="text-[9px] uppercase font-bold text-slate-400 text-center w-[70px]">Type</TableHeader>
                                        <TableHeader className="text-[9px] uppercase font-bold text-slate-400 text-center w-[110px]">Estimate #</TableHeader>
                                        <TableHeader className="text-[9px] uppercase font-bold text-slate-400 text-center w-[120px]">In</TableHeader>
                                        <TableHeader className="text-[9px] uppercase font-bold text-slate-400 text-center w-[120px]">Out</TableHeader>
                                        <TableHeader className="text-[9px] uppercase font-bold text-slate-400 text-right w-[90px]">Dist (Mi)</TableHeader>
                                        <TableHeader className="text-[9px] uppercase font-bold text-slate-400 text-right w-[70px]">Hrs</TableHeader>
                                        <TableHeader className="text-[9px] uppercase font-bold text-slate-400 text-right w-[110px]">Actions</TableHeader>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {paginatedData.length > 0 ? paginatedData.map((ts, idx) => {
                                        const recordId = ts._id || ts.recordId;
                                        const isQuickEditing = quickEditingId === recordId;

                                        return (
                                            <TableRow key={`${ts._id || 'ts'}-${idx}-${ts.clockIn}`} className={`group hover:bg-[#F1F5F9] transition-all cursor-default ${isQuickEditing ? 'bg-orange-50/50' : ''}`}>
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
                                                        <span className="text-[11px] font-medium text-slate-600">{employeesMap[ts.employee]?.label || ts.employee}</span>
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
                                                <TableCell className="text-center">
                                                    <span className="text-[10px] font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 uppercase tracking-tighter">
                                                        {ts.estimate || '-'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center text-xs text-slate-500">
                                                    {ts.type?.toLowerCase().includes('drive') ? (
                                                        <div className="flex flex-col items-center">
                                                            <button 
                                                                onClick={() => triggerSpecialFieldModal(ts, 'dumpWashout')}
                                                                className={`px-2 py-1 rounded text-[9px] font-black uppercase transition-all shadow-sm flex flex-col items-center min-w-[70px] ${
                                                                    ts.dumpWashout ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                                }`}
                                                            >
                                                                <span>{ts.dumpWashout ? 'Washout ✓' : 'Washout'}</span>
                                                                {ts.dumpWashout && (
                                                                    <span className="text-[7px] leading-tight opacity-90">
                                                                        {String(ts.dumpWashout).match(/\((\d+)\s+qty\)/)?.[1] || ''} Qty
                                                                    </span>
                                                                )}
                                                            </button>
                                                        </div>
                                                    ) : isQuickEditing ? (
                                                        <div className="px-1">
                                                            <input 
                                                                type="time"
                                                                className="w-full px-2 py-1.5 bg-white border-2 border-[#0F4C75]/20 focus:border-[#0F4C75] focus:ring-4 focus:ring-[#0F4C75]/5 rounded-xl text-[10px] font-medium text-[#0F4C75] transition-all outline-none shadow-inner"
                                                                value={quickEditForm.clockIn ? toLocalISO(quickEditForm.clockIn).split('T')[1] : ''}
                                                                onChange={e => {
                                                                    const timeVal = e.target.value;
                                                                    const currentIso = toLocalISO(quickEditForm.clockIn || '');
                                                                    const datePart = currentIso.split('T')[0];
                                                                    setQuickEditForm(prev => ({...prev, clockIn: `${datePart}T${timeVal}:00.000Z`}));
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] font-medium text-slate-600 tracking-tight">{formatTimeOnly(ts.clockIn)}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center text-xs text-slate-500">
                                                    {ts.type?.toLowerCase().includes('drive') ? (
                                                        <div className="flex flex-col items-center">
                                                            <button 
                                                                onClick={() => triggerSpecialFieldModal(ts, 'shopTime')}
                                                                className={`px-2 py-1 rounded text-[9px] font-black uppercase transition-all shadow-sm flex flex-col items-center min-w-[70px] ${
                                                                    ts.shopTime ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                                }`}
                                                            >
                                                                <span>{ts.shopTime ? 'Shop ✓' : 'Shop'}</span>
                                                                {ts.shopTime && (
                                                                    <span className="text-[7px] leading-tight opacity-90">
                                                                        {String(ts.shopTime).match(/\((\d+)\s+qty\)/)?.[1] || ''} Qty
                                                                    </span>
                                                                )}
                                                            </button>
                                                        </div>
                                                    ) : isQuickEditing ? (
                                                        <div className="px-1">
                                                            <input 
                                                                type="time"
                                                                className="w-full px-2 py-1.5 bg-white border-2 border-[#0F4C75]/20 focus:border-[#0F4C75] focus:ring-4 focus:ring-[#0F4C75]/5 rounded-xl text-[10px] font-medium text-[#0F4C75] transition-all outline-none shadow-inner"
                                                                value={quickEditForm.clockOut ? toLocalISO(quickEditForm.clockOut).split('T')[1] : ''}
                                                                onChange={e => {
                                                                    const timeVal = e.target.value;
                                                                    const currentIso = toLocalISO(quickEditForm.clockOut || quickEditForm.clockIn || '');
                                                                    const datePart = currentIso.split('T')[0];
                                                                    setQuickEditForm(prev => ({...prev, clockOut: `${datePart}T${timeVal}:00.000Z`}));
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] font-medium text-slate-600 tracking-tight">{formatTimeOnly(ts.clockOut)}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right text-xs font-medium text-slate-500">
                                                    {isQuickEditing && ts.type?.toLowerCase().includes('drive') ? (
                                                        <input 
                                                            type="number"
                                                            className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold w-16 text-right"
                                                            value={quickEditForm.manualDistance || ''}
                                                            onChange={e => setQuickEditForm(prev => ({...prev, manualDistance: e.target.value}))}
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-end">
                                                            <span className={ts.manualDistance ? "text-orange-600 font-bold" : ""}>
                                                                {((ts.distanceVal || 0) > 0 ? (ts.distanceVal || 0).toFixed(1) : '-')}
                                                            </span>
                                                            {ts.manualDistance && (
                                                                <span className="text-[9px] text-slate-300 font-medium leading-none">
                                                                    {((ts as any).rawDistanceVal || 0).toFixed(1)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className={`text-right text-xs font-black ${isQuickEditing ? 'text-orange-600 underline decoration-orange-300' : 'text-slate-700'}`}>
                                                    {isQuickEditing ? (quickEditLiveStats?.hours || 0).toFixed(2) : (ts.hoursVal || 0).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {isQuickEditing ? (
                                                        <div className="flex justify-end gap-1">
                                                            <button 
                                                                onClick={handleQuickSave}
                                                                className="px-2 py-1 bg-green-500 text-white rounded text-[10px] font-bold hover:bg-green-600 shadow-sm transition-all"
                                                            >
                                                                Save
                                                            </button>
                                                            <button 
                                                                onClick={() => setQuickEditingId(null)}
                                                                className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-[10px] font-bold hover:bg-slate-300 transition-all font-black"
                                                            >
                                                                X
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end gap-1">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button 
                                                                        onClick={() => handleQuickEditClick(ts)}
                                                                        className="p-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg shadow-sm transition-all flex items-center gap-1"
                                                                    >
                                                                        <Edit size={12} />
                                                                        <span className="text-[10px] font-black uppercase">Quick</span>
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>Quick Adjust Times & Miles</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button 
                                                                        onClick={() => handleEditClick(ts)}
                                                                        className="p-1.5 hover:bg-white text-slate-400 hover:text-[#0F4C75] rounded-lg shadow-sm hover:shadow transition-all"
                                                                    >
                                                                        <FileText size={12} />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>Full Edit</p>
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
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }) : (
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
        </main>

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
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-2">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Select Employee</label>
                        <SearchableSelect 
                            options={employeesOptions}
                            value={editForm.employee || ''}
                            onChange={(val) => setEditForm(prev => ({...prev, employee: val}))}
                            placeholder="Search & Select Employee"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Estimate #</label>
                        <SearchableSelect 
                            options={estimatesOptions}
                            value={editForm.estimate || ''}
                            onChange={(val) => {
                                setEditForm(prev => ({
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
                                        label: `${formatDateOnly(s.fromDate)} ${getDayName(s.fromDate)}`,
                                        estimate: s.estimate
                                    }));
                            })()}
                            value={editForm.scheduleId || ''}
                            onChange={(val) => setEditForm(prev => ({...prev, scheduleId: val}))}
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
                                    onClick={() => setEditForm(prev => ({...prev, type: t}))}
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
                                        const val = e.target.value;
                                        if (val) {
                                            setEditForm(prev => ({...prev, clockIn: val + ':00.000Z'}));
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
                                        const val = e.target.value;
                                        if (val) {
                                            setEditForm(prev => ({...prev, lunchStart: val + ':00.000Z'}));
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
                                        const val = e.target.value;
                                        if (val) {
                                            setEditForm(prev => ({...prev, lunchEnd: val + ':00.000Z'}));
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
                                        const val = e.target.value;
                                        if (val) {
                                            setEditForm(prev => ({...prev, clockOut: val + ':00.000Z'}));
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
                                        onChange={e => setEditForm(prev => ({...prev, manualDistance: e.target.value}))}
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
                                        onChange={e => setEditForm(prev => ({...prev, locationIn: e.target.value}))}
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
                                        onChange={e => setEditForm(prev => ({...prev, locationOut: e.target.value}))}
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
                                            return match?.[1] || (editForm.dumpWashout === true || String(editForm.dumpWashout).toLowerCase() === 'true' || String(editForm.dumpWashout).toLowerCase() === 'yes' ? "1" : "");
                                        })()}
                                        onChange={e => {
                                            const qty = parseFloat(e.target.value);
                                            if (isNaN(qty) || qty <= 0) {
                                                setEditForm(prev => ({...prev, dumpWashout: ""}));
                                            } else {
                                                const val = `${(qty * 0.5).toFixed(2)} hrs (${qty} qty)`;
                                                setEditForm(prev => ({...prev, dumpWashout: val}));
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
                                            return match?.[1] || (editForm.shopTime === true || String(editForm.shopTime).toLowerCase() === 'true' || String(editForm.shopTime).toLowerCase() === 'yes' ? "1" : "");
                                        })()}
                                        onChange={e => {
                                            const qty = parseFloat(e.target.value);
                                            if (isNaN(qty) || qty <= 0) {
                                                setEditForm(prev => ({...prev, shopTime: ""}));
                                            } else {
                                                const val = `${(qty * 0.25).toFixed(2)} hrs (${qty} qty)`;
                                                setEditForm(prev => ({...prev, shopTime: val}));
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
                            onChange={e => setEditForm(prev => ({...prev, comments: e.target.value}))}
                        />
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="Add Timecard Record"
                maxWidth="2xl"
                noBlur={true}
                footer={
                    <>
                        <button 
                            onClick={() => setIsAddModalOpen(false)}
                            className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-bold text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveAdd}
                            className="px-6 py-2 rounded-xl bg-[#0F4C75] text-white font-bold text-sm shadow-lg hover:shadow-xl hover:bg-[#0b3c5d] transition-all"
                        >
                            Create Record
                        </button>
                    </>
                }
            >
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-2">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Select Employee</label>
                        <SearchableSelect 
                            options={employeesOptions}
                            value={addForm.employee || ''}
                            onChange={(val) => setAddForm(prev => ({...prev, employee: val}))}
                            placeholder="Search & Select Employee"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Estimate #</label>
                        <SearchableSelect 
                            options={estimatesOptions}
                            value={addForm.estimate || ''}
                            onChange={(val) => {
                                const opt = estimatesOptions.find(o => o.value === val);
                                setAddForm(prev => ({
                                    ...prev, 
                                    estimate: val,
                                    scheduleId: '' // Reset schedule when estimate changes
                                }));
                            }}
                            placeholder="Select Estimate"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Schedule Date</label>
                        <SearchableSelect 
                            options={(() => {
                                if (!addForm.estimate) return [];
                                const estNorm = normalizeEst(addForm.estimate);
                                return rawSchedules
                                    .filter(s => normalizeEst(s.estimate) === estNorm && s.item !== 'Day Off')
                                    .sort((a, b) => new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime())
                                    .map(s => ({
                                        value: s._id,
                                        label: `${formatDateOnly(s.fromDate)} ${getDayName(s.fromDate)}`,
                                        estimate: s.estimate
                                    }));
                            })()}
                            value={addForm.scheduleId || ''}
                            onChange={(val) => {
                                const sched = rawSchedules.find(s => s._id === val);
                                if (sched && addForm.type?.trim().toLowerCase() === 'site time') {
                                    const clockIn = robustNormalizeISO(sched.fromDate);
                                    const clockOut = robustNormalizeISO(sched.toDate || sched.fromDate);
                                    const datePart = clockIn.split('T')[0];
                                    setAddForm(prev => ({
                                        ...prev,
                                        scheduleId: val,
                                        clockIn: clockIn,
                                        clockOut: clockOut,
                                        lunchStart: `${datePart}T12:00:00.000Z`,
                                        lunchEnd: `${datePart}T12:30:00.000Z`
                                    }));
                                } else {
                                    setAddForm(prev => ({...prev, scheduleId: val}));
                                }
                            }}
                            placeholder={addForm.estimate ? "Select Schedule Date" : "Select Estimate First"}
                        />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Entry Type</label>
                        <div className="flex gap-3">
                            {['Drive Time', 'Site Time'].map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => {
                                        const isSiteTime = t.trim().toLowerCase() === 'site time';
                                        if (isSiteTime && addForm.scheduleId) {
                                            const sched = rawSchedules.find(s => s._id === addForm.scheduleId);
                                            if (sched) {
                                                const clockIn = robustNormalizeISO(sched.fromDate);
                                                const clockOut = robustNormalizeISO(sched.toDate || sched.fromDate);
                                                const datePart = clockIn.split('T')[0];
                                                setAddForm(prev => ({
                                                    ...prev,
                                                    type: t,
                                                    clockIn: clockIn,
                                                    clockOut: clockOut,
                                                    lunchStart: `${datePart}T12:00:00.000Z`,
                                                    lunchEnd: `${datePart}T12:30:00.000Z`
                                                }));
                                                return;
                                            }
                                        }
                                        setAddForm(prev => ({...prev, type: t}));
                                    }}
                                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all border-2 ${
                                        addForm.type?.trim().toLowerCase() === t.trim().toLowerCase() 
                                        ? 'bg-[#0F4C75] border-[#0F4C75] text-white shadow-lg' 
                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>


                    {addForm.type?.trim().toLowerCase() !== 'drive time' && (
                        <>
                            {/* Row 4: Clock In and Lunch Start */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Clock In</label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                                    value={toLocalISO(addForm.clockIn)}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val) {
                                            // Split by T to get date parts without Date object conversion
                                            const parts = val.split('T');
                                            if (parts.length === 2) {
                                                const datePart = parts[0];
                                                const timePart = parts[1];
                                                const [hour] = timePart.split(':').map(Number);
                                                
                                                // Auto-fill: Clock Out = Clock In + 7 hours (manual string manipulation)
                                                const clockOutHour = String((hour + 7) % 24).padStart(2, '0');
                                                const clockOutVal = `${datePart}T${clockOutHour}:${timePart.split(':')[1]}:00.000Z`;
                                                
                                                // Default lunch: 12:00 PM to 12:30 PM on same day
                                                const lunchStartVal = `${datePart}T12:00:00.000Z`;
                                                const lunchEndVal = `${datePart}T12:30:00.000Z`;
                                                
                                                setAddForm(prev => ({
                                                    ...prev,
                                                    clockIn: val + ':00.000Z',
                                                    clockOut: clockOutVal,
                                                    lunchStart: lunchStartVal,
                                                    lunchEnd: lunchEndVal
                                                }));
                                            }
                                        }
                                    }}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Lunch Start</label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                                    value={toLocalISO(addForm.lunchStart)}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val) {
                                            setAddForm(prev => ({...prev, lunchStart: val + ':00.000Z'}));
                                        }
                                    }}
                                />
                            </div>

                            {/* Row 5: Lunch End and Clock Out */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Lunch End</label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                                    value={toLocalISO(addForm.lunchEnd)}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val) {
                                            setAddForm(prev => ({...prev, lunchEnd: val + ':00.000Z'}));
                                        }
                                    }}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Clock Out</label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                                    value={toLocalISO(addForm.clockOut)}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val) {
                                            setAddForm(prev => ({...prev, clockOut: val + ':00.000Z'}));
                                        }
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {addForm.type?.trim().toLowerCase() === 'drive time' && (
                        <>
                            <div className="col-span-2 grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Distance (Mi)</label>
                                    <input 
                                        type="number"
                                        placeholder="Manual"
                                        className="w-full px-4 py-3 rounded-xl bg-blue-50/50 border border-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                                        value={addForm.manualDistance || ''}
                                        onChange={e => setAddForm(prev => ({...prev, manualDistance: e.target.value}))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Location In</label>
                                    <input 
                                        type="text"
                                        placeholder="Start loc"
                                        disabled={!!addForm.manualDistance}
                                        className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700 ${
                                            addForm.manualDistance ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200'
                                        }`}
                                        value={addForm.locationIn || ''}
                                        onChange={e => setAddForm(prev => ({...prev, locationIn: e.target.value}))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Location Out</label>
                                    <input 
                                        type="text"
                                        placeholder="End loc"
                                        disabled={!!addForm.manualDistance}
                                        className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700 ${
                                            addForm.manualDistance ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200'
                                        }`}
                                        value={addForm.locationOut || ''}
                                        onChange={e => setAddForm(prev => ({...prev, locationOut: e.target.value}))}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {addForm.type?.trim().toLowerCase() === 'drive time' && (
                        <div className="col-span-2 grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-100">
                                <label className="block text-[10px] font-black text-orange-400 uppercase mb-1 tracking-widest pl-1">Washout Qty</label>
                                <input 
                                    type="number"
                                    className="w-full px-2 py-1.5 rounded-lg bg-white border border-orange-200 font-black text-slate-700 text-sm"
                                    placeholder="0"
                                    onChange={e => {
                                        const qty = parseFloat(e.target.value);
                                        if (isNaN(qty) || qty <= 0) {
                                            setAddForm(prev => ({...prev, dumpWashout: ""}));
                                        } else {
                                            const val = `${(qty * 0.5).toFixed(2)} hrs (${qty} qty)`;
                                            setAddForm(prev => ({...prev, dumpWashout: val}));
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
                                    onChange={e => {
                                        const qty = parseFloat(e.target.value);
                                        if (isNaN(qty) || qty <= 0) {
                                            setAddForm(prev => ({...prev, shopTime: ""}));
                                        } else {
                                            const val = `${(qty * 0.25).toFixed(2)} hrs (${qty} qty)`;
                                            setAddForm(prev => ({...prev, shopTime: val}));
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    )}


                    <div className="col-span-2 flex items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl mt-4 relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-white tabular-nums tracking-tighter">{addCalculated.hours.toFixed(2)}</span>
                                <span className="text-xl font-bold text-slate-600">HRS</span>
                            </div>
                        </div>
                        {addForm.type === 'Drive Time' && (
                            <div className="relative z-10 text-right">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Distance</p>
                                <div className="flex items-baseline gap-1 justify-end">
                                    <span className="text-3xl font-black text-blue-400 tabular-nums tracking-tighter">{addCalculated.distance.toFixed(1)}</span>
                                    <span className="text-sm font-bold text-slate-600">MI</span>
                                </div>
                            </div>
                        )}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#0F4C75]/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={!!specialFieldModal.ts && !!specialFieldModal.field}
                onClose={() => setSpecialFieldModal({ ts: null, field: null })}
                title={`Enter Quantity: ${specialFieldModal.field === 'dumpWashout' ? 'Dump Washout' : 'Shop Time'}`}
                maxWidth="sm"
                noBlur={true}
                footer={
                    <div className="flex items-center justify-between w-full">
                        <button 
                            onClick={removeSpecialField}
                            disabled={isSpecialLoading}
                            className="px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold text-sm transition-all disabled:opacity-50"
                        >
                            {isSpecialLoading ? 'Removing...' : 'Remove'}
                        </button>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setSpecialFieldModal({ ts: null, field: null })}
                                className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-bold text-sm"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmSpecialField}
                                disabled={isSpecialLoading}
                                className="px-6 py-2 rounded-xl bg-[#0F4C75] text-white font-bold text-sm shadow-lg hover:shadow-xl hover:bg-[#0b3c5d] transition-all disabled:opacity-50"
                            >
                                {isSpecialLoading ? 'Saving...' : 'Save Quantity'}
                            </button>
                        </div>
                    </div>
                }
            >
                <div className="space-y-3 py-2">
                    <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-600 leading-tight font-bold">
                            {specialFieldModal.field === 'dumpWashout' 
                                ? "Washout adds 0.50 hrs."
                                : "Shop adds 0.25 hrs."
                            }
                        </p>
                    </div>
                    
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest px-1">Quantity</label>
                        <input 
                            type="number"
                            autoFocus
                            className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-4 focus:ring-[#0F4C75]/10 focus:border-[#0F4C75] text-lg font-black text-slate-800 transition-all shadow-inner"
                            placeholder="0"
                            value={specialQty}
                            onChange={e => handleSpecialQtyChange(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') confirmSpecialField(); }}
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
