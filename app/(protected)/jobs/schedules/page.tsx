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
    SkeletonTable
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useAddShortcut } from '@/hooks/useAddShortcut';

interface ScheduleItem {
    _id: string;
    recordId: string;
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
    notifyAssignees: string[];
    perDiem: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export default function SchedulePage() {
    const { success, error: toastError } = useToast();
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
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
            notifyAssignees: [],
            perDiem: false
        });
        setIsModalOpen(true);
    };

    useAddShortcut(openCreateModal);

    const fetchSchedules = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getSchedules' })
            });
            const data = await res.json();
            if (data.success) {
                setSchedules(data.result || []);
            }
        } catch (err) {
            console.error(err);
            toastError('Failed to fetch schedules');
        } finally {
            setLoading(false);
        }
    };

    const fetchInitialData = async () => {
        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getInitialData' })
            });
            const data = await res.json();
            if (data.success) {
                setInitialData(data.result);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchSchedules();
        fetchInitialData();
    }, []);

    const filteredSchedules = useMemo(() => {
        return schedules.filter(s =>
            s.title?.toLowerCase().includes(search.toLowerCase()) ||
            s.customerName?.toLowerCase().includes(search.toLowerCase()) ||
            s.estimate?.toLowerCase().includes(search.toLowerCase()) ||
            s.jobLocation?.toLowerCase().includes(search.toLowerCase())
        );
    }, [schedules, search]);

    const paginatedSchedules = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredSchedules.slice(start, start + itemsPerPage);
    }, [filteredSchedules, currentPage]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const action = editingItem?._id ? 'updateSchedule' : 'createSchedule';
        const payload = editingItem?._id ? { id: editingItem._id, ...editingItem } : editingItem;

        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload })
            });
            const data = await res.json();
            if (data.success) {
                success(editingItem?._id ? 'Schedule updated' : 'Schedule created');
                setIsModalOpen(false);
                setEditingItem(null);
                fetchSchedules();
            } else {
                toastError(data.error || 'Failed to save schedule');
            }
        } catch (err) {
            console.error(err);
            toastError('Error saving schedule');
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
                fetchSchedules();
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

                            // Handle Boolean fields
                            if (h === 'perDiem') {
                                obj[h] = val.toLowerCase() === 'true';
                            }
                            // Handle Array fields
                            else if (h === 'assignees' || h === 'notifyAssignees') {
                                obj[h] = val ? val.split(',').map(v => v.trim()) : [];
                            }
                            else {
                                obj[h] = val;
                            }
                        }
                    });
                    if (obj.recordId) obj._id = obj.recordId;
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
                    fetchSchedules();
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
                    <div className="flex items-center gap-3">
                        <div className="w-64">
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
                            className="p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm hover:border-[#0F4C75] text-slate-600"
                            title="Import Schedules"
                        >
                            <Upload size={20} className={isImporting ? 'animate-pulse' : ''} />
                        </button>
                        <AddButton
                            onClick={openCreateModal}
                            label="Create Schedule"
                        />
                    </div>
                }
            />

            <main className="max-w-[1800px] mx-auto px-6 py-6 h-[calc(100vh-80px)] overflow-hidden">
                <div className="flex gap-8 h-full">

                    {/* LEFT COLUMN - 30% - CALENDAR */}
                    <div className="w-[30%] h-full overflow-y-auto pr-4 custom-scrollbar">
                        <div className="bg-[#E6EEF8] rounded-[32px] p-6 border border-white/40">

                            {/* Switcher */}
                            <div className="flex bg-[#E6EEF8] p-1.5 rounded-[20px] shadow-[inset_6px_6px_10px_#c9d1d9,inset_-6px_-6px_10px_#ffffff] mb-6">
                                <button
                                    onClick={() => setViewType('calendar')}
                                    className={`flex-1 py-2.5 text-[10px] font-black rounded-2xl transition-all tracking-[0.1em] ${viewType === 'calendar' ? 'bg-[#E6EEF8] shadow-[4px_4px_8px_#c9d1d9,-4px_-4px_8px_#ffffff] text-slate-800' : 'text-slate-400'}`}
                                >
                                    CALENDAR
                                </button>
                                <button
                                    onClick={() => setViewType('timeline')}
                                    className={`flex-1 py-2.5 text-[10px] font-black rounded-2xl transition-all tracking-[0.1em] ${viewType === 'timeline' ? 'bg-[#E6EEF8] shadow-[4px_4px_8px_#c9d1d9,-4px_-4px_8px_#ffffff] text-[#0F4C75]' : 'text-slate-400'}`}
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
                            <div className="bg-[#F0F5FA] rounded-[32px] p-4 shadow-[inset_10px_10px_20px_#d9e2ed,inset_-10px_-10px_20px_#ffffff]">
                                <div className="flex items-center justify-between mb-4 px-2">
                                    <button
                                        onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}
                                        className="text-slate-400 hover:text-[#0F4C75] transition-colors scale-75"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <span className="text-base font-black text-[#0F4C75] tracking-tight">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
                                    <button
                                        onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}
                                        className="text-slate-400 hover:text-[#0F4C75] transition-colors scale-75"
                                    >
                                        <ChevronRight size={24} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-7 gap-y-1">
                                    {getDaysInMonth(currentDate).map((day, idx) => (
                                        <div key={idx} className="flex justify-center items-center h-9">
                                            {day ? (
                                                <button
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all relative
                                                        ${day === 6 ? 'bg-[#50C878] text-white shadow-[0_4px_10px_rgba(80,200,120,0.4)]' :
                                                            (day >= 15 && day <= 17) ? 'bg-[#0F4C75] text-white shadow-md' :
                                                                (day === 25 || day === 26) ? 'bg-[#FF6B6B] text-white shadow-md' :
                                                                    [7, 14, 21, 28].includes(day) ? 'text-rose-400' : 'text-slate-500 hover:bg-white hover:text-[#0F4C75] hover:shadow-sm'}
                                                    `}
                                                >
                                                    {day}
                                                    {day === 27 && <div className="absolute -bottom-1 w-1 h-1 bg-[#FF6B6B] rounded-full"></div>}
                                                </button>
                                            ) : null}
                                        </div>
                                    ))}
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

                    {/* MIDDLE COLUMN - 55% - SCHEDULE FEED */}
                    <div className="w-[55%] h-full overflow-y-auto px-2 custom-scrollbar pb-10">
                        <div className="flex items-center justify-between mb-8 sticky top-0 bg-[#F8FAFC]/80 backdrop-blur-md py-4 z-10">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Active Schedules</h2>
                            <div className="flex items-center gap-3">
                                <Badge variant="info" className="bg-[#0F4C75]/10 text-[#0F4C75] border-none font-black px-4 py-1.5">
                                    {filteredSchedules.length} SCHEDULES
                                </Badge>
                                <button className="p-3 bg-white shadow-sm border border-slate-100 rounded-2xl text-slate-400 hover:text-[#0F4C75] transition-all"><Filter size={20} /></button>
                            </div>
                        </div>

                        {loading ? (
                            <SkeletonTable rows={8} columns={6} />
                        ) : filteredSchedules.length > 0 ? (
                            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-8">
                                {paginatedSchedules.map((item) => (
                                    <div key={item._id} className="group relative bg-[#F2F6FA] rounded-[48px] p-7 shadow-[16px_16px_32px_#d1d9e6,-16px_-16px_32px_#ffffff] hover:shadow-[20px_20px_40px_#d1d9e6,-20px_-20px_40px_#ffffff] transition-all duration-300 transform hover:-translate-y-1 overflow-hidden border border-white/50">

                                        {/* Action Overlay */}
                                        <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingItem(item);
                                                    setIsModalOpen(true);
                                                }}
                                                className="p-3 bg-white/80 backdrop-blur rounded-full text-slate-500 hover:text-[#0F4C75] shadow-md transition-colors"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setDeleteId(item._id);
                                                    setIsConfirmOpen(true);
                                                }}
                                                className="p-3 bg-white/80 backdrop-blur rounded-full text-slate-500 hover:text-red-500 shadow-md transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="flex flex-col h-full justify-between">

                                            {/* Header Section */}
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="flex-1 pr-12">
                                                    <h3 className="text-2xl font-black text-slate-800 leading-tight mb-2 line-clamp-2 tracking-tight">
                                                        {item.title || 'Untitled Schedule'}
                                                    </h3>
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                                        <span>Via</span>
                                                        <span className="text-[#0F4C75]">{item.customerName || 'Direct Client'}</span>
                                                    </div>
                                                </div>

                                                {/* Brand/Type Icon */}
                                                <div className="w-14 h-14 shrink-0 rounded-[20px] bg-white shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] flex items-center justify-center text-[#0F4C75]">
                                                    {item.jobLocation ? <MapPin size={24} /> : <Briefcase size={24} />}
                                                </div>
                                            </div>

                                            {/* Footer Section */}
                                            <div className="flex items-end justify-between mt-4">
                                                {/* Date Pill */}
                                                <div className="bg-[#4299E1] text-white px-5 py-3 rounded-full shadow-[6px_6px_12px_#b3cee5,-6px_-6px_12px_#ffffff] flex items-center gap-2 transform transition-transform group-hover:scale-105">
                                                    <Clock size={14} className="text-blue-100" />
                                                    <span className="text-[11px] font-black tracking-wide uppercase">
                                                        {new Date(item.fromDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>

                                                {/* Avatar Stack */}
                                                <div className="flex -space-x-3 items-center pl-2">
                                                    {(item.assignees || []).slice(0, 3).map((email, i) => (
                                                        <div key={i} className="w-10 h-10 rounded-full bg-slate-200 border-[3px] border-[#F2F6FA] flex items-center justify-center text-[10px] font-black text-slate-600 shadow-sm z-10 relative">
                                                            {email[0].toUpperCase()}
                                                        </div>
                                                    ))}
                                                    {(item.assignees || []).length > 3 && (
                                                        <div className="w-10 h-10 rounded-full bg-[#38A169] border-[3px] border-[#F2F6FA] flex items-center justify-center text-[10px] font-black text-white shadow-sm z-20 relative">
                                                            {(item.assignees?.length || 0) - 3}+
                                                        </div>
                                                    )}
                                                    {(item.assignees || []).length === 0 && (
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 border-[3px] border-[#F2F6FA] flex items-center justify-center shadow-sm">
                                                            <User size={16} className="text-slate-300" />
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

                    {/* RIGHT COLUMN - 15% - PLACEHOLDER / STATS */}
                    <div className="w-[15%] h-full border-l border-slate-100 pl-6 hidden xl:block overflow-y-auto no-scrollbar">
                        <div className="space-y-10 pt-4">
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
                        </div>
                    </div>

                </div>
            </main>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingItem?._id ? "Edit Schedule" : "New Schedule"}
            >
                <form onSubmit={handleSave} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Record ID (Required)</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all"
                                    placeholder="e.g. SCH-001"
                                    required
                                    value={editingItem?.recordId || ''}
                                    onChange={(e) => setEditingItem({ ...editingItem, recordId: e.target.value })}
                                    disabled={!!editingItem?._id}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Schedule Title</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all"
                                    placeholder="Project Main Phase"
                                    required
                                    value={editingItem?.title || ''}
                                    onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">From Date</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all"
                                        value={editingItem?.fromDate ? new Date(editingItem.fromDate).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => setEditingItem({ ...editingItem, fromDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">To Date</label>
                                    <input
                                        type="datetime-local"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all"
                                        value={editingItem?.toDate ? new Date(editingItem.toDate).toISOString().slice(0, 16) : ''}
                                        onChange={(e) => setEditingItem({ ...editingItem, toDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Location</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all"
                                    placeholder="123 Jobsite Ave, City"
                                    value={editingItem?.jobLocation || ''}
                                    onChange={(e) => setEditingItem({ ...editingItem, jobLocation: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Assignments */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Client</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all appearance-none"
                                        value={editingItem?.customerId || ''}
                                        onChange={(e) => {
                                            const client = initialData.clients.find(c => c._id === e.target.value);
                                            setEditingItem({ ...editingItem, customerId: e.target.value, customerName: client?.name || '' });
                                        }}
                                    >
                                        <option value="">Select Client</option>
                                        {initialData.clients.map(c => (
                                            <option key={c._id} value={c._id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Estimate #</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all appearance-none"
                                        value={editingItem?.estimate || ''}
                                        onChange={(e) => setEditingItem({ ...editingItem, estimate: e.target.value })}
                                    >
                                        <option value="">Select Estimate</option>
                                        {initialData.estimates.map(e => (
                                            <option key={e.value} value={e.value}>{e.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Project Manager</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all appearance-none"
                                    value={editingItem?.projectManager || ''}
                                    onChange={(e) => setEditingItem({ ...editingItem, projectManager: e.target.value })}
                                >
                                    <option value="">Select PM</option>
                                    {initialData.employees.map(e => (
                                        <option key={e.value} value={e.value}>{e.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Foreman</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all appearance-none"
                                        value={editingItem?.foremanName || ''}
                                        onChange={(e) => setEditingItem({ ...editingItem, foremanName: e.target.value })}
                                    >
                                        <option value="">Select Foreman</option>
                                        {initialData.employees.map(e => (
                                            <option key={e.value} value={e.value}>{e.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">SD Name</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all appearance-none"
                                        value={editingItem?.SDName || ''}
                                        onChange={(e) => setEditingItem({ ...editingItem, SDName: e.target.value })}
                                    >
                                        <option value="">Select SD</option>
                                        {initialData.employees.map(e => (
                                            <option key={e.value} value={e.value}>{e.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Description Area */}
                    <div className="mt-6">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description & Scope</label>
                        <textarea
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all resize-none"
                            placeholder="Enter detailed job instructions..."
                            value={editingItem?.description || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                        />
                    </div>

                    {/* Constants Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Service</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all appearance-none"
                                value={editingItem?.service || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, service: e.target.value })}
                            >
                                <option value="">Select Service</option>
                                {initialData.constants.filter(c => c.type === 'services').map(c => (
                                    <option key={c._id} value={c.description}>{c.description}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Schedule Item</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all appearance-none"
                                value={editingItem?.item || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, item: e.target.value })}
                            >
                                <option value="">Select Item</option>
                                {initialData.constants.filter(c => c.type === 'Schedule Items').map(c => (
                                    <option key={c._id} value={c.description}>{c.description}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fringe</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all appearance-none"
                                value={editingItem?.fringe || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, fringe: e.target.value })}
                            >
                                <option value="">Select Fringe</option>
                                {initialData.constants.filter(c => c.type === 'Fringe').map(c => (
                                    <option key={c._id} value={c.description}>{c.description}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Certified Payroll</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all appearance-none"
                                value={editingItem?.certifiedPayroll || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, certifiedPayroll: e.target.value })}
                            >
                                <option value="">Select CP</option>
                                {initialData.constants.filter(c => c.type === 'Certified Payroll').map(c => (
                                    <option key={c._id} value={c.description}>{c.description}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Multiselects */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assignees (Team)</label>
                            <div className="max-h-40 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                {initialData.employees.map(emp => (
                                    <label key={emp.value} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-[#0F4C75] focus:ring-[#0F4C75]"
                                            checked={(editingItem?.assignees || []).includes(emp.value)}
                                            onChange={(e) => {
                                                const current = editingItem?.assignees || [];
                                                const next = e.target.checked
                                                    ? [...current, emp.value]
                                                    : current.filter(v => v !== emp.value);
                                                setEditingItem({ ...editingItem, assignees: next });
                                            }}
                                        />
                                        <span className="text-sm text-slate-700">{emp.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notify Assignees</label>
                            <div className="max-h-40 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                {initialData.employees.map(emp => (
                                    <label key={emp.value} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-[#0F4C75] focus:ring-[#0F4C75]"
                                            checked={(editingItem?.notifyAssignees || []).includes(emp.value)}
                                            onChange={(e) => {
                                                const current = editingItem?.notifyAssignees || [];
                                                const next = e.target.checked
                                                    ? [...current, emp.value]
                                                    : current.filter(v => v !== emp.value);
                                                setEditingItem({ ...editingItem, notifyAssignees: next });
                                            }}
                                        />
                                        <span className="text-sm text-slate-700">{emp.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="inline-flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <input
                                type="checkbox"
                                id="perDiem"
                                className="w-5 h-5 rounded border-slate-300 text-[#0F4C75] focus:ring-[#0F4C75]"
                                checked={editingItem?.perDiem || false}
                                onChange={(e) => setEditingItem({ ...editingItem, perDiem: e.target.checked })}
                            />
                            <label htmlFor="perDiem" className="text-sm font-bold text-slate-700">Per Diem Eligible</label>
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
            </Modal>

            {/* Confirm Delete */}
            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleDelete}
                title="Delete Schedule"
                message="Are you sure you want to delete this schedule? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />
        </div>
    );
}
