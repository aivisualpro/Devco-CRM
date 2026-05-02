'use client';

import { useEffect, useState, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Plus, Trash2, Edit, Calendar as CalendarIcon, User, Search,
    Upload, Download, Filter, MoreHorizontal,
    ChevronRight, Clock, MapPin, Briefcase, Phone,
    CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronDown, ChevronUp, Bell, ArrowLeft, Users, Import, ClipboardList, FilePlus, Loader2, X, FileSpreadsheet, FileText, PlusSquare, Shield, ShieldCheck, FileCheck, Timer, ClockCheck, Mail, Car, StopCircle, Circle, Droplets, Warehouse, RefreshCcw, Copy, ChevronsLeft, ChevronsRight
} from 'lucide-react';

import SignaturePad from './SignaturePad';

import {
    Header, AddButton, Card, SearchInput, Table, TableHead,
    TableBody, TableRow, TableHeader, TableCell, Pagination,
    EmptyState, Loading, Modal, ConfirmModal, Badge,
    SkeletonTable, SearchableSelect, BadgeTabs, MyDropDown,
    Tooltip, TooltipTrigger, TooltipContent, UploadButton
} from '@/components/ui';
import { JHAModal } from './components/JHAModal';
import { DJTModal } from './components/DJTModal';
import { ChangeOfScopeModal } from './components/ChangeOfScopeModal';
import { TimesheetModal } from './components/TimesheetModal';
import { DriveMapModal } from './components/DriveMapModal';
import { ScheduleCard, ScheduleItem } from './components/ScheduleCard';
import { EstimateChat } from '@/components/ui/EstimateChat';
import { useToast } from '@/hooks/useToast';
import { useAddShortcut } from '@/hooks/useAddShortcut';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentUser } from '@/lib/context/AppContext';
import { MODULES } from '@/lib/permissions/types';
import { useScheduleFilters } from '@/hooks/useScheduleFilters';
import { FilterItem } from './components/FilterItem';
import {
    formatLocalDate,
    formatLocalDateTime,
    extractTimeFromDateTime,
    combineCurrentDateWithTime,
    formatToReadableDateTime,
    formatTimeOnly,
    getDayName,
    addOneDay,
    toLocalISO,
    deg2rad,
    getDistanceFromLatLonInMiles,
    isCoord,
    isLight,
    getWorkDays,
    getDaysInMonth,
    getCurrentWeekDates,
    getLocalNowISO
} from '@/lib/scheduleUtils';
import { calculateTimesheetData } from '@/lib/timeCardUtils';
import { formatWallDate, formatWallTime, formatWallDateTime } from '@/lib/format/date';

interface Objective {
    text: string;
    completed: boolean;
    completedBy?: string;
    completedAt?: string;
}

// ScheduleItem interface imported from components/ScheduleCard

