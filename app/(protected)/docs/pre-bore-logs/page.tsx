'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Plus, Search, ArrowUpDown, Pencil, Trash2, Eye,
    Loader2, ChevronDown, Check, Calendar,
    Image as ImageIcon, X, ChevronRight, Upload, ChevronLeft, Drill
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import {
    Header, Button, Table, TableHeader, TableRow, TableHead,
    TableBody, TableCell, Badge, Input
} from '@/components/ui';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { MyDropDown } from '@/components/ui/MyDropDown';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';

const SOIL_TYPES = [
    '1', '2', '3', '4', '5',
    'Sandy', 'Clay', 'Loam', 'Rocky', 'Mixed'
];

interface PreBoreLogItem {
    _id?: string;
    legacyId?: string;
    rodNumber: string;
    distance: string;
    topDepth: string;
    bottomDepth: string;
    overOrUnder: string;
    existingUtilities: string;
    picture?: string;
    createdBy?: string;
    createdAt?: Date;
}

interface PreBoreLog {
    _id: string;
    legacyId?: string;
    scheduleId?: string;
    estimate?: string;
    date: string;
    customerForeman: string;
    customerWorkRequestNumber: string;
    startTime: string;
    addressBoreStart: string;
    addressBoreEnd: string;
    devcoOperator: string;
    drillSize: string;
    pilotBoreSize: string;
    reamerSize6: string;
    reamerSize8: string;
    reamerSize10: string;
    reamerSize12: string;
    soilType: string;
    boreLength: string;
    pipeSize: string;
    foremanSignature: string;
    customerName: string;
    customerSignature: string;
    preBoreLogs: PreBoreLogItem[];
    createdBy: string;
    createdAt: string;
    scheduleCustomerName?: string;
    scheduleCustomerId?: string;
    scheduleTitle?: string;
}

interface Estimate {
    _id: string;
    estimate?: string;
    projectName?: string;
    jobAddress?: string;
    customerName?: string;
    contactName?: string;
    customer?: string;
    versionNumber?: number;
}

interface Client {
    _id: string;
    name: string;
}

interface ScheduleOption {
    _id: string;
    title: string;
    estimate: string;
    fromDate?: string;
    toDate?: string;
    customerName?: string;
    jobLocation?: string;
}

interface Employee {
    _id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
}

