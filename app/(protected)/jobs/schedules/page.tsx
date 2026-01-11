'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import {
    Plus, Trash2, Edit, Calendar as CalendarIcon, User, Search,
    Upload, Download, Filter, MoreHorizontal,
    ChevronRight, Clock, MapPin, Briefcase, Phone,
    CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronDown, ChevronUp, Bell, ArrowLeft, Users, Import, ClipboardList, FilePlus, Loader2, X
} from 'lucide-react';

import SignaturePad from './SignaturePad';

import {
    Header, AddButton, Card, SearchInput, Table, TableHead,
    TableBody, TableRow, TableHeader, TableCell, Pagination,
    EmptyState, Loading, Modal, ConfirmModal, Badge,
    SkeletonTable, SearchableSelect, BadgeTabs, MyDropDown
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
    assignees: string[];
    description: string;
    service: string;
    item: string;
    fringe: string;
    certifiedPayroll: string;
    notifyAssignees: string;
    perDiem: string;
    aerialImage?: string;
    siteLayout?: string;
    createdAt?: string;
    updatedAt?: string;
    timesheet?: any[];
    hasJHA?: boolean;
    jha?: any;
    JHASignatures?: any[];
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
    const [visibleCount, setVisibleCount] = useState(20);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<ScheduleItem> | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    
    // JHA Modal State
    const [jhaModalOpen, setJhaModalOpen] = useState(false);
    const [selectedJHA, setSelectedJHA] = useState<any>(null);
    const [isJhaEditMode, setIsJhaEditMode] = useState(false);
    const [activeSignatureEmployee, setActiveSignatureEmployee] = useState<string | null>(null);
    const [isGeneratingJHAPDF, setIsGeneratingJHAPDF] = useState(false);

    // Filter States
    const [filterEstimate, setFilterEstimate] = useState('');
    const [filterClient, setFilterClient] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterService, setFilterService] = useState('');
    const [filterTag, setFilterTag] = useState('');
    const [filterCertifiedPayroll, setFilterCertifiedPayroll] = useState('');
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

    const clearFilters = () => {
        setSearch('');
        setSelectedDates([]); // Or reset to today/week? User said "Clear all filters including dates selection", implying clear selection.
        setFilterEstimate('');
        setFilterClient('');
        setFilterEmployee('');
        setFilterService('');
        setFilterTag('');
        setFilterCertifiedPayroll('');
    };

    // Mobile filters visibility
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    // Media Modal State
    const [mediaModal, setMediaModal] = useState<{ isOpen: boolean; type: 'image' | 'map'; url: string; title: string }>({
        isOpen: false,
        type: 'image',
        url: '',
        title: ''
    });

    // Initial data for dropdowns
    const [initialData, setInitialData] = useState<{
        clients: any[];
        employees: any[];
        constants: any[];
        estimates: any[];
    }>({ clients: [], employees: [], constants: [], estimates: [] });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const timesheetInputRef = useRef<HTMLInputElement>(null);
    const jhaInputRef = useRef<HTMLInputElement>(null);
    const jhaSignatureInputRef = useRef<HTMLInputElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const INCREMENT = 20;

    const openCreateModal = () => {
        const start = new Date();
        start.setHours(7, 0, 0, 0);
        const end = new Date(start);
        end.setHours(15, 0, 0, 0);

        setEditingItem({
            fromDate: start.toISOString(),
            toDate: end.toISOString(),
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

    const getCustomerName = (schedule: ScheduleItem) => {
        if (schedule.customerName && schedule.customerName !== 'Client') return schedule.customerName;
        if (schedule.customerId) {
            const client = initialData.clients.find(c => String(c._id) === String(schedule.customerId) || String(c.recordId) === String(schedule.customerId));
            return client ? client.name : 'Client';
        }
        return 'Client';
    };

    // Format date as YYYY-MM-DD in local timezone (avoids UTC conversion issues)
    const formatLocalDate = (dateInput: string | Date) => {
        const date = new Date(dateInput);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatLocalDateTime = (dateInput: string | Date) => {
        const date = new Date(dateInput);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
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
        const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
                    getCustomerName(s).toLowerCase().includes(search.toLowerCase()) ||
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
                getCustomerName(s).toLowerCase().includes(search.toLowerCase()) ||
                s.estimate?.toLowerCase().includes(search.toLowerCase()) ||
                s.jobLocation?.toLowerCase().includes(search.toLowerCase());



            const scheduleDate = formatLocalDate(s.fromDate);
            const matchesSelectedDates = selectedDates.length === 0 || selectedDates.includes(scheduleDate);

            // Filter by day tab
            const dayName = getDayName(scheduleDate);
            const matchesDayTab = activeDayTab === 'all' || dayName === activeDayTab;

            // New Filters
            const matchesEstimate = !filterEstimate || s.estimate?.toLowerCase().includes(filterEstimate.toLowerCase()) || (s.estimate === filterEstimate);

            // Loose comparison for IDs in case mismatch between ObjectId object and string
            const matchesClient = !filterClient || String(s.customerId) === String(filterClient);

            const matchesEmployee = !filterEmployee || (
                s.projectManager === filterEmployee ||
                s.foremanName === filterEmployee ||
                (s.assignees && s.assignees.some(a => String(a) === String(filterEmployee))) // Check if value matches
            );

            const matchesService = !filterService || s.service === filterService;
            const matchesTag = !filterTag || s.item === filterTag;
            const matchesCertifiedPayroll = !filterCertifiedPayroll || s.certifiedPayroll === filterCertifiedPayroll;

            return matchesSearch && matchesSelectedDates && matchesDayTab &&
                matchesEstimate && matchesClient && matchesEmployee &&
                matchesService && matchesTag && matchesCertifiedPayroll;
        });
    }, [schedules, search, selectedDates, activeDayTab, filterEstimate, filterClient, filterEmployee, filterService, filterTag, filterCertifiedPayroll]);

    // Reset pagination when filters change
    useEffect(() => {
        setVisibleCount(INCREMENT);
    }, [search, selectedDates, activeDayTab, filterEstimate, filterClient, filterEmployee, filterService, filterTag, filterCertifiedPayroll]);

    const FilterItem = ({ label, placeholder, options, value, onChange, id }: any) => (
        <div className="relative">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">{label}</label>
            <div 
                id={`anchor-${id}`}
                className="w-full h-10 px-4 py-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between cursor-pointer hover:border-[#0F4C75] transition-all shadow-sm group"
                onClick={() => setOpenDropdownId(openDropdownId === id ? null : id)}
            >
                <div className="flex items-center gap-2 truncate flex-1">
                    {(() => {
                        const selectedOption = options.find((o: any) => o.value === value);
                        if (selectedOption?.image || selectedOption?.profilePicture) {
                            return <img src={selectedOption.image || selectedOption.profilePicture} className="w-5 h-5 rounded-full object-cover shrink-0" alt="" />;
                        }
                        if (selectedOption?.color) {
                            return <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: selectedOption.color }} />;
                        }
                        return null;
                    })()}
                    <span className={`text-[13px] font-bold truncate ${value ? 'text-slate-700' : 'text-slate-400'}`}>
                        {options.find((o: any) => o.value === value)?.label || placeholder}
                    </span>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${openDropdownId === id ? 'rotate-180' : ''}`} />
            </div>
            {openDropdownId === id && (
                <MyDropDown
                    isOpen={openDropdownId === id}
                    onClose={() => setOpenDropdownId(null)}
                    options={options.map((o: any) => ({ 
                        id: o.value, 
                        label: o.label, 
                        value: o.value,
                        profilePicture: o.image || o.profilePicture,
                        color: o.color
                    }))}
                    selectedValues={value ? [value] : []}
                    onSelect={(val) => {
                        onChange(val === value ? '' : val); // Toggle behavior
                        setOpenDropdownId(null);
                    }}
                    width="w-[200px]"
                    placeholder={`Search...`}
                    anchorId={`anchor-${id}`}
                />
            )}
        </div>
    );

    const displayedSchedules = useMemo(() => {
        return filteredSchedules.slice(0, visibleCount);
    }, [filteredSchedules, visibleCount]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight + 100) {
            setVisibleCount(prev => Math.min(prev + INCREMENT, filteredSchedules.length));
        }
    };

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
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
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
                hour12: true
            });
        } catch (e) {
            return dateStr;
        }
    };

    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewType, setViewType] = useState<'calendar' | 'timeline'>('calendar');
    const [showImportMenu, setShowImportMenu] = useState(false);

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

    const handleImportTimesheets = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
                            obj[h] = val;
                        }
                    });
                     
                    if ((obj as any).recordId) {
                        (obj as any)._id = (obj as any).recordId;
                        delete (obj as any).recordId;
                    }
                    // Ensure type is uppercase for consistency if present
                    if ((obj as any).type) {
                        (obj as any).type = (obj as any).type.toUpperCase();
                    }
                    
                    return obj;
                });

                const res = await fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importTimesheets', payload: { timesheets: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported ${data.length} timesheets`);
                    fetchPageData(); 
                } else {
                    toastError(resData.error || 'Timesheet import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (timesheetInputRef.current) timesheetInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleImportJHA = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
                            obj[h] = val;
                        }
                    });

                    if ((obj as any).recordId) {
                        (obj as any)._id = (obj as any).recordId;
                        delete (obj as any).recordId;
                    }
                    return obj;
                });

                const res = await fetch('/api/jha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importJHA', payload: { records: data } })
                });
                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported ${data.length} JHA records`);
                    // We don't fetch page data here as JHAs are not shown on schedule list directly
                } else {
                    toastError(resData.error || 'JHA import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (jhaInputRef.current) jhaInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleImportJHASignatures = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                const parsedRows = parseCSV(text);

                // Parse CSV
                // Assuming simple CSV parsing or use library if available
                const Papa = require('papaparse');
                const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
                
                // Process records
                const res = await fetch('/api/jha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'importJHASignatures', payload: { records: data } })
                });

                const resData = await res.json();
                if (resData.success) {
                    success(`Successfully imported ${data.length} signature records`);
                    // Refresh data
                    fetchPageData();
                } else {
                    toastError(resData.error || 'Signature import failed');
                }
            } catch (err: any) {
                console.error(err);
                toastError(err.message || 'Error parsing CSV');
            } finally {
                setIsImporting(false);
                if (jhaSignatureInputRef.current) jhaSignatureInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    const handleSaveJHAForm = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Include schedule_id in the payload
            const payload = {
                ...selectedJHA,
                schedule_id: selectedJHA.schedule_id || selectedJHA._id // Ensure link backing
            };

            const res = await fetch('/api/jha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveJHA', payload })
            });
            const data = await res.json();
            if (data.success) {
                success('JHA Saved Successfully');
                // Update local state or refresh
                fetchPageData();
                // Switch to view mode or close? Keep in edit mode?
                setIsJhaEditMode(false);
            } else {
                toastError(data.error || 'Failed to save JHA');
            }
        } catch (error) {
            console.error(error);
            toastError('Error saving JHA');
        }
    };

    const handleDownloadJhaPdf = async () => {
        if (!selectedJHA) return;
        setIsGeneratingJHAPDF(true);
        try {
            const templateId = '164zwSdl2631kZ4mRUVtzWhg5oewL0wy6RVCgPQig258';
            
            // Build variables from selectedJHA and its parent schedule
            const schedule = schedules.find(s => s._id === selectedJHA.schedule_id) || selectedJHA.scheduleRef;
            
            // Find matching estimate for contact info
            const estimate = initialData.estimates.find(e => e.estimateNum === schedule?.estimate || e._id === schedule?.estimate);
            
            // Find matching client for customer name
            const client = initialData.clients.find(c => c._id === schedule?.customerId || c.name === schedule?.customerName);
            
            // Combine fields
            const variables: Record<string, any> = {
                ...selectedJHA,
                // Customer name from clients collection
                customerId: client?.name || schedule?.customerName || '',
                // Contact info from estimate
                contactName: estimate?.contactName || estimate?.contact || '',
                contactPhone: estimate?.contactPhone || estimate?.phone || '',
                jobAddress: estimate?.jobAddress || estimate?.address || schedule?.jobLocation || '',
                // Other schedule info
                customerName: schedule?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                estimateNum: schedule?.estimate || '',
                foremanName: schedule?.foremanName || '',
                date: selectedJHA.date ? new Date(selectedJHA.date).toLocaleDateString() : '',
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

    const handleSaveJHASignature = async (dataUrl: string) => {
        if (!activeSignatureEmployee || !selectedJHA) return;
        
        // Get Location
        let location = 'Unknown';
        if (navigator.geolocation) {
             try {
                 const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                     navigator.geolocation.getCurrentPosition(resolve, reject);
                 });
                 location = `${pos.coords.latitude},${pos.coords.longitude}`;
             } catch (e) {
                 console.log('Location access denied or failed');
             }
        }

        try {
            const payload = {
                schedule_id: selectedJHA.schedule_id,
                employee: activeSignatureEmployee,
                signature: dataUrl,
                createdBy: 'jt@devco-inc.com', // TODO: Get logged in user
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
                // Add to local state
                const newSig = data.result;
                setSelectedJHA((prev: any) => ({
                    ...prev,
                    signatures: [...(prev.signatures || []), newSig]
                }));
                setActiveSignatureEmployee(null); // Close pad
                
                // Refresh schedules to update the card icon if first JHA action?
                // Actually JHA existence relies on the main JHA record, but signatures are part of the detailed view.
            } else {
                toastError(data.error || 'Failed to save signature');
            }
        } catch (error) {
            console.error(error);
            toastError('Error saving signature');
        }
    };

    // Helper to format time strings
    const formatTimeOnly = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
            return time === 'Invalid Date' ? dateStr : time;
        } catch (e) {
            return dateStr;
        }
    };

    const calculateTimesheetData = (ts: any, scheduleDate: string) => {
        let hours = 0;
        let distance = 0;
        // Normalize type
        const type = (ts.type || '').toUpperCase();

        // Safe parse helpers
        const parseLoc = (val: any) => {
            const num = parseFloat(String(val).replace(/,/g, ''));
            return isNaN(num) ? 0 : num;
        };

        const locIn = parseLoc(ts.locationIn);
        const locOut = parseLoc(ts.locationOut);

        // Calculate Distance (always needed for display if type is Drive Time or just available)
        // Rule: Distance is locationOut - locationIn (if valid)
        if (locOut > locIn) {
            distance = locOut - locIn;
        }

        if (type.includes('DRIVE')) {
            if (distance > 0) {
                 // Rule: Distance / 55
                 hours = distance / 55;
            } else if (String(ts.dumpWashout).toLowerCase() === 'yes' || ts.dumpWashout === true) {
                 // Rule: If Dump/Washout is Yes, 0.5 hours
                 hours = 0.5;
            }
        } 
        else if (type.includes('SITE')) {
            // Rule: Calculate Duration
            if (ts.clockIn && ts.clockOut) {
                const start = new Date(ts.clockIn).getTime();
                const end = new Date(ts.clockOut).getTime();
                let durationMs = end - start;

                // Subtract lunch
                if (ts.lunchStart && ts.lunchEnd) {
                    const lStart = new Date(ts.lunchStart).getTime();
                    const lEnd = new Date(ts.lunchEnd).getTime();
                    if (lEnd > lStart) {
                        durationMs -= (lEnd - lStart);
                    }
                }

                if (durationMs > 0) {
                    const totalHoursRaw = durationMs / (1000 * 60 * 60);
                    
                    // Date Check for Logic Branching
                    const tsDateStr = ts.clockIn || scheduleDate;
                    const tsDate = new Date(tsDateStr);
                    const cutoffDate = new Date('2025-10-26T00:00:00'); // ensuring comparison works
                    
                    if (tsDate < cutoffDate) {
                        // Old Logic: exact decimal hours
                        hours = totalHoursRaw;
                    } else {
                        // New Logic (>= 10/26/2025)
                        if (totalHoursRaw >= 7.75 && totalHoursRaw < 8.0) {
                            hours = 8.0;
                        } else {
                            // Minute Rounding Logic
                            const h = Math.floor(totalHoursRaw);
                            const m = Math.round((totalHoursRaw - h) * 60); // Get minute part

                            let roundedM = 0;
                            // IFS(AND(M>1,M<=14),0, AND(M>14,M<=29),15, AND(M>29,M<=44),30, AND(M>44,M<=59),45)
                            if (m > 1 && m <= 14) roundedM = 0;
                            else if (m > 14 && m <= 29) roundedM = 15;
                            else if (m > 29 && m <= 44) roundedM = 30;
                            else if (m > 44 && m <= 59) roundedM = 45;
                            else if (m > 59) {
                                // edge case close to 60, usually 0 and add hour, but strict to formula logic:
                                // "AND(MINUTE([Duration])>44,MINUTE([Duration])<=59),45" -> undefined for 60.
                                // We'll assume standard behavior or just 45 if it caps there, 
                                // but mathematically 60 mins -> next hour. Let's stick to adding fractional part.
                                // If simple logic:
                                roundedM = 0; // Reset
                            } else {
                                // 0 or 1
                                roundedM = 0;
                            }
                            
                            hours = h + (roundedM / 60);
                        }
                    }
                }
            }
        }

        return { hours, distance };
    };

    const handleDeleteTimesheet = async (tsId: string) => {
        if (!selectedSchedule) return;
        
        const confirmDelete = window.confirm("Are you sure you want to delete this timesheet entry?");
        if (!confirmDelete) return;

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
            } else {
                toastError(data.error || 'Failed to delete entry');
            }
        } catch (error) {
            console.error(error);
            toastError('Error removing timesheet');
        }
    };


    return (
        <div className="flex flex-col h-full bg-[#F8FAFC]">
            <div className="flex-none">
            <Header
                rightContent={

                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Mobile Search Button */}
                        <button
                            onClick={() => {
                                if (searchInputRef.current) {
                                    searchInputRef.current.focus();
                                }
                            }}
                            className="sm:hidden p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm text-slate-600"
                            title="Search"
                        >
                            <Search size={18} />
                        </button>
                        
                        {/* Mobile Filter Button */}
                        <button
                            onClick={() => setShowMobileFilters(!showMobileFilters)}
                            className="sm:hidden p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm text-slate-600"
                            title="Filters"
                        >
                            <Filter size={18} />
                        </button>

                        <SearchInput
                            ref={searchInputRef}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search schedules..."
                            className="hidden sm:block"
                        />
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImport}
                            className="hidden"
                            accept=".csv"
                        />
                        <input
                            type="file"
                            ref={timesheetInputRef}
                            onChange={handleImportTimesheets}
                            className="hidden"
                            accept=".csv"
                        />
                        <input
                            type="file"
                            ref={jhaInputRef}
                            onChange={handleImportJHA}
                            className="hidden"
                            accept=".csv"
                        />
                        <input
                            type="file"
                            ref={jhaSignatureInputRef}
                            onChange={handleImportJHASignatures}
                            className="hidden"
                            accept=".csv"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="hidden sm:flex p-2 sm:p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm hover:border-[#0F4C75] text-slate-600"
                            title="Import Schedules"
                        >
                            <Upload size={18} className={isImporting ? 'animate-pulse' : ''} />
                        </button>
                        <button
                            onClick={() => timesheetInputRef.current?.click()}
                            className="hidden sm:flex p-2 sm:p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm hover:border-[#0F4C75] text-slate-600"
                            title="Import Timesheets"
                        >
                            <Clock size={18} className={isImporting ? 'animate-pulse' : ''} />
                        </button>
                        <button
                            onClick={() => jhaInputRef.current?.click()}
                            className="hidden sm:flex p-2 sm:p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm hover:border-[#0F4C75] text-slate-600"
                            title="Import JHA"
                        >
                            <Import size={18} className={isImporting ? 'animate-pulse' : ''} />
                        </button>
                        <button
                            onClick={() => jhaSignatureInputRef.current?.click()}
                            className="hidden sm:flex p-2 sm:p-2.5 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all shadow-sm hover:border-[#0F4C75] text-slate-600"
                            title="Import JHA Signatures"
                        >
                            <ClipboardList size={18} className={isImporting ? 'animate-pulse' : ''} />
                        </button>
                        <button
                            onClick={openCreateModal}
                            className="hidden sm:flex p-2 sm:p-2.5 bg-[#0F4C75] text-white rounded-full hover:bg-[#0a3a5c] transition-all shadow-lg hover:shadow-[#0F4C75]/30 group"
                            title="Create Schedule"
                        >
                            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
                }
            />
            </div>

            <main className="flex-1 overflow-y-auto max-w-[1800px] w-full mx-auto px-4 py-4">
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-4 h-full">

                    {/* LEFT COLUMN - CALENDAR - Full width on mobile, 25% on desktop */}
                    <div className="w-full lg:w-[25%] lg:h-full lg:overflow-y-auto custom-scrollbar bg-[#F0F5FA] rounded-[32px] p-4">
                        <div className="">

                            {/* Mobile: Simple Date Range Inputs */}
                            <div className="lg:hidden space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">From Date</label>
                                    <input
                                        type="date"
                                        value={selectedDates[0] || ''}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setSelectedDates([e.target.value]);
                                            }
                                        }}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">To Date</label>
                                    <input
                                        type="date"
                                        value={selectedDates[selectedDates.length - 1] || ''}
                                        onChange={(e) => {
                                            if (e.target.value && selectedDates[0]) {
                                                // Create range from first selected date to this date
                                                const start = new Date(selectedDates[0]);
                                                const end = new Date(e.target.value);
                                                const range = [];
                                                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                                    const year = d.getFullYear();
                                                    const month = String(d.getMonth() + 1).padStart(2, '0');
                                                    const day = String(d.getDate()).padStart(2, '0');
                                                    range.push(`${year}-${month}-${day}`);
                                                }
                                                setSelectedDates(range);
                                            }
                                        }}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* Desktop: Full Calendar */}
                            <div className="hidden lg:block">
                                {/* Days Mapping */}
                                <div className="grid grid-cols-7 mb-2 px-2">
                                    {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map(day => (
                                        <div key={day} className="text-center text-[10px] font-black text-slate-400 tracking-widest">{day}</div>
                                    ))}
                                </div>

                                {/* Calendar Grid Container */}
                                <div className="bg-[#F0F5FA] rounded-[24px] lg:rounded-[32px] p-4 shadow-[inset_8px_8px_16px_#d1d9e6,inset_-8px_-8px_16px_#ffffff]">
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
                                    id="filterEstimate"
                                    label="Estimate #"
                                    placeholder="Select Estimate"
                                    options={initialData.estimates.map(e => ({ label: e.label, value: e.label }))}
                                    value={filterEstimate}
                                    onChange={setFilterEstimate}
                                />

                                <FilterItem
                                    id="filterClient"
                                    label="Client"
                                    placeholder="Select Client"
                                    options={initialData.clients.map(c => ({ label: c.name, value: c._id }))}
                                    value={filterClient}
                                    onChange={setFilterClient}
                                />

                                <FilterItem
                                    id="filterEmployee"
                                    label="Employee"
                                    placeholder="Select Employee"
                                    options={initialData.employees.map(e => ({ label: e.label, value: e.value, image: e.image }))}
                                    value={filterEmployee}
                                    onChange={setFilterEmployee}
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
                                />

                                <FilterItem
                                    id="filterCertifiedPayroll"
                                    label="Certified Payroll"
                                    placeholder="Any"
                                    options={initialData.constants
                                        .filter(c => c.type === 'Certified Payroll')
                                        .map(c => ({ label: c.description, value: c.description }))}
                                    value={filterCertifiedPayroll}
                                    onChange={setFilterCertifiedPayroll}
                                />
                            </div>
                        </div>
                    </div>

                    {/* MIDDLE COLUMN - SCHEDULE FEED - Full width on mobile */}
                    <div
                        className={`w-full ${selectedSchedule ? 'lg:w-[30%]' : 'lg:w-[60%]'} lg:h-full lg:overflow-y-auto p-4 custom-scrollbar bg-[#F0F5FA] rounded-[24px] lg:rounded-[32px] transition-all duration-500 ease-in-out`}
                        onScroll={handleScroll}
                    >

                        {/* Day Filter Tabs */}
                        <div className="pt-0 pb-4 overflow-x-auto">
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
                            <div className={`grid grid-cols-1 ${selectedSchedule ? '' : 'md:grid-cols-2'} gap-4 pt-0 transition-all duration-500`}>
                                {displayedSchedules.map((item) => (
                                    <div
                                        key={item._id}
                                        onClick={() => setSelectedSchedule(selectedSchedule?._id === item._id ? null : item)}
                                        className={`group relative bg-white rounded-[24px] sm:rounded-[40px] p-4 cursor-pointer transition-all duration-300 transform border
                                            ${selectedSchedule?._id === item._id
                                                ? 'border-[#0F4C75] ring-1 ring-[#0F4C75] scale-[1.01]'
                                                : 'border-slate-100 hover:border-[#0F4C75]/30 hover:-translate-y-1'
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
                                                    <div className="flex flex-col">
                                                        <span className="text-xs sm:text-sm font-bold text-slate-500 leading-tight">{getCustomerName(item)}</span>
                                                        {(() => {
                                                            const est = initialData.estimates.find(e => e.value === item.estimate);
                                                            if (est?.jobAddress) {
                                                                return (
                                                                    <span className="text-[10px] text-slate-400 font-medium truncate max-w-[150px] mt-0.5">
                                                                        {est.jobAddress}
                                                                    </span>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row 2: Title (smaller font) */}
                                            <div className="mb-2">
                                                <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-tight line-clamp-2">
                                                    {item.title || 'Untitled Schedule'}
                                                </h3>
                                            </div>

                                            {/* Row 3: Job Location */}
                                            <p className="text-[11px] sm:text-xs font-medium text-slate-400 truncate mb-2">{item.jobLocation}</p>

                                            {/* Row 4: Estimate # and Project Name */}
                                            <div className="flex items-center gap-2 mb-3">
                                                {item.estimate && (
                                                    <span className="text-[10px] sm:text-[11px] font-bold text-[#0F4C75] bg-[#E6EEF8] px-2 py-0.5 rounded-full">
                                                        {item.estimate.replace(/-[vV]\d+$/, '')}
                                                    </span>
                                                )}
                                                {item.description && (
                                                    <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate">
                                                        {item.description.split('\n')[0]?.substring(0, 30)}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Row 5: Assignees (left) + Service/Fringe/etc badges (right) */}
                                            <div className="flex items-center justify-between mb-3">
                                                {/* Assignees - left side */}
                                                <div className="flex -space-x-2">
                                                    {(item.assignees || []).filter(Boolean).slice(0, 4).map((email, i) => {
                                                        const emp = initialData.employees.find(e => e.value === email);
                                                        return (
                                                            <div key={i} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-white flex items-center justify-center text-[8px] sm:text-[9px] font-bold shadow-sm overflow-hidden bg-slate-200 text-slate-600">
                                                                {emp?.image ? (
                                                                    <img src={emp.image} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    email?.[0]?.toUpperCase() || '?'
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    {(item.assignees || []).filter(Boolean).length > 4 && (
                                                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#38A169] border-2 border-white flex items-center justify-center text-[8px] sm:text-[9px] font-bold text-white shadow-sm">
                                                            +{(item.assignees?.filter(Boolean).length || 0) - 4}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Service, Fringe, Certified Payroll, Notified, Per Diem - right side */}
                                                <div className="flex -space-x-1.5">
                                                    {[
                                                        { val: item.service, label: 'SV' },
                                                        { val: item.fringe, label: 'FR' },
                                                        { val: item.certifiedPayroll, label: 'CP' },
                                                        { val: item.notifyAssignees, label: 'NA' },
                                                        { val: item.perDiem, label: 'PD' }
                                                    ].filter(attr => attr.val && attr.val !== 'No' && attr.val !== '-' && attr.val !== '').map((attr, i) => {
                                                        // Look up in constants by description
                                                        const constant = initialData.constants.find(c => c.description === attr.val);
                                                        const hasImage = constant?.image;
                                                        const hasColor = constant?.color;

                                                        return (
                                                            <div
                                                                key={i}
                                                                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-white flex items-center justify-center text-[7px] sm:text-[8px] font-bold shadow-sm overflow-hidden"
                                                                style={{
                                                                    backgroundColor: hasColor || '#64748b',
                                                                    color: 'white'
                                                                }}
                                                                title={`${attr.label}: ${attr.val}`}
                                                            >
                                                                {hasImage ? (
                                                                    <img src={hasImage} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    attr.label
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Row 6: Date (left) + PM/Foreman/SD (right) */}
                                            <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                                                {/* Date - left side */}
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-100/50 flex items-center justify-center text-emerald-600">
                                                        <Clock size={12} />
                                                    </div>
                                                    <span className="text-[11px] sm:text-xs font-bold text-slate-700">
                                                        {new Date(item.fromDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                                    </span>
                                                    {item.hasJHA ? (
                                                        <div 
                                                            className="relative z-10 flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-100 text-orange-600 ml-1 hover:bg-orange-200 transition-colors cursor-pointer" 
                                                            title="View JHA"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const jhaWithSigs = { 
                                                                    ...item.jha, 
                                                                    signatures: item.JHASignatures || [] 
                                                                };
                                                                setSelectedJHA(jhaWithSigs);
                                                                setIsJhaEditMode(false);
                                                                setJhaModalOpen(true);
                                                            }}
                                                        >
                                                            <ClipboardList size={12} />
                                                        </div>
                                                    ) : (
                                                        <div 
                                                            className="relative z-10 flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-100 text-slate-400 ml-1 hover:bg-blue-100 hover:text-blue-600 transition-colors cursor-pointer" 
                                                            title="Create JHA"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // Initialize new JHA
                                                                setSelectedJHA({
                                                                    schedule_id: item._id,
                                                                    date: new Date(),
                                                                    jhaTime: new Date().toLocaleTimeString('en-US', { hour12: false }), // Default time
                                                                    emailCounter: 0,
                                                                    signatures: [], // Empty signatures initially
                                                                    scheduleRef: item // Pass reference for assignees access
                                                                });
                                                                setIsJhaEditMode(true);
                                                                setJhaModalOpen(true);
                                                            }}
                                                        >
                                                            <FilePlus size={12} />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* PM / Foreman / SD - right side */}
                                                <div className="flex -space-x-1.5">
                                                    {[item.projectManager, item.foremanName].filter(Boolean).map((email, i) => {
                                                        const emp = initialData.employees.find(e => e.value === email);
                                                        const labels = ['PM', 'FM'];
                                                        return (
                                                            <div
                                                                key={i}
                                                                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-white flex items-center justify-center text-[8px] sm:text-[9px] font-bold shadow-sm overflow-hidden bg-[#0F4C75] text-white"
                                                                title={`${labels[i]}: ${emp?.label || email}`}
                                                            >
                                                                {emp?.image ? (
                                                                    <img src={emp.image} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    labels[i]
                                                                )}
                                                            </div>
                                                        );
                                                    })}
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

                        {visibleCount < filteredSchedules.length && (
                            <div className="mt-8 flex justify-center pb-4 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                Loading more...
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN - DETAILS OR STATS - Hidden on mobile/tablet */}
                    {/* RIGHT COLUMN - DETAILS OR STATS - Hidden on mobile/tablet */}
                    {/* RIGHT COLUMN - DETAILS OR STATS - Hidden on mobile/tablet */}
                    <div className={`${selectedSchedule ? 'xl:w-[45%]' : 'xl:w-[15%]'} h-full hidden xl:flex flex-col items-center overflow-y-auto custom-scrollbar transition-all duration-500 ease-in-out bg-[#F0F5FA] rounded-[32px] p-4`}>
                        <div className="space-y-4 w-full">
                            {selectedSchedule ? (
                                <div className="animate-in slide-in-from-right duration-300">
                                    <div className="animate-in slide-in-from-right duration-300">
                                        <div className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm space-y-4">

                                            {/* Row 1: Tag Icon & Client Name */}
                                            <div className="flex items-center gap-4">
                                                {(() => {
                                                    const tagConstant = initialData.constants.find(c => c.description === selectedSchedule.item);
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
                                                <div>
                                                    <p className="text-xl font-black text-[#0F4C75] leading-none mb-1">{getCustomerName(selectedSchedule)}</p>
                                                    {(() => {
                                                        const est = initialData.estimates.find(e => e.value === selectedSchedule.estimate);
                                                        if (est?.jobAddress) {
                                                            return <p className="text-xs font-bold text-slate-400 mb-1">{est.jobAddress}</p>;
                                                        }
                                                        return null;
                                                    })()}
                                                    <div className="flex items-center gap-1.5 text-slate-500">
                                                        <MapPin size={14} className="text-slate-400 shrink-0" />
                                                        <p className="text-xs font-bold text-slate-500 leading-tight">{selectedSchedule.jobLocation || 'N/A'}</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row 3: Title & Date */}
                                            <div className="grid grid-cols-1 gap-1">
                                                <div>
                                                    <p className="text-base font-black text-slate-800 leading-tight">{selectedSchedule.title}</p>
                                                </div>
                                                <div className="mt-2 flex items-center gap-3">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <CalendarIcon size={14} className="text-slate-400" />
                                                            <span className="text-xs font-bold text-slate-700">
                                                                From: {new Date(selectedSchedule.fromDate).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                                            </span>
                                                        </div>
                                                        {selectedSchedule.toDate && (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3.5" />
                                                                <span className="text-xs font-bold text-slate-700">
                                                                    To: {new Date(selectedSchedule.toDate).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {selectedSchedule.estimate && (
                                                        <Badge variant="info" className="py-0 h-5">{selectedSchedule.estimate.replace(/-[vV]\d+$/, '')}</Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="h-px bg-slate-100 my-2" />

                                            {/* Rows 5, 6, 7: PM, Foreman, SD */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {[
                                                    { label: 'Project Manager', val: selectedSchedule.projectManager, color: 'bg-blue-600' },
                                                    { label: 'Foreman', val: selectedSchedule.foremanName, color: 'bg-emerald-600' }
                                                ].map((role, idx) => {
                                                    if (!role.val) return null;
                                                    const emp = initialData.employees.find(e => e.value === role.val);
                                                    return (
                                                        <div key={idx} className="flex items-center gap-2 p-2 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm overflow-hidden shrink-0 ${role.color}`}>
                                                                {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : (emp?.label?.[0] || role.val[0])}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{role.label}</p>
                                                                <p className="text-xs font-bold text-slate-700 truncate">{emp?.label || role.val}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <div className="h-px bg-slate-100 my-2" />

                                            {/* Row 9: Assignees (Inline Chips) */}
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Assignees</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {(selectedSchedule.assignees || []).map((assignee, i) => {
                                                        const emp = initialData.employees.find(e => e.value === assignee);
                                                        return (
                                                            <div key={i} className="inline-flex items-center gap-2 pl-1 pr-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                                                                <div className="w-6 h-6 rounded-full bg-slate-300 overflow-hidden flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                                                                    {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : (emp?.label?.[0] || assignee[0])}
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

                                            {/* Row 8: Service, Tag, Notify, Per Diem (Inline) */}
                                            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Service</p>
                                                    <Badge variant="default" className="text-slate-600 bg-slate-50 border-slate-200">{selectedSchedule.service || 'N/A'}</Badge>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tag</p>
                                                    <Badge className="bg-[#E6EEF8] text-[#0F4C75] hover:bg-[#dbe6f5] border-none">{selectedSchedule.item || 'N/A'}</Badge>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notify</p>
                                                    <Badge variant={selectedSchedule.notifyAssignees === 'Yes' ? 'success' : 'default'} className="gap-1.5 pl-1.5">
                                                        <div className={`w-2 h-2 rounded-full ${selectedSchedule.notifyAssignees === 'Yes' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                                        {selectedSchedule.notifyAssignees || 'No'}
                                                    </Badge>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Per Diem</p>
                                                    <Badge variant={selectedSchedule.perDiem === 'Yes' ? 'success' : 'default'} className="gap-1.5 pl-1.5">
                                                        <div className={`w-2 h-2 rounded-full ${selectedSchedule.perDiem === 'Yes' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                                        {selectedSchedule.perDiem || 'No'}
                                                    </Badge>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Certified Payroll</p>
                                                    <Badge variant={selectedSchedule.certifiedPayroll ? 'success' : 'default'} className="gap-1.5 pl-1.5">
                                                        <div className={`w-2 h-2 rounded-full ${selectedSchedule.certifiedPayroll ? 'bg-green-500' : 'bg-slate-400'}`} />
                                                        {selectedSchedule.certifiedPayroll || 'No'}
                                                    </Badge>
                                                </div>
                                            </div>

                                            {/* Row 11: Scope / Notes (Moved to end) */}
                                            {selectedSchedule.description && (
                                                <div className="pt-4 border-t border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Scope / Notes</p>
                                                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                        {selectedSchedule.description}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Aerial Image & Site Layout */}
                                            {(selectedSchedule.aerialImage || selectedSchedule.siteLayout) && (
                                                <div className="pt-4 border-t border-slate-100">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {selectedSchedule.aerialImage && (
                                                            <div>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Aerial Image</p>
                                                                <div 
                                                                    className="relative group cursor-pointer"
                                                                    onClick={() => setMediaModal({ isOpen: true, type: 'image', url: selectedSchedule.aerialImage!, title: 'Aerial Site View' })}
                                                                >
                                                                    <img 
                                                                        src={selectedSchedule.aerialImage} 
                                                                        alt="Aerial View" 
                                                                        className="w-full h-44 object-cover rounded-xl border border-slate-200 group-hover:opacity-90 transition-all shadow-sm"
                                                                    />
                                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <div className="px-3 py-1.5 bg-white/90 backdrop-blur text-[10px] font-bold text-slate-700 rounded-lg shadow-xl">Click to Enlarge</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {selectedSchedule.siteLayout && (
                                                            <div>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Interactive 3D Site Preview</p>
                                                                {(() => {
                                                                    const earthUrl = selectedSchedule.siteLayout;
                                                                    const coordsMatch = earthUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                                                                    const lat = coordsMatch?.[1];
                                                                    const lng = coordsMatch?.[2];
                                                                    const embedUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}&t=k&z=19&ie=UTF8&iwloc=&output=embed` : '';
                                                                    
                                                                    return (
                                                                        <div 
                                                                            className="relative w-full h-44 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 group cursor-pointer"
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
                                                                                        <div className="px-4 py-2 bg-white/90 backdrop-blur shadow-2xl rounded-xl scale-75 group-hover:scale-100 transition-transform flex items-center gap-2">
                                                                                            <MapPin size={16} className="text-blue-600" />
                                                                                            <span className="text-[11px] font-black text-slate-800 uppercase">Enlarge Interactive Map</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                                                                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg mb-3 group-hover:scale-110 transition-transform">
                                                                                        <MapPin size={24} className="text-blue-600" />
                                                                                    </div>
                                                                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Open Google Earth</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Row 12: Timesheets - Grouped */}
                                            {selectedSchedule.timesheet && selectedSchedule.timesheet.length > 0 && (
                                                <div className="pt-4 border-t border-slate-100">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timesheets</p>
                                                        <Badge variant="default" className="bg-slate-100 text-slate-500 border-none">{selectedSchedule.timesheet.length} Entries</Badge>
                                                    </div>
                                                    
                                                    {Object.entries(
                                                        selectedSchedule.timesheet.reduce((acc: any, item: any) => {
                                                            const type = item.type || 'Other';
                                                            if (!acc[type]) acc[type] = [];
                                                            acc[type].push(item);
                                                            return acc;
                                                        }, {}) as Record<string, any[]>
                                                    ).map(([type, items], groupIdx) => (
                                                        <div key={groupIdx} className="mb-4 last:mb-0">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-[#0F4C75]"></div>
                                                                <h5 className="text-xs font-bold text-[#0F4C75] uppercase tracking-wide">{type}</h5>
                                                            </div>
                                                            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
                                                                <table className="w-full text-left border-collapse">
                                                                    <thead>
                                                                        <tr className="bg-slate-50/80 border-b border-slate-100">
                                                                            <th className="p-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider w-[25%]">Employee</th>
                                                                            <th className="p-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center">In</th>
                                                                            <th className="p-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center">Out</th>
                                                                            <th className="p-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">Dist.</th>
                                                                            <th className="p-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">Hrs</th>
                                                                            <th className="p-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right w-20">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="text-xs text-slate-600 divide-y divide-slate-50">
                                                                        {items.map((ts, idx) => {
                                                                            const emp = initialData.employees.find(e => e.value === ts.employee);
                                                                            const { hours, distance } = calculateTimesheetData(ts, selectedSchedule.fromDate);
                                                                            return (
                                                                                <tr key={idx} className="group hover:bg-blue-50/30 transition-colors">
                                                                                    <td className="p-2">
                                                                                        <div className="flex items-center gap-2.5">
                                                                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500 overflow-hidden shrink-0 border border-white shadow-sm">
                                                                                                {emp?.image ? (
                                                                                                    <img src={emp.image} className="w-full h-full object-cover" />
                                                                                                ) : (
                                                                                                    (emp?.label?.[0] || ts.employee?.[0] || '?').toUpperCase()
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="min-w-0">
                                                                                                <p className="font-bold text-slate-700 truncate max-w-[120px]">{emp?.label || ts.employee}</p>
                                                                                            </div>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="p-2 text-center font-medium bg-slate-50/30 group-hover:bg-transparent transition-colors">
                                                                                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100/50">
                                                                                            {formatTimeOnly(ts.clockIn)}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="p-2 text-center font-medium">
                                                                                         <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-100/50">
                                                                                            {formatTimeOnly(ts.clockOut)}
                                                                                         </div>
                                                                                    </td>
                                                                                    <td className="p-2 text-right font-medium text-slate-500">
                                                                                        {distance > 0 ? `${distance.toFixed(1)} mi` : '-'}
                                                                                    </td>
                                                                                    <td className="p-2 text-right font-bold text-[#0F4C75]">
                                                                                        {hours > 0 ? hours.toFixed(2) : '-'}
                                                                                    </td>
                                                                                    <td className="p-2 text-right">
                                                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                                                                                            <button 
                                                                                                onClick={(e) => { e.stopPropagation(); /* TODO: Edit logic */ }}
                                                                                                className="p-1.5 text-slate-400 hover:text-[#0F4C75] hover:bg-blue-50 rounded-lg transition-colors"
                                                                                                title="Edit"
                                                                                            >
                                                                                                <Edit size={12} />
                                                                                            </button>
                                                                                            <button 
                                                                                                onClick={(e) => { 
                                                                                                    e.stopPropagation(); 
                                                                                                    handleDeleteTimesheet(ts._id || ts.recordId); 
                                                                                                }}
                                                                                                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                                                                title="Delete"
                                                                                            >
                                                                                                <Trash2 size={12} />
                                                                                            </button>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="w-full text-center">
                                        <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center w-full">QUICK STATS</h4>
                                        <div className="space-y-4 w-full">
                                            <div className="bg-white p-4 rounded-[32px] border border-slate-50 shadow-sm flex flex-col items-center justify-center text-center">
                                                <p className="text-3xl font-black text-slate-800">{filteredSchedules.length}</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">TOTAL JOBS</p>
                                            </div>
                                            <div className="bg-[#0F4C75] p-4 rounded-[32px] shadow-lg shadow-blue-900/20 flex flex-col items-center justify-center text-center">
                                                <p className="text-3xl font-black text-white">84%</p>
                                                <p className="text-[10px] font-black text-blue-100 uppercase tracking-widest mt-1">CAPACITY</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full text-center">
                                        <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center w-full">NOTIFICATIONS</h4>
                                        <div className="space-y-4 w-full">
                                            <div className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl border border-white text-center">
                                                <div className="w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.4)]"></div>
                                                <p className="text-xs font-bold text-slate-600 leading-snug">New import completed successfully.</p>
                                            </div>
                                            <div className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl border border-white opacity-60 text-center">
                                                <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
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

            {/* Floating Action Button - Mobile Only */}
            <button
                onClick={openCreateModal}
                className="sm:hidden fixed bottom-24 right-6 z-50 w-14 h-14 bg-[#0F4C75] text-white rounded-full shadow-2xl hover:bg-[#0a3a5c] transition-all flex items-center justify-center group active:scale-95"
                title="Create Schedule"
            >
                <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>


            {/* Create/Edit Modal */}
            < Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)
                }
                title={editingItem?._id ? "Edit Schedule" : "New Schedule"}
            >
                <form onSubmit={handleSave} className="p-4">
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
                    <div className={`grid grid-cols-1 ${!editingItem?._id ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6 mb-6`}>
                        <div className="md:col-span-2">
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
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{editingItem?._id ? 'Date & Time' : 'From Date & Time'}</label>
                            <input
                                id="schedFromDate"
                                type="datetime-local"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all"
                                value={editingItem?.fromDate ? formatLocalDateTime(editingItem.fromDate) : ''}
                                onChange={(e) => setEditingItem({ ...editingItem, fromDate: e.target.value })}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (!editingItem?._id) {
                                            document.getElementById('schedToDate')?.focus();
                                        } else {
                                            document.getElementById('schedDesc')?.focus();
                                        }
                                    }
                                }}
                            />
                        </div>
                        {!editingItem?._id && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">To Date & Time</label>
                                <input
                                    id="schedToDate"
                                    type="datetime-local"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all"
                                    value={editingItem?.toDate ? formatLocalDateTime(editingItem.toDate) : ''}
                                    onChange={(e) => setEditingItem({ ...editingItem, toDate: e.target.value })}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            document.getElementById('schedDesc')?.focus();
                                        }
                                    }}
                                />
                            </div>
                        )}
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
                                options={initialData.employees.map(emp => ({
                                    label: emp.label,
                                    value: emp.value,
                                    image: emp.image
                                }))}
                                value={editingItem?.projectManager || ''}
                                onChange={(val) => setEditingItem({ ...editingItem, projectManager: val })}
                                onNext={() => document.getElementById('schedForeman')?.focus()}
                            />
                            <SearchableSelect
                                id="schedForeman"
                                label="Foreman"
                                placeholder="Select Foreman"
                                options={initialData.employees.map(emp => ({
                                    label: emp.label,
                                    value: emp.value,
                                    image: emp.image
                                }))}
                                value={editingItem?.foremanName || ''}
                                onChange={(val) => setEditingItem({ ...editingItem, foremanName: val })}
                                onNext={() => document.getElementById('schedService')?.focus()}
                            />
                        </div>
                    </div>

                    {/* Grid for Service, Tag, Notify, Per Diem, Fringe, CP - 3 Rows of 2 Cols */}
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
                                onNext={() => document.getElementById('schedNotify')?.focus()}
                            />
                        </div>
                        <div>
                            <SearchableSelect
                                id="schedNotify"
                                label="Notify Assignees"
                                placeholder="Select"
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
                                placeholder="Select"
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
                                onNext={() => document.getElementById('schedFringe')?.focus()}
                            />
                        </div>
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
                        />
                    </div>

                    {/* Row 8: Aerial Image & Site Layout */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Aerial Image</label>
                            <div className="space-y-2">
                                {editingItem?.aerialImage && (
                                    <div className="relative group">
                                        <img 
                                            src={editingItem.aerialImage} 
                                            alt="Aerial View" 
                                            className="w-full h-32 object-cover rounded-lg border border-slate-200"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setEditingItem({ ...editingItem, aerialImage: '' })}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    id="aerialImageUpload"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => {
                                                setEditingItem({ ...editingItem, aerialImage: ev.target?.result as string });
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                />
                                <label
                                    htmlFor="aerialImageUpload"
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors text-xs text-slate-600"
                                >
                                    <Upload size={14} />
                                    {editingItem?.aerialImage ? 'Replace Image' : 'Upload Aerial Image'}
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Site Layout (Google Earth)</label>
                            <input
                                type="url"
                                placeholder="Paste Google Earth URL..."
                                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                value={editingItem?.siteLayout || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, siteLayout: e.target.value })}
                            />
                            {editingItem?.siteLayout && (
                                <a
                                    href={editingItem.siteLayout}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                                >
                                    <MapPin size={12} />
                                    Open in Google Earth
                                </a>
                            )}
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
            {/* JHA Details Modal */}
            <Modal
                isOpen={jhaModalOpen}
                onClose={() => setJhaModalOpen(false)}
                title="Job Hazard Analysis (JHA)"
                maxWidth="4xl"
            >
                {selectedJHA ? (
                    isJhaEditMode ? (
                        <form onSubmit={handleSaveJHAForm} className="space-y-6">
                            {/* Header Inputs */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Date</label>
                                    <input 
                                        type="date" 
                                        required
                                        className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                                        value={formatLocalDate(selectedJHA.date)}
                                        onChange={(e) => setSelectedJHA({...selectedJHA, date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Time</label>
                                    <input 
                                        type="time"
                                        className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                                        value={selectedJHA.jhaTime?.includes('M') ? '' : selectedJHA.jhaTime} // Handle AM/PM format display vs input? Inputs accept HH:mm
                                        onChange={(e) => setSelectedJHA({...selectedJHA, jhaTime: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">USA No.</label>
                                    <input 
                                        type="text"
                                        className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                                        value={selectedJHA.usaNo || ''}
                                        onChange={(e) => setSelectedJHA({...selectedJHA, usaNo: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Subcontractor USA</label>
                                    <input 
                                        type="text"
                                        className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                                        value={selectedJHA.subcontractorUSANo || ''}
                                        onChange={(e) => setSelectedJHA({...selectedJHA, subcontractorUSANo: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* Signatures Section (Prioritized) */}
                            <div className="border rounded-xl p-4 border-slate-200 bg-blue-50/50">
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-blue-100 pb-2 flex justify-between">
                                    <span>Signatures</span>
                                    <span className="text-[10px] font-normal text-slate-500 normal-case">All assignees must sign</span>
                                </h4>
                                
                                {activeSignatureEmployee ? (
                                    <div className="max-w-md mx-auto">
                                        <SignaturePad 
                                            employeeName={initialData.employees.find(e => e.value === activeSignatureEmployee)?.label || activeSignatureEmployee}
                                            onSave={handleSaveJHASignature} 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setActiveSignatureEmployee(null)} 
                                            className="mt-2 w-full text-xs text-slate-500 hover:text-slate-800"
                                        >
                                            Cancel Signing
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {(() => {
                                            // Get Assignees
                                            const schedule = schedules.find(s => s._id === selectedJHA.schedule_id) || selectedJHA.scheduleRef;
                                            const assignees = schedule?.assignees || [];
                                            
                                            // Ensure uniqueness and filter legacy
                                            const uniqueAssignees = Array.from(new Set(assignees)).filter(Boolean) as string[];

                                            return uniqueAssignees.map((email: string) => {
                                                const emp = initialData.employees.find(e => e.value === email);
                                                const sig = selectedJHA.signatures?.find((s: any) => s.employee === email);
                                                
                                                return (
                                                    <div key={email} className={`relative p-3 rounded-xl border transition-all ${sig ? 'bg-white border-green-200 shadow-sm' : 'bg-white border-dashed border-slate-300 hover:border-[#0F4C75]'}`}>
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-white shadow-sm flex items-center justify-center shrink-0">
                                                                {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-slate-500">{emp?.label?.[0]}</span>}
                                                            </div>
                                                            <div className="overflow-hidden">
                                                                <p className="text-xs font-bold text-slate-700 truncate">{emp?.label || email}</p>
                                                                <p className="text-[10px] text-slate-400">{sig ? 'Signed' : 'Pending Signature'}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        {sig ? (
                                                            <div className="h-12 border-t border-slate-50 mt-2 flex items-center justify-center">
                                                                <img src={sig.signature} className="max-h-full max-w-full object-contain opacity-80" />
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveSignatureEmployee(email)}
                                                                className="w-full py-1.5 mt-1 text-xs font-bold text-white bg-[#0F4C75] hover:bg-[#0b3d61] rounded-lg transition-colors flex items-center justify-center gap-1"
                                                            >
                                                                <FilePlus size={12} /> Sign Now
                                                            </button>
                                                        )}
                                                        {sig && (
                                                             <div className="absolute top-2 right-2 text-green-500"><CheckCircle2 size={14} /></div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </div>

                            {/* Daily Work Checkboxes */}
                            <div>
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Daily Work</h4>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    {[
                                        { key: 'operatingMiniEx', label: 'Operating Mini Ex' },
                                        { key: 'operatingAVacuumTruck', label: 'Vacuum Truck' },
                                        { key: 'excavatingTrenching', label: 'Excavating/Trenching' },
                                        { key: 'acConcWork', label: 'AC/Concrete Work' },
                                        { key: 'operatingBackhoe', label: 'Operating Backhoe' },
                                        { key: 'workingInATrench', label: 'Working in Trench' },
                                        { key: 'trafficControl', label: 'Traffic Control' },
                                        { key: 'roadWork', label: 'Road Work' },
                                        { key: 'operatingHdd', label: 'Operating HDD' },
                                        { key: 'confinedSpace', label: 'Confined Space' },
                                        { key: 'settingUgBoxes', label: 'Setting UG Boxes' },
                                        { key: 'sidewalks', label: 'Sidewalks' },
                                        { key: 'heatAwareness', label: 'Heat Awareness' },
                                        { key: 'ladderWork', label: 'Ladder Work' },
                                        { key: 'overheadLifting', label: 'Overhead Lifting' },
                                        { key: 'materialHandling', label: 'Material Handling' },
                                        { key: 'roadHazards', label: 'Road Hazards' },
                                        { key: 'heavyLifting', label: 'Heavy Lifting' },
                                        { key: 'highNoise', label: 'High Noise' },
                                        { key: 'pinchPoints', label: 'Pinch Points' },
                                        { key: 'sharpObjects', label: 'Sharp Objects' },
                                        { key: 'trippingHazards', label: 'Tripping Hazards' },
                                        { key: 'otherJobsiteHazards', label: 'Other Hazards' },
                                    ].map((item) => (
                                        <label key={item.key} className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors ${selectedJHA[item.key] ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-[#0F4C75] rounded focus:ring-[#0F4C75]"
                                                checked={!!selectedJHA[item.key]}
                                                onChange={(e) => setSelectedJHA({ ...selectedJHA, [item.key]: e.target.checked })}
                                            />
                                            <span className={`text-xs font-bold ${selectedJHA[item.key] ? 'text-blue-900' : 'text-slate-600'}`}>{item.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Emergency Plan */}
                             <div>
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Emergency Plan</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     {[
                                        { key: 'stagingAreaDiscussed', label: 'Staging Area Discussed' },
                                        { key: 'rescueProceduresDiscussed', label: 'Rescue Procedures Discussed' },
                                        { key: 'evacuationRoutesDiscussed', label: 'Evacuation Routes Discussed' },
                                        { key: 'emergencyContactNumberWillBe911', label: 'Emergency Contact is 911' },
                                        { key: 'firstAidAndCPREquipmentOnsite', label: 'First Aid/CPR Onsite' },
                                        { key: 'closestHospitalDiscussed', label: 'Closest Hospital Discussed' },
                                     ].map((item) => (
                                        <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-600"
                                                checked={!!selectedJHA[item.key]}
                                                onChange={(e) => setSelectedJHA({ ...selectedJHA, [item.key]: e.target.checked })}
                                            />
                                            <span className="text-sm font-medium text-slate-700">{item.label}</span>
                                        </label>
                                     ))}
                                </div>
                             </div>

                             {/* Hospital Info */}
                             <div className="bg-red-50 p-4 rounded-xl border border-red-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div>
                                     <label className="text-[10px] font-bold text-red-400 uppercase block mb-1">Nearest Hospital Name</label>
                                     <input 
                                        type="text"
                                        className="w-full text-sm font-bold text-slate-700 bg-white border border-red-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-200"
                                        value={selectedJHA.nameOfHospital || ''}
                                        onChange={(e) => setSelectedJHA({...selectedJHA, nameOfHospital: e.target.value})}
                                        placeholder="Enter Hospital Name"
                                     />
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-red-400 uppercase block mb-1">Hospital Address</label>
                                     <input 
                                        type="text"
                                        className="w-full text-sm font-bold text-slate-700 bg-white border border-red-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-200"
                                        value={selectedJHA.addressOfHospital || ''}
                                        onChange={(e) => setSelectedJHA({...selectedJHA, addressOfHospital: e.target.value})}
                                        placeholder="Enter Hospital Address"
                                     />
                                 </div>
                             </div>

                             <div className="flex justify-end pt-4 border-t border-slate-100">
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-[#0F4C75] hover:bg-[#0b3d61] text-white font-bold rounded-xl shadow-lg transition-all"
                                >
                                    Save Entire JHA
                                </button>
                             </div>
                        </form>
                    ) : (
                    <div className="space-y-8">
                        {/* Section 1: JHA Info */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-200 pb-2 flex flex-wrap justify-between items-center gap-2">
                                <span>JHA Info</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsJhaEditMode(true)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-all shadow-sm"
                                    >
                                        <Edit size={12} />
                                        EDIT JHA
                                    </button>
                                    <button
                                        onClick={handleDownloadJhaPdf}
                                        disabled={isGeneratingJHAPDF}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:text-[#0F4C75] hover:border-[#0F4C75] transition-all shadow-sm disabled:opacity-50"
                                    >
                                        {isGeneratingJHAPDF ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                        DOWNLOAD PDF
                                    </button>
                                </div>
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Date</p><p className="text-sm font-bold text-slate-700">{new Date(selectedJHA.date).toLocaleDateString()}</p></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Time</p><p className="text-sm font-bold text-slate-700">{selectedJHA.jhaTime}</p></div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Created By</p>
                                    {(() => {
                                        const creator = initialData.employees.find(e => e.value === selectedJHA.createdBy);
                                        if (creator) {
                                            return (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                                        {creator.image ? <img src={creator.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-slate-500">{creator.label?.[0]}</div>}
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-700 truncate">{creator.label}</p>
                                                </div>
                                            );
                                        }
                                        return <p className="text-sm font-bold text-slate-700 truncate">{selectedJHA.createdBy}</p>;
                                    })()}
                                </div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">USA No.</p><p className="text-sm font-bold text-slate-700">{selectedJHA.usaNo || '-'}</p></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Subcontractor USA</p><p className="text-sm font-bold text-slate-700">{selectedJHA.subcontractorUSANo || '-'}</p></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Client Email</p><p className="text-sm font-bold text-slate-700">{selectedJHA.clientEmail || '-'}</p></div>
                            </div>
                        </div>

                        {/* Section 2: Daily Work */}
                        <div>
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Daily Work</h4>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                {[
                                    { label: 'Operating Mini Ex', val: selectedJHA.operatingMiniEx },
                                    { label: 'Vacuum Truck', val: selectedJHA.operatingAVacuumTruck },
                                    { label: 'Excavating/Trenching', val: selectedJHA.excavatingTrenching },
                                    { label: 'AC/Concrete Work', val: selectedJHA.acConcWork },
                                    { label: 'Operating Backhoe', val: selectedJHA.operatingBackhoe },
                                    { label: 'Working in Trench', val: selectedJHA.workingInATrench },
                                    { label: 'Traffic Control', val: selectedJHA.trafficControl },
                                    { label: 'Road Work', val: selectedJHA.roadWork },
                                    { label: 'Operating HDD', val: selectedJHA.operatingHdd },
                                    { label: 'Confined Space', val: selectedJHA.confinedSpace },
                                    { label: 'Setting UG Boxes', val: selectedJHA.settingUgBoxes },
                                    { label: 'Other Daily Work', val: selectedJHA.otherDailyWork, comment: selectedJHA.commentsOtherDailyWork },
                                ].map((item, i) => (
                                    <div key={i} className={`p-3 rounded-lg border flex flex-col gap-2 ${item.val ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100 opacity-60'}`}>
                                        <div className="flex items-center gap-2">
                                            {item.val ? <CheckCircle2 size={16} className="text-blue-600 shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />}
                                            <span className={`text-xs font-bold ${item.val ? 'text-blue-900' : 'text-slate-500'}`}>{item.label}</span>
                                        </div>
                                        {item.val && item.comment && (
                                            <p className="text-[10px] italic text-slate-600 bg-white/50 p-1.5 rounded ml-6 border border-blue-100/50">{item.comment}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Section 3: Jobsite Hazards */}
                        <div>
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Jobsite Hazards</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                {[
                                    { label: 'Sidewalks', val: selectedJHA.sidewalks, c: selectedJHA.commentsOnSidewalks },
                                    { label: 'Heat Awareness', val: selectedJHA.heatAwareness, c: selectedJHA.commentsOnHeatAwareness },
                                    { label: 'Ladder Work', val: selectedJHA.ladderWork, c: selectedJHA.commentsOnLadderWork },
                                    { label: 'Overhead Lifting', val: selectedJHA.overheadLifting, c: selectedJHA.commentsOnOverheadLifting },
                                    { label: 'Material Handling', val: selectedJHA.materialHandling, c: selectedJHA.commentsOnMaterialHandling },
                                    { label: 'Road Hazards', val: selectedJHA.roadHazards, c: selectedJHA.commentsOnRoadHazards },
                                    { label: 'Heavy Lifting', val: selectedJHA.heavyLifting, c: selectedJHA.commentsOnHeavyLifting },
                                    { label: 'High Noise', val: selectedJHA.highNoise, c: selectedJHA.commentsOnHighNoise },
                                    { label: 'Pinch Points', val: selectedJHA.pinchPoints, c: selectedJHA.commentsOnPinchPoints },
                                    { label: 'Sharp Objects', val: selectedJHA.sharpObjects, c: selectedJHA.commentsOnSharpObjects },
                                    { label: 'Tripping Hazards', val: selectedJHA.trippingHazards, c: selectedJHA.commentsOnTrippingHazards },
                                    { label: 'Other Hazards', val: selectedJHA.otherJobsiteHazards, c: selectedJHA.commentsOnOther },
                                ].map((item, i) => (
                                    <div key={i} className="group">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                {item.val ? <AlertCircle size={14} className="text-orange-500" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
                                                <span className={`text-xs font-bold ${item.val ? 'text-slate-800' : 'text-slate-400'}`}>{item.label}</span>
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.val ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-400'}`}>
                                                {item.val ? 'YES' : 'NO'}
                                            </span>
                                        </div>
                                        {item.c && (
                                            <div className="pl-6 text-[11px] text-slate-600 bg-orange-50/50 p-2 rounded border border-orange-100/50 mt-1">
                                                <span className="font-semibold text-orange-800/70">Note:</span> {item.c}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {selectedJHA.anySpecificNotes && (
                                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                                    <p className="text-xs font-bold text-yellow-800 mb-1">Specific Notes:</p>
                                    <p className="text-xs text-yellow-900/80">{selectedJHA.anySpecificNotes}</p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Section 4: Emergency Action Plan */}
                            <div>
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Emergency Action Plan</h4>
                                <div className="space-y-3">
                                    {[
                                        { label: 'Staging Area Discussed', val: selectedJHA.stagingAreaDiscussed },
                                        { label: 'Rescue Procedures Discussed', val: selectedJHA.rescueProceduresDiscussed },
                                        { label: 'Evacuation Routes Discussed', val: selectedJHA.evacuationRoutesDiscussed },
                                        { label: 'Emergency Contact is 911', val: selectedJHA.emergencyContactNumberWillBe911 },
                                        { label: 'First Aid & CPR Equipment Onsite', val: selectedJHA.firstAidAndCPREquipmentOnsite },
                                        { label: 'Closest Hospital Discussed', val: selectedJHA.closestHospitalDiscussed },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                                            <span className="text-xs font-medium text-slate-700">{item.label}</span>
                                            {item.val ? 
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                                                    <CheckCircle2 size={10} /> DONE
                                                </div> 
                                                : 
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-100 text-slate-400 px-2 py-1 rounded-full">
                                                    PENDING
                                                </div>
                                            }
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 5: Hospital */}
                            <div>
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Hospital Information</h4>
                                <div className="bg-red-50 p-5 rounded-xl border border-red-100">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-500 shrink-0">
                                            <Plus size={20} strokeWidth={3} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Nearest Hospital</p>
                                            <p className="text-base font-black text-red-900 mb-1">{selectedJHA.nameOfHospital || 'Not Specified'}</p>
                                            <p className="text-sm text-red-800/80 leading-relaxed">{selectedJHA.addressOfHospital || 'No address provided'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 6: Signatures */}
                        <div>
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Employee Signatures</h4>
                            {selectedJHA.signatures && selectedJHA.signatures.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {selectedJHA.signatures.map((sig: any, index: number) => {
                                        const emp = initialData.employees.find(e => e.value === sig.employee);
                                        return (
                                            <div key={index} className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col items-center gap-1.5 hover:shadow-md transition-all">
                                                <div className="w-full h-24 bg-slate-50 rounded border border-slate-100 flex items-center justify-center overflow-hidden relative">
                                                    {sig.signature ? (
                                                        <img src={sig.signature} alt="Signature" className="max-w-full max-h-full object-contain" />
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">No Image</span>
                                                    )}
                                                </div>
                                                
                                                <div className="flex items-center gap-2 mt-1">
                                                     <div className="w-5 h-5 rounded-full bg-slate-200 border border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                                                        {emp?.image ? (
                                                            <img src={emp.image} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-slate-500">{emp?.label?.[0] || 'U'}</span>
                                                        )}
                                                     </div>
                                                     <p className="text-xs font-bold text-slate-700 truncate max-w-[140px]" title={emp?.label || sig.employee}>
                                                        {emp?.label || sig.employee}
                                                     </p>
                                                </div>

                                                <p className="text-[10px] text-slate-400 font-medium">
                                                    {new Date(sig.createdAt || Date.now()).toLocaleString('en-US', { 
                                                        year: 'numeric', 
                                                        month: 'numeric', 
                                                        day: 'numeric', 
                                                        hour: 'numeric', 
                                                        minute: 'numeric', 
                                                        hour12: true 
                                                    })}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <p className="text-sm text-slate-400 italic">No signatures recorded.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    )
                ) : (
                    <EmptyState title="No Data" message="Unable to load JHA details." />
                )}
            </Modal>

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
        </div>
    );
}
