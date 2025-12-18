'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import {
    Plus, Trash2, Edit, Calendar as CalendarIcon, User, Search,
    Upload, Download, Filter, MoreHorizontal,
    ChevronRight, Clock, MapPin, Briefcase,
    CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronDown, ChevronUp, Bell, ArrowLeft, Users
} from 'lucide-react';

import {
    Header, AddButton, Card, SearchInput, Table, TableHead,
    TableBody, TableRow, TableHeader, TableCell, Pagination,
    EmptyState, Loading, Modal, ConfirmModal, Badge,
    SkeletonTable, SearchableSelect, BadgeTabs
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useAddShortcut } from '@/hooks/useAddShortcut';

interface ScheduleItem {
    _id: string;
    // recordId removed
    title: string;
    fromDate: string;
    toDate: string;
    customerId: string;
    customerName: string;
    estimate: string;
    jobLocation: string;
    projectManager: string;
    foremanName: string;
    SDName: string;
    assignees: string[];
    description: string;
    service: string;
    item: string;
    fringe: string;
    certifiedPayroll: string;
    notifyAssignees: string;
    perDiem: string;
    createdAt?: string;
    updatedAt?: string;
}

export default function SchedulePage() {
    const { success, error: toastError } = useToast();
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    // Initialize selectedDates with all days of the current week (Sunday to Saturday)
    const [selectedDates, setSelectedDates] = useState<string[]>(() => {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - dayOfWeek); // Go back to Sunday

        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            dates.push(dateStr);
        }
        return dates;
    });
    const [activeDayTab, setActiveDayTab] = useState<string>('all');
    const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<ScheduleItem> | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    // Initial data for dropdowns
    const [initialData, setInitialData] = useState<{
        clients: any[];
        employees: any[];
        constants: any[];
        estimates: any[];
    }>({ clients: [], employees: [], constants: [], estimates: [] });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const itemsPerPage = 12;

    const openCreateModal = () => {
        setEditingItem({
            fromDate: new Date().toISOString(),
            toDate: new Date().toISOString(),
            assignees: [],
            notifyAssignees: 'No',
            perDiem: 'No'
        });
        setIsModalOpen(true);
    };

    useAddShortcut(openCreateModal);


    const fetchPageData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getSchedulesPage' })
            });
            const data = await res.json();
            if (data.success) {
                setSchedules(data.result.schedules || []);
                setInitialData(data.result.initialData);
            }
        } catch (err) {
            console.error(err);
            toastError('Failed to fetch schedules');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPageData();
    }, []);

    // Format date as YYYY-MM-DD in local timezone (avoids UTC conversion issues)
    const formatLocalDate = (dateInput: string | Date) => {
        const date = new Date(dateInput);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const scheduledDatesRaw = useMemo(() => {
        return new Set(schedules.map(s => {
            try { return formatLocalDate(s.fromDate); }
            catch { return ''; }
        }));
    }, [schedules]);

    // Get day name from date string (using local timezone)
    const getDayName = (dateStr: string) => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        // Parse as local date by adding time component
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return days[date.getDay()];
    };

    // Generate day tabs based on selected dates
    const dayTabs = useMemo(() => {
        const dayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const daysInSelection = new Set<string>();

        selectedDates.forEach(dateStr => {
            daysInSelection.add(getDayName(dateStr));
        });

        // Count schedules per day
        const scheduleCounts: Record<string, number> = { all: 0 };
        dayOrder.forEach(d => scheduleCounts[d] = 0);

        schedules.forEach(s => {
            const scheduleDate = formatLocalDate(s.fromDate);
            if (selectedDates.length === 0 || selectedDates.includes(scheduleDate)) {
                const matchesSearch =
                    s.title?.toLowerCase().includes(search.toLowerCase()) ||
                    s.customerName?.toLowerCase().includes(search.toLowerCase()) ||
                    s.estimate?.toLowerCase().includes(search.toLowerCase()) ||
                    s.jobLocation?.toLowerCase().includes(search.toLowerCase());
                if (matchesSearch) {
                    scheduleCounts.all++;
                    const dayName = getDayName(scheduleDate);
                    scheduleCounts[dayName]++;
                }
            }
        });

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
            const matchesSearch =
                s.title?.toLowerCase().includes(search.toLowerCase()) ||
                s.customerName?.toLowerCase().includes(search.toLowerCase()) ||
                s.estimate?.toLowerCase().includes(search.toLowerCase()) ||
                s.jobLocation?.toLowerCase().includes(search.toLowerCase());

            if (selectedDates.length === 0 && activeDayTab === 'all') return matchesSearch;

            const scheduleDate = formatLocalDate(s.fromDate);
            const matchesSelectedDates = selectedDates.length === 0 || selectedDates.includes(scheduleDate);

            // Filter by day tab
            const dayName = getDayName(scheduleDate);
            const matchesDayTab = activeDayTab === 'all' || dayName === activeDayTab;

            return matchesSearch && matchesSelectedDates && matchesDayTab;
        });
    }, [schedules, search, selectedDates, activeDayTab]);

    const paginatedSchedules = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredSchedules.slice(start, start + itemsPerPage);
    }, [filteredSchedules, currentPage]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        // If updating, just update the single schedule
        if (editingItem?._id) {
            try {
                const res = await fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'updateSchedule', payload: { id: editingItem._id, ...editingItem } })
                });
                const data = await res.json();
                if (data.success) {
                    success('Schedule updated');
                    setIsModalOpen(false);
                    setEditingItem(null);
                    fetchPageData();
                } else {
                    toastError(data.error || 'Failed to update schedule');
                }
            } catch (err) {
                console.error(err);
                toastError('Error updating schedule');
            }
            return;
        }

        // For new schedules, create one per day in the range
        const fromDate = new Date(editingItem?.fromDate || new Date());
        const toDate = new Date(editingItem?.toDate || new Date());

        // Normalize to start of day to avoid timezone issues
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(0, 0, 0, 0);

        const schedulesToCreate: any[] = [];
        const currentDate = new Date(fromDate);

        while (currentDate <= toDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            // Generate MongoDB-compatible ObjectId (24 hex characters)
            const objectIdHex = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
            schedulesToCreate.push({
                ...editingItem,
                _id: objectIdHex,
                fromDate: dateStr,
                toDate: dateStr
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }

        try {
            // Use bulk create via import action for efficiency
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'importSchedules', payload: { schedules: schedulesToCreate } })
            });
            const data = await res.json();
            if (data.success) {
                success(`Created ${schedulesToCreate.length} schedule${schedulesToCreate.length > 1 ? 's' : ''}`);
                setIsModalOpen(false);
                setEditingItem(null);
                fetchPageData();
            } else {
                toastError(data.error || 'Failed to create schedules');
            }
        } catch (err) {
            console.error(err);
            toastError('Error creating schedules');
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deleteSchedule', payload: { id: deleteId } })
            });
            const data = await res.json();
            if (data.success) {
                success('Schedule deleted');
                setIsConfirmOpen(false);
                setDeleteId(null);
                fetchPageData();
            }
        } catch (err) {
            console.error(err);
            toastError('Error deleting schedule');
        }
    };

    const parseCSV = (csvText: string) => {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentField = '';
        let insideQuotes = false;
        const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        for (let i = 0; i < normalized.length; i++) {
            const char = normalized[i];
            const nextChar = normalized[i + 1];

            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    currentField += '"';
                    i++;
                } else {
                    insideQuotes = !insideQuotes;
                }
            } else if (char === ',' && !insideQuotes) {
                currentRow.push(currentField.trim());
                currentField = '';
            } else if (char === '\n' && !insideQuotes) {
                currentRow.push(currentField.trim());
                if (currentRow.some(c => c)) rows.push(currentRow);
                currentRow = [];
                currentField = '';
            } else {
                currentField += char;
            }
        }
        if (currentField || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            if (currentRow.some(c => c)) rows.push(currentRow);
        }
        return rows;
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const parsedRows = parseCSV(text);

                if (parsedRows.length < 2) throw new Error("File must contain at least a header and one data row.");

                const headers = parsedRows[0].map(h => h.replace(/^"|"$/g, '').trim());

                const data = parsedRows.slice(1).map(values => {
                    const obj: any = {};
                    headers.forEach((h, i) => {
                        if (values[i] !== undefined) {
                            let val = values[i].replace(/^"|"$/g, '').trim();

                            // Handle Array fields
                            if (h === 'assignees') {
                                obj[h] = val ? val.split(/[,;]/).map(v => v.trim()).filter(Boolean) : [];
                            }
                            else {
                                obj[h] = val;
                            }
                        }
                    });
                    if ((obj as any).recordId) {
                        (obj as any)._id = (obj as any).recordId;
                        delete (obj as any).recordId;
                    }
                    return obj;
                });

                const res = await fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importSchedules', payload: { schedules: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported ${data.length} schedules`);
                    fetchPageData();
                } else {
                    toastError(resData.error || 'Import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

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
                hour12: true
            });
        } catch (e) {
            return dateStr;
        }
    };

    const [currentDate, setCurrentDate] = useState(new Date());
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

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);
        return days;
    };

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            <Header
                rightContent={
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="hidden sm:block w-48 md:w-64">
                            <SearchInput
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search schedules..."
                            />
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImport}
                            className="hidden"
                            accept=".csv"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 sm:p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm hover:border-[#0F4C75] text-slate-600"
                            title="Import Schedules"
                        >
                            <Upload size={18} className={isImporting ? 'animate-pulse' : ''} />
                        </button>
                        <AddButton
                            onClick={openCreateModal}
                            label="Create Schedule"
                        />
                    </div>
                }
            />

            <main className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:h-[calc(100vh-80px)] lg:overflow-hidden">
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-0 h-full">

                    {/* LEFT COLUMN - CALENDAR - Full width on mobile, 25% on desktop */}
                    <div className="w-full lg:w-[25%] lg:h-full overflow-y-auto custom-scrollbar">
                        <div className="bg-[#F2F6FA] rounded-[24px] lg:rounded-[32px] p-3 sm:p-4 border border-white/40">

                            {/* Switcher */}
                            <div className="flex bg-[#E6EEF8] p-1.5 rounded-[20px] shadow-[inset_6px_6px_10px_#c9d1d9,inset_-6px_-6px_10px_#ffffff] mb-4 sm:mb-6">
                                <button
                                    onClick={() => setViewType('calendar')}
                                    className={`flex-1 py-2 sm:py-2.5 text-[10px] font-black rounded-2xl transition-all tracking-[0.1em] ${viewType === 'calendar' ? 'bg-[#E6EEF8] shadow-[4px_4px_8px_#c9d1d9,-4px_-4px_8px_#ffffff] text-slate-800' : 'text-slate-400'}`}
                                >
                                    CALENDAR
                                </button>
                                <button
                                    onClick={() => setViewType('timeline')}
                                    className={`flex-1 py-2 sm:py-2.5 text-[10px] font-black rounded-2xl transition-all tracking-[0.1em] ${viewType === 'timeline' ? 'bg-[#E6EEF8] shadow-[4px_4px_8px_#c9d1d9,-4px_-4px_8px_#ffffff] text-[#0F4C75]' : 'text-slate-400'}`}
                                >
                                    TIMELINE
                                </button>
                            </div>

                            {/* Days Mapping */}
                            <div className="grid grid-cols-7 mb-2 px-2">
                                {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(day => (
                                    <div key={day} className="text-center text-[10px] font-black text-slate-400 tracking-widest">{day}</div>
                                ))}
                            </div>

                            {/* Calendar Grid Container */}
                            <div className="bg-[#F0F5FA] rounded-[24px] lg:rounded-[32px] p-4 sm:p-6 shadow-[inset_8px_8px_16px_#d1d9e6,inset_-8px_-8px_16px_#ffffff]">
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <button
                                        onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                                        className="text-slate-400 hover:text-[#0F4C75] transition-colors scale-75"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <span className="text-sm sm:text-base font-black text-[#0F4C75] tracking-tight">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                                    <button
                                        onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                                        className="text-slate-400 hover:text-[#0F4C75] transition-colors scale-75"
                                    >
                                        <ChevronRight size={24} />
                                    </button>
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
                                            <div key={idx} className="flex justify-center items-center h-8 w-8 sm:h-10 sm:w-10 mx-auto">
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
                                        Friday, {currentDate.getDate()} {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
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

                    {/* MIDDLE COLUMN - SCHEDULE FEED - Full width on mobile */}
                    <div className={`w-full ${selectedSchedule ? 'lg:w-[30%]' : 'lg:w-[60%]'} lg:h-full overflow-y-auto px-2 sm:px-6 custom-scrollbar pb-10 bg-[#F0F5FA] rounded-[24px] lg:rounded-[32px] transition-all duration-500 ease-in-out`}>

                        {/* Day Filter Tabs */}
                        <div className="pt-4 pb-2 overflow-x-auto">
                            <BadgeTabs
                                tabs={dayTabs}
                                activeTab={activeDayTab}
                                onChange={setActiveDayTab}
                                size="sm"
                            />
                        </div>


                        {loading ? (
                            <SkeletonTable rows={8} columns={6} />
                        ) : filteredSchedules.length > 0 ? (
                            <div className={`grid grid-cols-1 ${selectedSchedule ? '' : 'md:grid-cols-2'} gap-4 sm:gap-6 pt-4 sm:pt-6 transition-all duration-500`}>
                                {paginatedSchedules.map((item) => (
                                    <div
                                        key={item._id}
                                        onClick={() => setSelectedSchedule(selectedSchedule?._id === item._id ? null : item)}
                                        className={`group relative bg-white rounded-[24px] sm:rounded-[40px] p-4 sm:p-7 cursor-pointer transition-all duration-300 transform border
                                            ${selectedSchedule?._id === item._id
                                                ? 'border-[#0F4C75] ring-4 ring-[#0F4C75]/10 shadow-[25px_25px_70px_#d1d9e6,-25px_-25px_70px_#ffffff] scale-[1.02]'
                                                : 'border-white/60 shadow-[20px_20px_60px_#d1d9e6,-20px_-20px_60px_#ffffff] hover:shadow-[25px_25px_70px_#d1d9e6,-25px_-25px_70px_#ffffff] hover:-translate-y-1'
                                            }
                                        `}
                                    >

                                        {/* Action Overlay */}
                                        <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingItem(item);
                                                    setIsModalOpen(true);
                                                }}
                                                className="p-2 bg-white/80 backdrop-blur rounded-full text-slate-500 hover:text-[#0F4C75] shadow-sm transition-colors"
                                            >
                                                <Edit size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteId(item._id);
                                                    setIsConfirmOpen(true);
                                                }}
                                                className="p-2 bg-white/80 backdrop-blur rounded-full text-slate-500 hover:text-red-500 shadow-sm transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>

                                        <div className="flex flex-col h-full justify-between">

                                            {/* Header: Icon (Tag) + Customer */}
                                            <div className="flex justify-between items-start mb-3 sm:mb-4">
                                                <div className="flex items-center gap-2 sm:gap-3">
                                                    {(() => {
                                                        // Find the tag constant for this schedule item
                                                        const tagConstant = initialData.constants.find(c => c.description === item.item);
                                                        const tagImage = tagConstant?.image;
                                                        const tagColor = tagConstant?.color;
                                                        const tagLabel = item.item || item.service || 'S';

                                                        if (tagImage) {
                                                            // Priority 1: Show image (filled circle)
                                                            return (
                                                                <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full overflow-hidden shadow-md">
                                                                    <img src={tagImage} alt={tagLabel} className="w-full h-full object-cover" />
                                                                </div>
                                                            );
                                                        } else if (tagColor) {
                                                            // Priority 2: Show color circle with letters
                                                            return (
                                                                <div
                                                                    className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full shadow-[inset_5px_5px_10px_rgba(0,0,0,0.1),inset_-5px_-5px_10px_rgba(255,255,255,0.5)] flex items-center justify-center text-white font-black text-xs sm:text-sm"
                                                                    style={{ backgroundColor: tagColor }}
                                                                >
                                                                    {tagLabel.substring(0, 2).toUpperCase()}
                                                                </div>
                                                            );
                                                        } else {
                                                            // Priority 3: Show letters with default styling
                                                            return (
                                                                <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full bg-[#E6EEF8] shadow-[inset_5px_5px_10px_#d1d9e6,inset_-5px_-5px_10px_#ffffff] flex items-center justify-center text-[#0F4C75] font-black text-xs sm:text-sm">
                                                                    {tagLabel.substring(0, 2).toUpperCase()}
                                                                </div>
                                                            );
                                                        }
                                                    })()}
                                                    <span className="text-xs sm:text-sm font-bold text-slate-500 truncate max-w-[80px] sm:max-w-[100px]">{item.customerName || 'Client'}</span>
                                                </div>
                                            </div>

                                            {/* Main Title */}
                                            <div className="mb-4 sm:mb-6">
                                                <h3 className="text-base sm:text-lg font-black text-slate-800 leading-tight mb-1 line-clamp-2 tracking-tight">
                                                    {item.title || 'Untitled Schedule'}
                                                </h3>
                                                <p className="text-[11px] sm:text-xs font-medium text-slate-400 truncate">{item.jobLocation}</p>
                                            </div>

                                            {/* Footer: Time + Assignees */}
                                            <div className="flex items-end justify-between mt-3 sm:mt-4">
                                                {/* Time Pill */}
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-100/50 flex items-center justify-center text-emerald-600 shadow-sm">
                                                        <Clock size={12} className="sm:w-3.5 sm:h-3.5" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</span>
                                                        <span className="text-[11px] sm:text-xs font-black text-slate-700">
                                                            {new Date(item.fromDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Avatars */}
                                                <div className="flex -space-x-2">
                                                    {(item.assignees || []).filter(Boolean).slice(0, 3).map((email, i) => (
                                                        <div key={i} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-200 border-2 border-[#F2F6FA] flex items-center justify-center text-[8px] sm:text-[9px] font-black text-slate-600 shadow-sm">
                                                            {email?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                    ))}
                                                    {(item.assignees || []).filter(Boolean).length > 3 && (
                                                        <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#38A169] border-2 border-[#F2F6FA] flex items-center justify-center text-[8px] sm:text-[9px] font-black text-white shadow-sm">
                                                            +{(item.assignees?.filter(Boolean).length || 0) - 3}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                title="No Schedules Found"
                                message="Start by creating your first project schedule or import from CSV."
                                icon="📅"
                            />
                        )}

                        {filteredSchedules.length > itemsPerPage && (
                            <div className="mt-12 flex justify-center">
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={Math.ceil(filteredSchedules.length / itemsPerPage)}
                                    onPageChange={setCurrentPage}
                                />
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN - DETAILS OR STATS - Hidden on mobile/tablet */}
                    <div className={`${selectedSchedule ? 'xl:w-[45%]' : 'xl:w-[15%]'} h-full border-l border-slate-100 pl-6 hidden xl:block overflow-y-auto custom-scrollbar transition-all duration-500 ease-in-out`}>
                        <div className="space-y-10 pt-4">
                            {selectedSchedule ? (
                                <div className="animate-in slide-in-from-right duration-300">
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">JOB DETAILS</h4>
                                        <button
                                            onClick={() => setSelectedSchedule(null)}
                                            className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            <XCircle size={20} />
                                        </button>
                                    </div>

                                    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
                                        {/* Status / Title */}
                                        <div>
                                            <Badge variant="success" className="mb-3 bg-emerald-100 text-emerald-700 border-none">Active</Badge>
                                            <h3 className="text-xl font-black text-slate-800 leading-tight">{selectedSchedule.title}</h3>
                                            <p className="text-sm font-bold text-[#0F4C75] mt-1">{selectedSchedule.customerName}</p>
                                        </div>

                                        {/* Info Grid */}
                                        <div className="space-y-4">
                                            <div className="flex gap-3">
                                                <div className="mt-0.5 text-slate-400"><CalendarIcon size={16} /></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">From</p>
                                                    <p className="text-sm font-bold text-slate-700">{formatDate(selectedSchedule.fromDate)}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="mt-0.5 text-slate-400"><ArrowLeft size={16} className="rotate-180" /></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">To</p>
                                                    <p className="text-sm font-bold text-slate-700">{formatDate(selectedSchedule.toDate)}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="mt-0.5 text-slate-400"><MapPin size={16} /></div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Location</p>
                                                    <p className="text-sm font-bold text-slate-700 leading-tight">{selectedSchedule.jobLocation || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Description */}
                                        {selectedSchedule.description && (
                                            <div className="pt-4 border-t border-slate-100">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Scope / Notes</p>
                                                <p className="text-xs text-slate-600 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                                                    {selectedSchedule.description}
                                                </p>
                                            </div>
                                        )}

                                        {/* Team */}
                                        <div className="pt-4 border-t border-slate-100">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-3">Assigned Team</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedSchedule.assignees?.map((email, i) => (
                                                    <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-600 border border-slate-200">
                                                        {email.split('@')[0]}
                                                    </span>
                                                )) || <span className="text-xs text-slate-400 italic">No assignees</span>}
                                            </div>
                                        </div>

                                        {/* Metadata */}
                                        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">PM</p>
                                                <p className="text-xs font-bold text-slate-700 truncate">{selectedSchedule.projectManager || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Foreman</p>
                                                <p className="text-xs font-bold text-slate-700 truncate">{selectedSchedule.foremanName || '-'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">QUICK STATS</h4>
                                        <div className="space-y-6">
                                            <div className="bg-white p-6 rounded-[32px] border border-slate-50 shadow-sm">
                                                <p className="text-3xl font-black text-slate-800">{filteredSchedules.length}</p>
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">TOTAL JOBS</p>
                                            </div>
                                            <div className="bg-[#0F4C75] p-6 rounded-[32px] shadow-lg shadow-blue-900/20">
                                                <p className="text-3xl font-black text-white">84%</p>
                                                <p className="text-[11px] font-black text-blue-100 uppercase tracking-widest mt-1">CAPACITY</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">NOTIFICATIONS</h4>
                                        <div className="space-y-4">
                                            <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-white">
                                                <div className="w-2 h-2 bg-rose-500 rounded-full mt-1.5 shrink-0 shadow-[0_0_8px_rgba(244,63,94,0.4)]"></div>
                                                <p className="text-xs font-bold text-slate-600 leading-snug">New import completed successfully.</p>
                                            </div>
                                            <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-white opacity-60">
                                                <div className="w-2 h-2 bg-slate-300 rounded-full mt-1.5 shrink-0"></div>
                                                <p className="text-xs font-bold text-slate-600 leading-snug">System backup finished.</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                </div>
            </main >

            {/* Create/Edit Modal */}
            < Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)
                }
                title={editingItem?._id ? "Edit Schedule" : "New Schedule"}
            >
                <form onSubmit={handleSave} className="p-6">
                    {/* Row 1: Title and Client */}
                    {/* Row 1: Title and Client */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Title</label>
                            <input
                                id="schedTitle"
                                autoFocus
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all"
                                placeholder="Project Main Phase"
                                required
                                value={editingItem?.title || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        document.getElementById('schedClient')?.focus();
                                    }
                                }}
                            />
                        </div>
                        <div>
                            <SearchableSelect
                                id="schedClient"
                                label="Client"
                                placeholder="Select client"
                                options={initialData.clients.map(c => ({ label: c.name, value: c._id }))}
                                value={editingItem?.customerId || ''}
                                onChange={(val) => {
                                    const client = initialData.clients.find(c => c._id === val);
                                    setEditingItem({
                                        ...editingItem,
                                        customerId: val,
                                        customerName: client?.name || '',
                                        estimate: '' // Clear estimate when client changes to avoid mismatch
                                    });
                                }}
                                onNext={() => document.getElementById('schedProposal')?.focus()}
                            />
                        </div>
                    </div>

                    {/* Row 2: Proposal #, From Date, To Date */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div>
                            <SearchableSelect
                                id="schedProposal"
                                label="Proposal #"
                                placeholder="Select proposal"
                                options={initialData.estimates
                                    .filter(e => !editingItem?.customerId || (e.customerId && e.customerId.toString() === editingItem.customerId.toString()))
                                    .map(e => ({ label: e.label, value: e.value }))}
                                value={editingItem?.estimate || ''}
                                onChange={(val) => {
                                    const est = initialData.estimates.find(e => e.value === val);
                                    setEditingItem({ ...editingItem, estimate: val });
                                }}
                                onNext={() => document.getElementById('schedFromDate')?.focus()}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">From Date</label>
                            <input
                                id="schedFromDate"
                                type="date"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all"
                                value={editingItem?.fromDate ? formatLocalDate(editingItem.fromDate) : ''}
                                onChange={(e) => setEditingItem({ ...editingItem, fromDate: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        document.getElementById('schedToDate')?.focus();
                                    }
                                }}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">To Date</label>
                            <input
                                id="schedToDate"
                                type="date"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all"
                                value={editingItem?.toDate ? formatLocalDate(editingItem.toDate) : ''}
                                onChange={(e) => setEditingItem({ ...editingItem, toDate: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        document.getElementById('schedDesc')?.focus();
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {/* Row 3: Description & Scope (left) + PM/Foreman/SD stacked (right) */}
                    <div className="flex flex-col md:flex-row gap-6 mb-10">
                        {/* Description - takes 2/3 width */}
                        <div className="flex-1 md:w-2/3">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description & Scope</label>
                            <textarea
                                id="schedDesc"
                                rows={6}
                                className="w-full h-full min-h-[180px] bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all resize-none"
                                placeholder="Enter detailed job instructions..."
                                value={editingItem?.description || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                            />
                        </div>

                        {/* PM, Foreman, SD - stacked vertically, takes 1/3 width */}
                        <div className="md:w-1/3 flex flex-col gap-4">
                            <SearchableSelect
                                id="schedPM"
                                label="Project Manager"
                                placeholder="Select PM"
                                options={initialData.employees.map(e => ({
                                    label: e.label,
                                    value: e.value,
                                    image: e.image
                                }))}
                                value={editingItem?.projectManager || ''}
                                onChange={(val) => setEditingItem({ ...editingItem, projectManager: val })}
                                onNext={() => document.getElementById('schedForeman')?.focus()}
                            />
                            <SearchableSelect
                                id="schedForeman"
                                label="Foreman"
                                placeholder="Select Foreman"
                                options={initialData.employees.map(e => ({
                                    label: e.label,
                                    value: e.value,
                                    image: e.image
                                }))}
                                value={editingItem?.foremanName || ''}
                                onChange={(val) => setEditingItem({ ...editingItem, foremanName: val })}
                                onNext={() => document.getElementById('schedSD')?.focus()}
                            />
                            <SearchableSelect
                                id="schedSD"
                                label="SD"
                                placeholder="Select SD"
                                options={initialData.employees.map(e => ({
                                    label: e.label,
                                    value: e.value,
                                    image: e.image
                                }))}
                                value={editingItem?.SDName || ''}
                                onChange={(val) => setEditingItem({ ...editingItem, SDName: val })}
                                onNext={() => document.getElementById('schedService')?.focus()}
                            />
                        </div>
                    </div>

                    {/* Row 5: Service, Tag (Schedule Item) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <SearchableSelect
                                id="schedService"
                                label="Service"
                                placeholder="Select Service"
                                options={initialData.constants.filter(c => c.type?.toLowerCase() === 'services').map(c => ({
                                    label: c.description,
                                    value: c.description,
                                    image: c.image,
                                    color: c.color
                                }))}
                                value={editingItem?.service || ''}
                                onChange={(val) => setEditingItem({ ...editingItem, service: val })}
                                onNext={() => document.getElementById('schedTag')?.focus()}
                            />
                        </div>
                        <div>
                            <SearchableSelect
                                id="schedTag"
                                label="Tag"
                                placeholder="Select Tag"
                                options={initialData.constants.filter(c => c.type === 'Schedule Items').map(c => ({
                                    label: c.description,
                                    value: c.description,
                                    image: c.image,
                                    color: c.color
                                }))}
                                value={editingItem?.item || ''}
                                onChange={(val) => setEditingItem({ ...editingItem, item: val })}
                                onNext={() => document.getElementById('schedFringe')?.focus()}
                            />
                        </div>
                    </div>

                    {/* Row 6: Fringe, Certified Payroll */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <SearchableSelect
                                id="schedFringe"
                                label="Fringe"
                                placeholder="Select Fringe"
                                options={initialData.constants.filter(c => c.type === 'Fringe').map(c => ({
                                    label: c.description,
                                    value: c.description,
                                    image: c.image,
                                    color: c.color
                                }))}
                                value={editingItem?.fringe || ''}
                                onChange={(val) => setEditingItem({ ...editingItem, fringe: val })}
                                onNext={() => document.getElementById('schedCP')?.focus()}
                            />
                        </div>
                        <div>
                            <SearchableSelect
                                id="schedCP"
                                label="Certified Payroll"
                                placeholder="Select CP"
                                options={initialData.constants.filter(c => c.type === 'Certified Payroll').map(c => ({
                                    label: c.description,
                                    value: c.description,
                                    image: c.image,
                                    color: c.color
                                }))}
                                value={editingItem?.certifiedPayroll || ''}
                                onChange={(val) => setEditingItem({ ...editingItem, certifiedPayroll: val })}
                                onNext={() => document.getElementById('schedTeam')?.focus()} // Focus Team checkbox
                            />
                        </div>
                    </div>

                    {/* Row 7: Assignees (Multi-select) */}
                    <div className="mb-6">
                        <SearchableSelect
                            id="schedTeam"
                            label="Assignees"
                            placeholder="Select Team Members"
                            multiple
                            options={initialData.employees.map(emp => ({
                                label: emp.label,
                                value: emp.value,
                                image: emp.image
                            }))}
                            value={editingItem?.assignees || []}
                            onChange={(val) => {
                                setEditingItem(prev => ({ ...prev, assignees: val }));
                            }}
                            onNext={() => document.getElementById('schedNotify')?.focus()}
                        />
                    </div>

                    {/* Row 8: Notify & Per Diem (Dropdowns) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <SearchableSelect
                                id="schedNotify"
                                label="Notify Assignees"
                                placeholder="Select Option"
                                disableBlank={true}
                                options={[
                                    { label: 'No', value: 'No', color: '#ef4444' }, // Red-500
                                    { label: 'Yes', value: 'Yes', color: '#22c55e' } // Green-500
                                ]}
                                value={editingItem?.notifyAssignees || 'No'}
                                onChange={(val) => {
                                    setEditingItem({
                                        ...editingItem,
                                        notifyAssignees: val
                                    });
                                }}
                                onNext={() => document.getElementById('schedPerDiem')?.focus()}
                            />
                        </div>
                        <div>
                            <SearchableSelect
                                id="schedPerDiem"
                                label="Per Diem Eligible"
                                placeholder="Select Option"
                                disableBlank={true}
                                submitOnEnter={true}
                                openOnFocus={true}
                                options={[
                                    { label: 'No', value: 'No', color: '#ef4444' },
                                    { label: 'Yes', value: 'Yes', color: '#22c55e' }
                                ]}
                                value={editingItem?.perDiem || 'No'}
                                onChange={(val) => {
                                    setEditingItem({ ...editingItem, perDiem: val });
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-8 py-2.5 bg-gradient-to-r from-[#0F4C75] to-[#3282B8] text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:scale-105 active:scale-95 transition-all"
                        >
                            {editingItem?._id ? 'Update Schedule' : 'Create Schedule'}
                        </button>
                    </div>
                </form>
            </Modal >

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
        </div >
    );
}