export default function PreBoreLogsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, can } = usePermissions();

    const canCreate = can(MODULES.JHA, ACTIONS.CREATE);
    const canEdit = can(MODULES.JHA, ACTIONS.EDIT);
    const canDelete = can(MODULES.JHA, ACTIONS.DELETE);

    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<PreBoreLog[]>([]);
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [search, setSearch] = useState('');

    // Cascading Selection: Customer -> Estimate -> Schedule
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [selectedEstimateId, setSelectedEstimateId] = useState<string>('');
    const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
    const [schedules, setSchedules] = useState<ScheduleOption[]>([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<PreBoreLog | null>(null);
    const [logToDelete, setLogToDelete] = useState<PreBoreLog | null>(null);
    const [saving, setSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        date: '',
        customerForeman: '',
        customerWorkRequestNumber: '',
        startTime: '',
        addressBoreStart: '',
        addressBoreEnd: '',
        devcoOperator: '',
        drillSize: '',
        pilotBoreSize: '',
        reamerSize6: '',
        reamerSize8: '',
        reamerSize10: '',
        reamerSize12: '',
        soilType: '',
        boreLength: '',
        pipeSize: '',
        foremanSignature: '',
        customerName: '',
        customerSignature: '',
        preBoreLogs: [] as PreBoreLogItem[]
    });

    // Expanded rows for viewing bore log items
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Mobile action sheet
    const [actionSheetItem, setActionSheetItem] = useState<PreBoreLog | null>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    // Gallery State
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const handleLongPressStart = (log: PreBoreLog) => {
        longPressTimer.current = setTimeout(() => {
            setActionSheetItem(log);
        }, 500);
    };

    const handleLongPressEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [logsRes, estimatesRes, employeesRes, clientsRes] = await Promise.all([
                fetch('/api/pre-bore-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'getPreBoreLogs',
                        payload: { limit: 500 }
                    })
                }),
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'getEstimates',
                        payload: {
                            limit: 500,
                            projection: { _id: 1, estimate: 1, projectName: 1, jobAddress: 1, customerName: 1, contactName: 1, customer: 1, versionNumber: 1 }
                        }
                    })
                }),
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'getEmployees',
                        payload: {
                            limit: 200,
                            projection: { _id: 1, email: 1, firstName: 1, lastName: 1, profilePicture: 1 }
                        }
                    })
                }),
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'getClients',
                        payload: {
                            limit: 500,
                            projection: { _id: 1, name: 1 }
                        }
                    })
                })
            ]);

            const [logsData, estimatesData, employeesData, clientsData] = await Promise.all([logsRes.json(), estimatesRes.json(), employeesRes.json(), clientsRes.json()]);

            if (logsData.success) setLogs(logsData.result || []);
            if (estimatesData.success) setEstimates(estimatesData.result || []);
            if (employeesData.success) setEmployees(employeesData.result || []);
            if (clientsData.success) setClients(clientsData.result || []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    // Fetch schedules when estimate is selected
    const fetchSchedulesByEstimate = async (estimateNumber: string) => {
        if (!estimateNumber) {
            setSchedules([]);
            return;
        }
        setLoadingSchedules(true);
        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'getSchedulesByEstimate',
                    payload: { estimateNumber }
                })
            });
            const data = await res.json();
            if (data.success) {
                setSchedules(data.result || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingSchedules(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filtering & Sorting
    const filteredLogs = useMemo(() => {
        let result = [...logs];

        if (search) {
            const s = search.toLowerCase();
            result = result.filter(log =>
                String(log.customerName || '').toLowerCase().includes(s) ||
                String(log.customerForeman || '').toLowerCase().includes(s) ||
                String(log.devcoOperator || '').toLowerCase().includes(s) ||
                String(log.addressBoreStart || '').toLowerCase().includes(s) ||
                String(log.addressBoreEnd || '').toLowerCase().includes(s) ||
                String(log.customerWorkRequestNumber || '').toLowerCase().includes(s) ||
                String(log.soilType || '').toLowerCase().includes(s) ||
                String(log.legacyId || '').toLowerCase().includes(s) ||
                log.preBoreLogs?.some(item =>
                    item.rodNumber?.toLowerCase().includes(s) ||
                    item.existingUtilities?.toLowerCase().includes(s)
                )
            );
        }

        result.sort((a: any, b: any) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return result;
    }, [logs, search, sortConfig]);

    // Find employee by email
    const getEmployeeByEmail = (email: string) => {
        if (!email) return null;
        return employees.find(e => e.email?.toLowerCase() === email.toLowerCase());
    };

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const toggleRow = (id: string) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleEdit = (log: PreBoreLog) => {
        setEditingLog(log);

        // Pre-select cascading dropdowns from the existing log
        // Customer: resolve via scheduleCustomerId → clients, or fall back
        const matchedClient = log.scheduleCustomerId
            ? clients.find(c => c._id === log.scheduleCustomerId)
            : clients.find(c => c.name?.toLowerCase() === (log.scheduleCustomerName || '').toLowerCase());
        const custId = matchedClient?._id || '';
        setSelectedCustomerId(custId);

        // Estimate: use the estimate number stored on the log
        const estNum = log.estimate || '';
        setSelectedEstimateId(estNum);

        // Schedule: the _id of the log IS the parentSchedule _id
        setSelectedScheduleId(log._id);

        // Fetch schedules for this estimate so the dropdown is populated
        if (estNum) fetchSchedulesByEstimate(estNum);

        setOpenDropdownId(null);

        // Build a datetime-local value from stored date + startTime
        const buildDateTimeLocal = () => {
            const dateStr = log.date ? format(new Date(log.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
            if (log.startTime && log.startTime.includes('T')) return log.startTime.slice(0, 16);
            if (log.startTime) {
                const match = log.startTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
                if (match) {
                    let hours = parseInt(match[1]);
                    const mins = match[2].padStart(2, '0');
                    const ampm = match[3]?.toUpperCase();
                    if (ampm === 'PM' && hours < 12) hours += 12;
                    if (ampm === 'AM' && hours === 12) hours = 0;
                    return `${dateStr}T${hours.toString().padStart(2, '0')}:${mins}`;
                }
            }
            return `${dateStr}T00:00`;
        };

        setFormData({
            date: log.date ? format(new Date(log.date), 'yyyy-MM-dd') : '',
            customerForeman: log.customerForeman || '',
            customerWorkRequestNumber: log.customerWorkRequestNumber || '',
            startTime: buildDateTimeLocal(),
            addressBoreStart: log.addressBoreStart || '',
            addressBoreEnd: log.addressBoreEnd || '',
            devcoOperator: log.devcoOperator || '',
            drillSize: log.drillSize || '',
            pilotBoreSize: log.pilotBoreSize || '',
            reamerSize6: log.reamerSize6 || '',
            reamerSize8: log.reamerSize8 || '',
            reamerSize10: log.reamerSize10 || '',
            reamerSize12: log.reamerSize12 || '',
            soilType: log.soilType || '',
            boreLength: log.boreLength || '',
            pipeSize: log.pipeSize || '',
            foremanSignature: log.foremanSignature || '',
            customerName: log.customerName || '',
            customerSignature: log.customerSignature || '',
            preBoreLogs: log.preBoreLogs || []
        });
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setEditingLog(null);
        setFormData({
            date: format(new Date(), 'yyyy-MM-dd'),
            customerForeman: '',
            customerWorkRequestNumber: '',
            startTime: '',
            addressBoreStart: '',
            addressBoreEnd: '',
            devcoOperator: '',
            drillSize: '',
            pilotBoreSize: '',
            reamerSize6: '',
            reamerSize8: '',
            reamerSize10: '',
            reamerSize12: '',
            soilType: '',
            boreLength: '',
            pipeSize: '',
            foremanSignature: '',
            customerName: '',
            customerSignature: '',
            preBoreLogs: []
        });
        setSelectedCustomerId('');
        setSelectedEstimateId('');
        setSelectedScheduleId('');
        setSchedules([]);
        setOpenDropdownId(null);
        setIsModalOpen(true);
    };

    // Client options for MyDropDown
    const clientOptions = useMemo(() => {
        return clients
            .filter(c => c.name)
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .map(c => ({
                id: c._id,
                label: c.name,
                value: c._id
            }));
    }, [clients]);

    // Estimate options filtered by selected customer
    const estimateOptions = useMemo(() => {
        // Look up the selected customer's name to match against estimate's customerName/customer fields
        const selectedClientName = clients.find(c => c._id === selectedCustomerId)?.name?.toLowerCase().trim() || '';

        const uniqueMap: Record<string, Estimate> = {};
        estimates.forEach(est => {
            const num = est.estimate;
            if (!num) return;
            // Filter by customer name when one is selected
            if (selectedCustomerId && selectedClientName) {
                const estCust = (est.customerName || est.customer || '').toLowerCase().trim();
                // Skip estimates with no customer info at all
                if (!estCust) return;
                // Match: either the estimate's customer contains the client name, or client name contains the estimate's customer
                const matches = estCust.includes(selectedClientName) || selectedClientName.includes(estCust);
                if (!matches) return;
            }
            if (!uniqueMap[num]) uniqueMap[num] = est;
        });
        return Object.values(uniqueMap)
            .sort((a, b) => (b.estimate || '').localeCompare(a.estimate || ''))
            .map(est => ({
                id: est._id,
                label: `${est.estimate || 'No #'} - ${est.projectName || 'Untitled'}`,
                value: est.estimate || est._id
            }));
    }, [estimates, selectedCustomerId, clients]);

    // Schedule options for MyDropDown
    const scheduleOptions = useMemo(() => {
        return [...schedules]
            .sort((a, b) => {
                const da = a.fromDate ? new Date(a.fromDate).getTime() : 0;
                const db = b.fromDate ? new Date(b.fromDate).getTime() : 0;
                return db - da; // newest first
            })
            .map(s => ({
                id: s._id,
                label: s.fromDate ? format(new Date(s.fromDate), 'MMM dd, yyyy') : 'No date',
                value: s._id
            }));
    }, [schedules]);

    const handleAddBoreItem = () => {
        setFormData(prev => ({
            ...prev,
            preBoreLogs: [...prev.preBoreLogs, {
                rodNumber: '',
                distance: '',
                topDepth: '',
                bottomDepth: '',
                overOrUnder: '',
                existingUtilities: '',
                picture: '',
                createdBy: user?.email || ''
            }]
        }));
    };

    const handleRemoveBoreItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            preBoreLogs: prev.preBoreLogs.filter((_, i) => i !== index)
        }));
    };

    const handleBoreItemChange = (index: number, field: keyof PreBoreLogItem, value: string) => {
        setFormData(prev => ({
            ...prev,
            preBoreLogs: prev.preBoreLogs.map((item, i) =>
                i === index ? { ...item, [field]: value } : item
            )
        }));
    };

    const handlePhotoUpload = async (index: number, files: FileList | null) => {
        if (!files || files.length === 0) return;

        const file = files[0];
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formDataUpload
            });
            const data = await res.json();
            if (data.success && data.url) {
                handleBoreItemChange(index, 'picture', data.url);
            }
        } catch (err) {
            console.error('Upload error:', err);
            toast.error(`Failed to upload ${file.name}`);
        }
    };

    const openGallery = (images: string[], index: number) => {
        setGalleryImages(images);
        setCurrentImageIndex(index);
        setIsGalleryOpen(true);
    };

    const nextImage = (e?: React.MouseEvent | KeyboardEvent) => {
        e?.stopPropagation();
        setCurrentImageIndex((prev) => (prev + 1) % galleryImages.length);
    };

    const prevImage = (e?: React.MouseEvent | KeyboardEvent) => {
        e?.stopPropagation();
        setCurrentImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isGalleryOpen) return;
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
            if (e.key === 'Escape') setIsGalleryOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isGalleryOpen, galleryImages.length]);

    const handleSave = async () => {
        if (!editingLog && !selectedScheduleId) {
            toast.error('Please select a schedule');
            return;
        }

        setSaving(true);
        try {
            const preBoreData = {
                date: formData.date ? new Date(formData.date) : new Date(),
                customerForeman: formData.customerForeman,
                customerWorkRequestNumber: formData.customerWorkRequestNumber,
                startTime: formData.startTime,
                addressBoreStart: formData.addressBoreStart,
                addressBoreEnd: formData.addressBoreEnd,
                devcoOperator: formData.devcoOperator,
                drillSize: formData.drillSize,
                pilotBoreSize: formData.pilotBoreSize,
                reamerSize6: formData.reamerSize6,
                reamerSize8: formData.reamerSize8,
                reamerSize10: formData.reamerSize10,
                reamerSize12: formData.reamerSize12,
                soilType: formData.soilType,
                boreLength: formData.boreLength,
                pipeSize: formData.pipeSize,
                foremanSignature: formData.foremanSignature,
                customerName: formData.customerName,
                customerSignature: formData.customerSignature,
                preBoreLogs: formData.preBoreLogs,
                createdBy: editingLog?.createdBy || user?.email
            };

            const action = editingLog ? 'updatePreBoreLog' : 'createPreBoreLog';
            const res = await fetch('/api/pre-bore-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    payload: editingLog
                        ? { id: editingLog._id, item: preBoreData }
                        : { scheduleId: selectedScheduleId, item: preBoreData }
                })
            });

            const result = await res.json();
            if (result.success) {
                toast.success(editingLog ? 'Pre-Bore Log updated' : 'Pre-Bore Log created');
                setIsModalOpen(false);
                fetchData();
            } else {
                toast.error(result.error || 'Failed to save');
            }
        } catch (err) {
            console.error(err);
            toast.error('An error occurred');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!logToDelete) return;
        setSaving(true);
        try {
            const res = await fetch('/api/pre-bore-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deletePreBoreLog', payload: { id: logToDelete._id } })
            });

            if (res.ok) {
                toast.success('Pre-Bore Log deleted');
                setIsDeleteOpen(false);
                fetchData();
            } else {
                toast.error('Failed to delete');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error deleting log');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header
                rightContent={
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
                        <div className="relative flex-1 max-w-[200px] sm:max-w-[264px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                placeholder="Search logs..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                        {canCreate && (
                            <div className="hidden lg:block">
                                <Button
                                    onClick={handleAddNew}
                                    className="bg-[#0F4C75] hover:bg-[#0a3a5c] text-white w-8 h-8 p-0 rounded-full flex items-center justify-center"
                                >
                                    <Plus size={16} />
                                </Button>
                            </div>
                        )}
                    </div>
                }
            />

            <div className="flex-1 p-4 lg:p-6 overflow-auto flex flex-col min-h-0">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin text-[#0F4C75]" />
                            <span className="text-sm text-slate-500">Loading pre-bore logs...</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="lg:hidden space-y-3">
                            {filteredLogs.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                                    <Drill className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-500 font-medium text-sm">No pre-bore logs found.</p>
                                </div>
                            ) : (
                                filteredLogs.map((log) => {
                                    const emp = getEmployeeByEmail(log.createdBy);
                                    return (
                                        <div
                                            key={log._id}
                                            className="bg-white rounded-2xl border border-slate-100 p-4 active:scale-[0.98] transition-transform shadow-sm"
                                            onClick={() => handleEdit(log)}
                                            onTouchStart={() => handleLongPressStart(log)}
                                            onTouchEnd={handleLongPressEnd}
                                            onTouchCancel={handleLongPressEnd}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">
                                                        {log.date && !isNaN(new Date(log.date).getTime()) ? format(new Date(log.date), 'MMM dd, yyyy') : '-'}
                                                    </div>
                                                    <span className="text-xs text-slate-500 truncate block max-w-[180px]">{log.customerName || '-'}</span>
                                                </div>
                                                <Badge variant="default" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] shrink-0">
                                                    {log.devcoOperator || 'N/A'}
                                                </Badge>
                                            </div>

                                            {(log.addressBoreStart || log.addressBoreEnd) && (
                                                <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                                                    <Drill size={10} className="shrink-0 text-slate-400" />
                                                    <span className="truncate">{log.addressBoreStart}{log.addressBoreEnd ? ` → ${log.addressBoreEnd}` : ''}</span>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                                                <div className="flex items-center gap-2">
                                                    {emp ? (
                                                        <>
                                                            <div className="w-5 h-5 rounded-full bg-[#0F4C75] text-white flex items-center justify-center text-[8px] font-bold overflow-hidden shrink-0">
                                                                {emp.profilePicture ? (
                                                                    <img src={emp.profilePicture} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-slate-500">{emp.firstName} {emp.lastName?.[0]}.</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-500">{log.createdBy || '-'}</span>
                                                    )}
                                                </div>
                                                <Badge variant="default" className="text-[10px]">
                                                    {log.preBoreLogs?.length || 0} rods
                                                </Badge>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden lg:flex flex-col flex-1 min-h-0">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 overflow-hidden">
                                <Table containerClassName="flex-1 overflow-auto">
                                    <TableHead>
                                        <TableRow>
                                            <TableHeader className="w-[40px]"> </TableHeader>
                                            <TableHeader className="w-[100px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('date')}>
                                                <div className="flex items-center gap-1">Date <ArrowUpDown size={12} className="opacity-50" /></div>
                                            </TableHeader>
                                            <TableHeader className="w-[130px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('customerName')}>
                                                <div className="flex items-center gap-1">Customer <ArrowUpDown size={12} className="opacity-50" /></div>
                                            </TableHeader>
                                            <TableHeader className="w-[100px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('estimate')}>
                                                <div className="flex items-center gap-1">Estimate # <ArrowUpDown size={12} className="opacity-50" /></div>
                                            </TableHeader>
                                            <TableHeader className="min-w-[130px]">Project Name</TableHeader>
                                            <TableHeader className="w-[120px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('devcoOperator')}>
                                                <div className="flex items-center gap-1">Operator <ArrowUpDown size={12} className="opacity-50" /></div>
                                            </TableHeader>
                                            <TableHeader className="min-w-[140px]">Bore Start</TableHeader>
                                            <TableHeader className="min-w-[140px]">Bore End</TableHeader>
                                            <TableHeader className="w-[80px]">Soil</TableHeader>
                                            <TableHeader className="w-[80px]">Bore Len</TableHeader>
                                            <TableHeader className="w-[80px] text-center">Rods</TableHeader>
                                            <TableHeader className="w-[100px]">Created By</TableHeader>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredLogs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={12} className="h-48 text-center text-slate-500">
                                                    No pre-bore logs found.
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredLogs.map((log) => {
                                            const isExpanded = expandedRows.has(log._id);
                                            const estInfo = estimates.find(e => e._id === log.estimate || e.estimate === log.estimate);
                                            return (
                                                <React.Fragment key={log._id}>
                                                    <TableRow
                                                        className="group hover:bg-slate-50 transition-colors cursor-pointer"
                                                        onClick={() => handleEdit(log)}
                                                    >
                                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                                            {log.preBoreLogs?.length > 0 && (
                                                                <button
                                                                    onClick={() => toggleRow(log._id)}
                                                                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100"
                                                                >
                                                                    <ChevronRight size={14} className={cn("transition-transform", isExpanded && "rotate-90")} />
                                                                </button>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="font-medium text-slate-700 text-xs whitespace-nowrap">
                                                            {log.date && !isNaN(new Date(log.date).getTime()) ? format(new Date(log.date), 'MMM dd, yyyy') : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-700 font-semibold max-w-[130px] truncate">
                                                            {(() => {
                                                                // Resolve customer name: customerId reference on the schedule → clients list
                                                                if (log.scheduleCustomerId) {
                                                                    const client = clients.find(c => c._id === log.scheduleCustomerId);
                                                                    if (client) return client.name;
                                                                }
                                                                return log.scheduleCustomerName || log.customerName || '-';
                                                            })()}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-blue-600 font-medium cursor-pointer hover:underline" onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!log.estimate) return;
                                                            // Navigate to the latest version of this estimate
                                                            const matchingVersions = estimates
                                                                .filter(e => e.estimate === log.estimate)
                                                                .sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0));
                                                            const latestSlug = matchingVersions[0]?._id || log.estimate;
                                                            router.push(`/estimates/${latestSlug}`);
                                                        }}>
                                                            {log.estimate || '-'}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-600 max-w-[130px] truncate">
                                                            {estInfo?.projectName || '-'}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-600 max-w-[120px] truncate">
                                                            {log.devcoOperator || '-'}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-600 max-w-[140px] truncate">
                                                            {log.addressBoreStart || '-'}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-600 max-w-[140px] truncate">
                                                            {log.addressBoreEnd || '-'}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-600">
                                                            {log.soilType || '-'}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-600">
                                                            {log.boreLength || '-'}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="default" className="text-[10px]">
                                                                {log.preBoreLogs?.length || 0}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {(() => {
                                                                const emp = getEmployeeByEmail(log.createdBy);
                                                                if (emp) {
                                                                    return (
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-6 h-6 rounded-full bg-[#0F4C75] text-white flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0">
                                                                                {emp.profilePicture ? (
                                                                                    <img src={emp.profilePicture} alt="" className="w-full h-full object-cover" />
                                                                                ) : (
                                                                                    `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`
                                                                                )}
                                                                            </div>
                                                                            <span className="text-xs text-slate-700 truncate max-w-[80px]">
                                                                                {emp.firstName} {emp.lastName?.[0]}.
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                }
                                                                return <span className="text-xs text-slate-500 truncate">{log.createdBy || '-'}</span>;
                                                            })()}
                                                        </TableCell>
                                                    </TableRow>
                                                    {isExpanded && log.preBoreLogs?.map((item, idx) => (
                                                        <TableRow key={`${log._id}-item-${idx}`} className="bg-slate-50/50">
                                                            <TableCell> </TableCell>
                                                            <TableCell colSpan={11}>
                                                                <div className="flex items-center gap-4 py-2 px-4 text-xs">
                                                                    <span className="font-bold text-slate-700">Rod #{item.rodNumber || idx + 1}</span>
                                                                    <span><strong>Distance:</strong> {item.distance || '-'}</span>
                                                                    <span><strong>Top:</strong> {item.topDepth || '-'}</span>
                                                                    <span><strong>Bottom:</strong> {item.bottomDepth || '-'}</span>
                                                                    <span><strong>Over/Under:</strong> {item.overOrUnder || '-'}</span>
                                                                    <span><strong>Utilities:</strong> {item.existingUtilities || '-'}</span>
                                                                    {item.picture && (
                                                                        <div
                                                                            className="relative group cursor-pointer"
                                                                            onClick={() => openGallery([item.picture!], 0)}
                                                                        >
                                                                            <div className="w-8 h-8 rounded overflow-hidden border hover:border-[#0F4C75] transition-all">
                                                                                <img src={item.picture} alt={`Rod ${idx + 1}`} className="w-full h-full object-cover" />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Mobile FAB */}
            {canCreate && (
                <button
                    onClick={handleAddNew}
                    className="lg:hidden fixed bottom-24 right-6 w-14 h-14 bg-[#0F4C75] text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform z-30 border-4 border-white"
                >
                    <Plus size={24} />
                </button>
            )}

            {/* Mobile Action Sheet */}
            {actionSheetItem && (
                <div
                    className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-20 lg:pb-4 transition-all"
                    onClick={() => setActionSheetItem(null)}
                >
                    <div
                        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-slate-100">
                            <p className="text-sm font-bold text-slate-800">
                                Pre-Bore Log — {actionSheetItem.customerName || actionSheetItem.devcoOperator || 'N/A'}
                            </p>
                            <p className="text-xs text-slate-500">{actionSheetItem.addressBoreStart || '-'}</p>
                        </div>
                        <div className="p-2">
                            {canEdit && (
                                <button
                                    onClick={() => { handleEdit(actionSheetItem); setActionSheetItem(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50"
                                >
                                    <Pencil size={18} /> Edit
                                </button>
                            )}
                            {canDelete && (
                                <button
                                    onClick={() => { setLogToDelete(actionSheetItem); setIsDeleteOpen(true); setActionSheetItem(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 size={18} /> Delete
                                </button>
                            )}
                        </div>
                        <div className="p-2 border-t border-slate-100">
                            <button
                                onClick={() => setActionSheetItem(null)}
                                className="w-full py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="!max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingLog ? 'Edit Pre-Bore Log' : 'New Pre-Bore Log'}</DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
                        {/* Cascading Selection: Customer -> Estimate -> Schedule */}
                        <>
                            {/* Step 1: Customer Selection */}
                            <div className="sm:col-span-1">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">1. Customer *</Label>
                                <div className="relative mt-1">
                                    <div
                                        className="w-full flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer bg-white hover:border-slate-400 transition-colors"
                                        onClick={() => setOpenDropdownId(openDropdownId === 'customer' ? null : 'customer')}
                                    >
                                        <span className={`text-sm truncate ${selectedCustomerId ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                                            {selectedCustomerId ? (clients.find(c => c._id === selectedCustomerId)?.name || 'Selected') : 'Select Customer...'}
                                        </span>
                                        <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${openDropdownId === 'customer' ? 'rotate-180' : ''}`} />
                                    </div>
                                    {openDropdownId === 'customer' && (
                                        <MyDropDown
                                            isOpen={true}
                                            onClose={() => setOpenDropdownId(null)}
                                            options={clientOptions}
                                            selectedValues={selectedCustomerId ? [selectedCustomerId] : []}
                                            onSelect={(val) => {
                                                const newVal = val === selectedCustomerId ? '' : val;
                                                setSelectedCustomerId(newVal);
                                                setSelectedEstimateId('');
                                                setSelectedScheduleId('');
                                                setSchedules([]);
                                                const client = clients.find(c => c._id === newVal);
                                                if (client) setFormData(prev => ({ ...prev, customerName: client.name }));
                                                setOpenDropdownId(null);
                                            }}
                                            placeholder="Search customers..."
                                            width="w-full"
                                            modal={false}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Step 2: Estimate Selection */}
                            <div className="sm:col-span-1">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">2. Estimate *</Label>
                                <div className="relative mt-1">
                                    <div
                                        className={`w-full flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer transition-colors ${!selectedCustomerId ? 'bg-slate-50 cursor-not-allowed' : 'bg-white hover:border-slate-400'}`}
                                        onClick={() => {
                                            if (!selectedCustomerId) return;
                                            setOpenDropdownId(openDropdownId === 'estimate' ? null : 'estimate');
                                        }}
                                    >
                                        <span className={`text-sm truncate ${selectedEstimateId ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                                            {selectedEstimateId || 'Select Estimate...'}
                                        </span>
                                        <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${openDropdownId === 'estimate' ? 'rotate-180' : ''}`} />
                                    </div>
                                    {openDropdownId === 'estimate' && selectedCustomerId && (
                                        <MyDropDown
                                            isOpen={true}
                                            onClose={() => setOpenDropdownId(null)}
                                            options={estimateOptions}
                                            selectedValues={selectedEstimateId ? [selectedEstimateId] : []}
                                            onSelect={(val) => {
                                                const newVal = val === selectedEstimateId ? '' : val;
                                                setSelectedEstimateId(newVal);
                                                setSelectedScheduleId('');
                                                if (newVal) {
                                                    fetchSchedulesByEstimate(newVal);
                                                    const est = estimates.find(e => e.estimate === newVal);
                                                    const custName = est?.customerName || est?.contactName || formData.customerName;
                                                    const now = new Date();
                                                    const h12 = now.getHours() % 12 || 12;
                                                    const timeStr = `${h12}:${now.getMinutes().toString().padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
                                                    setFormData(prev => ({ ...prev, customerName: custName, startTime: timeStr }));
                                                } else {
                                                    setSchedules([]);
                                                }
                                                setOpenDropdownId(null);
                                            }}
                                            placeholder="Search estimates..."
                                            width="w-full"
                                            modal={false}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Step 3: Schedule Selection */}
                            <div className="sm:col-span-1">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">3. Schedule *</Label>
                                <div className="relative mt-1">
                                    <div
                                        className={`w-full flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer transition-colors ${!selectedEstimateId ? 'bg-slate-50 cursor-not-allowed' : 'bg-white hover:border-slate-400'}`}
                                        onClick={() => {
                                            if (!selectedEstimateId) return;
                                            setOpenDropdownId(openDropdownId === 'schedule' ? null : 'schedule');
                                        }}
                                    >
                                        <span className={`text-sm truncate ${selectedScheduleId ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                                            {selectedScheduleId
                                                ? (() => {
                                                    const s = schedules.find(s => s._id === selectedScheduleId);
                                                    return s?.fromDate ? format(new Date(s.fromDate), 'MMM dd, yyyy') : 'Selected';
                                                })()
                                                : (loadingSchedules ? 'Loading...' : 'Select Schedule...')}
                                        </span>
                                        <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${openDropdownId === 'schedule' ? 'rotate-180' : ''}`} />
                                    </div>
                                    {openDropdownId === 'schedule' && selectedEstimateId && (
                                        <MyDropDown
                                            isOpen={true}
                                            onClose={() => setOpenDropdownId(null)}
                                            options={scheduleOptions}
                                            selectedValues={selectedScheduleId ? [selectedScheduleId] : []}
                                            onSelect={(val) => {
                                                const newVal = val === selectedScheduleId ? '' : val;
                                                setSelectedScheduleId(newVal);
                                                // Auto-fill date & startTime from selected schedule's fromDate
                                                if (newVal) {
                                                    const sched = schedules.find(s => s._id === newVal);
                                                    if (sched?.fromDate) {
                                                        const d = new Date(sched.fromDate);
                                                        const dateStr = format(d, 'yyyy-MM-dd');
                                                        const timeStr = `${dateStr}T${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                                                        setFormData(prev => ({ ...prev, date: dateStr, startTime: timeStr }));
                                                    }
                                                }
                                                setOpenDropdownId(null);
                                            }}
                                            placeholder="Search schedules..."
                                            emptyMessage={loadingSchedules ? 'Loading schedules...' : 'No schedules found for this estimate'}
                                            width="w-full"
                                            modal={false}
                                        />
                                    )}
                                </div>
                            </div>
                        </>

                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Start Date &amp; Time</Label>
                            <Input
                                type="datetime-local"
                                value={formData.startTime}
                                onChange={e => setFormData(prev => ({ ...prev, startTime: e.target.value, date: e.target.value.split('T')[0] }))}
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Foreman</Label>
                            <Input
                                value={formData.customerForeman}
                                onChange={e => setFormData(prev => ({ ...prev, customerForeman: e.target.value }))}
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Work Request #</Label>
                            <Input
                                value={formData.customerWorkRequestNumber}
                                onChange={e => setFormData(prev => ({ ...prev, customerWorkRequestNumber: e.target.value }))}
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Devco Operator</Label>
                            <Input
                                value={formData.devcoOperator}
                                onChange={e => setFormData(prev => ({ ...prev, devcoOperator: e.target.value }))}
                                className="mt-1"
                            />
                        </div>

                        <div className="col-span-2 sm:col-span-3 grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Address Bore Start</Label>
                                <Input
                                    value={formData.addressBoreStart}
                                    onChange={e => setFormData(prev => ({ ...prev, addressBoreStart: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Address Bore End</Label>
                                <Input
                                    value={formData.addressBoreEnd}
                                    onChange={e => setFormData(prev => ({ ...prev, addressBoreEnd: e.target.value }))}
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        {/* Drill / Bore Specifications */}
                        <div className="col-span-2 sm:col-span-3 mt-2">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Bore Specifications</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div>
                                    <Label className="text-[9px] text-slate-400">Drill Size</Label>
                                    <Input
                                        value={formData.drillSize}
                                        onChange={e => setFormData(prev => ({ ...prev, drillSize: e.target.value }))}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div>
                                    <Label className="text-[9px] text-slate-400">Pilot Bore Size</Label>
                                    <Input
                                        value={formData.pilotBoreSize}
                                        onChange={e => setFormData(prev => ({ ...prev, pilotBoreSize: e.target.value }))}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div>
                                    <Label className="text-[9px] text-slate-400">Bore Length</Label>
                                    <Input
                                        value={formData.boreLength}
                                        onChange={e => setFormData(prev => ({ ...prev, boreLength: e.target.value }))}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div>
                                    <Label className="text-[9px] text-slate-400">Pipe Size</Label>
                                    <Input
                                        value={formData.pipeSize}
                                        onChange={e => setFormData(prev => ({ ...prev, pipeSize: e.target.value }))}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Reamer Sizes */}
                        <div className="col-span-2 sm:col-span-3">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Reamer Sizes</Label>
                            <div className="grid grid-cols-4 gap-3">
                                <div>
                                    <Label className="text-[9px] text-slate-400">6&quot;</Label>
                                    <Input
                                        value={formData.reamerSize6}
                                        onChange={e => setFormData(prev => ({ ...prev, reamerSize6: e.target.value }))}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div>
                                    <Label className="text-[9px] text-slate-400">8&quot;</Label>
                                    <Input
                                        value={formData.reamerSize8}
                                        onChange={e => setFormData(prev => ({ ...prev, reamerSize8: e.target.value }))}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div>
                                    <Label className="text-[9px] text-slate-400">10&quot;</Label>
                                    <Input
                                        value={formData.reamerSize10}
                                        onChange={e => setFormData(prev => ({ ...prev, reamerSize10: e.target.value }))}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div>
                                    <Label className="text-[9px] text-slate-400">12&quot;</Label>
                                    <Input
                                        value={formData.reamerSize12}
                                        onChange={e => setFormData(prev => ({ ...prev, reamerSize12: e.target.value }))}
                                        className="h-8 text-xs"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Soil Type</Label>
                            <select
                                value={formData.soilType}
                                onChange={e => setFormData(prev => ({ ...prev, soilType: e.target.value }))}
                                className="w-full mt-1 h-9 text-sm border rounded-lg px-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                            >
                                <option value="">Select soil...</option>
                                {SOIL_TYPES.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        {/* Pre-Bore Log Items Section */}
                        <div className="col-span-2 sm:col-span-3 mt-4">
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rod Log Items</Label>
                                <Button type="button" size="sm" variant="outline" onClick={handleAddBoreItem}>
                                    <Plus size={14} className="mr-1" /> Add Rod
                                </Button>
                            </div>

                            {formData.preBoreLogs.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-sm border border-dashed rounded-xl">
                                    No rod log items yet. Click &quot;Add Rod&quot; to add one.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {formData.preBoreLogs.map((item, idx) => (
                                        <div key={idx} className="border rounded-xl p-4 bg-slate-50 relative">
                                            <button
                                                onClick={() => handleRemoveBoreItem(idx)}
                                                className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                                            >
                                                <X size={16} />
                                            </button>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                                <div>
                                                    <Label className="text-[9px] text-slate-400">Rod #</Label>
                                                    <Input
                                                        value={item.rodNumber}
                                                        onChange={e => handleBoreItemChange(idx, 'rodNumber', e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[9px] text-slate-400">Distance</Label>
                                                    <Input
                                                        value={item.distance}
                                                        onChange={e => handleBoreItemChange(idx, 'distance', e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[9px] text-slate-400">Top Depth</Label>
                                                    <Input
                                                        value={item.topDepth}
                                                        onChange={e => handleBoreItemChange(idx, 'topDepth', e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[9px] text-slate-400">Bottom Depth</Label>
                                                    <Input
                                                        value={item.bottomDepth}
                                                        onChange={e => handleBoreItemChange(idx, 'bottomDepth', e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[9px] text-slate-400">Over / Under</Label>
                                                    <Input
                                                        value={item.overOrUnder}
                                                        onChange={e => handleBoreItemChange(idx, 'overOrUnder', e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[9px] text-slate-400">Existing Utilities</Label>
                                                    <Input
                                                        value={item.existingUtilities}
                                                        onChange={e => handleBoreItemChange(idx, 'existingUtilities', e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <Label className="text-[9px] text-slate-400">Picture</Label>
                                                    <div className="mt-1 flex items-center gap-2">
                                                        {item.picture ? (
                                                            <div className="relative group">
                                                                <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-blue-400 transition-colors">
                                                                    <img src={item.picture} alt={`Rod ${idx + 1}`} className="w-full h-full object-cover" />
                                                                </div>
                                                                <button
                                                                    onClick={() => handleBoreItemChange(idx, 'picture', '')}
                                                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ) : null}
                                                        <label className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 cursor-pointer flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 transition-colors">
                                                            <Upload size={16} />
                                                            <span className="text-[8px] mt-1">Add</span>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={e => handlePhotoUpload(idx, e.target.files)}
                                                            />
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C75] hover:bg-[#0a3a5c]">
                            {saving ? 'Saving...' : (editingLog ? 'Update' : 'Create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Pre-Bore Log</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this pre-bore log for <strong>{logToDelete?.customerName || logToDelete?.devcoOperator}</strong>?
                            <br />This will also delete all {logToDelete?.preBoreLogs?.length || 0} rod items.
                            <br />This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                            {saving ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Image Gallery Modal */}
            <Dialog open={isGalleryOpen} onOpenChange={setIsGalleryOpen}>
                <DialogContent className="max-w-4xl w-full p-0 bg-black/95 border-none overflow-hidden h-[80vh] flex flex-col items-center justify-center">
                    <button
                        onClick={() => setIsGalleryOpen(false)}
                        className="absolute top-4 right-4 text-white/50 hover:text-white z-50 p-2 bg-white/10 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>

                    {galleryImages.length > 1 && (
                        <>
                            <button
                                onClick={prevImage}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white z-50 p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all group"
                            >
                                <ChevronLeft size={32} className="group-hover:-translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={nextImage}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white z-50 p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all group"
                            >
                                <ChevronRight size={32} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </>
                    )}

                    <div className="relative w-full h-full flex items-center justify-center p-8">
                        <img
                            src={galleryImages[currentImageIndex]}
                            alt={`Gallery image ${currentImageIndex + 1}`}
                            className="max-w-full max-h-full object-contain animate-in fade-in zoom-in duration-300"
                        />
                    </div>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3">
                        <div className="text-white text-sm font-medium">
                            {currentImageIndex + 1} / {galleryImages.length}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