function SchedulesTable({ serverData }: { serverData?: any }) {
    const router = useRouter();
    const { success, error: toastError } = useToast();
    const { user, getDataScope: getScope, isSuperAdmin } = usePermissions();
    // Users with 'self' scope for schedules can only create Day Off schedules
    const isEmployeeScope = !isSuperAdmin && getScope(MODULES.SCHEDULES) === 'self';

    // Map Modal State
    const [mapModalOpen, setMapModalOpen] = useState(false);
    const [selectedMapRoute, setSelectedMapRoute] = useState<{ start?: string, end?: string, distance?: number }>({});
    const [schedules, setSchedules] = useState<ScheduleItem[]>(serverData?.schedules || []);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    // Initialize selectedDates with all days of the current week (Sunday to Saturday)
    // Initialize selectedDates with all days of the current week (Monday to Sunday)
    const [selectedDates, setSelectedDates] = useState<string[]>(() => {
        const today = new Date();
        const startOfWeek = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        const dayOfWeek = startOfWeek.getUTCDay(); // 0 = Sunday, 1 = Monday
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setUTCDate(startOfWeek.getUTCDate() + diff); // Go back to Monday

        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setUTCDate(startOfWeek.getUTCDate() + i);
            const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
            dates.push(dateStr);
        }
        return dates;
    });
    const [activeDayTab, setActiveDayTab] = useState<string>('all');
    const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(serverData?.totalPages || 1);
    const [totalCount, setTotalCount] = useState(serverData?.total || 0);
    const [serverCounts, setServerCounts] = useState<Record<string, number>>(() => {
        if (serverData?.counts) {
            const countsMap: Record<string, number> = {};
            serverData.counts.forEach((c: any) => countsMap[c._id] = c.count);
            return countsMap;
        }
        return {};
    });
    const [serverCapacity, setServerCapacity] = useState(serverData?.capacity || 0);
    // Initialize filterWeek with current week value (matching selectedDates initialization)
    const [filterWeek, setFilterWeek] = useState(() => {
        const today = new Date();
        const startOfWeek = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        const dayOfWeek = startOfWeek.getUTCDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startOfWeek.setUTCDate(startOfWeek.getUTCDate() + diff);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
        const startStr = `${startOfWeek.getUTCFullYear()}-${String(startOfWeek.getUTCMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getUTCDate()).padStart(2, '0')}`;
        const endStr = `${endOfWeek.getUTCFullYear()}-${String(endOfWeek.getUTCMonth() + 1).padStart(2, '0')}-${String(endOfWeek.getUTCDate()).padStart(2, '0')}`;
        return `${startStr}|${endStr}`;
    });

    // Scroll Spy Logic
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [visibleScrollDay, setVisibleScrollDay] = useState<string>('all');

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const stickyHeaderHeight = 60;
            const containerRect = container.getBoundingClientRect();
            const cards = Array.from(container.querySelectorAll('[data-day]'));

            for (const card of cards) {
                const rect = card.getBoundingClientRect();
                if (rect.bottom > containerRect.top + stickyHeaderHeight + 10) {
                    const day = card.getAttribute('data-day');
                    if (day) setVisibleScrollDay(day);
                    break;
                }
            }
        };
        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [schedules]);
    const [hasMore, setHasMore] = useState(serverData ? 1 < serverData.totalPages : true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<ScheduleItem> | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Action Confirmation State
    const [actionConfirm, setActionConfirm] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText: string;
        variant: 'danger' | 'primary' | 'dark';
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        variant: 'primary',
        onConfirm: () => { }
    });


    // JHA Modal State
    const [jhaModalOpen, setJhaModalOpen] = useState(false);
    const [selectedJHA, setSelectedJHA] = useState<any>(null);
    const [isJhaEditMode, setIsJhaEditMode] = useState(false);
    const [djtModalOpen, setDjtModalOpen] = useState(false);
    const [selectedDJT, setSelectedDJT] = useState<any>(null);
    const [isDjtEditMode, setIsDjtEditMode] = useState(false);
    const [changeOfScopeModalOpen, setChangeOfScopeModalOpen] = useState(false);
    const [selectedScopeSchedule, setSelectedScopeSchedule] = useState<ScheduleItem | null>(null);
    const [activeSignatureEmployee, setActiveSignatureEmployee] = useState<string | null>(null);
    const [isGeneratingJHAPDF, setIsGeneratingJHAPDF] = useState(false);
    const [isGeneratingDJTPDF, setIsGeneratingDJTPDF] = useState(false);
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [isSavingSignature, setIsSavingSignature] = useState(false);

    // Filter States
    const [filterEstimate, setFilterEstimate] = useState('');
    const [filterClient, setFilterClient] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterService, setFilterService] = useState('');
    const [filterTag, setFilterTag] = useState('');
    const [filterCertifiedPayroll, setFilterCertifiedPayroll] = useState('');
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

    const currentUser = useCurrentUser();

    // Timesheet Individual Modal State
    const [timesheetModalOpen, setTimesheetModalOpen] = useState(false);
    const [selectedTimesheet, setSelectedTimesheet] = useState<any>(null);
    const [isTimesheetEditMode, setIsTimesheetEditMode] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; tsId: string | null }>({
        isOpen: false,
        tsId: null
    });

    // Timesheet Edit Modal State (same as time-cards page)
    const [editingTimesheet, setEditingTimesheet] = useState<any>(null);
    const [editTimesheetForm, setEditTimesheetForm] = useState<any>({});

    // Calendar & Activity State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [monthlyActivityDates, setMonthlyActivityDates] = useState<Set<string>>(new Set());



    const clearFilters = () => {
        setSearch('');
        // Clear all filters including dates - show all schedules
        setSelectedDates([]);
        setFilterWeek(''); // Clear week dropdown
        setFilterEstimate('');
        setFilterClient('');
        setFilterEmployee('');
        setFilterService('');
        setFilterTag('');
        setFilterCertifiedPayroll('');
    };

    // Mobile filters visibility
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    // Mobile detail sheet visibility
    const [showMobileDetail, setShowMobileDetail] = useState(false);
    // Right panel tab state
    const [detailActiveTab, setDetailActiveTab] = useState<'aerial' | 'planning' | 'timecard' | 'chat' | 'pothole' | 'prebore'>('aerial');
    // Pothole & PreBore logs state for detail panel
    const [detailPotholeLogs, setDetailPotholeLogs] = useState<any[]>([]);
    const [detailPotholeLoading, setDetailPotholeLoading] = useState(false);
    const [detailPreboreLogs, setDetailPreboreLogs] = useState<any[]>([]);
    const [detailPreboreLoading, setDetailPreboreLoading] = useState(false);
    // Mobile search visibility
    const [showMobileSearch, setShowMobileSearch] = useState(false);

    // Media Modal State
    const [mediaModal, setMediaModal] = useState<{ isOpen: boolean; type: 'image' | 'map'; url: string; title: string }>({
        isOpen: false,
        type: 'image',
        url: '',
        title: ''
    });

    // Day Off Stats State
    const [dayOffStats, setDayOffStats] = useState<any[]>([]);

    const fetchDayOffStats = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const future = new Date(today);
            future.setFullYear(today.getFullYear() + 5);

            const payload = {
                page: 1,
                limit: 1000,
                startDate: today.toISOString(),
                endDate: future.toISOString(),
                filters: { tag: 'Day Off' },
                skipInitialData: true
            };

            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getSchedulesPage', payload })
            });
            const data = await res.json();
            
            if (data.success && data.result) {
                setDayOffStats(data.result.schedules || []);
            }
        } catch (error) {
            console.error("Failed to fetch day off stats", error);
        }
    };

    useEffect(() => {
        fetchDayOffStats();
    }, []);

    const [initialData, setInitialData] = useState<{
        clients: any[];
        employees: any[];
        constants: any[];
        estimates: any[];
        equipmentItems: any[];
    }>(() => {
        if (serverData?.initialData) {
            return serverData.initialData;
        }
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('devco_schedules_initial_data_v2');
            if (cached) {
                try {
                    return JSON.parse(cached);
                } catch (e) {}
            }
        }
        return { clients: [], employees: [], constants: [], estimates: [], equipmentItems: [] };
    });

    const searchInputRef = useRef<HTMLInputElement>(null);
    const INCREMENT = 20;

    const openCreateModal = () => {
        // Create default times as strings directly - NO Date object to avoid timezone issues
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

        // Default: 7:00 AM to 3:30 PM (Typical shift) - stored as plain strings
        const fromDate = `${year}-${month}-${day}T07:00`;
        const toDate = `${year}-${month}-${day}T15:30`;

        setEditingItem({
            fromDate: fromDate,
            toDate: toDate,
            assignees: [],
            notifyAssignees: 'No',
            perDiem: 'No',
            title: isEmployeeScope ? 'Day Off' : '', // Employees default to Day Off
            ...(isEmployeeScope ? { item: 'Day Off' } : {}), // Employees locked to Day Off tag
        });
        setIsModalOpen(true);
    };

    useAddShortcut(openCreateModal);


    const fetchPageData = async (pageNum = 1, reset = false) => {
        if (reset) {
            setLoading(true);
            setSchedules([]);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const payload = {
                page: pageNum,
                limit: 100,
                search,
                filters: {
                    estimate: filterEstimate,
                    client: filterClient,
                    employee: filterEmployee,
                    service: filterService,
                    tag: filterTag,
                    certifiedPayroll: filterCertifiedPayroll
                },
                selectedDates: selectedDates,
                skipInitialData: !reset
            };

            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getSchedulesPage', payload })
            });
            const data = await res.json();

            if (data.success && data.result) {
                const result = data.result;
                const newSchedules = result.schedules || [];
                
                if (reset) {
                    setSchedules(newSchedules);
                    
                    setSelectedSchedule(prev => {
                        if (!prev) return null;
                        const updated = newSchedules.find((s: any) => s._id === prev._id);
                        return updated || prev;
                    });
                    
                    if (result.initialData) {
                        setInitialData(result.initialData);
                        try {
                            localStorage.setItem('devco_schedules_initial_data_v2', JSON.stringify(result.initialData));
                        } catch (e) {
                            console.warn('Failed to cache initialData to localStorage', e);
                        }
                    }
                    if (result.counts) {
                        const countsMap: Record<string, number> = {};
                        result.counts.forEach((c: any) => countsMap[c._id] = c.count);
                        setServerCounts(countsMap);
                    }
                    setServerCapacity(result.capacity || 0);
                } else {
                    setSchedules(prev => {
                        const existingIds = new Set(prev.map(s => s._id));
                        const uniqueNew = newSchedules.filter((s: any) => !existingIds.has(s._id));
                        return [...prev, ...uniqueNew];
                    });
                    
                    setSelectedSchedule(prev => {
                        if (!prev) return null;
                        const updated = newSchedules.find((s: any) => s._id === prev._id);
                        return updated || prev;
                    });
                }

                setTotalCount(result.total || 0);
                setTotalPages(result.totalPages || 1);
                setHasMore(pageNum < (result.totalPages || 1));
            }
        } catch (err) {
            console.error(err);
            toastError('Failed to fetch schedules');
        } finally {
            setLoading(false);
            setIsLoadingMore(false);
        }
    };

    // Skip initial fetch since it's handled server-side, but fetch if filters change
    const isInitialMount = useRef(true);
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (!currentUser) return;
        setPage(1);
        fetchPageData(1, true);
    }, [search, selectedDates, filterEstimate, filterClient, filterEmployee, filterService, filterTag, filterCertifiedPayroll, currentUser]);

    // Synchronize selectedSchedule with schedules to ensure right panel immediately updates
    useEffect(() => {
        if (selectedSchedule) {
            const updated = schedules.find((s: any) => s._id === selectedSchedule._id);
            if (updated && updated !== selectedSchedule) {
                setSelectedSchedule(updated);
            }
        }
    }, [schedules, selectedSchedule]);

    const handleLoadMore = () => {
        if (!hasMore || isLoadingMore || loading) return;
        const nextPage = page + 1;
        setPage(nextPage);
        fetchPageData(nextPage, false);
    };

    const getCustomerName = (schedule: ScheduleItem) => {
        if (schedule.customerName && schedule.customerName !== 'Client') return schedule.customerName;
        if (schedule.customerId) {
            const client = initialData.clients.find(c => String(c._id) === String(schedule.customerId) || String(c.recordId) === String(schedule.customerId));
            return client ? client.name : 'Client';
        }
        return 'Client';
    };

    // formatLocalDate is imported from lib/scheduleUtils.ts
    // formatLocalDateTime is imported from lib/scheduleUtils.ts

    const weekOptions = useMemo(() => {
        const options = [];
        const today = new Date();
        const currentYear = today.getFullYear();

        // Start Jan 1 UTC
        let d = new Date(Date.UTC(currentYear, 0, 1));
        const day = d.getUTCDay();
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday start
        d.setUTCDate(diff);

        for (let i = 0; i < 54; i++) {
            const start = new Date(d);
            const end = new Date(d);
            end.setUTCDate(end.getUTCDate() + 6);

            // Format: MM/DD/YY to MM/DD/YY
            const weekNum = String(i + 1).padStart(2, '0');
            const sM = String(start.getUTCMonth() + 1).padStart(2, '0');
            const sD = String(start.getUTCDate()).padStart(2, '0');
            const sY = String(start.getUTCFullYear()).slice(-2);

            const eM = String(end.getUTCMonth() + 1).padStart(2, '0');
            const eD = String(end.getUTCDate()).padStart(2, '0');
            const eY = String(end.getUTCFullYear()).slice(-2);

            const label = `${sM}/${sD}/${sY} to ${eM}/${eD}/${eY}`;
            const val = `${formatLocalDate(start)}|${formatLocalDate(end)}`;

            // Check if today falls in this week range using date strings to avoid timezone issues
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const startStr2 = formatLocalDate(start);
            const endStr2 = formatLocalDate(end);
            const isCurrent = todayStr >= startStr2 && todayStr <= endStr2;

            if (isCurrent) {
                // Highlighting with color and label
                options.push({ label: `${label} (Current)`, value: val, color: '#10B981', badge: weekNum });
            } else {
                options.push({ label, value: val, badge: weekNum });
            }
            d.setUTCDate(d.getUTCDate() + 7);
        }
        return options;
    }, []);

    // extractTimeFromDateTime, combineCurrentDateWithTime, formatToReadableDateTime 
    // are imported from lib/scheduleUtils.ts

    const scheduledDatesRaw = useMemo(() => {
        const dates = new Set(monthlyActivityDates);
        // Also include loaded schedules just in case (e.g. recent updates locally)
        schedules.forEach(s => {
            try { dates.add(formatLocalDate(s.fromDate)); } catch { }
        });
        return dates;
    }, [schedules, monthlyActivityDates]);

    // Fetch monthly activity when month/year changes
    useEffect(() => {
        const fetchMonthActivity = async () => {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            const start = new Date(Date.UTC(year, month, 1)).toISOString();
            const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59)).toISOString();

            try {
                const res = await fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'getScheduleActivity',
                        payload: {
                            start,
                            end
                        }
                    })
                });
                const data = await res.json();
                if (data.success && Array.isArray(data.result)) {
                    const dates = new Set<string>();
                    data.result.forEach((s: any) => {
                        try { dates.add(formatLocalDate(s.fromDate)); } catch { }
                    });
                    setMonthlyActivityDates(dates);
                }
            } catch (e) {
                console.error("Failed to fetch monthly activity", e);
            }
        };

        if (currentUser) {
            fetchMonthActivity();
        }
    }, [currentDate, currentUser]);

    // getDayName is imported from lib/scheduleUtils.ts

    // Generate day tabs based on selected dates
    const dayTabs = useMemo(() => {
        const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const daysInSelection = new Set<string>();

        selectedDates.forEach(dateStr => {
            daysInSelection.add(getDayName(dateStr));
        });

        // Count schedules per day
        // Count schedules per day - NOTE: This is now only for LOADED items, unless we aggregate on server.
        // For "All", we use server total. For others, we rely on local (imperfect but better than nothing for infinite scroll)
        const scheduleCounts: Record<string, number> = { all: totalCount };
        dayOrder.forEach(d => scheduleCounts[d] = 0);

        if (Object.keys(serverCounts).length > 0) {
            Object.entries(serverCounts).forEach(([dateStr, count]) => {
                const dayName = getDayName(dateStr);
                if (scheduleCounts[dayName] !== undefined) scheduleCounts[dayName] += count;
            });
        } else {
            schedules.forEach(s => {
                const scheduleDate = formatLocalDate(s.fromDate);
                if (selectedDates.length === 0 || selectedDates.includes(scheduleDate)) {
                    const matchesSearch =
                        s.title?.toLowerCase().includes(search.toLowerCase()) ||
                        getCustomerName(s).toLowerCase().includes(search.toLowerCase()) ||
                        s.estimate?.toLowerCase().includes(search.toLowerCase()) ||
                        s.jobLocation?.toLowerCase().includes(search.toLowerCase());
                    if (matchesSearch) {
                        const dayName = getDayName(scheduleDate);
                        scheduleCounts[dayName]++;
                    }
                }
            });
        }

        const tabs = [{ id: 'all', label: 'All', count: scheduleCounts.all }];
        dayOrder.forEach(day => {
            if (daysInSelection.has(day)) {
                tabs.push({ id: day, label: day, count: scheduleCounts[day] });
            }
        });

        return tabs;
    }, [selectedDates, schedules, search]);

    const filteredSchedules = useMemo(() => {
        return schedules.filter(s => {
            const scheduleDate = formatLocalDate(s.fromDate);
            if (activeDayTab === 'all') return true;
            return getDayName(scheduleDate) === activeDayTab;
        }).sort((a, b) => {
            const dateDiff = new Date(a.fromDate).getTime() - new Date(b.fromDate).getTime();
            if (dateDiff !== 0) return dateDiff;
            return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        });
    }, [schedules, activeDayTab]);

    const searchParams = useSearchParams();

    // Handle deep linking from Dashboard or URLs
    useEffect(() => {
        const id = searchParams.get('id');
        const edit = searchParams.get('edit');
        const jha = searchParams.get('jha');
        const djt = searchParams.get('djt');
        const timesheet = searchParams.get('timesheet');

        if (id && schedules.length > 0) {
            const item = schedules.find(s => s._id === id);
            if (item) {
                // Select the item
                setSelectedSchedule(item);

                // Open specific modals if requested
                if (edit === 'true') {
                    setEditingItem(item);
                    setIsModalOpen(true);
                } else if (jha === 'true') {
                    // Fetch JHA from standalone collection (authoritative source)
                    fetch('/api/jha', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'getJHA', payload: { schedule_id: item._id } })
                    }).then(res => res.json()).then(data => {
                        if (data.success && data.jha) {
                            const jhaData = data.jha;
                            setSelectedJHA({
                                ...jhaData,
                                schedule_id: item._id,
                            });
                            setIsJhaEditMode(false);
                            setJhaModalOpen(true);
                        }
                    });
                } else if (djt === 'true') {
                    // Fetch DJT from standalone collection (authoritative source)
                    fetch('/api/djt', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'getDJT', payload: { schedule_id: item._id } })
                    }).then(res => res.json()).then(data => {
                        if (data.success && data.result) {
                            const djtData = data.result;
                            setSelectedDJT({
                                ...djtData,
                                schedule_id: item._id,
                            });
                            setIsDjtEditMode(false);
                            setDjtModalOpen(true);
                        }
                    });
                } else if (timesheet === 'true') {
                    setEditingItem(item);
                    setTimesheetModalOpen?.(true);
                }
            }
        }
    }, [searchParams, schedules]);


    // FilterItem component is now imported from ./components/FilterItem

    const displayedSchedules = filteredSchedules; // No slicing, display all loaded (which are paginated)

    const quickStats = useMemo(() => {
        let jhas = 0;
        let djts = 0;
        let driveHours = 0;
        let siteHours = 0;
        let jobs = 0;
        let off = 0;

        filteredSchedules.forEach(s => {
            if (s.item === 'Day Off' || ((s as any).tag && (s as any).tag === 'Day Off')) {
                off++;
            } else {
                jobs++;
            }

            if (s.hasJHA) jhas++;
            if (s.hasDJT || (s.djt && Object.keys(s.djt).length > 0)) djts++;
            
            if (s.timesheet && Array.isArray(s.timesheet)) {
                s.timesheet.forEach(ts => {
                    const stats = calculateTimesheetData(ts, s.fromDate);
                    if (ts.type && ts.type.toLowerCase().includes('drive')) {
                        driveHours += stats.hours || 0;
                    } else {
                        siteHours += stats.hours || 0;
                    }
                });
            }
        });

        return { jhas, djts, driveHours, siteHours, jobs, off };
    }, [filteredSchedules]);

    // Check for any active drive time across ALL schedules for the current user
    // Active = clockOut is not set (undefined/null/empty) - meaning still in progress
    const globalActiveDriveTime = useMemo(() => {
        if (!currentUser?.email) return null;
        for (const schedule of schedules) {
            const activeTs = (schedule.timesheet || []).find((ts: any) => {
                if (ts.employee !== currentUser.email) return false;
                if (ts.type !== 'Drive Time') return false;

                // Check if clockOut is NOT set (active drive time)
                // clockOut must be undefined, null, or empty string to be considered active
                const clockOutValue = ts.clockOut;
                const isActive = clockOutValue === undefined ||
                    clockOutValue === null ||
                    clockOutValue === '' ||
                    (typeof clockOutValue === 'string' && clockOutValue.trim() === '');

                return isActive;
            });
            if (activeTs) {
                return { ...activeTs, scheduleTitle: schedule.title, scheduleId: schedule._id };
            }
        }
        return null;
    }, [schedules, currentUser]);




    const handleToggleObjective = async (scheduleId: string, index: number, currentStatus: boolean) => {
        // Find existing schedule
        const schedule = schedules.find(s => s._id === scheduleId);
        if (!schedule) return;

        // Clone deeply to avoid mutation issues
        const updatedObjectives = schedule.todayObjectives ? [...schedule.todayObjectives] : [];
        if (!updatedObjectives[index]) return;

        // Update object
        const updatedObj = typeof updatedObjectives[index] === 'string'
            ? { text: updatedObjectives[index] as string, completed: !currentStatus }
            : { ...updatedObjectives[index], completed: !currentStatus };

        // Add metadata if completing
        if (!currentStatus) { // If marking as complete
            updatedObj.completedBy = user?.email || 'Unknown';
            updatedObj.completedAt = new Date().toISOString();
        } else {
            updatedObj.completedBy = undefined;
            updatedObj.completedAt = undefined;
        }

        updatedObjectives[index] = updatedObj;

        // Optimistic update locally
        setSchedules(prev => prev.map(s => s._id === scheduleId ? { ...s, todayObjectives: updatedObjectives } : s));
        if (selectedSchedule?._id === scheduleId) {
            setSelectedSchedule(prev => prev ? { ...prev, todayObjectives: updatedObjectives } : null);
        }

        // Send to API
        try {
            const payload = {
                action: 'updateSchedule',
                payload: {
                    ...schedule,
                    todayObjectives: updatedObjectives
                }
            };
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                success('Objective updated');
            } else {
                throw new Error(data.error || 'Failed to update');
            }
        } catch (err) {
            console.error(err);
            toastError("Failed to update objective");
            // Revert on error could be implemented here
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate all mandatory fields - conditional based on tag
        const isDayOff = editingItem?.item === 'Day Off';

        // Base required fields (always required)
        const baseRequiredFields = [
            { key: 'item', label: 'Tag', id: 'schedTag' },
            { key: 'fromDate', label: 'From Date', id: 'schedFromDate' },
            { key: 'toDate', label: 'To Date', id: 'schedToDate' },
        ];

        // Additional fields required for non-Day Off schedules
        const additionalRequiredFields = [
            { key: 'customerId', label: 'Client', id: 'schedClient' },
            { key: 'title', label: 'Title', id: 'schedTitle' },
            { key: 'projectManager', label: 'Project Manager', id: 'schedPM' },
            { key: 'foremanName', label: 'Foreman', id: 'schedForeman' },
            { key: 'description', label: 'Scope of Work', id: 'schedDesc' },
            { key: 'service', label: 'Service', id: 'schedService' },
            { key: 'notifyAssignees', label: 'Notify Assignees', id: 'schedNotify' },
            { key: 'perDiem', label: 'Per Diem', id: 'schedPerDiem' },
            { key: 'fringe', label: 'Fringe', id: 'schedFringe' },
            { key: 'certifiedPayroll', label: 'Certified Payroll', id: 'schedCP' }
        ];

        // Combine fields based on whether it's a Day Off
        const requiredFields = isDayOff ? baseRequiredFields : [...baseRequiredFields, ...additionalRequiredFields];

        for (const field of requiredFields) {
            if (!(editingItem as any)?.[field.key]) {
                toastError(`${field.label} is required`);

                // Scroll to and focus the missing field
                const el = document.getElementById(field.id);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.focus();
                }
                return;
            }
        }



        // If updating, just update the single schedule
        if (editingItem?._id) {
            // Optimistic Update
            setIsModalOpen(false);
            setEditingItem(null);

            // Helper to format date as local ISO string (no timezone conversion)
            const toLocalISOString = (d: string | undefined): string => {
                if (!d) return '';
                // Input strings from type="datetime-local" look like "YYYY-MM-DDTHH:mm"
                // If it already has Z, keep it. If not, add Z to anchor it to UTC (Nominal Time).
                return d.includes('Z') ? d : `${d}:00Z`;
            };

            const prevSchedules = [...schedules];
            const updatedSchedule = {
                ...editingItem,
                fromDate: toLocalISOString(editingItem.fromDate),
                toDate: toLocalISOString(editingItem.toDate)
            };

            setSchedules(prev => prev.map(s => s._id === updatedSchedule._id ? { ...s, ...updatedSchedule } : s));
            if (selectedSchedule?._id === updatedSchedule._id) {
                setSelectedSchedule(prev => prev ? { ...prev, ...updatedSchedule } : null);
            }

            // Optimistically update serverCounts if date changed
            const originalSchedule = schedules.find(s => s._id === updatedSchedule._id);
            if (originalSchedule && originalSchedule.fromDate !== updatedSchedule.fromDate) {
                setServerCounts(prev => {
                    const newCounts = { ...prev };
                    const oldStr = typeof originalSchedule.fromDate === 'string' ? originalSchedule.fromDate.split('T')[0] : new Date(originalSchedule.fromDate).toISOString().split('T')[0];
                    const newStr = updatedSchedule.fromDate.split('T')[0];
                    if (newCounts[oldStr]) newCounts[oldStr] = Math.max(0, newCounts[oldStr] - 1);
                    newCounts[newStr] = (newCounts[newStr] || 0) + 1;
                    return newCounts;
                });
            }

            // Also update dayOffStats optimistically if it's a Day Off
            if (updatedSchedule.item === 'Day Off') {
                setDayOffStats(prev => prev.map(s => s._id === updatedSchedule._id ? { ...s, ...updatedSchedule } : s));
            }

            // Background Fetch
            fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateSchedule', payload: { id: updatedSchedule._id, ...updatedSchedule } })
            }).then(res => res.json()).then(data => {
                if (data.success) {
                    success('Schedule updated');
                    // Optional: Update with server result if needed (e.g. timestamps)
                    // setSchedules(prev => prev.map(s => s._id === updatedSchedule._id ? { ...s, ...data.result } : s));
                } else {
                    toastError(data.error || 'Failed to update schedule');
                    // Revert? For now just error is enough as user will see it didn't persist on reload if they care
                    setSchedules(prevSchedules);
                }
            }).catch(err => {
                console.error(err);
                toastError('Error updating schedule');
                setSchedules(prevSchedules);
            });
            return;
        }

        // For new schedules, create one per day in the range
        const originalFrom = new Date(editingItem?.fromDate || new Date());
        const originalTo = new Date(editingItem?.toDate || new Date());

        // Use midnight-normalized dates for the loop counter to ensure correct number of days
        const loopStart = new Date(originalFrom);
        loopStart.setHours(0, 0, 0, 0);
        const loopEnd = new Date(originalTo);
        loopEnd.setHours(0, 0, 0, 0);

        const schedulesToCreate: any[] = [];
        const currentDate = new Date(loopStart);

        while (currentDate <= loopEnd) {
            // Reconstruct the specific date-time for this day
            // We use the year/month/date from the loop, but keep the original user-selected time
            const thisDayFrom = new Date(currentDate);
            thisDayFrom.setHours(originalFrom.getHours(), originalFrom.getMinutes(), 0, 0);

            const thisDayTo = new Date(currentDate);
            thisDayTo.setHours(originalTo.getHours(), originalTo.getMinutes(), 0, 0);

            // Helper to format date as local ISO string (no timezone conversion)
            const toLocalISOString = (d: Date) => {
                const pad = (n: number) => n < 10 ? '0' + n : n;
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00Z`;
            };

            // Generate MongoDB-compatible ObjectId (24 hex characters)
            const objectIdHex = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

            schedulesToCreate.push({
                ...editingItem,
                _id: objectIdHex,
                fromDate: toLocalISOString(thisDayFrom), // Store as local time string
                toDate: toLocalISOString(thisDayTo) // Store as local time string
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        // Optimistic Create
        setIsModalOpen(false);
        setEditingItem(null);

        const prevSchedules = [...schedules];
        setSchedules(prev => [...schedulesToCreate, ...prev]);
        setTotalCount((prev: number) => prev + schedulesToCreate.length);

        setServerCounts(prev => {
            const newCounts = { ...prev };
            schedulesToCreate.forEach(s => {
                const dStr = typeof s.fromDate === 'string' ? s.fromDate.split('T')[0] : new Date(s.fromDate).toISOString().split('T')[0];
                newCounts[dStr] = (newCounts[dStr] || 0) + 1;
            });
            return newCounts;
        });

        // Also update dayOffStats optimistically
        if (isDayOff) {
            setDayOffStats(prev => [...schedulesToCreate, ...prev].sort((a, b) => {
                const dateDiff = new Date(a.fromDate).getTime() - new Date(b.fromDate).getTime();
                if (dateDiff !== 0) return dateDiff;
                return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
            }));
        }

        // Background Fetch
        fetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'importSchedules', payload: { schedules: schedulesToCreate } })
        }).then(res => res.json()).then(data => {
            if (data.success) {
                success(`Created ${schedulesToCreate.length} schedule${schedulesToCreate.length > 1 ? 's' : ''}`);
            } else {
                toastError(data.error || 'Failed to create schedules');
                setSchedules(prevSchedules);
            }
        }).catch(err => {
            console.error(err);
            toastError('Error creating schedules');
            setSchedules(prevSchedules);
        });
    };

    const handleDelete = async () => {
        if (!deleteId) return;

        // Optimistic Delete
        const prevSchedules = [...schedules];
        const idToDelete = deleteId;

        setIsConfirmOpen(false);
        setDeleteId(null);
        setSchedules(prev => prev.filter(s => s._id !== idToDelete));
        setTotalCount((prev: number) => Math.max(0, prev - 1));

        const scheduleToDelete = schedules.find(s => s._id === idToDelete);
        if (scheduleToDelete) {
            setServerCounts(prev => {
                const newCounts = { ...prev };
                const dStr = typeof scheduleToDelete.fromDate === 'string' ? scheduleToDelete.fromDate.split('T')[0] : new Date(scheduleToDelete.fromDate).toISOString().split('T')[0];
                if (newCounts[dStr]) newCounts[dStr] = Math.max(0, newCounts[dStr] - 1);
                return newCounts;
            });
        }

        fetch('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'deleteSchedule', payload: { id: idToDelete } })
        }).then(res => res.json()).then(data => {
            if (data.success) {
                success('Schedule deleted');
            } else {
                toastError(data.error || 'Failed to delete schedule');
                setSchedules(prevSchedules);
            }
        }).catch(err => {
            console.error(err);
            toastError('Error deleting schedule');
            setSchedules(prevSchedules);
        });
    };

    const handleResendEmail = async (item: any) => {
        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resendEmail', payload: { id: item._id } })
            });
            const data = await res.json();
            if (data.success) {
                success(data.message || 'Email resent successfully');
            } else {
                toastError(data.error || 'Failed to resend email');
            }
        } catch (err) {
            console.error(err);
            toastError('Error resending email');
        }
    };







    // Close details on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedSchedule) {
                setSelectedSchedule(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedSchedule]);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'UTC'
            });
        } catch (e) {
            return dateStr;
        }
    };


    const [viewType, setViewType] = useState<'calendar' | 'timeline'>('calendar');


    const toggleDate = (day: number) => {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        // Adjust for timezone offset to ensure "2024-05-01" remains "2024-05-01" when converted to ISO
        // Actually best to just construct the string manually to avoid timezone shifts
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${d}`;

        setSelectedDates(prev => prev.includes(dateStr)
            ? prev.filter(d => d !== dateStr)
            : [...prev, dateStr]
        );
    };

    // Local getDaysInMonth with simpler signature (returns number | null array) for calendar UI
    const getDaysInMonth = (date: Date): (number | null)[] => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const offset = firstDay === 0 ? 6 : firstDay - 1;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days: (number | null)[] = [];
        for (let i = 0; i < offset; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);
        return days;
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];



    const handleSaveJHAForm = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Include schedule_id and ensure createdBy in the payload
            const userEmail = currentUser?.email || null;
            const payload = {
                ...selectedJHA,
                schedule_id: selectedJHA.schedule_id || selectedJHA._id, // Ensure link backing
                createdBy: selectedJHA.createdBy || userEmail || 'system'
            };

            const res = await fetch('/api/jha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveJHA', payload })
            });
            const data = await res.json();
            if (data.success) {
                success('JHA Saved Successfully');
                // Immediately update local state so the icon changes
                const scheduleId = payload.schedule_id;
                setSchedules(prev => prev.map(s => 
                    s._id === scheduleId ? { ...s, hasJHA: true } : s
                ));
                if (data.result) {
                    setSelectedJHA((prev: any) => ({ ...prev, ...data.result }));
                }
                setIsJhaEditMode(false);
                // Also refetch to ensure consistency
                fetchPageData();
            } else {
                toastError(data.error || 'Failed to save JHA');
            }
        } catch (error) {
            console.error(error);
            toastError('Error saving JHA');
        }
    };

    const handleSaveDJTForm = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const userEmail = currentUser?.email || null;
            const payload = {
                ...selectedDJT,
                schedule_id: selectedDJT.schedule_id || selectedDJT._id,
                createdBy: selectedDJT.createdBy || userEmail || 'system'
            };

            const res = await fetch('/api/djt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveDJT', payload })
            });
            const data = await res.json();
            if (data.success) {
                success('Daily Job Ticket Saved Successfully');
                const updatedDJT = data.result;
                // Update local state immediately
                setSchedules((prev: any[]) => prev.map((s: any) =>
                    s._id === payload.schedule_id
                        ? { ...s, djt: updatedDJT, hasDJT: true }
                        : s
                ));
                setIsDjtEditMode(false);
                // Also update selectedDJT to reflect newest data in modal
                setSelectedDJT((prev: any) => ({ ...prev, ...updatedDJT }));
                fetchPageData(); // Still fetch to be safe/sync other data
            } else {
                toastError(data.error || 'Failed to save DJT');
            }
        } catch (error) {
            console.error(error);
            toastError('Error saving DJT');
        }
    };

    const handleDownloadJhaPdf = async () => {
        if (!selectedJHA) return;
        setIsGeneratingJHAPDF(true);
        try {
            const templateId = '164zwSdl2631kZ4mRUVtzWhg5oewL0wy6RVCgPQig258';

            // Build variables from selectedJHA and its parent schedule
            const schedule = schedules.find(s => s._id === selectedJHA.schedule_id) || selectedJHA.scheduleRef;

            // Find matching estimate for contact info - match by estimate number (value field)
            const estimate = initialData.estimates.find((e: any) => {
                const estNum = e.value || e.estimate || e.estimateNum;
                return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
            });

            // Find matching client for customer name
            const client = initialData.clients.find(c => c._id === schedule?.customerId || c.name === schedule?.customerName);

            // Combine fields
            const variables: Record<string, any> = {
                ...selectedJHA,
                // Customer name from clients collection
                customerId: client?.name || schedule?.customerName || '',
                // Contact info from estimate (contact field stores name like "Danny Escobar")
                contactName: estimate?.contactName || estimate?.contact || '',
                contactPhone: estimate?.contactPhone || estimate?.phone || '',
                // Job address from estimate
                jobAddress: estimate?.jobAddress || schedule?.jobLocation || '',
                // Estimate number from parent schedule
                estimate: schedule?.estimate || '',
                estimateNum: schedule?.estimate || '',
                // Other schedule info
                customerName: schedule?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                foremanName: schedule?.foremanName || '',
                projectName: estimate?.projectTitle || estimate?.projectName || '',
                date: selectedJHA.date ? formatWallDate(selectedJHA.date) : '',
                day: new Date(selectedJHA.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
            };

            // Convert booleans to "✔️" for checkboxes in the template
            const booleanFields = [
                'operatingMiniEx', 'operatingAVacuumTruck', 'excavatingTrenching', 'acConcWork',
                'operatingBackhoe', 'workingInATrench', 'trafficControl', 'roadWork', 'operatingHdd',
                'confinedSpace', 'settingUgBoxes', 'otherDailyWork', 'sidewalks', 'heatAwareness',
                'ladderWork', 'overheadLifting', 'materialHandling', 'roadHazards', 'heavyLifting',
                'highNoise', 'pinchPoints', 'sharpObjects', 'trippingHazards', 'otherJobsiteHazards',
                'stagingAreaDiscussed', 'rescueProceduresDiscussed', 'evacuationRoutesDiscussed',
                'emergencyContactNumberWillBe911', 'firstAidAndCPREquipmentOnsite', 'closestHospitalDiscussed'
            ];
            booleanFields.forEach(f => {
                if (variables[f] === true || variables[f] === 'TRUE' || variables[f] === 'Yes' || variables[f] === '1') {
                    variables[f] = '✔️';
                } else {
                    variables[f] = '';
                }
            });

            // Prepare multiple signatures (Clear slots up to 15)
            for (let i = 1; i <= 15; i++) {
                variables[`sig_name_${i}`] = '';
                variables[`sig_img_${i}`] = '';
                variables[`Print Name_${i}`] = '';
                variables[`_ComputedName_${i}`] = '';
            }

            if (variables.signatures && variables.signatures.length > 0) {
                variables.hasSignatures = true;
                variables.signatures.forEach((sig: any, index: number) => {
                    const empName = initialData.employees.find(e => e.value === sig.employee)?.label || sig.employee;
                    const idx = index + 1;
                    variables[`sig_name_${idx}`] = empName;
                    variables[`sig_img_${idx}`] = sig.signature;
                    variables[`Print Name_${idx}`] = empName;
                    variables[`_ComputedName_${idx}`] = empName;
                    if (idx === 1) variables[`_ComputedName`] = empName;
                });
            } else {
                variables.hasSignatures = false;
            }

            const response = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate JHA PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `JHA_${schedule?.customerName || 'Report'}_${selectedJHA.usaNo || 'Doc'}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            success('JHA PDF downloaded successfully!');
        } catch (error: any) {
            console.error('JHA PDF Error:', error);
            toastError(error.message || 'Failed to download JHA PDF');
        } finally {
            setIsGeneratingJHAPDF(false);
        }
    };

    const handleDownloadDjtPdf = async () => {
        if (!selectedDJT) return;
        setIsGeneratingDJTPDF(true);
        try {
            const templateId = '1cN4CpzsvuKLYXtmSANeyqTTlL3HPc7XEyFsjfNwzo-8';

            // Build variables from selectedDJT and its parent schedule
            const schedule = schedules.find(s => s._id === (selectedDJT.schedule_id || selectedDJT._id));

            // Find matching estimate for contact info - match by estimate number (value field)
            const estimate = initialData.estimates.find((e: any) => {
                const estNum = e.value || e.estimate || e.estimateNum;
                return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
            });

            // Find matching client for customer name
            const client = initialData.clients.find(c => c._id === schedule?.customerId || c.name === schedule?.customerName);

            // Combine fields
            const variables: Record<string, any> = {
                // ...selectedDJT, // Don't spread all DJT fields blindly to avoid clutter/collisions if not needed
                dailyJobDescription: selectedDJT.dailyJobDescription || '',
                customerPrintName: selectedDJT.customerPrintName || '',

                // Customer name/info from matched estimate or client or schedule
                customerId: estimate?.customerName || estimate?.customer || client?.name || schedule?.customerName || '',
                // Contact info from estimate
                contactName: estimate?.contactName || estimate?.contact || '',
                contactPhone: estimate?.contactPhone || estimate?.phone || '',
                jobAddress: estimate?.jobAddress || schedule?.jobLocation || '',
                // Other schedule info
                customerName: estimate?.customerName || client?.name || schedule?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                estimate: schedule?.estimate || '',
                estimateNum: schedule?.estimate || '',
                projectName: estimate?.projectName || estimate?.projectTitle || '',
                foremanName: schedule?.foremanName || '',
                date: new Date(selectedDJT.date || schedule?.fromDate || new Date()).toLocaleDateString(),
                day: new Date(selectedDJT.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
            };

            // Customer Signature
            if (selectedDJT.customerSignature) {
                variables['customerSignature'] = selectedDJT.customerSignature;
            }

            // Prepare multiple signatures (Clear slots up to 15 or 10?) JHA did 15.
            for (let i = 1; i <= 15; i++) {
                variables[`sig_name_${i}`] = '';
                variables[`sig_img_${i}`] = '';
                variables[`Print Name_${i}`] = '';
                variables[`Times_${i}`] = ''; // Maybe time in/out?
            }

            if (selectedDJT.signatures && selectedDJT.signatures.length > 0) {
                variables.hasSignatures = true;
                selectedDJT.signatures.forEach((sig: any, index: number) => {
                    const empName = initialData.employees.find(e => e.value === sig.employee)?.label || sig.employee;
                    const idx = index + 1;
                    variables[`sig_name_${idx}`] = empName;
                    variables[`sig_img_${idx}`] = sig.signature;
                    variables[`Print Name_${idx}`] = empName;

                    // Add time info if available?
                    const timesheet = schedule?.timesheet?.find((t: any) => t.employee === sig.employee);
                    if (timesheet) {
                        const inTime = formatTimeOnly(timesheet.clockIn);
                        const outTime = formatTimeOnly(timesheet.clockOut);
                        variables[`Times_${idx}`] = `${inTime} - ${outTime}`;
                    }
                });
            } else {
                variables.hasSignatures = false;
            }

            const response = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate DJT PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `DJT_${schedule?.customerName || 'Report'}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            success('DJT PDF downloaded successfully!');
        } catch (error: any) {
            console.error('DJT PDF Error:', error);
            toastError(error.message || 'Failed to download DJT PDF');
        } finally {
            setIsGeneratingDJTPDF(false);
        }
    };
    const handleEmailJhaPdf = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedJHA || !emailTo) return;

        setIsSendingEmail(true);
        try {
            const templateId = '164zwSdl2631kZ4mRUVtzWhg5oewL0wy6RVCgPQig258';

            // Build variables (Duplicate logic from download for safety)
            const schedule = schedules.find(s => s._id === selectedJHA.schedule_id) || selectedJHA.scheduleRef;

            // Strict estimate lookup
            const estimate = initialData.estimates.find(e => {
                const estNum = e.estimate || e.estimateNum;
                return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
            }) || initialData.estimates.find(e => e.estimateNum === schedule?.estimate || e._id === schedule?.estimate);

            const client = initialData.clients.find(c => c._id === schedule?.customerId || c.name === schedule?.customerName);

            const variables: Record<string, any> = {
                ...selectedJHA,
                customerId: client?.name || schedule?.customerName || '',
                contactName: estimate?.contactName || estimate?.contact || '',
                contactPhone: estimate?.contactPhone || estimate?.phone || '',
                jobAddress: estimate?.jobAddress || estimate?.address || schedule?.jobLocation || '',
                customerName: schedule?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                estimateNum: schedule?.estimate || '',
                foremanName: schedule?.foremanName || '',
                addressOfHospital: selectedJHA.addressOfHospital || selectedJHA.hospitalAddress || '',
                date: selectedJHA.date ? formatWallDate(selectedJHA.date) : '',
            };

            const booleanFields = [
                'operatingMiniEx', 'operatingAVacuumTruck', 'excavatingTrenching', 'acConcWork',
                'operatingBackhoe', 'workingInATrench', 'trafficControl', 'roadWork', 'operatingHdd',
                'confinedSpace', 'settingUgBoxes', 'otherDailyWork', 'sidewalks', 'heatAwareness',
                'ladderWork', 'overheadLifting', 'materialHandling', 'roadHazards', 'heavyLifting',
                'highNoise', 'pinchPoints', 'sharpObjects', 'trippingHazards', 'otherJobsiteHazards',
                'stagingAreaDiscussed', 'rescueProceduresDiscussed', 'evacuationRoutesDiscussed',
                'emergencyContactNumberWillBe911', 'firstAidAndCPREquipmentOnsite', 'closestHospitalDiscussed'
            ];
            booleanFields.forEach(f => {
                if (variables[f] === true || variables[f] === 'TRUE' || variables[f] === 'Yes' || variables[f] === '1') {
                    variables[f] = '✔️';
                } else {
                    variables[f] = '';
                }
            });

            for (let i = 1; i <= 15; i++) {
                variables[`sig_name_${i}`] = '';
                variables[`sig_img_${i}`] = '';
                variables[`Print Name_${i}`] = '';
                variables[`_ComputedName_${i}`] = '';
            }

            if (variables.signatures && variables.signatures.length > 0) {
                variables.hasSignatures = true;
                variables.signatures.forEach((sig: any, index: number) => {
                    const empName = initialData.employees.find(e => e.value === sig.employee)?.label || sig.employee;
                    const idx = index + 1;
                    variables[`sig_name_${idx}`] = empName;
                    variables[`sig_img_${idx}`] = sig.signature;
                    variables[`Print Name_${idx}`] = empName;
                    variables[`_ComputedName_${idx}`] = empName;
                    if (idx === 1) variables[`_ComputedName`] = empName;
                });
            } else {
                variables.hasSignatures = false;
            }

            const pdfRes = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!pdfRes.ok) throw new Error('Failed to generate PDF');
            const blob = await pdfRes.blob();

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;

                const emailRes = await fetch('/api/email-jha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        emailTo,
                        subject: 'JHA Document',
                        emailBody: 'Please find attached JHA document',
                        attachment: base64data,
                        jhaId: selectedJHA._id,
                        scheduleId: selectedJHA.schedule_id || selectedJHA.scheduleRef?._id,
                        createdBy: currentUser?.email || ''
                    })
                });

                const emailData = await emailRes.json();
                if (emailData.success) {
                    success('PDF emailed successfully!');
                    setEmailModalOpen(false);
                    setEmailTo('');
                    setSelectedJHA((prev: any) => ({
                        ...prev,
                        emailCounter: (prev.emailCounter || 0) + 1,
                        jhaEmails: emailData.jha?.jhaEmails || [...(prev.jhaEmails || []), { emailto: emailTo, createdAt: new Date() }]
                    }));
                } else {
                    throw new Error(emailData.error || 'Failed to send email');
                }
                setIsSendingEmail(false);
            };
        } catch (error: any) {
            console.error('Email Error:', error);
            toastError(error.message || 'Failed to email PDF');
            setIsSendingEmail(false);
        }
    };

    const handleSaveJHASignature = async (dataUrl: string) => {
        if (!activeSignatureEmployee || !selectedJHA) return;

        setIsSavingSignature(true);
        // Location logic removed per request

        // Check if employee already signed to prevent duplicates
        if (selectedJHA.signatures?.some((s: any) => s.employee === activeSignatureEmployee)) {
            toastError('This employee has already signed.');
            setActiveSignatureEmployee(null); // Reset selection
            setIsSavingSignature(false);
            return;
        }
        try {
            const payload = {
                schedule_id: selectedJHA.schedule_id,
                employee: activeSignatureEmployee,
                signature: dataUrl,
                createdBy: currentUser?.email || null,
                location
            };
            const res = await fetch('/api/jha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveJHASignature', payload })
            });
            const data = await res.json();
            if (data.success) {
                success('Signature Saved');
                const newSig = data.result;
                setSelectedJHA((prev: any) => ({ ...prev, signatures: [...(prev.signatures || []), newSig] }));
                setActiveSignatureEmployee(null);
                // Refresh schedules to update JHA status icons
                fetchPageData();
            } else {
                toastError(data.error || 'Failed to save signature');
            }
        } catch (error) {
            console.error(error);
            toastError('Error saving signature');
        }
    };

    const handleSaveDJTSignature = async (dataInput: string | any) => {
        if (!activeSignatureEmployee || !selectedDJT) return;

        const dataUrl = typeof dataInput === 'string' ? dataInput : dataInput.signature;
        const lunchStart = typeof dataInput === 'object' ? dataInput.lunchStart : null;
        const lunchEnd = typeof dataInput === 'object' ? dataInput.lunchEnd : null;

        setIsSavingSignature(true);

        try {
            const payload = {
                schedule_id: selectedDJT.schedule_id || selectedDJT._id,
                employee: activeSignatureEmployee,
                signature: dataUrl,
                lunchStart,
                lunchEnd,
                createdBy: currentUser?.email || 'system',
                clientNow: getLocalNowISO()
            };

            const res = await fetch('/api/djt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveDJTSignature', payload })
            });

            const data = await res.json();

            if (data.success) {
                success('Signature saved successfully');

                const updatedDJT = data.result;

                // Update selectedDJT immediately to show "Signed" status
                // Merge with existing state to preserve scheduleRef and other properties
                setSelectedDJT((prev: any) => ({
                    ...prev,
                    ...updatedDJT,
                    signatures: updatedDJT.signatures || []
                }));

                // Update Schedules List
                setSchedules((prev: any[]) => prev.map((s: any) =>
                    String(s._id) === String(updatedDJT.schedule_id || selectedDJT._id)
                        ? { ...s, djt: { ...s.djt, ...updatedDJT, signatures: updatedDJT.signatures }, DJTSignatures: updatedDJT.signatures }
                        : s
                ));

                setActiveSignatureEmployee(null);
            } else {
                toastError(data.error || 'Failed to save signature');
            }
        } catch (e) {
            console.error(e);
            toastError('Error saving signature');
        } finally {
            setIsSavingSignature(false);
        }
    };

    const handleSaveIndividualTimesheet = async (e: React.FormEvent) => {
        e.preventDefault();

        let employeeEmail = selectedTimesheet.employee;
        if (!employeeEmail && typeof window !== 'undefined') {
            try {
                employeeEmail = currentUser?.email;
            } catch (e) {
                console.error(e);
            }
        }

        if (!employeeEmail) {
            toastError("User email not found. Please reload or sign in.");
            return;
        }

        try {
            // Business Logic: Clock out is automatic (now)
            // Lunch Start/End combined with current date
            const finalTimesheet = {
                ...selectedTimesheet,
                employee: employeeEmail,
                clockOut: new Date().toISOString(),
                lunchStart: selectedTimesheet.lunchStartTime ? combineCurrentDateWithTime(selectedTimesheet.lunchStartTime) : selectedTimesheet.lunchStart,
                lunchEnd: selectedTimesheet.lunchEndTime ? combineCurrentDateWithTime(selectedTimesheet.lunchEndTime) : selectedTimesheet.lunchEnd,
                type: 'Site Time'
            };

            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'saveIndividualTimesheet',
                    payload: { timesheet: finalTimesheet }
                })
            });
            const data = await res.json();
            if (data.success) {
                success('Timesheet Saved Successfully');
                fetchPageData();
                setTimesheetModalOpen(false);
            } else {
                toastError(data.error || 'Failed to save timesheet');
            }
        } catch (error) {
            console.error(error);
            toastError('Error saving timesheet');
        }
    };

    // formatTimeOnly is imported from lib/scheduleUtils.ts

    // calculateTimesheetData is now imported from @/lib/timeCardUtils
    // This ensures consistent distance priority: Manual > Google Distance API > Haversine

    // deg2rad, getDistanceFromLatLonInMiles, and toLocalISO are imported from lib/scheduleUtils.ts


    // Calculate hours and distance for the editing timesheet form
    const editingTimesheetCalculated = useMemo(() => {
        if (!editingTimesheet) return { hours: 0, distance: 0 };
        return calculateTimesheetData(editTimesheetForm, editingTimesheet.clockIn);
    }, [editTimesheetForm, editingTimesheet]);

    // Open the edit timesheet modal
    const handleEditTimesheetClick = (ts: any, scheduleId: string) => {
        // Find the schedule to get the estimate
        const schedule = schedules.find(s => s._id === scheduleId);
        const estimate = schedule?.estimate || ts.estimate || '';

        setEditingTimesheet({ ...ts, scheduleId, estimate });
        setEditTimesheetForm({ ...ts, scheduleId, estimate });
    };

    // Save timesheet edits to database
    const handleSaveTimesheetEdit = async () => {
        if (!editingTimesheet || !editTimesheetForm.scheduleId) return;

        try {
            // Close modal immediately for better UX
            const scheduleId = editTimesheetForm.scheduleId;
            const tsId = editingTimesheet._id || editingTimesheet.recordId;

            setEditingTimesheet(null);
            setEditTimesheetForm({});

            // Fetch current schedule
            const resGet = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getScheduleById', payload: { id: scheduleId } })
            });
            const dataGet = await resGet.json();
            if (!dataGet.success) throw new Error("Schedule not found");

            const schedule = dataGet.result;
            const updatedTimesheets = (schedule.timesheet || []).map((t: any) => {
                if ((t._id || t.recordId) === tsId) {
                    const { scheduleId: _, ...rest } = editTimesheetForm;

                    // Embed hourly rate from employee profile for payroll integrity
                    const empEmail = editTimesheetForm.employee || t.employee || '';
                    const empProfile = initialData.employees?.find((e: any) => e.value === empEmail) || {};
                    const rateFields: any = {};
                    const tsType = String(editTimesheetForm.type || t.type || '').toLowerCase();
                    if (tsType.includes('site') && empProfile.hourlyRateSITE) {
                        rateFields.hourlyRateSITE = empProfile.hourlyRateSITE;
                    } else if (tsType.includes('drive') && empProfile.hourlyRateDrive) {
                        rateFields.hourlyRateDrive = empProfile.hourlyRateDrive;
                    }

                    return { ...t, ...rest, ...rateFields };
                }
                return t;
            });

            // Save updated timesheets
            const resSave = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateSchedule',
                    payload: { id: scheduleId, timesheet: updatedTimesheets }
                })
            });

            const saveResult = await resSave.json();
            if (saveResult.success) {
                success("Timesheet updated");
                // Refresh schedules to reflect changes
                fetchPageData(1, true);
            } else {
                throw new Error("Failed to save");
            }

        } catch (e) {
            console.error(e);
            toastError("Failed to update timesheet");
        }
    };



    const executeDriveTimeToggle = async (schedule: any, activeDriveTime: any, e: React.MouseEvent) => {
        e.stopPropagation();

        let employeeEmail = currentUser?.email;
        // Fallback if currentUser is missing context
        if (!employeeEmail && typeof window !== 'undefined') {
            try {
                employeeEmail = currentUser?.email;
            } catch (e) { console.error(e); }
        }

        if (!employeeEmail) {
            toastError("User identity not found.");
            return;
        }

        // Geolocation
        if (!navigator.geolocation) {
            toastError("Geolocation is not supported by your browser");
            return;
        }

        const getPosition = (): Promise<GeolocationPosition> => {
            return new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
        };

        try {
            const position = await getPosition();
            const { latitude, longitude } = position.coords;

            if (activeDriveTime) {
                // STOP DRIVE TIME
                let distance = 0;
                if (activeDriveTime.locationIn) {
                    const [startLat, startLng] = activeDriveTime.locationIn.split(',').map(Number);
                    if (!isNaN(startLat) && !isNaN(startLng)) {
                        // Driving Distance (Haversine * 1.19)
                        distance = getDistanceFromLatLonInMiles(startLat, startLng, latitude, longitude) * 1.19;
                    }
                }

                const finalTimesheet = {
                    ...activeDriveTime,
                    clockOut: getLocalNowISO(),
                    locationOut: `${latitude},${longitude}`,
                    distance: distance ? parseFloat(distance.toFixed(2)) : 0
                };

                // OPTIMISTIC UPDATE: Update UI immediately
                setSchedules(prev => prev.map(s => {
                    if (s._id !== schedule._id) return s;
                    return {
                        ...s,
                        timesheet: (s.timesheet || []).map((ts: any) =>
                            ts._id === activeDriveTime._id ? finalTimesheet : ts
                        )
                    };
                }));
                success('Drive Time Stopped');

                // API call in background
                fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'saveIndividualTimesheet',
                        payload: { timesheet: finalTimesheet }
                    })
                }).then(res => res.json()).then(data => {
                    if (!data.success) {
                        // Revert on failure
                        toastError(data.error || 'Failed to save - reverting');
                        fetchPageData(1, true);
                    }
                }).catch(() => {
                    toastError('Failed to save - reverting');
                    fetchPageData(1, true);
                });

            } else {
                // START DRIVE TIME
                const tempId = `temp-${Date.now()}`;
                const newTimesheet = {
                    _id: tempId,
                    scheduleId: schedule._id,
                    employee: employeeEmail,
                    clockIn: schedule.fromDate || getLocalNowISO(),
                    locationIn: `${latitude},${longitude}`,
                    type: 'Drive Time',
                    status: 'Pending',
                    createdBy: employeeEmail,
                    createdAt: new Date().toISOString()
                };

                // OPTIMISTIC UPDATE: Update UI immediately
                setSchedules(prev => prev.map(s => {
                    if (s._id !== schedule._id) return s;
                    return {
                        ...s,
                        timesheet: [...(s.timesheet || []), newTimesheet]
                    };
                }));
                success('Drive Time Started');

                // API call in background
                fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'saveIndividualTimesheet',
                        payload: { timesheet: newTimesheet }
                    })
                }).then(res => res.json()).then(data => {
                    if (data.success && data.result) {
                        // Update with real ID from server
                        const savedTimesheet = data.result.timesheet?.find((ts: any) =>
                            ts.employee === employeeEmail && ts.clockIn === newTimesheet.clockIn
                        );
                        if (savedTimesheet) {
                            setSchedules(prev => prev.map(s => {
                                if (s._id !== schedule._id) return s;
                                return {
                                    ...s,
                                    timesheet: (s.timesheet || []).map((ts: any) =>
                                        ts._id === tempId ? { ...ts, _id: savedTimesheet._id } : ts
                                    )
                                };
                            }));
                        }
                    } else {
                        // Revert on failure
                        toastError(data.error || 'Failed to save - reverting');
                        setSchedules(prev => prev.map(s => {
                            if (s._id !== schedule._id) return s;
                            return {
                                ...s,
                                timesheet: (s.timesheet || []).filter((ts: any) => ts._id !== tempId)
                            };
                        }));
                    }
                }).catch(() => {
                    toastError('Failed to save - reverting');
                    setSchedules(prev => prev.map(s => {
                        if (s._id !== schedule._id) return s;
                        return {
                            ...s,
                            timesheet: (s.timesheet || []).filter((ts: any) => ts._id !== tempId)
                        };
                    }));
                });
            }
        } catch (error) {
            console.error(error);
            toastError("Unable to retrieve location or save data.");
        }
    };

    const executeQuickTimesheet = async (schedule: any, type: 'Dump Washout' | 'Shop Time', e: React.MouseEvent) => {
        e.stopPropagation();

        let employeeEmail = currentUser?.email;
        if (!employeeEmail && typeof window !== 'undefined') {
            try {
                employeeEmail = currentUser?.email;
            } catch (e) { console.error(e); }
        }

        if (!employeeEmail) {
            toastError("User identity not found.");
            return;
        }

        const unitHours = type === 'Dump Washout' ? 0.50 : 0.25;
        const now = new Date();
        const clockOut = now.toISOString();

        // Optimistic update
        setSchedules(prev => prev.map(s => {
            if (s._id !== schedule._id) return s;

            const timesheets = s.timesheet || [];
            const empEmailLower = employeeEmail!.toLowerCase();
            const existingIndex = timesheets.findIndex((ts: any) => {
                if (ts.employee?.toLowerCase() !== empEmailLower) return false;
                const dwVal = String(ts.dumpWashout || '').toLowerCase();
                const stVal = String(ts.shopTime || '').toLowerCase();

                if (type === 'Dump Washout') return dwVal === 'true' || dwVal === 'yes' || dwVal.includes('hrs');
                if (type === 'Shop Time') return stVal === 'true' || stVal === 'yes' || stVal.includes('hrs');
                return false;
            });

            if (existingIndex > -1) {
                const updatedTimesheets = [...timesheets];
                const existingTs = updatedTimesheets[existingIndex];
                const newQty = (existingTs.qty || 1) + 1;
                const newHours = parseFloat(((existingTs.hours || 0) + unitHours).toFixed(2));

                // Update specific flag with string format
                const update: any = { qty: newQty, hours: newHours };
                if (type === 'Dump Washout') {
                    update.dumpWashout = `${newHours.toFixed(2)} hrs (${newQty} qty)`;
                } else {
                    update.shopTime = `${newHours.toFixed(2)} hrs (${newQty} qty)`;
                }

                updatedTimesheets[existingIndex] = {
                    ...existingTs,
                    ...update
                };
                return { ...s, timesheet: updatedTimesheets };
            } else {
                const clockIn = new Date(now.getTime() - (unitHours * 60 * 60 * 1000)).toISOString();
                const valStr = `${unitHours.toFixed(2)} hrs (1 qty)`;
                const newTs = {
                    _id: `ts-${Date.now()}`,
                    scheduleId: schedule._id,
                    employee: employeeEmail,
                    clockIn: clockIn,
                    clockOut: clockOut,
                    type: 'Drive Time',
                    hours: unitHours,
                    qty: 1,
                    dumpWashout: type === 'Dump Washout' ? valStr : undefined,
                    shopTime: type === 'Shop Time' ? valStr : undefined,
                    status: 'Pending',
                    createdBy: employeeEmail,
                    createdAt: now.toISOString()
                };
                return { ...s, timesheet: [...timesheets, newTs] };
            }
        }));

        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'quickTimesheet',
                    payload: {
                        scheduleId: schedule._id,
                        employee: employeeEmail,
                        type,
                        date: clockOut
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                success(`${type} Updated`);
            } else {
                toastError(data.error || `Failed to update ${type}`);
                fetchPageData(1, true);
            }
        } catch (error) {
            console.error(error);
            toastError(`Error updating ${type}`);
            fetchPageData(1, true);
        }
    };

    const handleViewTimesheet = (item: ScheduleItem, ts: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedTimesheet(ts);
        setIsTimesheetEditMode(false);
        setTimesheetModalOpen(true);
    };

    const handleDeleteTimesheet = (tsId: string) => {
        setDeleteConfirmation({ isOpen: true, tsId });
    };

    const confirmDeleteTimesheet = async () => {
        if (!selectedSchedule || !deleteConfirmation.tsId) return;

        const tsId = deleteConfirmation.tsId;
        const updatedTimesheets = (selectedSchedule.timesheet || []).filter(t => (t._id || t.recordId) !== tsId);

        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateSchedule',
                    payload: {
                        id: selectedSchedule._id,
                        timesheet: updatedTimesheets
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                // Update local state
                setSchedules(prev => prev.map(s => s._id === selectedSchedule._id ? { ...s, timesheet: updatedTimesheets } : s));
                setSelectedSchedule(prev => prev ? { ...prev, timesheet: updatedTimesheets } : null);
                success('Timesheet entry deleted');
                setDeleteConfirmation({ isOpen: false, tsId: null });
            } else {
                toastError(data.error || 'Failed to delete entry');
            }
        } catch (error) {
            console.error(error);
            toastError('Error removing timesheet');
        }
    };


    // Wrappers for confirmation
    const handleDriveTimeToggle = (schedule: any, activeDriveTime: any, e: React.MouseEvent) => {
        e.stopPropagation();
        const isStopping = !!activeDriveTime;
        setActionConfirm({
            isOpen: true,
            title: isStopping ? 'Stop Drive Time' : 'Start Drive Time',
            message: `Are you sure you want to ${isStopping ? 'STOP' : 'START'} Drive Time?`,
            confirmText: isStopping ? 'Stop' : 'Start',
            variant: isStopping ? 'danger' : 'primary',
            onConfirm: () => executeDriveTimeToggle(schedule, activeDriveTime, e)
        });
    };

    const handleQuickTimesheet = (schedule: any, type: 'Dump Washout' | 'Shop Time', e: React.MouseEvent) => {
        e.stopPropagation();

        const isIncrement = (schedule.timesheet || []).some((ts: any) => {
            if (ts.employee?.toLowerCase() !== (currentUser?.email?.toLowerCase() || '')) return false;
            const dwVal = String(ts.dumpWashout || '').toLowerCase();
            const stVal = String(ts.shopTime || '').toLowerCase();

            if (type === 'Dump Washout') return dwVal === 'true' || dwVal === 'yes' || dwVal.includes('hrs');
            if (type === 'Shop Time') return stVal === 'true' || stVal === 'yes' || stVal.includes('hrs');
            return false;
        });

        const actionWord = isIncrement ? 'INCREMENT' : 'REGISTER';

        setActionConfirm({
            isOpen: true,
            title: `${type}`,
            message: `Are you sure you want to ${actionWord} ${type}?`,
            confirmText: 'Confirm',
            variant: 'primary',
            onConfirm: () => executeQuickTimesheet(schedule, type, e)
        });
    };

    return (
        <div className="flex flex-col h-full bg-[#F8FAFC]">
            <div className="flex-none">
                <Header
                    rightContent={

                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Mobile Search Button */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setShowMobileSearch(!showMobileSearch)}
                                        className="sm:hidden p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm text-slate-600"
                                    >
                                        <Search size={18} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Search</p>
                                </TooltipContent>
                            </Tooltip>

                            {/* Mobile Filter Button */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => setShowMobileFilters(!showMobileFilters)}
                                        className="sm:hidden p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm text-slate-600"
                                    >
                                        <Filter size={18} />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Filters</p>
                                </TooltipContent>
                            </Tooltip>

                            <SearchInput
                                ref={searchInputRef}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search schedules..."
                                className="hidden sm:block"
                            />

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={openCreateModal}
                                        className="hidden sm:flex p-2 sm:p-2.5 bg-[#0F4C75] text-white rounded-full hover:bg-[#0a3a5c] transition-all shadow-lg hover:shadow-[#0F4C75]/30 group"
                                    >
                                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Create Schedule</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    }
                />
            </div>

            {/* Mobile Search Bar */}
            {showMobileSearch && (
                <div className="sm:hidden px-4 py-2 bg-[#F8FAFC] border-b border-slate-100 animate-in slide-in-from-top duration-200">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search schedules..."
                            autoFocus
                            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] focus:border-transparent"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Mobile Filters Panel - lg:hidden */}
            {showMobileFilters && (
                <div className="lg:hidden px-4 py-3 bg-[#F0F5FA] border-b border-slate-200 animate-in slide-in-from-top duration-200 max-h-[60vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Filter size={12} />
                            FILTERS
                        </h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={clearFilters}
                                className="text-[10px] font-bold text-[#0F4C75] hover:underline bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm"
                            >
                                Clear All
                            </button>
                            <button
                                onClick={() => setShowMobileFilters(false)}
                                className="p-1.5 rounded-full bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                            >
                                <X size={14} className="text-slate-500" />
                            </button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <FilterItem
                            id="mobileFilterWeek"
                            label="Weeks"
                            placeholder="Select Week"
                            options={weekOptions}
                            value={filterWeek}
                            openDropdownId={openDropdownId}
                            setOpenDropdownId={setOpenDropdownId}
                            onChange={(val: string) => {
                                setFilterWeek(val);
                                if (val) {
                                    const [startStr] = val.split('|');
                                    const dates = [];
                                    const [y1, m1, d1] = startStr.split('-').map(Number);
                                    const currentD = new Date(Date.UTC(y1, m1 - 1, d1));
                                    for (let k = 0; k < 7; k++) {
                                        dates.push(formatLocalDate(currentD));
                                        currentD.setUTCDate(currentD.getUTCDate() + 1);
                                    }
                                    setSelectedDates(dates);
                                }
                            }}
                        />
                        <FilterItem
                            id="mobileFilterEstimate"
                            label="Estimate #"
                            placeholder="Select Estimate"
                            options={initialData.estimates.map(e => ({ label: e.label, value: e.value }))}
                            value={filterEstimate}
                            onChange={setFilterEstimate}
                            openDropdownId={openDropdownId}
                            setOpenDropdownId={setOpenDropdownId}
                        />
                        <FilterItem
                            id="mobileFilterClient"
                            label="Client"
                            placeholder="Select Client"
                            options={initialData.clients.map(c => ({ label: c.name, value: c._id }))}
                            value={filterClient}
                            onChange={setFilterClient}
                            openDropdownId={openDropdownId}
                            setOpenDropdownId={setOpenDropdownId}
                        />
                        <FilterItem
                            id="mobileFilterEmployee"
                            label="Employee"
                            placeholder="Select Employee"
                            options={initialData.employees.map(e => ({ label: e.label, value: e.value, image: e.image }))}
                            value={filterEmployee}
                            onChange={setFilterEmployee}
                            openDropdownId={openDropdownId}
                            setOpenDropdownId={setOpenDropdownId}
                        />
                        <FilterItem
                            id="mobileFilterService"
                            label="Service"
                            placeholder="Select Service"
                            options={initialData.constants
                                .filter(c => c.type?.toLowerCase() === 'services')
                                .map(c => ({ label: c.description, value: c.description }))}
                            value={filterService}
                            onChange={setFilterService}
                            openDropdownId={openDropdownId}
                            setOpenDropdownId={setOpenDropdownId}
                        />
                        <FilterItem
                            id="mobileFilterTag"
                            label="Tag"
                            placeholder="Select Tag"
                            options={initialData.constants
                                .filter(c => c.type === 'Schedule Items')
                                .map(c => ({ label: c.description, value: c.description, image: c.image, color: c.color }))}
                            value={filterTag}
                            onChange={setFilterTag}
                            openDropdownId={openDropdownId}
                            setOpenDropdownId={setOpenDropdownId}
                        />
                        <FilterItem
                            id="mobileFilterPayroll"
                            label="Payroll"
                            placeholder="Any"
                            options={initialData.constants
                                .filter(c => c.type === 'Certified Payroll')
                                .map(c => ({ label: c.description, value: c.description }))}
                            value={filterCertifiedPayroll}
                            onChange={setFilterCertifiedPayroll}
                            openDropdownId={openDropdownId}
                            setOpenDropdownId={setOpenDropdownId}
                        />
                    </div>
                </div>
            )}

            <main className="flex-1 overflow-y-auto max-w-[1800px] w-full mx-auto px-4 py-4">
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-4 h-full">

                    {/* LEFT COLUMN - CALENDAR - Hidden on mobile, 25% on desktop */}
                    <div className="hidden lg:block w-full lg:w-[25%] lg:h-full lg:overflow-y-auto custom-scrollbar bg-[#F0F5FA] rounded-[32px] p-4">
                        <div className="">

                            {/* Desktop: Full Calendar */}
                            <div className="hidden lg:block">
                                {/* Days Mapping */}
                                <div className="grid grid-cols-7 mb-2 px-2">
                                    {['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map(day => (
                                        <div key={day} className="text-center text-[10px] font-black text-slate-400 tracking-widest">{day}</div>
                                    ))}
                                </div>

                                {/* Calendar Grid Container */}
                                <div className="bg-[#F0F5FA] rounded-[24px] lg:rounded-[32px] p-4 shadow-[inset_8px_8px_16px_#d1d9e6,inset_-8px_-8px_16px_#ffffff]">
                                    <div className="flex items-center justify-between mb-4 px-2">
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                                                className="text-slate-400 hover:text-[#0F4C75] transition-colors scale-75"
                                                title="Previous Month"
                                            >
                                                <ChevronsLeft size={24} />
                                            </button>
                                            <button
                                                onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))}
                                                className="text-slate-400 hover:text-[#0F4C75] transition-colors scale-75"
                                                title="Previous Week"
                                            >
                                                <ChevronLeft size={24} />
                                            </button>
                                        </div>
                                        <span className="text-sm sm:text-base font-black text-[#0F4C75] tracking-tight">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))}
                                                className="text-slate-400 hover:text-[#0F4C75] transition-colors scale-75"
                                                title="Next Week"
                                            >
                                                <ChevronRight size={24} />
                                            </button>
                                            <button
                                                onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                                                className="text-slate-400 hover:text-[#0F4C75] transition-colors scale-75"
                                                title="Next Month"
                                            >
                                                <ChevronsRight size={24} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-7 gap-y-1">
                                        {getDaysInMonth(currentDate).map((day, idx) => {
                                            if (!day) return <div key={idx} className="flex justify-center items-center h-8 sm:h-9" />;

                                            const dateForCheck = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                                            const year = dateForCheck.getFullYear();
                                            const month = String(dateForCheck.getMonth() + 1).padStart(2, '0');
                                            const d = String(dateForCheck.getDate()).padStart(2, '0');
                                            const dateStr = `${year}-${month}-${d}`;

                                            const isSelected = selectedDates.includes(dateStr);
                                            const hasSchedule = scheduledDatesRaw.has(dateStr);

                                            return (
                                                <div key={idx} className="flex justify-center items-center h-8 w-8 sm:h-9 sm:w-10 mx-auto">
                                                    <button
                                                        onClick={() => toggleDate(day)}
                                                        className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold transition-all relative
                                                            ${isSelected
                                                                ? 'bg-[#0F4C75] text-white shadow-[4px_4px_8px_rgba(15,76,117,0.4)] scale-110 z-10'
                                                                : hasSchedule
                                                                    ? 'bg-[#D1E9FA] text-[#0F4C75] shadow-sm hover:bg-[#B3D7F8]'
                                                                    : 'text-slate-400 hover:bg-white hover:text-[#0F4C75] hover:shadow-sm'
                                                            }
                                                        `}
                                                    >
                                                        {day}
                                                        {isSelected && <div className="absolute -bottom-1.5 w-1 h-1 bg-[#0F4C75] rounded-full opacity-0"></div>}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-4 text-center pt-3 border-t border-slate-200/50">
                                        <p className="text-[10px] font-black text-slate-500 tracking-tight pb-1">
                                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDate.getDay()]}, {currentDate.getDate()} {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                                        </p>
                                        <div className="flex justify-center gap-1.5 mt-2">
                                            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                            <div className="w-3 h-1 rounded-full bg-[#0F4C75]"></div>
                                            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Filters Section */}
                        <div className={`mt-4 ${showMobileFilters ? 'block' : 'hidden'} lg:block`}>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Filter size={12} />
                                    FILTERS
                                </h3>
                                <button
                                    onClick={clearFilters}
                                    className="text-[10px] font-bold text-[#0F4C75] hover:underline bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm"
                                >
                                    Clear All
                                </button>
                            </div>

                            <div className="space-y-4">
                                <FilterItem
                                    id="filterWeek"
                                    label="Weeks"
                                    placeholder="Select Week"
                                    options={weekOptions}
                                    value={filterWeek}
                                    openDropdownId={openDropdownId}
                                    setOpenDropdownId={setOpenDropdownId}
                                    onChange={(val: string) => {
                                        setFilterWeek(val);
                                        if (val) {
                                            const [startStr, endStr] = val.split('|');
                                            const dates = [];
                                            // Parse using UTC to avoid timezone shift
                                            const [y1, m1, d1] = startStr.split('-').map(Number);
                                            const currentD = new Date(Date.UTC(y1, m1 - 1, d1));

                                            for (let k = 0; k < 7; k++) {
                                                dates.push(formatLocalDate(currentD));
                                                currentD.setUTCDate(currentD.getUTCDate() + 1);
                                            }
                                            setSelectedDates(dates);
                                        }
                                    }}
                                />
                                <FilterItem
                                    id="filterEstimate"
                                    label="Estimate #"
                                    placeholder="Select Estimate"
                                    options={initialData.estimates.map(e => ({ label: e.label, value: e.value }))}
                                    value={filterEstimate}
                                    onChange={setFilterEstimate}
                                    openDropdownId={openDropdownId}
                                    setOpenDropdownId={setOpenDropdownId}
                                />

                                <FilterItem
                                    id="filterClient"
                                    label="Client"
                                    placeholder="Select Client"
                                    options={initialData.clients.map(c => ({ label: c.name, value: c._id }))}
                                    value={filterClient}
                                    onChange={setFilterClient}
                                    openDropdownId={openDropdownId}
                                    setOpenDropdownId={setOpenDropdownId}
                                />

                                <FilterItem
                                    id="filterEmployee"
                                    label="Employee"
                                    placeholder="Select Employee"
                                    options={initialData.employees.map(e => ({ label: e.label, value: e.value, image: e.image }))}
                                    value={filterEmployee}
                                    onChange={setFilterEmployee}
                                    openDropdownId={openDropdownId}
                                    setOpenDropdownId={setOpenDropdownId}
                                />

                                <FilterItem
                                    id="filterService"
                                    label="Service"
                                    placeholder="Select Service"
                                    options={initialData.constants
                                        .filter(c => c.type?.toLowerCase() === 'services')
                                        .map(c => ({ label: c.description, value: c.description }))}
                                    value={filterService}
                                    onChange={setFilterService}
                                    openDropdownId={openDropdownId}
                                    setOpenDropdownId={setOpenDropdownId}
                                />

                                <FilterItem
                                    id="filterTag"
                                    label="Tag"
                                    placeholder="Select Tag"
                                    options={initialData.constants
                                        .filter(c => c.type === 'Schedule Items')
                                        .map(c => ({ label: c.description, value: c.description, image: c.image, color: c.color }))}
                                    value={filterTag}
                                    onChange={setFilterTag}
                                    openDropdownId={openDropdownId}
                                    setOpenDropdownId={setOpenDropdownId}
                                />

                                <FilterItem
                                    id="filterCertifiedPayroll"
                                    label="Payroll"
                                    placeholder="Any"
                                    options={initialData.constants
                                        .filter(c => c.type === 'Certified Payroll')
                                        .map(c => ({ label: c.description, value: c.description }))}
                                    value={filterCertifiedPayroll}
                                    onChange={setFilterCertifiedPayroll}
                                    openDropdownId={openDropdownId}
                                    setOpenDropdownId={setOpenDropdownId}
                                />
                            </div>
                        </div>
                    </div>

                    {/* MIDDLE COLUMN - SCHEDULE FEED - Full width on mobile */}
                    <div
                        ref={scrollContainerRef}
                        className={`w-full lg:w-[75%] ${selectedSchedule ? 'xl:w-[35%]' : 'xl:w-[60%]'} lg:h-full lg:overflow-y-auto p-4 custom-scrollbar bg-[#F0F5FA] rounded-[24px] lg:rounded-[32px] transition-all duration-500 ease-in-out`}
                    >

                        {/* Day Filter Tabs */}
                        <div className="pt-0 mb-4 overflow-x-auto sticky top-0 z-50 bg-[#F0F5FA] transition-all">
                            <BadgeTabs
                                tabs={dayTabs}
                                activeTab={activeDayTab}
                                onChange={setActiveDayTab}
                                size="sm"
                            />
                        </div>


                        {loading ? (
                            <div className={`grid grid-cols-1 ${selectedSchedule ? '' : 'md:grid-cols-2'} gap-4 pt-0`}>
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="h-48 bg-white/50 backdrop-blur-sm rounded-[32px] border border-slate-100 animate-pulse" />
                                ))}
                            </div>
                        ) : filteredSchedules.length > 0 ? (
                            <div className={`grid grid-cols-1 ${selectedSchedule ? '' : 'md:grid-cols-2'} gap-4 pt-0 transition-all duration-500`}>
                                {displayedSchedules.map((item) => (
                                    <ScheduleCard
                                        key={item._id}
                                        item={item}
                                        initialData={initialData}
                                        currentUser={currentUser}
                                        isSelected={selectedSchedule?._id === item._id}
                                        onClick={() => {
                                            const isDeselecting = selectedSchedule?._id === item._id;
                                            setSelectedSchedule(isDeselecting ? null : item);
                                            if (!isDeselecting) {
                                                setShowMobileDetail(true);
                                                // Clear cached pothole/prebore logs when switching schedules
                                                setDetailPotholeLogs([]);
                                                setDetailPreboreLogs([]);
                                            }
                                            else setShowMobileDetail(false);
                                        }}
                                        onEdit={(item) => {
                                            setEditingItem(item);
                                            setIsModalOpen(true);
                                        }}
                                        onResendEmail={handleResendEmail}
                                        onCopy={(item) => {
                                            const addOneDay = (dateStr: string) => {
                                                const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
                                                if (!match) return dateStr;
                                                const [, year, month, day, hours, minutes] = match;
                                                const utcDate = new Date(Date.UTC(
                                                    parseInt(year),
                                                    parseInt(month) - 1,
                                                    parseInt(day) + 1
                                                ));
                                                const newYear = utcDate.getUTCFullYear();
                                                const newMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
                                                const newDay = String(utcDate.getUTCDate()).padStart(2, '0');
                                                return `${newYear}-${newMonth}-${newDay}T${hours}:${minutes}`;
                                            };
                                            const clonedItem = {
                                                ...item,
                                                _id: undefined,
                                                fromDate: addOneDay(item.fromDate),
                                                toDate: addOneDay(item.toDate),
                                                timesheet: [],
                                                hasJHA: false,
                                                jha: undefined,
                                                JHASignatures: [],
                                                hasDJT: false,
                                                DJTSignatures: []
                                            };
                                            setEditingItem(clonedItem as any);
                                            setIsModalOpen(true);
                                        }}
                                        onDelete={(item) => {
                                            setDeleteId(item._id);
                                            setIsConfirmOpen(true);
                                        }}
                                        onChangeOfScope={(item) => {
                                            setSelectedScopeSchedule(item);
                                            setChangeOfScopeModalOpen(true);
                                        }}
                                        onViewJHA={(item) => {
                                            // Fetch JHA from standalone collection (authoritative source, not stale embedded copy)
                                            fetch('/api/jha', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ action: 'getJHA', payload: { schedule_id: item._id } })
                                            }).then(res => res.json()).then(data => {
                                                if (data.success && data.jha) {
                                                    setSelectedJHA({
                                                        ...data.jha,
                                                        schedule_id: item._id,
                                                    });
                                                    setIsJhaEditMode(false);
                                                    setJhaModalOpen(true);
                                                }
                                            }).catch(err => {
                                                console.error('Failed to fetch JHA data:', err);
                                                toastError('Failed to load JHA data');
                                            });
                                        }}
                                        onCreateJHA={(item) => {
                                            const userEmail = currentUser?.email || null;
                                            setSelectedJHA({
                                                schedule_id: item._id,
                                                date: new Date(),
                                                jhaTime: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                                                createdBy: userEmail || '',
                                                emailCounter: 0,
                                                signatures: [],
                                                scheduleRef: item
                                            });
                                            setIsJhaEditMode(true);
                                            setJhaModalOpen(true);
                                        }}
                                        onViewDJT={(item) => {
                                            // Fetch DJT from standalone collection (authoritative source, not stale embedded copy)
                                            fetch('/api/djt', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ action: 'getDJT', payload: { schedule_id: item._id } })
                                            }).then(res => res.json()).then(data => {
                                                if (data.success && data.result) {
                                                    setSelectedDJT({
                                                        ...data.result,
                                                        schedule_id: item._id,
                                                    });
                                                    setIsDjtEditMode(false);
                                                    setDjtModalOpen(true);
                                                }
                                            }).catch(err => {
                                                console.error('Failed to fetch DJT data:', err);
                                                toastError('Failed to load DJT data');
                                            });
                                        }}
                                        onCreateDJT={(item) => {
                                            const userEmail = currentUser?.email || null;
                                            setSelectedDJT({
                                                schedule_id: item._id,
                                                dailyJobDescription: '',
                                                customerPrintName: '',
                                                customerSignature: '',
                                                createdBy: userEmail || '',
                                                clientEmail: '',
                                                emailCounter: 0
                                            });
                                            setIsDjtEditMode(true);
                                            setDjtModalOpen(true);
                                        }}
                                        onToggleDriveTime={(item, activeTs, e) => handleDriveTimeToggle(item, activeTs, e)}
                                        onQuickTimesheet={(item, type, e) => handleQuickTimesheet(item, type, e)}
                                        onViewTimesheet={(item, ts, e) => handleViewTimesheet(item, ts, e)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                title="No Schedules Found"
                                message="Start by creating your first project schedule or import from CSV."
                                icon="📅"
                            />
                        )}

                        {hasMore && (
                            <div
                                className="mt-8 flex justify-center pb-4 text-slate-400 text-xs font-bold uppercase tracking-wider"
                                ref={(el) => {
                                    if (el) {
                                        const observer = new IntersectionObserver(
                                            (entries) => {
                                                if (entries[0].isIntersecting && !loading && !isLoadingMore) {
                                                    handleLoadMore();
                                                }
                                            },
                                            { threshold: 1.0 }
                                        );
                                        observer.observe(el);
                                        return () => observer.disconnect();
                                    }
                                }}
                            >
                                {isLoadingMore ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="animate-spin" size={14} />
                                        Loading more...
                                    </div>
                                ) : (
                                    "Load more"
                                )}
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN - DETAILS OR STATS - Hidden on mobile/tablet */}
                    <div className={`${selectedSchedule ? 'xl:w-[40%]' : 'xl:w-[15%]'} h-full hidden xl:flex flex-col items-center overflow-y-auto custom-scrollbar transition-all duration-500 ease-in-out bg-[#F0F5FA] rounded-[32px] p-4`}>
                        <div className="space-y-4 w-full">
                            {selectedSchedule ? (
                                <div className="animate-in slide-in-from-right duration-300">
                                    <div className="animate-in slide-in-from-right duration-300">
                                        <div className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm space-y-4">



                                            {/* Row 1: Tag Icon & Client Name */}
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-4">
                                                    {(() => {
                                                        const tagConstant = initialData.constants.find(c => c.description === selectedSchedule.item || c.value === selectedSchedule.item);
                                                        const tagImage = tagConstant?.image;
                                                        const tagColor = tagConstant?.color;
                                                        const tagLabel = selectedSchedule.item || selectedSchedule.service || 'S';

                                                        if (tagImage) {
                                                            return (
                                                                <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden shadow-md">
                                                                    <img src={tagImage} alt={tagLabel} className="w-full h-full object-cover" />
                                                                </div>
                                                            );
                                                        } else if (tagColor) {
                                                            return (
                                                                <div className="w-12 h-12 shrink-0 rounded-full shadow-sm flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: tagColor }}>
                                                                    {tagLabel.substring(0, 2).toUpperCase()}
                                                                </div>
                                                            );
                                                        } else {
                                                            return (
                                                                <div className="w-12 h-12 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-[#0F4C75] font-black text-sm">
                                                                    {tagLabel.substring(0, 2).toUpperCase()}
                                                                </div>
                                                            );
                                                        }
                                                    })()}
                                                    {selectedSchedule.item !== 'Day Off' && (
                                                        <div>
                                                            <p className="text-xl font-black text-[#0F4C75] leading-none mb-1">{getCustomerName(selectedSchedule)}</p>
                                                            {(() => {
                                                                const est = initialData.estimates.find(e => e.value === selectedSchedule.estimate);
                                                                const displayAddress = est?.jobAddress;

                                                                if (displayAddress && displayAddress !== 'N/A') {
                                                                    return <p className="text-xs font-bold text-slate-400 mb-1">{displayAddress}</p>;
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div 
                                                    className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100/50 flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity select-all"
                                                    title="Schedule ID"
                                                >
                                                    {selectedSchedule._id}
                                                </div>
                                            </div>

                                            {/* Row 3: Title & Date */}
                                            <div className="grid grid-cols-1 gap-1">
                                                <div>
                                                    <p className="text-base font-black text-slate-800 leading-tight">{selectedSchedule.title}</p>
                                                </div>
                                                <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-500">
                                                    {selectedSchedule.item !== 'Day Off' && selectedSchedule.estimate && (
                                                        <span 
                                                            className="text-[#0F4C75] bg-[#E6EEF8] px-2 py-0.5 rounded-full hover:bg-[#b0cde8] transition-colors cursor-pointer shadow-sm active:scale-95 z-10 relative"
                                                            onMouseEnter={() => router.prefetch(`/estimates/${selectedSchedule.estimate}`)} onClick={(e) => {
                                                                e.stopPropagation();
                                                                router.push(`/estimates/${selectedSchedule.estimate}`);
                                                            }}
                                                        >
                                                            {selectedSchedule.estimate.replace(/-[vV]\d+$/, '')}
                                                        </span>
                                                    )}
                                                    <span>{formatWallDate(selectedSchedule.fromDate)}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span>{formatWallTime(selectedSchedule.fromDate)}</span>
                                                    <span>-</span>
                                                    <span>{selectedSchedule.toDate ? formatWallTime(selectedSchedule.toDate) : ''}</span>
                                                </div>
                                            </div>

                                            <div className="h-px bg-slate-100 my-2" />

                                            {/* Rows 5, 6, 7: PM, Foreman, SD */}
                                            {selectedSchedule.item !== 'Day Off' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {[
                                                        { label: 'Project Manager', val: selectedSchedule.projectManager, color: 'bg-blue-600' },
                                                        { label: 'Foreman', val: selectedSchedule.foremanName, color: 'bg-emerald-600' }
                                                    ].map((role, idx) => {
                                                        if (!role.val) return null;
                                                        const emp = initialData.employees.find(e => e.value?.toLowerCase() === role.val?.toLowerCase());
                                                        const initials = emp?.label
                                                            ? emp.label.split(' ').map((n: string) => n[0]).join('').toUpperCase()
                                                            : role.val[0]?.toUpperCase() || '?';
                                                        return (
                                                            <div key={idx} className="flex items-center gap-2 p-2 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-[10px] shadow-sm overflow-hidden shrink-0 ${role.color}`}>
                                                                    {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : initials}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{role.label}</p>
                                                                    <p className="text-xs font-bold text-slate-700 truncate">{emp?.label || role.val}</p>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            <div className="h-px bg-slate-100 my-2" />

                                            {/* Row 9: Assignees (Inline Chips) */}
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Assignees</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {(selectedSchedule.assignees || []).map((assignee, i) => {
                                                        const emp = initialData.employees.find(e => e.value?.toLowerCase() === assignee?.toLowerCase());
                                                        const initials = emp?.label
                                                            ? emp.label.split(' ').map((n: string) => n[0]).join('').toUpperCase()
                                                            : assignee[0]?.toUpperCase() || '?';
                                                        return (
                                                            <div key={i} className="inline-flex items-center gap-2 pl-1 pr-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                                                                <div className="w-6 h-6 rounded-full bg-slate-300 overflow-hidden flex items-center justify-center text-[10px] font-black text-slate-600 shrink-0">
                                                                    {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : initials}
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]">{emp?.label || assignee}</span>
                                                            </div>
                                                        );
                                                    })}
                                                    {(!selectedSchedule.assignees || selectedSchedule.assignees.length === 0) && (
                                                        <span className="text-xs text-slate-400 italic">No assignees</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Row 8a: Services - Dedicated Row with Color Chips */}
                                            {selectedSchedule.item !== 'Day Off' && selectedSchedule.service && (
                                                <div className="mt-4">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Services</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedSchedule.service.split(',').map((svc: string, idx: number) => {
                                                            const serviceName = svc.trim();
                                                            const serviceConstant = initialData.constants.find(c => (c.description === serviceName || c.value === serviceName));
                                                            const bgColor = serviceConstant?.color || '#E2E8F0';
                                                            // isLight is imported from lib/scheduleUtils.ts
                                                            const textColor = isLight(bgColor) ? '#1E293B' : '#FFFFFF';

                                                            return (
                                                                <span
                                                                    key={idx}
                                                                    className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold shadow-sm"
                                                                    style={{ backgroundColor: bgColor, color: textColor }}
                                                                >
                                                                    {serviceName}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Row 8b: Tag, Notify, Per Diem, Payroll - 4 Columns */}
                                            {selectedSchedule.item !== 'Day Off' && (
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                                                    {[
                                                        { label: 'Tag', val: selectedSchedule.item || 'N/A' },
                                                        { label: 'Notify', val: selectedSchedule.notifyAssignees },
                                                        { label: 'Per Diem', val: selectedSchedule.perDiem },
                                                        { label: 'Payroll', val: selectedSchedule.certifiedPayroll }
                                                    ].map((flag, idx) => {
                                                        const valString = flag.val === true ? 'Yes' : (flag.val === false ? 'No' : (flag.val || (idx === 0 ? 'N/A' : 'No')));
                                                        const constant = initialData.constants?.find((c: any) => c.description === valString || c.value === valString);
                                                        const isYes = ['Yes', 'TRUE'].includes(String(valString));
                                                        
                                                        const color = constant?.color || (isYes ? '#10b981' : (idx === 0 ? '#0F4C75' : '#94a3b8'));
                                                        const bgColor = constant?.color ? `${constant.color}15` : (isYes ? '#ecfdf5' : (idx === 0 ? '#E6EEF8' : '#f8fafc'));
                                                        const textColor = constant?.color || (isYes ? '#059669' : (idx === 0 ? '#0F4C75' : '#64748b'));
                                                        const borderColor = constant?.color ? `${constant.color}30` : (isYes ? '#d1fae5' : (idx === 0 ? '#bfdbfe' : '#f1f5f9'));

                                                        return (
                                                            <div key={idx}>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{flag.label}</p>
                                                                <Badge className="gap-1.5 pl-2 pr-3 py-1 border transition-all" style={{ backgroundColor: bgColor, color: textColor, borderColor }}>
                                                                    <div className="w-1.5 h-1.5 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                                                                    {valString}
                                                                </Badge>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Today's Objectives */}
                                            {selectedSchedule.todayObjectives && selectedSchedule.todayObjectives.length > 0 && (
                                                <div className="pt-4 border-t border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Today&apos;s Objectives</p>
                                                    <div className="space-y-2">
                                                        {selectedSchedule.todayObjectives.map((obj, i) => {
                                                            const isCompleted = typeof obj === 'string' ? false : obj.completed;
                                                            const text = typeof obj === 'string' ? obj : obj.text;
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    className="flex items-start gap-2 cursor-pointer group"
                                                                    onClick={() => handleToggleObjective(selectedSchedule._id, i, isCompleted)}
                                                                >
                                                                    {isCompleted ? (
                                                                        <CheckCircle2 className="w-5 h-5 text-orange-400 shrink-0 fill-orange-100" />
                                                                    ) : (
                                                                        <Circle className="w-5 h-5 text-slate-300 shrink-0 group-hover:text-slate-400 transition-colors" />
                                                                    )}
                                                                    <div className="flex flex-col">
                                                                        <span className={`text-sm ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                                                                            {text}
                                                                        </span>
                                                                        {typeof obj !== 'string' && obj.completed && obj.completedBy && (
                                                                            <span className="text-[10px] text-slate-400">
                                                                                Completed by {obj.completedBy}
                                                                                {obj.completedAt && ` at ${formatWallTime(obj.completedAt)}`}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Row 11: Scope of Work */}
                                            {selectedSchedule.description && (
                                                <div className="pt-4 border-t border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Scope of Work</p>
                                                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
                                                        {selectedSchedule.description}
                                                    </p>
                                                </div>
                                            )}

                                            {/* TABS SECTION */}
                                            <div className="pt-4 border-t border-slate-100">
                                                <div className="flex items-center justify-center">
                                                    <div className="flex items-center p-1 bg-slate-100 rounded-lg self-center">
                                                        <button 
                                                            onClick={() => setDetailActiveTab('aerial')}
                                                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${detailActiveTab === 'aerial' ? 'bg-white text-[#0F4C75] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                        >
                                                            Aerial Layout
                                                        </button>
                                                        <button 
                                                            onClick={() => setDetailActiveTab('planning')}
                                                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${detailActiveTab === 'planning' ? 'bg-white text-[#0F4C75] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                        >
                                                            Job Planning
                                                        </button>
                                                        <button 
                                                            onClick={() => setDetailActiveTab('timecard')}
                                                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 ${detailActiveTab === 'timecard' ? 'bg-white text-[#0F4C75] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                        >
                                                            Time Card
                                                            {selectedSchedule.timesheet?.length ? <span className="bg-slate-200 px-1.5 rounded-full text-[9px]">{selectedSchedule.timesheet.length}</span> : null}
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setDetailActiveTab('pothole');
                                                                if (selectedSchedule.estimate && detailPotholeLogs.length === 0 && !detailPotholeLoading) {
                                                                    setDetailPotholeLoading(true);
                                                                    fetch(`/api/pothole-logs?estimate=${encodeURIComponent(selectedSchedule.estimate)}`)
                                                                        .then(r => r.json())
                                                                        .then(d => { if (d.success) setDetailPotholeLogs(d.result || []); })
                                                                        .catch(err => console.error('Failed to fetch pothole logs', err))
                                                                        .finally(() => setDetailPotholeLoading(false));
                                                                }
                                                            }}
                                                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${detailActiveTab === 'pothole' ? 'bg-white text-[#0F4C75] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                        >
                                                            Pothole Logs
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setDetailActiveTab('prebore');
                                                                if (selectedSchedule._id && detailPreboreLogs.length === 0 && !detailPreboreLoading) {
                                                                    setDetailPreboreLoading(true);
                                                                    fetch('/api/pre-bore-logs', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ action: 'getPreBoreLog', payload: { id: selectedSchedule._id } })
                                                                    })
                                                                        .then(r => r.json())
                                                                        .then(d => { if (d.success) setDetailPreboreLogs(d.result?.preBore || []); })
                                                                        .catch(err => console.error('Failed to fetch prebore logs', err))
                                                                        .finally(() => setDetailPreboreLoading(false));
                                                                }
                                                            }}
                                                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${detailActiveTab === 'prebore' ? 'bg-white text-[#0F4C75] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                        >
                                                            Prebore Logs
                                                        </button>
                                                        <button 
                                                            onClick={() => setDetailActiveTab('chat')}
                                                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${detailActiveTab === 'chat' ? 'bg-white text-[#0F4C75] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                        >
                                                            Chat
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* TAB CONTENT */}
                                            <div className="mt-3">
                                                {/* TAB 1: AERIAL LAYOUT */}
                                                {detailActiveTab === 'aerial' && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Aerial Image */}
                                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Aerial Image</p>
                                                            {selectedSchedule.aerialImage ? (
                                                                <div
                                                                    className="relative group cursor-pointer"
                                                                    onClick={() => setMediaModal({ isOpen: true, type: 'image', url: selectedSchedule.aerialImage!, title: 'Aerial Site View' })}
                                                                >
                                                                    <img
                                                                        src={selectedSchedule.aerialImage}
                                                                        alt="Aerial View"
                                                                        className="w-full h-36 object-cover rounded-xl border border-slate-200 group-hover:opacity-90 transition-all shadow-sm"
                                                                    />
                                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <div className="px-3 py-1.5 bg-white/90 backdrop-blur text-[10px] font-bold text-slate-700 rounded-lg shadow-xl">Click to Enlarge</div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="w-full h-36 bg-slate-50 rounded-xl flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-40"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                                                                    <span className="text-xs font-medium">No aerial image</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Site Layout */}
                                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{selectedSchedule.siteLayout ? 'Site Layout' : 'Site Layout'}</p>
                                                            {selectedSchedule.siteLayout ? (
                                                                (() => {
                                                                    const earthUrl = selectedSchedule.siteLayout;
                                                                    const coordsMatch = earthUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                                                                    const lat = coordsMatch?.[1];
                                                                    const lng = coordsMatch?.[2];
                                                                    const embedUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}&t=k&z=19&ie=UTF8&iwloc=&output=embed` : '';

                                                                    return (
                                                                        <div
                                                                            className="relative w-full h-36 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 group cursor-pointer"
                                                                            onClick={() => {
                                                                                if (embedUrl) {
                                                                                    setMediaModal({ isOpen: true, type: 'map', url: embedUrl, title: 'Interactive Site Layout' });
                                                                                } else {
                                                                                    window.open(earthUrl, '_blank');
                                                                                }
                                                                            }}
                                                                        >
                                                                            {embedUrl ? (
                                                                                <div className="w-full h-full">
                                                                                    <iframe
                                                                                        width="100%"
                                                                                        height="100%"
                                                                                        style={{ border: 0 }}
                                                                                        src={embedUrl}
                                                                                        className="w-full h-full pointer-events-none"
                                                                                    />
                                                                                    <div className="absolute inset-0 bg-transparent flex items-center justify-center group-hover:bg-black/5 transition-all">
                                                                                        <div className="px-3 py-1.5 bg-white/90 backdrop-blur shadow-2xl rounded-xl scale-75 group-hover:scale-100 transition-transform flex items-center gap-2">
                                                                                            <MapPin size={14} className="text-blue-600" />
                                                                                            <span className="text-[10px] font-black text-slate-800 uppercase">Enlarge Map</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                                                                                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg mb-2 group-hover:scale-110 transition-transform">
                                                                                        <MapPin size={20} className="text-blue-600" />
                                                                                    </div>
                                                                                    <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">Open Google Earth</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()
                                                            ) : (
                                                                <div className="w-full h-36 bg-slate-50 rounded-xl flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200">
                                                                    <MapPin size={32} className="mb-2 opacity-40" />
                                                                    <span className="text-xs font-medium">No site layout</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* TAB 2: JOB PLANNING */}
                                                {detailActiveTab === 'planning' && (
                                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                        <div className="p-3 border-b border-slate-100 bg-slate-50">
                                                            <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                                                                <FileCheck size={14} /> Job Planning Documents
                                                            </h4>
                                                        </div>
                                                        {(() => {
                                                            const est = initialData.estimates.find((e: any) => e.value === selectedSchedule.estimate);
                                                            const docs = est?.jobPlanningDocs || [];
                                                            return docs.length > 0 ? (
                                                                <ul className="divide-y divide-slate-100">
                                                                    {docs.map((doc: any, i: number) => (
                                                                        <li key={i} className="p-3 hover:bg-slate-50 transition-colors">
                                                                            <div className="flex items-start justify-between">
                                                                                <div>
                                                                                    <h5 className="text-xs font-bold text-slate-800 mb-1">{doc.documentName || 'Untitled Document'}</h5>
                                                                                    <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                                                                                        {doc.planningType && <span className="bg-slate-100 px-1.5 py-0.5 rounded">Type: {doc.planningType}</span>}
                                                                                        {doc.usaTicketNo && <span className="bg-slate-100 px-1.5 py-0.5 rounded">USA#: {doc.usaTicketNo}</span>}
                                                                                    </div>
                                                                                </div>
                                                                                {doc.documents?.length > 0 && (
                                                                                    <div className="flex flex-col gap-1">
                                                                                        {doc.documents.map((file: any, fi: number) => (
                                                                                            <a 
                                                                                                key={fi} 
                                                                                                href={file.url} 
                                                                                                target="_blank" 
                                                                                                rel="noreferrer"
                                                                                                className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 transition-colors"
                                                                                            >
                                                                                                <FileText size={10} />
                                                                                                View
                                                                                            </a>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            ) : (
                                                                <div className="p-8 text-center text-slate-400">
                                                                    <FileText size={36} className="mx-auto mb-2 opacity-20" />
                                                                    <p className="text-xs font-medium">No job planning documents found.</p>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                )}

                                                {/* TAB 3: TIME CARD */}
                                                {detailActiveTab === 'timecard' && (
                                                    <div className="space-y-6">
                                                        {(() => {
                                                            const timesheets = selectedSchedule.timesheet || [];
                                                            const driveTimeEntries = timesheets.filter((ts: any) => {
                                                                const type = (ts.type || '').toLowerCase();
                                                                return type.includes('drive') || type.includes('shop') || ts.shopTime === 'Yes';
                                                            });
                                                            const siteTimeEntries = timesheets.filter((ts: any) => {
                                                                const type = (ts.type || '').toLowerCase();
                                                                return !type.includes('drive') && !type.includes('shop') && ts.shopTime !== 'Yes';
                                                            });

                                                            if (timesheets.length === 0) {
                                                                return (
                                                                    <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                                                                        <ClipboardList size={36} className="mx-auto mb-2 opacity-20" />
                                                                        <p className="text-xs font-medium">No timesheet entries yet.</p>
                                                                    </div>
                                                                );
                                                            }

                                                            const renderEmployee = (ts: any) => {
                                                                const emp = initialData.employees.find(e => e.value === ts.employee);
                                                                return (
                                                                    <div className="flex items-center gap-2.5">
                                                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500 overflow-hidden shrink-0 border border-white shadow-sm">
                                                                            {emp?.image ? (
                                                                                <img src={emp.image} className="w-full h-full object-cover" />
                                                                            ) : (
                                                                                (emp?.label?.[0] || ts.employee?.[0] || '?').toUpperCase()
                                                                            )}
                                                                        </div>
                                                                        <p className="font-bold text-slate-700 truncate max-w-[120px]">{emp?.label || ts.employee}</p>
                                                                    </div>
                                                                );
                                                            };

                                                            const renderActions = (ts: any) => (
                                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleEditTimesheetClick(ts, selectedSchedule._id); }}
                                                                                className="p-1.5 text-slate-400 hover:text-[#0F4C75] hover:bg-blue-50 rounded-lg transition-colors"
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
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteTimesheet(ts._id || ts.recordId);
                                                                                }}
                                                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>Delete</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </div>
                                                            );

                                                            return (
                                                                <>
                                                                    {siteTimeEntries.length > 0 && (
                                                                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                                            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                                                                <div className="flex items-center gap-2">
                                                                                    <MapPin size={16} className="text-emerald-500" />
                                                                                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Site Time</h3>
                                                                                </div>
                                                                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 border-none">{siteTimeEntries.length} Entries</Badge>
                                                                            </div>
                                                                            <div className="overflow-x-auto">
                                                                                <table className="w-full text-left border-collapse">
                                                                                    <thead>
                                                                                        <tr className="bg-white border-b border-slate-100">
                                                                                            <th className="p-3 text-[9px] uppercase font-bold text-slate-400">Employee</th>
                                                                                            <th className="p-3 text-[9px] uppercase font-bold text-slate-400 text-center">In</th>
                                                                                            <th className="p-3 text-[9px] uppercase font-bold text-slate-400 text-center">Out</th>
                                                                                            <th className="p-3 text-[9px] uppercase font-bold text-slate-400 text-right">Hrs</th>
                                                                                            <th className="p-3 text-[9px] uppercase font-bold text-slate-400 text-right w-20">Actions</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="text-xs text-slate-600 divide-y divide-slate-50">
                                                                                        {siteTimeEntries.map((ts: any, i: number) => {
                                                                                            const { hours } = calculateTimesheetData(ts, selectedSchedule.fromDate);
                                                                                            return (
                                                                                                <tr key={i} className="hover:bg-slate-50 group transition-colors">
                                                                                                    <td className="p-3">{renderEmployee(ts)}</td>
                                                                                                    <td className="p-3 text-center font-medium">
                                                                                                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100/50 text-[10px]">
                                                                                                            {formatTimeOnly(ts.clockIn)}
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td className="p-3 text-center font-medium">
                                                                                                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-100/50 text-[10px]">
                                                                                                            {formatTimeOnly(ts.clockOut)}
                                                                                                        </div>
                                                                                                    </td>
                                                                                                    <td className="p-3 text-right font-black text-[#0F4C75] text-[11px]">{hours > 0 ? hours.toFixed(2) : '-'}</td>
                                                                                                    <td className="p-3 text-right">{renderActions(ts)}</td>
                                                                                                </tr>
                                                                                            );
                                                                                        })}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {driveTimeEntries.length > 0 && (
                                                                        <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm ${siteTimeEntries.length > 0 ? 'mt-6' : ''}`}>
                                                                            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                                                                <div className="flex items-center gap-2">
                                                                                    <Car size={16} className="text-blue-500" />
                                                                                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Drive & Shop Time</h3>
                                                                                </div>
                                                                                <Badge className="bg-blue-50 text-blue-700 border-blue-100 border-none">{driveTimeEntries.length} Entries</Badge>
                                                                            </div>
                                                                            <div className="overflow-x-auto">
                                                                                <table className="w-full text-left border-collapse">
                                                                                    <thead>
                                                                                        <tr className="bg-white border-b border-slate-100">
                                                                                            <th className="p-3 text-[9px] uppercase font-bold text-slate-400">Employee</th>
                                                                                            <th className="p-3 text-[9px] uppercase font-bold text-slate-400 text-center">Date</th>
                                                                                            <th className="p-3 text-[9px] uppercase font-bold text-slate-400 text-center">Washout</th>
                                                                                            <th className="p-3 text-[9px] uppercase font-bold text-slate-400 text-center">Shop</th>
                                                                                            <th className="p-3 text-[9px] uppercase font-bold text-slate-400 text-left">Dist</th>
                                                                                            <th className="p-3 text-[9px] uppercase font-bold text-slate-400 text-right">Hrs</th>
                                                                                            <th className="p-3 text-[9px] uppercase font-bold text-slate-400 text-right w-20">Actions</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="text-xs text-slate-600 divide-y divide-slate-50">
                                                                                        {driveTimeEntries.map((ts: any, i: number) => {
                                                                                            const { hours, distance } = calculateTimesheetData(ts, selectedSchedule.fromDate);
                                                                                            
                                                                                            const getQty = (val: any, numericQty?: number) => {
                                                                                                if (typeof numericQty === 'number' && numericQty > 0) return numericQty;
                                                                                                const str = String(val || '');
                                                                                                const match = str.match(/\((\d+)\s+qty\)/);
                                                                                                if (match) return parseFloat(match[1]);
                                                                                                if (val === true || str.toLowerCase() === 'true' || str.toLowerCase() === 'yes') return 1;
                                                                                                return 0;
                                                                                            };
                                                                                            const washoutQty = getQty(ts.dumpWashout, ts.dumpQty);
                                                                                            const shopQty = getQty(ts.shopTime, ts.shopQty);

                                                                                            return (
                                                                                                <tr key={i} className="hover:bg-slate-50 group transition-colors">
                                                                                                    <td className="p-3">{renderEmployee(ts)}</td>
                                                                                                    <td className="p-3 text-center text-[11px] font-medium text-slate-600">
                                                                                                        {ts.clockIn ? new Date(ts.clockIn).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '-'}
                                                                                                    </td>
                                                                                                    <td className="p-3 text-center">
                                                                                                        {washoutQty > 0 ? (
                                                                                                            <span className="text-[9px] font-black uppercase bg-orange-500 text-white px-2 py-1 rounded shadow-sm inline-flex flex-col items-center min-w-[60px] justify-center leading-none gap-0.5">
                                                                                                                <span className="flex items-center gap-1">WASHOUT <CheckCircle2 size={10} /></span>
                                                                                                                <span className="text-[8px] opacity-90">{washoutQty} QTY</span>
                                                                                                            </span>
                                                                                                        ) : <span className="text-slate-300">-</span>}
                                                                                                    </td>
                                                                                                    <td className="p-3 text-center">
                                                                                                        {shopQty > 0 ? (
                                                                                                            <span className="text-[9px] font-black uppercase bg-blue-500 text-white px-2 py-1 rounded shadow-sm inline-flex flex-col items-center min-w-[60px] justify-center leading-none gap-0.5">
                                                                                                                <span className="flex items-center gap-1">SHOP <CheckCircle2 size={10} /></span>
                                                                                                                <span className="text-[8px] opacity-90">{shopQty} QTY</span>
                                                                                                            </span>
                                                                                                        ) : <span className="text-slate-300">-</span>}
                                                                                                    </td>
                                                                                                    <td className="p-3 text-left font-medium text-slate-500 text-[11px]">
                                                                                                        {distance > 0 ? (
                                                                                                            <button
                                                                                                                onClick={(e) => {
                                                                                                                    e.stopPropagation();
                                                                                                                    const isCoord = (val: any) => typeof val === 'string' && val.includes(',');
                                                                                                                    if (isCoord(ts.locationIn) && isCoord(ts.locationOut)) {
                                                                                                                        setSelectedMapRoute({ start: ts.locationIn, end: ts.locationOut, distance: distance });
                                                                                                                        setMapModalOpen(true);
                                                                                                                    }
                                                                                                                }}
                                                                                                                className={`hover:text-blue-600 ${ts.locationIn && ts.locationOut && typeof ts.locationIn === 'string' && ts.locationIn.includes(',') ? 'hover:underline cursor-pointer' : ''}`}
                                                                                                            >
                                                                                                                {distance.toFixed(1)} mi
                                                                                                            </button>
                                                                                                        ) : '-'}
                                                                                                    </td>
                                                                                                    <td className="p-3 text-right font-black text-[#0F4C75] text-[11px]">{hours > 0 ? hours.toFixed(2) : '-'}</td>
                                                                                                    <td className="p-3 text-right">{renderActions(ts)}</td>
                                                                                                </tr>
                                                                                            );
                                                                                        })}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                )}

                                                {/* TAB: POTHOLE LOGS */}
                                                {detailActiveTab === 'pothole' && (
                                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                        <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                                            <h4 className="text-[10px] font-bold text-slate-700 flex items-center gap-2">
                                                                <Circle size={12} /> Pothole Logs
                                                            </h4>
                                                            {detailPotholeLogs.length > 0 && <span className="text-[9px] bg-slate-200 px-1.5 py-0.5 rounded-full font-bold text-slate-600">{detailPotholeLogs.length}</span>}
                                                        </div>
                                                        {detailPotholeLoading ? (
                                                            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" size={20} /></div>
                                                        ) : detailPotholeLogs.length > 0 ? (
                                                            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                                                                {detailPotholeLogs.map((log: any, li: number) => (
                                                                    <div key={log._id || li} className="p-3">
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Log #{li + 1} — {log.date ? formatWallDate(log.date) : '-'}</p>
                                                                            {log.projectionLocation && <span className="text-[9px] text-slate-400">{log.projectionLocation}</span>}
                                                                        </div>
                                                                        {log.potholeItems?.length > 0 ? (
                                                                            <div className="overflow-hidden rounded-lg border border-slate-100">
                                                                                <table className="w-full text-left border-collapse">
                                                                                    <thead>
                                                                                        <tr className="bg-slate-50/80 border-b border-slate-100">
                                                                                            <th className="p-1.5 text-[8px] font-bold text-slate-400 uppercase">#</th>
                                                                                            <th className="p-1.5 text-[8px] font-bold text-slate-400 uppercase">Utility</th>
                                                                                            <th className="p-1.5 text-[8px] font-bold text-slate-400 uppercase">Soil</th>
                                                                                            <th className="p-1.5 text-[8px] font-bold text-slate-400 uppercase text-center">Top</th>
                                                                                            <th className="p-1.5 text-[8px] font-bold text-slate-400 uppercase text-center">Bottom</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="text-[10px] text-slate-600 divide-y divide-slate-50">
                                                                                        {log.potholeItems.map((item: any, ii: number) => (
                                                                                            <tr key={ii} className="hover:bg-blue-50/30 transition-colors">
                                                                                                <td className="p-1.5 font-bold text-slate-700">{item.potholeNo || ii + 1}</td>
                                                                                                <td className="p-1.5">{item.typeOfUtility || '-'}</td>
                                                                                                <td className="p-1.5">{item.soilType || '-'}</td>
                                                                                                <td className="p-1.5 text-center">{item.topDepthOfUtility || '-'}</td>
                                                                                                <td className="p-1.5 text-center">{item.bottomDepthOfUtility || '-'}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        ) : (
                                                                            <p className="text-[9px] text-slate-400 italic">No pothole items</p>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="p-8 text-center text-slate-400">
                                                                <Circle size={28} className="mx-auto mb-2 opacity-20" />
                                                                <p className="text-[10px] font-medium">No pothole logs found.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* TAB: PREBORE LOGS */}
                                                {detailActiveTab === 'prebore' && (
                                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                                        <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                                            <h4 className="text-[10px] font-bold text-slate-700 flex items-center gap-2">
                                                                <StopCircle size={12} /> Prebore Logs
                                                            </h4>
                                                            {detailPreboreLogs.length > 0 && <span className="text-[9px] bg-slate-200 px-1.5 py-0.5 rounded-full font-bold text-slate-600">{detailPreboreLogs.length}</span>}
                                                        </div>
                                                        {detailPreboreLoading ? (
                                                            <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" size={20} /></div>
                                                        ) : detailPreboreLogs.length > 0 ? (
                                                            <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                                                                {detailPreboreLogs.map((pb: any, pi: number) => (
                                                                    <div key={pb._id || pb.legacyId || pi} className="p-3">
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Bore #{pi + 1} — {pb.date ? formatWallDate(pb.date) : '-'}</p>
                                                                            {pb.devcoOperator && <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-bold border border-blue-100">{pb.devcoOperator}</span>}
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-1.5 mb-2">
                                                                            {pb.addressBoreStart && <div className="bg-slate-50 p-1.5 rounded-lg"><p className="text-[8px] text-slate-400 uppercase font-bold">Start</p><p className="text-[10px] font-medium text-slate-700 truncate">{pb.addressBoreStart}</p></div>}
                                                                            {pb.addressBoreEnd && <div className="bg-slate-50 p-1.5 rounded-lg"><p className="text-[8px] text-slate-400 uppercase font-bold">End</p><p className="text-[10px] font-medium text-slate-700 truncate">{pb.addressBoreEnd}</p></div>}
                                                                            {pb.drillSize && <div className="bg-slate-50 p-1.5 rounded-lg"><p className="text-[8px] text-slate-400 uppercase font-bold">Drill</p><p className="text-[10px] font-medium text-slate-700">{pb.drillSize}</p></div>}
                                                                            {pb.boreLength && <div className="bg-slate-50 p-1.5 rounded-lg"><p className="text-[8px] text-slate-400 uppercase font-bold">Length</p><p className="text-[10px] font-medium text-slate-700">{pb.boreLength}</p></div>}
                                                                            {pb.soilType && <div className="bg-slate-50 p-1.5 rounded-lg"><p className="text-[8px] text-slate-400 uppercase font-bold">Soil</p><p className="text-[10px] font-medium text-slate-700">{pb.soilType}</p></div>}
                                                                            {pb.pipeSize && <div className="bg-slate-50 p-1.5 rounded-lg"><p className="text-[8px] text-slate-400 uppercase font-bold">Pipe</p><p className="text-[10px] font-medium text-slate-700">{pb.pipeSize}</p></div>}
                                                                        </div>
                                                                        {pb.preBoreLogs?.length > 0 && (
                                                                            <div className="overflow-hidden rounded-lg border border-slate-100">
                                                                                <table className="w-full text-left border-collapse">
                                                                                    <thead>
                                                                                        <tr className="bg-slate-50/80 border-b border-slate-100">
                                                                                            <th className="p-1.5 text-[8px] font-bold text-slate-400 uppercase">Rod</th>
                                                                                            <th className="p-1.5 text-[8px] font-bold text-slate-400 uppercase text-center">Dist</th>
                                                                                            <th className="p-1.5 text-[8px] font-bold text-slate-400 uppercase text-center">Top</th>
                                                                                            <th className="p-1.5 text-[8px] font-bold text-slate-400 uppercase text-center">Bottom</th>
                                                                                            <th className="p-1.5 text-[8px] font-bold text-slate-400 uppercase text-center">O/U</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody className="text-[10px] text-slate-600 divide-y divide-slate-50">
                                                                                        {pb.preBoreLogs.map((rod: any, ri: number) => (
                                                                                            <tr key={ri} className="hover:bg-blue-50/30 transition-colors">
                                                                                                <td className="p-1.5 font-bold text-slate-700">{rod.rodNumber || ri + 1}</td>
                                                                                                <td className="p-1.5 text-center">{rod.distance || '-'}</td>
                                                                                                <td className="p-1.5 text-center">{rod.topDepth || '-'}</td>
                                                                                                <td className="p-1.5 text-center">{rod.bottomDepth || '-'}</td>
                                                                                                <td className="p-1.5 text-center">{rod.overOrUnder || '-'}</td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="p-8 text-center text-slate-400">
                                                                <StopCircle size={28} className="mx-auto mb-2 opacity-20" />
                                                                <p className="text-[10px] font-medium">No prebore logs found.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* TAB: CHAT */}
                                                {detailActiveTab === 'chat' && (
                                                    <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm min-h-[300px]">
                                                        {selectedSchedule.estimate ? (
                                                            <EstimateChat 
                                                                estimateId={selectedSchedule.estimate} 
                                                                currentUserEmail={currentUser?.email} 
                                                                employees={initialData.employees}
                                                                height="350px"
                                                            />
                                                        ) : (
                                                            <div className="h-[300px] flex flex-col items-center justify-center text-slate-400">
                                                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                                                    <FileText size={24} className="opacity-50" />
                                                                </div>
                                                                <p className="text-xs font-medium">No estimate linked to this schedule.</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="w-full text-center">
                                        <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center w-full">QUICK STATS</h4>
                                        <div className="space-y-4 w-full">
                                            <div className="grid grid-cols-2 gap-3">
                                                {/* Row 1 */}
                                                <div className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex flex-col items-center justify-center text-center col-span-2">
                                                    <p className="text-2xl font-black text-slate-800">{activeDayTab === 'all' ? totalCount : filteredSchedules.length}</p>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">TOTAL RECORDS</p>
                                                </div>
                                                {/* Row 2 */}
                                                <div className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex flex-col items-center justify-center text-center">
                                                    <p className="text-2xl font-black text-slate-800">{quickStats.jobs}</p>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">JOBS</p>
                                                </div>
                                                <div className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex flex-col items-center justify-center text-center">
                                                    <p className="text-2xl font-black text-slate-800">{quickStats.off}</p>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">OFF</p>
                                                </div>
                                                {/* Row 3 */}
                                                <div className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex flex-col items-center justify-center text-center">
                                                    <p className={`text-2xl font-black ${quickStats.jhas < quickStats.jobs ? 'text-red-500' : 'text-slate-800'}`}>{quickStats.jhas}</p>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">JHAS</p>
                                                </div>
                                                <div className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex flex-col items-center justify-center text-center">
                                                    <p className={`text-2xl font-black ${quickStats.djts < quickStats.jobs ? 'text-red-500' : 'text-slate-800'}`}>{quickStats.djts}</p>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">DJTS</p>
                                                </div>
                                                {/* Row 4 */}
                                                <div className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex flex-col items-center justify-center text-center">
                                                    <p className="text-2xl font-black text-slate-800">{quickStats.driveHours.toFixed(1)}</p>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">DRIVE HRS</p>
                                                </div>
                                                <div className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm flex flex-col items-center justify-center text-center">
                                                    <p className="text-2xl font-black text-slate-800">{quickStats.siteHours.toFixed(1)}</p>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">SITE HRS</p>
                                                </div>
                                                {/* Row 5 */}
                                                {selectedDates.length > 0 && (
                                                    <div className="bg-[#0F4C75] p-4 rounded-3xl shadow-lg shadow-blue-900/20 flex flex-col items-center justify-center text-center col-span-2">
                                                        <p className="text-3xl font-black text-white">{serverCapacity}%</p>
                                                        <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest mt-1">CAPACITY</p>
                                                    </div>
                                                )}
                                            </div>

                                            {dayOffStats.length > 0 && (
                                                <div className="mt-8">
                                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-4">UPCOMING TIME OFF</h3>
                                                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                                        {dayOffStats.map((stat, idx) => {
                                                            const person = stat.assignees?.[0]
                                                                ? initialData.employees.find((e: any) => e.value === stat.assignees[0])
                                                                : null;

                                                            const formatDate = (d: string) => {
                                                                if (!d) return '';
                                                                return formatWallDate(d);
                                                            };

                                                            const getWorkDays = (start: string, end: string) => {
                                                                if (!start || !end) return { count: 0, days: '' };

                                                                // Use UTC dates because handleSave anchors to "Z" (nominal time)
                                                                const s = new Date(start);
                                                                const e = new Date(end);

                                                                // Normalize to UTC midnight
                                                                const sUTC = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
                                                                const eUTC = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());

                                                                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                                                const daysFound: string[] = [];
                                                                let count = 0;

                                                                let current = sUTC;
                                                                while (current <= eUTC) {
                                                                    const d = new Date(current);
                                                                    const dayOfWeek = d.getUTCDay();

                                                                    count++;
                                                                    const name = dayNames[dayOfWeek];
                                                                    if (!daysFound.includes(name)) daysFound.push(name);

                                                                    current += 86400000; // Step by 1 day in ms
                                                                }

                                                                return { count, days: daysFound.join(', ') };
                                                            };

                                                            const { count, days } = getWorkDays(stat.fromDate, stat.toDate);

                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    onClick={() => {
                                                                        const assignee = stat.assignees?.[0];
                                                                        if (assignee) setFilterEmployee(assignee);
                                                                        setFilterTag('Day Off');

                                                                        // Create a range of dates for this specific time off
                                                                        const s = new Date(stat.fromDate);
                                                                        const e = new Date(stat.toDate);
                                                                        const sUTC = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
                                                                        const eUTC = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());

                                                                        const range = [];
                                                                        let cur = sUTC;
                                                                        while (cur <= eUTC) {
                                                                            const d = new Date(cur);
                                                                            range.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`);
                                                                            cur += 86400000;
                                                                        }
                                                                        setSelectedDates(range);

                                                                        // Reset page and refetch
                                                                        setPage(1);
                                                                        // Scroll to top of schedule
                                                                        if (scrollContainerRef.current) {
                                                                            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                                                                        }

                                                                        // Close mobile filters if open
                                                                        setShowMobileFilters(false);
                                                                        success(`Showing Time Off for ${person?.label || assignee}`);
                                                                    }}
                                                                    className="bg-white p-4 rounded-3xl border border-slate-50 shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-all text-left group"
                                                                >
                                                                    <p className="text-xs font-black text-slate-800 leading-tight flex items-center justify-between">
                                                                        {person?.label || stat.assignees?.[0] || 'Unknown'}
                                                                        {stat.isDayOffApproved && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
                                                                    </p>
                                                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                                                                        {formatDate(stat.fromDate)} - {formatDate(stat.toDate)}
                                                                    </p>
                                                                    <p className="text-xs font-black text-[#0F4C75] mt-2">
                                                                        {count} {count === 1 ? 'Day' : 'Days'} <span className="text-slate-400 font-bold ml-1">({days || 'Weekend'})</span>
                                                                    </p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>


                                </>
                            )}
                        </div>
                    </div>

                </div>
            </main >

            {/* Floating Action Button - Mobile Only */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={openCreateModal}
                        className="sm:hidden fixed bottom-24 right-6 z-50 w-14 h-14 bg-[#0F4C75] text-white rounded-full shadow-2xl hover:bg-[#0a3a5c] transition-all flex items-center justify-center group active:scale-95"
                    >
                        <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Create Schedule</p>
                </TooltipContent>
            </Tooltip>

            {/* Mobile Detail Bottom Sheet - xl:hidden */}
            {showMobileDetail && selectedSchedule && (
                <div className="xl:hidden fixed inset-0 z-[60] flex flex-col">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => { setShowMobileDetail(false); setSelectedSchedule(null); }}
                    />

                    {/* Bottom Sheet */}
                    <div className="relative mt-auto bg-white rounded-t-[24px] max-h-[75vh] flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl">
                        {/* Drag Handle & Header */}
                        <div className="shrink-0 bg-white rounded-t-[24px] pt-3 pb-2 px-4 border-b border-slate-100">
                            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-2" />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {(() => {
                                        const tagConstant = initialData.constants.find(c => c.description === selectedSchedule.item || c.value === selectedSchedule.item);
                                        const tagImage = tagConstant?.image;
                                        const tagColor = tagConstant?.color;
                                        const tagLabel = selectedSchedule.item || selectedSchedule.service || 'S';
                                        if (tagImage) {
                                            return (
                                                <div className="w-10 h-10 shrink-0 rounded-xl overflow-hidden shadow-sm border border-slate-100">
                                                    <img src={tagImage} alt={tagLabel} className="w-full h-full object-cover" />
                                                </div>
                                            );
                                        } else if (tagColor) {
                                            return (
                                                <div className="w-10 h-10 shrink-0 rounded-xl shadow-sm flex items-center justify-center text-white font-black text-xs" style={{ backgroundColor: tagColor }}>
                                                    {tagLabel.substring(0, 2).toUpperCase()}
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <div className="w-10 h-10 shrink-0 rounded-xl bg-[#E6EEF8] flex items-center justify-center text-[#0F4C75] font-black text-xs">
                                                    {tagLabel.substring(0, 2).toUpperCase()}
                                                </div>
                                            );
                                        }
                                    })()}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-black text-slate-900 truncate">{selectedSchedule.title || 'Schedule'}</p>
                                        <p className="text-[11px] text-slate-400 font-bold truncate">
                                            {selectedSchedule.item !== 'Day Off' ? getCustomerName(selectedSchedule) : selectedSchedule.item}
                                        </p>
                                        <div className="mt-1">
                                            <span className="text-[8px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 select-all">{selectedSchedule._id}</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setShowMobileDetail(false); setSelectedSchedule(null); }}
                                    className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors shrink-0 ml-2 self-start"
                                >
                                    <X size={16} className="text-slate-500" />
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {/* Date & Time */}
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 flex-wrap bg-slate-50 p-3 rounded-xl">
                                {selectedSchedule.item !== 'Day Off' && selectedSchedule.estimate && (
                                    <span 
                                        className="text-[#0F4C75] bg-[#E6EEF8] px-2 py-0.5 rounded-full text-[11px] hover:bg-[#b0cde8] transition-colors cursor-pointer shadow-sm active:scale-95 z-10 relative"
                                        onMouseEnter={() => router.prefetch(`/estimates/${selectedSchedule.estimate}`)} onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/estimates/${selectedSchedule.estimate}`);
                                        }}
                                    >
                                        {selectedSchedule.estimate.replace(/-[vV]\d+$/, '')}
                                    </span>
                                )}
                                <span>{formatWallDate(selectedSchedule.fromDate)}</span>
                                <span className="text-slate-300">•</span>
                                <span>{formatWallTime(selectedSchedule.fromDate)}</span>
                                <span>-</span>
                                <span>{selectedSchedule.toDate ? formatWallTime(selectedSchedule.toDate) : ''}</span>
                            </div>

                            {/* Address */}
                            {selectedSchedule.item !== 'Day Off' && (() => {
                                const est = initialData.estimates.find(e => e.value === selectedSchedule.estimate);
                                if (est?.jobAddress && est.jobAddress !== 'N/A') {
                                    return (
                                        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl">
                                            <MapPin size={14} className="text-slate-400 shrink-0" />
                                            <span className="font-medium">{est.jobAddress}</span>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* PM & Foreman */}
                            {selectedSchedule.item !== 'Day Off' && (selectedSchedule.projectManager || selectedSchedule.foremanName) && (
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { label: 'PM', val: selectedSchedule.projectManager, color: 'bg-blue-600' },
                                        { label: 'Foreman', val: selectedSchedule.foremanName, color: 'bg-emerald-600' }
                                    ].map((role, idx) => {
                                        if (!role.val) return null;
                                        const emp = initialData.employees.find(e => e.value?.toLowerCase() === role.val?.toLowerCase());
                                        const initials = emp?.label
                                            ? emp.label.split(' ').map((n: string) => n[0]).join('').toUpperCase()
                                            : role.val[0]?.toUpperCase() || '?';
                                        return (
                                            <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-[9px] shadow-sm overflow-hidden shrink-0 ${role.color}`}>
                                                    {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : initials}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">{role.label}</p>
                                                    <p className="text-[11px] font-bold text-slate-700 truncate">{emp?.label || role.val}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Assignees */}
                            {selectedSchedule.assignees && selectedSchedule.assignees.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Assignees</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(selectedSchedule.assignees || []).map((assignee: string, i: number) => {
                                            const emp = initialData.employees.find(e => e.value?.toLowerCase() === assignee?.toLowerCase());
                                            const initials = emp?.label
                                                ? emp.label.split(' ').map((n: string) => n[0]).join('').toUpperCase()
                                                : assignee[0]?.toUpperCase() || '?';
                                            return (
                                                <div key={i} className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 bg-slate-50 rounded-full border border-slate-100">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-[8px] font-black text-slate-600 shrink-0">
                                                        {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : initials}
                                                    </div>
                                                    <span className="text-[11px] font-bold text-slate-700 truncate max-w-[80px]">{emp?.label || assignee}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Description */}
                            {selectedSchedule.description && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Scope of Work</p>
                                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap line-clamp-4">
                                        {selectedSchedule.description}
                                    </p>
                                </div>
                            )}

                            {/* Aerial Image & Site Layout */}
                            <div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Aerial Image</p>
                                        {selectedSchedule.aerialImage ? (
                                            <div
                                                className="relative group cursor-pointer"
                                                onClick={() => setMediaModal({ isOpen: true, type: 'image', url: selectedSchedule.aerialImage!, title: 'Aerial Site View' })}
                                            >
                                                <img
                                                    src={selectedSchedule.aerialImage}
                                                    alt="Aerial View"
                                                    className="w-full h-28 object-cover rounded-xl border border-slate-200 shadow-sm"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-full h-28 bg-slate-50 rounded-xl flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1 opacity-40"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                                                <span className="text-[10px] font-medium">No aerial image</span>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Site Layout</p>
                                        {selectedSchedule.siteLayout ? (
                                            <div
                                                className="w-full h-28 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 cursor-pointer"
                                                onClick={() => {
                                                    const earthUrl = selectedSchedule.siteLayout!;
                                                    const coordsMatch = earthUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                                                    const lat = coordsMatch?.[1];
                                                    const lng = coordsMatch?.[2];
                                                    const embedUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}&t=k&z=19&ie=UTF8&iwloc=&output=embed` : '';
                                                    if (embedUrl) {
                                                        setMediaModal({ isOpen: true, type: 'map', url: embedUrl, title: 'Site Layout' });
                                                    } else {
                                                        window.open(earthUrl, '_blank');
                                                    }
                                                }}
                                            >
                                                <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                                                    <MapPin size={24} className="text-blue-600 mb-1" />
                                                    <span className="text-[10px] font-bold text-slate-600">View Map</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-full h-28 bg-slate-50 rounded-xl flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200">
                                                <MapPin size={24} className="mb-1 opacity-40" />
                                                <span className="text-[10px] font-medium">No site layout</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Today's Objectives */}
                            {selectedSchedule.todayObjectives && selectedSchedule.todayObjectives.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Today&apos;s Objectives</p>
                                    <div className="space-y-1.5">
                                        {selectedSchedule.todayObjectives.map((obj, i) => {
                                            const isCompleted = typeof obj === 'string' ? false : obj.completed;
                                            const text = typeof obj === 'string' ? obj : obj.text;
                                            return (
                                                <div
                                                    key={i}
                                                    className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer"
                                                    onClick={() => handleToggleObjective(selectedSchedule._id, i, isCompleted)}
                                                >
                                                    {isCompleted ? (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5 fill-emerald-100" />
                                                    ) : (
                                                        <Circle className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                                                    )}
                                                    <span className={`text-xs ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                                        {text}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Timesheets Summary */}
                            {selectedSchedule.timesheet && selectedSchedule.timesheet.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timesheets</p>
                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{selectedSchedule.timesheet.length}</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {selectedSchedule.timesheet.slice(0, 4).map((ts: any, idx: number) => {
                                            const emp = initialData.employees.find(e => e.value === ts.employee);
                                            const { hours } = calculateTimesheetData(ts, selectedSchedule.fromDate);
                                            return (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                                                    onClick={(e) => { e.stopPropagation(); handleViewTimesheet(selectedSchedule, ts, e); }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500 overflow-hidden shrink-0">
                                                            {emp?.image ? (
                                                                <img src={emp.image} className="w-full h-full object-cover" />
                                                            ) : (
                                                                emp?.label?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || '?'
                                                            )}
                                                        </div>
                                                        <span className="text-[11px] font-bold text-slate-700">{emp?.label || ts.employee}</span>
                                                    </div>
                                                    <span className="text-[11px] font-black text-[#0F4C75]">{hours}h</span>
                                                </div>
                                            );
                                        })}
                                        {selectedSchedule.timesheet.length > 4 && (
                                            <p className="text-[10px] text-slate-400 text-center font-bold">+{selectedSchedule.timesheet.length - 4} more</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sticky Action Buttons */}
                        <div className="shrink-0 bg-white border-t border-slate-100 p-3 pb-8 grid grid-cols-3 gap-2">
                            <button
                                onClick={() => { setShowMobileDetail(false); setEditingItem(selectedSchedule); setIsModalOpen(true); }}
                                className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-blue-50 text-blue-600 active:bg-blue-100 transition-colors"
                            >
                                <Edit size={16} />
                                <span className="text-[10px] font-bold">Edit</span>
                            </button>
                            <button
                                onClick={() => {
                                    setShowMobileDetail(false);
                                    const addDay = (dateStr: string) => {
                                        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
                                        if (!match) return dateStr;
                                        const [, year, month, day, hours, minutes] = match;
                                        const utcDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day) + 1));
                                        return `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, '0')}-${String(utcDate.getUTCDate()).padStart(2, '0')}T${hours}:${minutes}`;
                                    };
                                    const clonedItem = {
                                        ...selectedSchedule,
                                        _id: undefined,
                                        fromDate: addDay(selectedSchedule.fromDate),
                                        toDate: addDay(selectedSchedule.toDate),
                                        timesheet: [], hasJHA: false, jha: undefined, JHASignatures: [],
                                        hasDJT: false, djt: undefined, DJTSignatures: []
                                    };
                                    setEditingItem(clonedItem as any);
                                    setIsModalOpen(true);
                                }}
                                className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-emerald-50 text-emerald-600 active:bg-emerald-100 transition-colors"
                            >
                                <Copy size={16} />
                                <span className="text-[10px] font-bold">Copy +1d</span>
                            </button>
                            <button
                                onClick={() => { setShowMobileDetail(false); setDeleteId(selectedSchedule._id); setIsConfirmOpen(true); }}
                                className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-red-50 text-red-600 active:bg-red-100 transition-colors"
                            >
                                <Trash2 size={16} />
                                <span className="text-[10px] font-bold">Delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingItem?._id ? "Edit Schedule" : "New Schedule"}
                maxWidth="4xl"
                preventClose={true}
            >
                <form onSubmit={handleSave} className="py-2">
                    <div className="space-y-6 min-h-[400px]">
                        {/* Row 1: Tag, From Date, To Date - Always visible */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <SearchableSelect
                                    id="schedTag"
                                    label="Tag"
                                    placeholder="Select Tag"
                                    disableBlank={true}
                                    disabled={isEmployeeScope}
                                    options={initialData.constants.filter(c => c.type === 'Schedule Items').map(c => ({
                                        label: c.description,
                                        value: c.description,
                                        image: c.image,
                                        color: c.color
                                    }))}
                                    value={editingItem?.item || ''}
                                    onChange={(val) => {
                                        if (isEmployeeScope) return; // Extra safety
                                        const updates: any = { item: val };
                                        if (val === 'Day Off') {
                                            updates.title = 'Day Off';
                                        }
                                        setEditingItem(prev => ({ ...prev, ...updates }));
                                    }}
                                    onNext={() => { }}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-900">From Date & Time</label>
                                <input
                                    id="schedFromDate"
                                    type="datetime-local"
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                                    value={editingItem?.fromDate ? formatLocalDateTime(editingItem.fromDate) : ''}
                                    onChange={(e) => {
                                        // Store the value directly as string - NO Date object conversion
                                        // datetime-local gives us "YYYY-MM-DDTHH:mm" format
                                        const newFrom = e.target.value; // e.g., "2026-01-26T06:00"
                                        setEditingItem(prev => {
                                            if (!prev?.toDate) return { ...prev, fromDate: newFrom, toDate: newFrom };

                                            // Extract date part from new fromDate and time part from old toDate
                                            // Using string manipulation to avoid timezone conversion
                                            const newFromDatePart = newFrom.split('T')[0]; // "2026-01-26"
                                            const oldToTimePart = formatLocalDateTime(prev.toDate).split('T')[1] || '15:30'; // "HH:mm"

                                            const newToDateString = `${newFromDatePart}T${oldToTimePart}`;

                                            return {
                                                ...prev,
                                                fromDate: newFrom,
                                                toDate: newToDateString
                                            };
                                        });
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                        }
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-900">To Date & Time</label>
                                <input
                                    id="schedToDate"
                                    type="datetime-local"
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                                    min={editingItem?.fromDate ? formatLocalDateTime(editingItem.fromDate) : undefined}
                                    value={editingItem?.toDate ? formatLocalDateTime(editingItem.toDate) : ''}
                                    onChange={(e) => {
                                        // Store the value directly as string - NO Date object conversion
                                        setEditingItem(prev => prev ? { ...prev, toDate: e.target.value } : null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {/* Row 2: Client/Proposal (Left) & Title/Location (Right) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            {/* Left Column (Client, Proposal) */}
                            {editingItem?.item !== 'Day Off' && (
                                <div className="flex flex-col gap-4">
                                    <div className="space-y-2">
                                        <SearchableSelect
                                            id="schedClient"
                                            label="Client"
                                            placeholder="Select client"
                                            disableBlank={true}
                                            options={initialData.clients.map(c => ({ label: c.name, value: c._id }))}
                                            value={editingItem?.customerId || ''}
                                            onChange={(val) => {
                                                const client = initialData.clients.find(c => c._id === val);
                                                setEditingItem(prev => ({
                                                    ...prev,
                                                    customerId: val,
                                                    customerName: client?.name || '',
                                                    // Clear proposal if client changes
                                                    estimate: (prev?.customerId && prev.customerId !== val) ? '' : prev?.estimate
                                                }));
                                            }}
                                            onNext={() => { }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <SearchableSelect
                                            id="schedProposal"
                                            label="Proposal #"
                                            placeholder="Select proposal"
                                            disableBlank={true}
                                            options={initialData.estimates
                                                .filter(e => !editingItem?.customerId || (e.customerId && e.customerId.toString() === editingItem?.customerId?.toString()))
                                                .filter((e: any) => e.status?.toLowerCase() === 'won')
                                                .map(e => ({ label: e.label, value: e.value }))}
                                            value={editingItem?.estimate || ''}
                                            onChange={(val) => {
                                                const est = initialData.estimates.find(e => e.value === val);
                                                const client = initialData.clients.find(c => c._id === est?.customerId);

                                                // Smart Auto-fill
                                                setEditingItem(prev => ({
                                                    ...prev,
                                                    estimate: val,
                                                    // Auto-select client if not set or mismatch
                                                    customerId: est?.customerId || prev?.customerId,
                                                    customerName: client?.name || prev?.customerName,
                                                    // Auto-fill title if empty or user wants override (we prioritize estimate data if selected explicitly)
                                                    title: est?.projectTitle || est?.projectName || prev?.title || '',
                                                    // Auto-fill description from Scope of Work/Proposal
                                                    description: est?.scopeOfWork || prev?.description || '',
                                                    // Auto-fill services (multi-select capable)
                                                    service: Array.isArray(est?.services) ? est.services.join(', ') : (est?.services || prev?.service || ''),
                                                    // Auto-fill Fringe & CP
                                                    fringe: est?.fringe || prev?.fringe || 'No',
                                                    certifiedPayroll: est?.certifiedPayroll || prev?.certifiedPayroll || 'No',
                                                    // Store jobLocation for display
                                                    jobLocation: est?.jobAddress || prev?.jobLocation || '',
                                                    aerialImage: est?.aerialImage || (val ? '' : prev?.aerialImage),
                                                    siteLayout: est?.siteLayout || (val ? '' : prev?.siteLayout)
                                                }));
                                            }}
                                            onNext={() => { }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Right Column (Title/Reason, Job Location, Approved Checkbox) */}
                            <div className={`flex flex-col gap-4 ${editingItem?.item === 'Day Off' ? 'md:col-span-2' : ''}`}>
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-900">
                                        {editingItem?.item === 'Day Off' ? 'Reason' : 'Title'}
                                    </label>
                                    <input
                                        id="schedTitle"
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all h-[42px]"
                                        placeholder={editingItem?.item === 'Day Off' ? "Enter reason..." : "Project Main Phase"}
                                        value={editingItem?.title || ''}
                                        onChange={(e) => setEditingItem(prev => prev ? { ...prev, title: e.target.value } : null)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                            }
                                        }}
                                    />
                                </div>

                                {/* Job Location (read-only from estimate) */}
                                {editingItem?.item !== 'Day Off' && editingItem?.estimate && (() => {
                                    const est = initialData.estimates.find(e => e.value === editingItem?.estimate);
                                    const jobAddr = est?.jobAddress || editingItem?.jobLocation;
                                    if (!jobAddr) return null;
                                    return (
                                        <div className="space-y-2">
                                            <label className="block text-sm font-bold text-slate-900">Job Location</label>
                                            <div className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 h-[42px] overflow-hidden text-ellipsis whitespace-nowrap">
                                                {jobAddr}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {editingItem?.item === 'Day Off' && (
                                    <div className="flex items-center h-[42px]">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <div className="relative flex items-center">
                                                <input
                                                    type="checkbox"
                                                    className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-slate-300 shadow-sm transition-all checked:border-slate-800 checked:bg-slate-800 hover:border-slate-400 focus:ring-1 focus:ring-slate-800 focus:ring-offset-1"
                                                    checked={editingItem?.isDayOffApproved === true}
                                                    onChange={(e) => setEditingItem(prev => prev ? { ...prev, isDayOffApproved: e.target.checked } : null)}
                                                    disabled={isEmployeeScope}
                                                />
                                                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                                    </svg>
                                                </div>
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">Approved</span>
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Assignees & Staffing */}
                        <div className={`grid grid-cols-1 ${editingItem?.item !== 'Day Off' ? 'md:grid-cols-2' : ''} gap-6 items-start`}>
                            {/* Left Column */}
                            <div className="space-y-2 h-full">
                                <SearchableSelect
                                    id="schedTeam"
                                    label="Assignees"
                                    placeholder="Select Team"
                                    multiple
                                    chipLayout="col"
                                    className="h-full"
                                    disableBlank={true}
                                    options={initialData.employees
                                        .filter(emp => emp.isScheduleActive)
                                        .sort((a, b) => (a.label || '').localeCompare(b.label || ''))
                                        .map(emp => ({
                                            label: emp.label,
                                            value: emp.value,
                                            image: emp.image
                                        }))}
                                    value={editingItem?.assignees || []}
                                    onChange={(val) => {
                                        setEditingItem(prev => ({ ...prev, assignees: val }));
                                    }}
                                />
                            </div>

                            {/* Right Column (PM, Foreman) */}
                            {editingItem?.item !== 'Day Off' && (
                                <div className="flex flex-col gap-4">
                                    <div className="space-y-2">
                                        <SearchableSelect
                                            id="schedPM"
                                            label="Project Manager"
                                            placeholder="Select PM"
                                            disableBlank={true}
                                            options={initialData.employees
                                                .filter(emp => emp.designation?.toLowerCase().includes('project manager'))
                                                .map(emp => ({
                                                    label: emp.label,
                                                    value: emp.value,
                                                    image: emp.image
                                                }))}
                                            value={editingItem?.projectManager || ''}
                                            onChange={(val) => setEditingItem(prev => prev ? { ...prev, projectManager: val } : null)}
                                            onNext={() => { }}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <SearchableSelect
                                            id="schedForeman"
                                            label="Foreman"
                                            placeholder="Select Foreman"
                                            disableBlank={true}
                                            options={initialData.employees
                                                .filter(emp => emp.designation?.toLowerCase().includes('foreman'))
                                                .map(emp => ({
                                                    label: emp.label,
                                                    value: emp.value,
                                                    image: emp.image
                                                }))}
                                            value={editingItem?.foremanName || ''}
                                            onChange={(val) => setEditingItem(prev => prev ? { ...prev, foremanName: val } : null)}
                                            onNext={() => { }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {editingItem?.item !== 'Day Off' && (
                            <>






                                {/* Grid for Service, Notify, Per Diem, Fringe, CP */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                    {/* Left Column */}
                                    <div className="space-y-2 h-full">
                                        <SearchableSelect
                                            id="schedService"
                                            className="h-full"
                                            label="Service"
                                            placeholder="Select Service"
                                            chipLayout="col"
                                            multiple={true}
                                            disableBlank={true}
                                            options={initialData.constants.filter(c => c.type?.toLowerCase() === 'services').map(c => ({
                                                label: c.description,
                                                value: c.description,
                                                image: c.image,
                                                color: c.color
                                            }))}
                                            value={editingItem?.service ? Array.from(new Set(editingItem.service.split(',').map(s => s.trim()).filter(Boolean))) : []}
                                            onChange={(val) => {
                                                const strVal = Array.isArray(val) ? val.join(', ') : val;
                                                setEditingItem(prev => prev ? { ...prev, service: strVal } : null);
                                            }}
                                            onNext={() => { }}
                                        />
                                    </div>
                                    
                                    {/* Right Column */}
                                    <div className="flex flex-col gap-4">
                                        <div className="space-y-2">
                                            <SearchableSelect
                                                id="schedNotify"
                                                label="Notify Assignees"
                                                placeholder="Select"
                                                disableBlank={true}
                                                options={[
                                                    { label: 'No', value: 'No', color: '#ef4444' },
                                                    { label: 'Yes', value: 'Yes', color: '#22c55e' }
                                                ]}
                                                value={editingItem?.notifyAssignees === true ? 'Yes' : (editingItem?.notifyAssignees === false ? 'No' : (editingItem?.notifyAssignees || 'No'))}
                                                onChange={(val) => {
                                                    setEditingItem(prev => prev ? { ...prev, notifyAssignees: val } : null);
                                                }}
                                                onNext={() => { }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <SearchableSelect
                                                id="schedPerDiem"
                                                label="Per Diem Eligible"
                                                placeholder="Select"
                                                disableBlank={true}
                                                submitOnEnter={true}
                                                openOnFocus={true}
                                                options={[
                                                    { label: 'No', value: 'No', color: '#ef4444' },
                                                    { label: 'Yes', value: 'Yes', color: '#22c55e' }
                                                ]}
                                                value={editingItem?.perDiem === true ? 'Yes' : (editingItem?.perDiem === false ? 'No' : (editingItem?.perDiem || 'No'))}
                                                onChange={(val) => {
                                                    setEditingItem(prev => prev ? { ...prev, perDiem: val } : null);
                                                }}
                                                onNext={() => { }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <SearchableSelect
                                                id="schedFringe"
                                                label="Fringe"
                                                placeholder="Select Fringe"
                                                disableBlank={true}
                                                options={initialData.constants.filter(c => c.type === 'Fringe').map(c => ({
                                                    label: c.description,
                                                    value: c.description,
                                                    image: c.image,
                                                    color: c.color
                                                }))}
                                                value={editingItem?.fringe || ''}
                                                onChange={(val) => setEditingItem(prev => prev ? { ...prev, fringe: val } : null)}
                                                onNext={() => { }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <SearchableSelect
                                                id="schedCP"
                                                label="Certified Payroll"
                                                placeholder="Select CP"
                                                disableBlank={true}
                                                options={initialData.constants.filter(c => c.type === 'Certified Payroll').map(c => ({
                                                    label: c.description,
                                                    value: c.description,
                                                    image: c.image,
                                                    color: c.color
                                                }))}
                                                value={editingItem?.certifiedPayroll === true ? 'Yes' : (editingItem?.certifiedPayroll === false ? 'No' : (editingItem?.certifiedPayroll || ''))}
                                                onChange={(val) => setEditingItem(prev => prev ? { ...prev, certifiedPayroll: val } : null)}
                                                onNext={() => { }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Today's Objectives */}
                                <div className="space-y-2 mt-4">
                                    <label className="block text-sm font-bold text-slate-900">Today&apos;s objectives</label>
                                    <div className="flex gap-2">
                                        <input
                                            id="newObjective"
                                            type="text"
                                            placeholder="Enter objective..."
                                            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const val = e.currentTarget.value.trim();
                                                    if (val) {
                                                        e.preventDefault();
                                                        const current = Array.isArray(editingItem?.todayObjectives) ? editingItem.todayObjectives : [];
                                                        const newObjective: Objective = { text: val, completed: false };
                                                        setEditingItem(prev => prev ? { ...prev, todayObjectives: [...current, newObjective] } : null);
                                                        e.currentTarget.value = '';
                                                    }
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors"
                                            onClick={() => {
                                                const input = document.getElementById('newObjective') as HTMLInputElement;
                                                if (input && input.value.trim()) {
                                                    const val = input.value.trim();
                                                    const current = Array.isArray(editingItem?.todayObjectives) ? editingItem.todayObjectives : [];
                                                    const newObjective: Objective = { text: val, completed: false };
                                                    setEditingItem(prev => prev ? { ...prev, todayObjectives: [...current, newObjective] } : null);
                                                    input.value = '';
                                                }
                                            }}
                                        >
                                            Add
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {(Array.isArray(editingItem?.todayObjectives) ? editingItem.todayObjectives : []).map((obj: Objective | string, idx: number) => {
                                            const objText = typeof obj === 'string' ? obj : obj.text;
                                            const isCompleted = typeof obj === 'string' ? false : obj.completed;
                                            return (
                                                <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg group ${isCompleted ? 'bg-green-50 border-green-200' : 'bg-slate-100 border-slate-200'}`}>
                                                    <span className={`text-sm font-medium ${isCompleted ? 'text-green-700 line-through' : 'text-slate-700'}`}>{objText}</span>
                                                    <button
                                                        type="button"
                                                        className="text-slate-400 hover:text-red-500 transition-colors"
                                                        onClick={() => {
                                                            const current = Array.isArray(editingItem?.todayObjectives) ? editingItem.todayObjectives : [];
                                                            setEditingItem(prev => prev ? { ...prev, todayObjectives: current.filter((_: Objective | string, i: number) => i !== idx) } : null);
                                                        }}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Description - takes full width */}
                                <div className="space-y-2 mt-2">
                                    <label className="block text-sm font-bold text-slate-900">Scope of Work</label>
                                    <textarea
                                        id="schedDesc"
                                        rows={8}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all resize-y placeholder:text-slate-400"
                                        placeholder="Enter scope of work..."
                                        value={editingItem?.description || ''}
                                        onChange={(e) => setEditingItem(prev => prev ? { ...prev, description: e.target.value } : null)}
                                    />
                                </div>




                            </>
                        )}

                        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-6 py-2 bg-white border border-slate-200 text-slate-900 text-sm font-bold rounded-lg hover:bg-slate-50 transition-all font-sans"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 bg-[#1A1A1A] text-white text-sm font-bold rounded-lg hover:bg-black transition-all shadow-sm font-sans"
                            >
                                {editingItem?._id ? 'Update Schedule' : 'Create Schedule'}
                            </button>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Confirm Delete */}
            < ConfirmModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleDelete}
                title="Delete Schedule"
                message="Are you sure you want to delete this schedule? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />
            {/* JHA Details Modal */}
            <JHAModal
                isOpen={jhaModalOpen}
                onClose={() => setJhaModalOpen(false)}
                selectedJHA={selectedJHA}
                setSelectedJHA={setSelectedJHA}
                isEditMode={isJhaEditMode}
                setIsEditMode={setIsJhaEditMode}
                handleSave={handleSaveJHAForm}
                handleSaveSignature={handleSaveJHASignature}
                isGeneratingPDF={isGeneratingJHAPDF}
                handleDownloadPDF={handleDownloadJhaPdf}
                setEmailModalOpen={(open) => {
                    if (open && selectedJHA) {
                        // Find the schedule for this JHA
                        const schedule = schedules.find(s => s._id === (selectedJHA.schedule_id || selectedJHA._id)) || selectedJHA.scheduleRef;
                        // Find the estimate to get contactEmail
                        const estimate = initialData.estimates.find((e: any) => {
                            const estNum = e.value || e.estimate || e.estimateNum;
                            return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
                        });
                        // Pre-fill email with contactEmail from estimate
                        if (estimate?.contactEmail) {
                            setEmailTo(estimate.contactEmail);
                        } else {
                            setEmailTo('');
                        }
                    }
                    setEmailModalOpen(open);
                }}
                initialData={initialData}
                schedules={schedules}
                activeSignatureEmployee={activeSignatureEmployee}
                setActiveSignatureEmployee={setActiveSignatureEmployee}
            />

            {/* Daily Job Ticket Modal */}
            <ChangeOfScopeModal
                isOpen={changeOfScopeModalOpen}
                onClose={() => {
                    setChangeOfScopeModalOpen(false);
                    setSelectedScopeSchedule(null);
                }}
                schedule={selectedScopeSchedule}
                setSchedules={setSchedules}
            />

            <DJTModal
                isOpen={djtModalOpen}
                onClose={() => setDjtModalOpen(false)}
                selectedDJT={selectedDJT}
                setSelectedDJT={setSelectedDJT}
                isEditMode={isDjtEditMode}
                setIsEditMode={setIsDjtEditMode}
                handleSave={handleSaveDJTForm}
                handleSaveSignature={handleSaveDJTSignature}
                initialData={initialData}
                schedules={schedules}
                activeSignatureEmployee={activeSignatureEmployee}
                setActiveSignatureEmployee={setActiveSignatureEmployee}

                isSavingSignature={isSavingSignature}
                handleDownloadPDF={handleDownloadDjtPdf}
                isGeneratingPDF={isGeneratingDJTPDF}
                setEmailModalOpen={(open) => {
                    if (open && selectedDJT) {
                        // Find the schedule for this DJT
                        const schedule = schedules.find(s => s._id === (selectedDJT.schedule_id || selectedDJT._id)) || selectedDJT.scheduleRef;
                        // Find the estimate to get contactEmail
                        const estimate = initialData.estimates.find((e: any) => {
                            const estNum = e.value || e.estimate || e.estimateNum;
                            return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
                        });
                        // Pre-fill email with contactEmail from estimate
                        if (estimate?.contactEmail) {
                            setEmailTo(estimate.contactEmail);
                        } else {
                            setEmailTo('');
                        }
                    }
                    setEmailModalOpen(open);
                }}
            />

            {/* Individual Timesheet Modal */}
            <TimesheetModal
                isOpen={timesheetModalOpen}
                onClose={() => setTimesheetModalOpen(false)}
                selectedTimesheet={selectedTimesheet}
                setSelectedTimesheet={setSelectedTimesheet}
                isEditMode={isTimesheetEditMode}
                setIsEditMode={setIsTimesheetEditMode}
                handleSave={handleSaveIndividualTimesheet}
            />

            <DriveMapModal
                isOpen={mapModalOpen}
                onClose={() => setMapModalOpen(false)}
                startLocation={selectedMapRoute.start}
                endLocation={selectedMapRoute.end}
                distance={selectedMapRoute.distance}
            />

            {/* Media Modal (Lightbox) */}
            <Modal
                isOpen={mediaModal.isOpen}
                onClose={() => setMediaModal({ ...mediaModal, isOpen: false })}
                title={mediaModal.title}
                maxWidth={mediaModal.type === 'map' ? '6xl' : '4xl'}
            >
                <div className="p-1">
                    {mediaModal.type === 'image' ? (
                        <img
                            src={mediaModal.url}
                            alt={mediaModal.title}
                            className="w-full h-auto rounded-xl shadow-2xl border border-slate-200"
                        />
                    ) : (
                        <div className="w-full aspect-[16/10] rounded-xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-100">
                            <iframe
                                src={mediaModal.url}
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                className="w-full h-full"
                            />
                        </div>
                    )}
                    <div className="mt-6 flex justify-end gap-3">
                        {mediaModal.type === 'map' && (
                            <a
                                href={mediaModal.url.replace('&output=embed', '').replace('output=embed', '')}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg hover:shadow-blue-200/50 hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                                <MapPin size={18} />
                                Open in Google Earth
                            </a>
                        )}
                        <button
                            onClick={() => setMediaModal({ ...mediaModal, isOpen: false })}
                            className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-black hover:bg-slate-200 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Email JHA Modal */}
            <Modal
                isOpen={emailModalOpen}
                onClose={() => !isSendingEmail && setEmailModalOpen(false)}
                title="Email JHA Document"
                maxWidth="md"
            >
                <form onSubmit={handleEmailJhaPdf} className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                        <div className="bg-blue-100 p-2 rounded-full text-[#0F4C75]">
                            <Mail size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-[#0F4C75]">Send PDF via Email</p>
                            <p className="text-xs text-blue-800/70 mt-1">The JHA document will be attached as a PDF and sent to the recipient below.</p>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block font-sans">Recipient Email</label>
                        <input
                            type="email"
                            required
                            className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                            placeholder="Enter email address"
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                        <button
                            type="button"
                            onClick={() => setEmailModalOpen(false)}
                            disabled={isSendingEmail}
                            className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSendingEmail}
                            className="px-6 py-2 bg-[#0F4C75] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:bg-[#0b3c5e] active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSendingEmail ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                            {isSendingEmail ? 'Sending...' : 'Send Email'}
                        </button>
                    </div>
                </form>
            </Modal>
            <Modal
                isOpen={deleteConfirmation.isOpen}
                onClose={() => setDeleteConfirmation({ isOpen: false, tsId: null })}
                title="Delete Timesheet Entry"
            >
                <div className="p-4">
                    <p className="text-slate-600 mb-6">
                        Are you sure you want to delete this timesheet entry? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setDeleteConfirmation({ isOpen: false, tsId: null })}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDeleteTimesheet}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold shadow-md hover:bg-red-700 transition-colors"
                        >
                            Delete Entry
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Edit Timesheet Modal - Same as time-cards page */}
            <Modal
                isOpen={!!editingTimesheet}
                onClose={() => setEditingTimesheet(null)}
                title="Edit Timecard Record"
                maxWidth="2xl"
                noBlur={true}
                footer={
                    <>
                        <button
                            onClick={() => setEditingTimesheet(null)}
                            className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-bold text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveTimesheetEdit}
                            className="px-6 py-2 rounded-xl bg-[#0F4C75] text-white font-bold text-sm shadow-lg hover:shadow-xl hover:bg-[#0b3c5d] transition-all"
                        >
                            Save Changes
                        </button>
                    </>
                }
            >
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-2">
                    {/* Employee - Read Only when editing */}
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Employee</label>
                        <div className="w-full px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 font-medium text-slate-700 cursor-not-allowed">
                            {(() => {
                                const emp = initialData.employees.find((e: any) => e.value === editTimesheetForm.employee);
                                return (
                                    <div className="flex items-center gap-2">
                                        {emp?.image && (
                                            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0">
                                                <img src={emp.image} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        <span>{emp?.label || editTimesheetForm.employee || 'Unknown'}</span>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Estimate - Read Only when editing */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Estimate #</label>
                        <div className="w-full px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 font-medium text-slate-700 cursor-not-allowed truncate">
                            {(() => {
                                const est = initialData.estimates.find((e: any) => e.value === editTimesheetForm.estimate);
                                return est?.label || editTimesheetForm.estimate || '-';
                            })()}
                        </div>
                    </div>

                    {/* Schedule Date - Read Only when editing */}
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Schedule Date</label>
                        <div className="w-full px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 font-medium text-slate-700 cursor-not-allowed">
                            {(() => {
                                const schedule = schedules.find(s => s._id === editTimesheetForm.scheduleId);
                                if (schedule?.fromDate) {
                                    return formatWallDate(schedule.fromDate);
                                }
                                return '-';
                            })()}
                        </div>
                    </div>

                    {/* Entry Type - Read Only when editing */}
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Entry Type</label>
                        <div className="flex gap-3">
                            {['Drive Time', 'Site Time'].map(t => (
                                <div
                                    key={t}
                                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold text-center border-2 cursor-not-allowed ${(editTimesheetForm.type || '').trim().toLowerCase() === t.trim().toLowerCase()
                                            ? 'bg-[#0F4C75] border-[#0F4C75] text-white'
                                            : 'bg-slate-100 border-slate-200 text-slate-400'
                                        }`}
                                >
                                    {t}
                                </div>
                            ))}
                        </div>
                    </div>

                    {(editTimesheetForm.type || '').trim().toLowerCase() !== 'drive time' && (
                        <>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Clock In</label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                                    value={toLocalISO(editTimesheetForm.clockIn)}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val) {
                                            setEditTimesheetForm((prev: any) => ({ ...prev, clockIn: val + ':00.000Z' }));
                                        }
                                    }}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Lunch Start</label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                                    value={toLocalISO(editTimesheetForm.lunchStart)}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val) {
                                            setEditTimesheetForm((prev: any) => ({ ...prev, lunchStart: val + ':00.000Z' }));
                                        }
                                    }}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Lunch End</label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                                    value={toLocalISO(editTimesheetForm.lunchEnd)}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val) {
                                            setEditTimesheetForm((prev: any) => ({ ...prev, lunchEnd: val + ':00.000Z' }));
                                        }
                                    }}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-1 px-1">Clock Out</label>
                                <input
                                    type="datetime-local"
                                    className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700"
                                    value={toLocalISO(editTimesheetForm.clockOut)}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val) {
                                            setEditTimesheetForm((prev: any) => ({ ...prev, clockOut: val + ':00.000Z' }));
                                        }
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {(editTimesheetForm.type || '').trim().toLowerCase() === 'drive time' && (
                        <>
                            <div className="col-span-2 grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Distance (Mi)</label>
                                    <input
                                        type="number"
                                        placeholder="Manual"
                                        className="w-full px-4 py-3 rounded-xl bg-blue-50/50 border border-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                                        value={editTimesheetForm.manualDistance || ''}
                                        onChange={e => setEditTimesheetForm((prev: any) => ({ ...prev, manualDistance: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Location In</label>
                                    <input
                                        type="text"
                                        placeholder="Start loc"
                                        disabled={!!editTimesheetForm.manualDistance}
                                        className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700 ${editTimesheetForm.manualDistance ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200'
                                            }`}
                                        value={editTimesheetForm.locationIn || ''}
                                        onChange={e => setEditTimesheetForm((prev: any) => ({ ...prev, locationIn: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Location Out</label>
                                    <input
                                        type="text"
                                        placeholder="End loc"
                                        disabled={!!editTimesheetForm.manualDistance}
                                        className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-[#0F4C75] font-medium text-slate-700 ${editTimesheetForm.manualDistance ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200'
                                            }`}
                                        value={editTimesheetForm.locationOut || ''}
                                        onChange={e => setEditTimesheetForm((prev: any) => ({ ...prev, locationOut: e.target.value }))}
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
                                            const match = String(editTimesheetForm.dumpWashout || '').match(/\((\d+)\s+qty\)/);
                                            return match ? match[1] : (editTimesheetForm.dumpWashout === true || String(editTimesheetForm.dumpWashout).toLowerCase() === 'true' || String(editTimesheetForm.dumpWashout).toLowerCase() === 'yes' ? "1" : "");
                                        })()}
                                        onChange={e => {
                                            const qty = parseFloat(e.target.value);
                                            if (isNaN(qty) || qty <= 0) {
                                                setEditTimesheetForm((prev: any) => ({ ...prev, dumpWashout: "" }));
                                            } else {
                                                const val = `${(qty * 0.5).toFixed(2)} hrs (${qty} qty)`;
                                                setEditTimesheetForm((prev: any) => ({ ...prev, dumpWashout: val }));
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
                                            const match = String(editTimesheetForm.shopTime || '').match(/\((\d+)\s+qty\)/);
                                            return match ? match[1] : (editTimesheetForm.shopTime === true || String(editTimesheetForm.shopTime).toLowerCase() === 'true' || String(editTimesheetForm.shopTime).toLowerCase() === 'yes' ? "1" : "");
                                        })()}
                                        onChange={e => {
                                            const qty = parseFloat(e.target.value);
                                            if (isNaN(qty) || qty <= 0) {
                                                setEditTimesheetForm((prev: any) => ({ ...prev, shopTime: "" }));
                                            } else {
                                                const val = `${(qty * 0.25).toFixed(2)} hrs (${qty} qty)`;
                                                setEditTimesheetForm((prev: any) => ({ ...prev, shopTime: val }));
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
                                <span className="text-5xl font-black text-white tabular-nums tracking-tighter">{editingTimesheetCalculated.hours.toFixed(2)}</span>
                                <span className="text-xl font-bold text-slate-600">HRS</span>
                            </div>
                        </div>
                        {(editTimesheetForm.type || '').trim().toLowerCase() === 'drive time' && (
                            <div className="relative z-10 text-right">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Distance</p>
                                <div className="flex items-baseline gap-1 justify-end">
                                    <span className="text-3xl font-black text-blue-400 tabular-nums tracking-tighter">{editingTimesheetCalculated.distance.toFixed(1)}</span>
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
                            value={editTimesheetForm.comments || ''}
                            onChange={e => setEditTimesheetForm((prev: any) => ({ ...prev, comments: e.target.value }))}
                        />
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                isOpen={actionConfirm.isOpen}
                onClose={() => setActionConfirm(prev => ({ ...prev, isOpen: false }))}
                onConfirm={actionConfirm.onConfirm}
                title={actionConfirm.title}
                message={actionConfirm.message}
                confirmText={actionConfirm.confirmText}
                variant={actionConfirm.variant}
            />
        </div>
    );
}

export default function SchedulesTableClient({ serverData }: { serverData?: any }) {
    return (
        <Suspense fallback={<Loading />}>
            <SchedulesTable serverData={serverData} />
        </Suspense>
    );
}
