'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    Plus, Search, ArrowUpDown, Pencil, Trash2, Eye,
    Loader2, ChevronDown, Check, MapPin, Calendar,
    Image as ImageIcon, X, ChevronRight, Upload, ChevronLeft
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
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';

// Dropdown options
const UTILITY_TYPES = [
    'Electrical',
    'Communication',
    'Gas',
    'Water',
    'Sewer',
    'Storm Drain',
    'Fiber Optic',
    'Cable/TV',
    'Unknown',
    'Other'
];

const SOIL_TYPES = [
    '1', '2', '3', '4', '5',
    'Sandy', 'Clay', 'Loam', 'Rocky', 'Mixed'
];

interface PotholeItem {
    _id?: string;
    potholeNo: string;
    typeOfUtility: string;
    soilType: string;
    topDepthOfUtility: string;
    bottomDepthOfUtility: string;
    photos?: string[];  // Multiple photos array
    photo1?: string;    // Legacy field for backward compatibility
    photo2?: string;    // Legacy field for backward compatibility
    pin?: string;
    createdBy?: string;
    createdAt?: Date;
}

interface PotholeLog {
    _id: string;
    oldrefid?: string;
    date: string;
    estimate: string;
    locationOfPothole?: { lat: number; lng: number };
    jobAddress?: string;
    projectionLocation?: string;  // Legacy field for backward compatibility
    potholeItems: PotholeItem[];
    createdBy: string;
    createdAt: string;
}

interface Estimate {
    _id: string;
    estimate?: string;
    projectName?: string;
    jobAddress?: string;
}

interface Employee {
    _id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
}

export default function PotholeLogsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, can } = usePermissions();
    
    // Permission checks - using DOCS module or create a new POTHOLE_LOGS module
    const canCreate = can(MODULES.JHA, ACTIONS.CREATE); // Using JHA permissions as fallback
    const canEdit = can(MODULES.JHA, ACTIONS.EDIT);
    const canDelete = can(MODULES.JHA, ACTIONS.DELETE);

    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<PotholeLog[]>([]);
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
    
    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<PotholeLog | null>(null);
    const [logToDelete, setLogToDelete] = useState<PotholeLog | null>(null);
    const [saving, setSaving] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState({
        date: '',
        estimate: '',
        jobAddress: '',
        locationLat: '',
        locationLng: '',
        potholeItems: [] as PotholeItem[]
    });
    
    // Estimate Selection
    const [selectedEstimateId, setSelectedEstimateId] = useState<string>('');
    const [estimateSearch, setEstimateSearch] = useState('');
    const [isEstimateDropdownOpen, setIsEstimateDropdownOpen] = useState(false);
    
    // Expanded rows for viewing pothole items
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

    // Mobile action sheet
    const [actionSheetItem, setActionSheetItem] = useState<PotholeLog | null>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    const handleLongPressStart = (log: PotholeLog) => {
        longPressTimer.current = setTimeout(() => {
            setActionSheetItem(log);
        }, 500);
    };

    const handleLongPressEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    // Gallery State
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [logsRes, estimatesRes, employeesRes] = await Promise.all([
                fetch('/api/pothole-logs', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ 
                        action: 'getPotholeLogs', 
                        payload: { 
                            limit: 200,
                            projection: { _id: 1, date: 1, estimate: 1, jobAddress: 1, potholeItems: 1, createdBy: 1 }
                        } 
                    }) 
                }),
                fetch('/api/webhook/devcoBackend', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ 
                        action: 'getEstimates', 
                        payload: { 
                            limit: 500,
                            projection: { _id: 1, estimate: 1, projectName: 1, jobAddress: 1 }
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
                })
            ]);
            
            const [logsData, estimatesData, employeesData] = await Promise.all([logsRes.json(), estimatesRes.json(), employeesRes.json()]);
            
            if (logsData.success) setLogs(logsData.result || []);
            if (estimatesData.success) setEstimates(estimatesData.result || []);
            if (employeesData.success) setEmployees(employeesData.result || []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Handle edit query param from URL
    useEffect(() => {
        const editId = searchParams.get('edit');
        if (editId && logs.length > 0) {
            const logToEdit = logs.find(l => l._id === editId);
            if (logToEdit) {
                handleEdit(logToEdit);
                // Clear the query param
                router.replace('/docs/pothole-logs', { scroll: false });
            }
        }
    }, [searchParams, logs]);

    // Filtering & Sorting
    const filteredLogs = useMemo(() => {
        let result = [...logs];

        if (search) {
            const s = search.toLowerCase();
            result = result.filter(log => 
                String(log.estimate || '').toLowerCase().includes(s) ||
                String(log.jobAddress || '').toLowerCase().includes(s) ||
                String(log.oldrefid || '').toLowerCase().includes(s) ||
                log.potholeItems?.some(item => 
                    item.potholeNo?.toLowerCase().includes(s) ||
                    item.typeOfUtility?.toLowerCase().includes(s)
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

    // Find estimate by ID
    const getEstimateInfo = (estimateId: string) => {
        return estimates.find(e => e._id === estimateId || e.estimate === estimateId);
    };

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

    const handleEdit = (log: PotholeLog) => {
        setEditingLog(log);
        // Migrate pothole items - convert legacy photo1/photo2 to photos array
        const migratedPotholeItems = (log.potholeItems || []).map(item => {
            const photos = [
                ...(item.photos || []),
                ...(item.photo1 ? [item.photo1] : []),
                ...(item.photo2 ? [item.photo2] : [])
            ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
            return { ...item, photos };
        });
        setFormData({
            date: log.date ? format(new Date(log.date), 'yyyy-MM-dd') : '',
            estimate: log.estimate || '',
            jobAddress: log.jobAddress || log.projectionLocation || '',
            locationLat: log.locationOfPothole?.lat?.toString() || '',
            locationLng: log.locationOfPothole?.lng?.toString() || '',
            potholeItems: migratedPotholeItems
        });
        setSelectedEstimateId(log.estimate);
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setEditingLog(null);
        setFormData({
            date: format(new Date(), 'yyyy-MM-dd'),
            estimate: '',
            jobAddress: '',
            locationLat: '',
            locationLng: '',
            potholeItems: []
        });
        setSelectedEstimateId('');
        setIsModalOpen(true);
    };

    const handleAddPotholeItem = () => {
        setFormData(prev => ({
            ...prev,
            potholeItems: [...prev.potholeItems, {
                potholeNo: '',
                typeOfUtility: '',
                soilType: '',
                topDepthOfUtility: '',
                bottomDepthOfUtility: '',
                photos: [],
                pin: '',
                createdBy: user?.email || ''
            }]
        }));
    };

    const handleRemovePotholeItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            potholeItems: prev.potholeItems.filter((_, i) => i !== index)
        }));
    };

    const handlePotholeItemChange = (index: number, field: keyof PotholeItem, value: string | string[]) => {
        setFormData(prev => ({
            ...prev,
            potholeItems: prev.potholeItems.map((item, i) => 
                i === index ? { ...item, [field]: value } : item
            )
        }));
    };

    const handlePhotoUpload = async (index: number, files: FileList | null) => {
        if (!files || files.length === 0) return;
        
        const currentPhotos = formData.potholeItems[index]?.photos || [];
        const newPhotoUrls: string[] = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);
            
            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formDataUpload
                });
                const data = await res.json();
                if (data.success && data.url) {
                    newPhotoUrls.push(data.url);
                }
            } catch (err) {
                console.error('Upload error:', err);
                toast.error(`Failed to upload ${file.name}`);
            }
        }
        
        handlePotholeItemChange(index, 'photos', [...currentPhotos, ...newPhotoUrls]);
    };

    const handleRemovePhoto = (itemIndex: number, photoIndex: number) => {
        const currentPhotos = formData.potholeItems[itemIndex]?.photos || [];
        const updatedPhotos = currentPhotos.filter((_, i) => i !== photoIndex);
        handlePotholeItemChange(itemIndex, 'photos', updatedPhotos);
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
        if (!selectedEstimateId) {
            toast.error('Please select an estimate');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                date: formData.date ? new Date(formData.date) : new Date(),
                estimate: selectedEstimateId,
                jobAddress: formData.jobAddress,
                locationOfPothole: formData.locationLat && formData.locationLng ? {
                    lat: parseFloat(formData.locationLat),
                    lng: parseFloat(formData.locationLng)
                } : undefined,
                potholeItems: formData.potholeItems,
                createdBy: editingLog?.createdBy || user?.email
            };

            const action = editingLog ? 'updatePotholeLog' : 'createPotholeLog';
            const res = await fetch('/api/pothole-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action, 
                    payload: editingLog 
                        ? { id: editingLog._id, item: payload } 
                        : { item: payload }
                })
            });

            const result = await res.json();
            if (result.success) {
                toast.success(editingLog ? 'Pothole Log updated' : 'Pothole Log created');
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
            const res = await fetch('/api/pothole-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deletePotholeLog', payload: { id: logToDelete._id } })
            });

            if (res.ok) {
                toast.success('Pothole Log deleted');
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

    // Filter estimates for dropdown
    const filteredEstimates = useMemo(() => {
        const uniqueMap: Record<string, Estimate> = {};
        estimates.forEach(est => {
            const num = est.estimate;
            if (!num) return;
            if (!uniqueMap[num]) uniqueMap[num] = est;
        });

        let res = Object.values(uniqueMap);
        if (estimateSearch) {
            res = res.filter(e => 
                (e.estimate || '').toLowerCase().includes(estimateSearch.toLowerCase()) ||
                (e.projectName || '').toLowerCase().includes(estimateSearch.toLowerCase())
            );
        }
        return res.sort((a, b) => (b.estimate || '').localeCompare(a.estimate || '')).slice(0, 50);
    }, [estimates, estimateSearch]);

    const getSelectedEstimateLabel = () => {
        const est = estimates.find(e => e._id === selectedEstimateId || e.estimate === selectedEstimateId);
        return est ? `${est.estimate || 'No #'} - ${est.projectName || 'Untitled'}` : 'Select Estimate...';
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
                            <span className="text-sm text-slate-500">Loading pothole logs...</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="lg:hidden space-y-3">
                            {filteredLogs.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                                    <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-500 font-medium text-sm">No pothole logs found.</p>
                                </div>
                            ) : (
                                filteredLogs.map((log) => {
                                    const estInfo = getEstimateInfo(log.estimate);
                                    const emp = getEmployeeByEmail(log.createdBy);
                                    return (
                                        <div
                                            key={log._id}
                                            className="bg-white rounded-2xl border border-slate-100 p-4 active:scale-[0.98] transition-transform shadow-sm"
                                            onClick={() => router.push(`/docs/pothole-logs/${log._id}`)}
                                            onTouchStart={() => handleLongPressStart(log)}
                                            onTouchEnd={handleLongPressEnd}
                                            onTouchCancel={handleLongPressEnd}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">
                                                        {log.date && !isNaN(new Date(log.date).getTime()) ? format(new Date(log.date), 'MMM dd, yyyy') : '-'}
                                                    </div>
                                                    <span className="text-xs text-slate-500 truncate block max-w-[180px]">{estInfo?.projectName || '-'}</span>
                                                </div>
                                                <Badge variant="default" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] shrink-0">
                                                    {estInfo?.estimate || log.estimate || 'N/A'}
                                                </Badge>
                                            </div>

                                            {(log.jobAddress || log.projectionLocation) && (
                                                <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                                                    <MapPin size={10} className="shrink-0 text-slate-400" />
                                                    <span className="truncate">{log.jobAddress || log.projectionLocation}</span>
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
                                                    {log.potholeItems?.length || 0} items
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
                                <TableHeader className="w-[120px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('estimate')}>
                                    <div className="flex items-center gap-1">Estimate <ArrowUpDown size={12} className="opacity-50" /></div>
                                </TableHeader>
                                <TableHeader className="min-w-[150px]">Project</TableHeader>
                                <TableHeader className="min-w-[150px]">Job Address</TableHeader>
                                <TableHeader className="w-[80px] text-center">Items</TableHeader>
                                <TableHeader className="w-[100px]">Created By</TableHeader>
                                <TableHeader className="w-[80px] text-right">Actions</TableHeader>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredLogs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-48 text-center text-slate-500">
                                        No pothole logs found.
                                    </TableCell>
                                </TableRow>
                            ) : filteredLogs.map((log) => {
                                const estInfo = getEstimateInfo(log.estimate);
                                const isExpanded = expandedRows.has(log._id);
                                return (
                                    <React.Fragment key={log._id}>
                                        <TableRow 
                                            className="group hover:bg-slate-50 transition-colors cursor-pointer"
                                            onClick={() => router.push(`/docs/pothole-logs/${log._id}`)}
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                {log.potholeItems?.length > 0 && (
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
                                            <TableCell>
                                                <span 
                                                    className="font-semibold text-[#0F4C75] text-xs cursor-pointer hover:underline"
                                                    onClick={() => router.push(`/estimates/${log.estimate}`)}
                                                >
                                                    {estInfo?.estimate || log.estimate || 'N/A'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-600 max-w-[150px] truncate">
                                                {estInfo?.projectName || '-'}
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-600 max-w-[150px] truncate">
                                                {log.jobAddress || log.projectionLocation || '-'}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="default" className="text-[10px]">
                                                    {log.potholeItems?.length || 0}
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
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {canEdit && (
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => handleEdit(log)}>
                                                            <Pencil size={14} />
                                                        </Button>
                                                    )}
                                                    {canDelete && (
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => { setLogToDelete(log); setIsDeleteOpen(true); }}>
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        {isExpanded && log.potholeItems?.map((item, idx) => (
                                            <TableRow key={`${log._id}-item-${idx}`} className="bg-slate-50/50">
                                                <TableCell> </TableCell>
                                                <TableCell colSpan={7}>
                                                    <div className="flex items-center gap-4 py-2 px-4 text-xs">
                                                        <span className="font-bold text-slate-700">#{item.potholeNo || idx + 1}</span>
                                                        <span><strong>Utility:</strong> {item.typeOfUtility || '-'}</span>
                                                        <span><strong>Soil:</strong> {item.soilType || '-'}</span>
                                                        <span><strong>Depth:</strong> {item.topDepthOfUtility || '-'} to {item.bottomDepthOfUtility || '-'}</span>
                                                        {/* Show photos from photos array or legacy photo1/photo2 */}
                                                        {(() => {
                                                            const allPhotos = [
                                                                ...(item.photos || []),
                                                                ...(item.photo1 ? [item.photo1] : []),
                                                                ...(item.photo2 ? [item.photo2] : [])
                                                            ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
                                                            
                                                            return allPhotos.length > 0 && (
                                                                <div className="flex items-center gap-2">
                                                                    {allPhotos.map((photo, pIdx) => (
                                                                        <div 
                                                                            key={pIdx} 
                                                                            className="relative group cursor-pointer"
                                                                            onClick={() => openGallery(allPhotos, pIdx)}
                                                                        >
                                                                            <div className="w-8 h-8 rounded overflow-hidden border hover:border-[#0F4C75] transition-all">
                                                                                <img src={photo} alt={`Photo ${pIdx + 1}`} className="w-full h-full object-cover" />
                                                                            </div>
                                                                            {allPhotos.length > 1 && pIdx === 0 && (
                                                                                <div className="absolute -top-1.5 -right-1.5 bg-[#0F4C75] text-white text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold shadow-sm border border-white">
                                                                                    {allPhotos.length}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            );
                                                        })()}
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
                                Pothole Log — {(() => { const est = getEstimateInfo(actionSheetItem.estimate); return est?.estimate || actionSheetItem.estimate || 'N/A'; })()}
                            </p>
                            <p className="text-xs text-slate-500">{actionSheetItem.jobAddress || actionSheetItem.projectionLocation || '-'}</p>
                        </div>
                        <div className="p-2">
                            <button
                                onClick={() => { router.push(`/docs/pothole-logs/${actionSheetItem._id}`); setActionSheetItem(null); }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                <Eye size={18} /> View
                            </button>
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
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingLog ? 'Edit Pothole Log' : 'New Pothole Log'}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-2 gap-4 py-4">
                        {/* Estimate Selection */}
                        <div className="col-span-2">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Linked Estimate *</Label>
                            <div className="relative mt-1">
                                <div 
                                    className="w-full flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer bg-white hover:border-slate-400 transition-colors"
                                    onClick={() => setIsEstimateDropdownOpen(!isEstimateDropdownOpen)}
                                >
                                    <span className={`text-sm ${selectedEstimateId ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                                        {getSelectedEstimateLabel()}
                                    </span>
                                    <ChevronDown size={16} className="text-slate-400" />
                                </div>
                                
                                {isEstimateDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-xl z-50 max-h-60 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-2 border-b bg-slate-50">
                                            <Input 
                                                placeholder="Search estimates..." 
                                                autoFocus
                                                value={estimateSearch}
                                                onChange={(e) => setEstimateSearch(e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div className="overflow-y-auto flex-1 p-1">
                                            {filteredEstimates.map(est => (
                                                <div 
                                                    key={est._id}
                                                    className={cn(
                                                        "px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between",
                                                        selectedEstimateId === est._id ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700"
                                                    )}
                                                    onClick={() => {
                                                        setSelectedEstimateId(est._id);
                                                        // Auto-fill jobAddress from estimate
                                                        if (est.jobAddress) {
                                                            setFormData(prev => ({ ...prev, jobAddress: est.jobAddress || '' }));
                                                        }
                                                        setIsEstimateDropdownOpen(false);
                                                    }}
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{est.estimate || 'No #'}</span>
                                                        <span className="text-xs opacity-70">{est.projectName}</span>
                                                    </div>
                                                    {selectedEstimateId === est._id && <Check size={14} />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {isEstimateDropdownOpen && (
                                <div className="fixed inset-0 z-40" onClick={() => setIsEstimateDropdownOpen(false)} />
                            )}
                        </div>

                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</Label>
                            <Input 
                                type="date" 
                                value={formData.date} 
                                onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Job Address</Label>
                            <Input 
                                value={formData.jobAddress} 
                                onChange={e => setFormData(prev => ({ ...prev, jobAddress: e.target.value }))}
                                className="mt-1"
                                placeholder="Auto-filled from estimate"
                            />
                        </div>

                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Latitude</Label>
                            <Input 
                                value={formData.locationLat} 
                                onChange={e => setFormData(prev => ({ ...prev, locationLat: e.target.value }))}
                                className="mt-1"
                                placeholder="e.g. 34.0522"
                            />
                        </div>

                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Longitude</Label>
                            <Input 
                                value={formData.locationLng} 
                                onChange={e => setFormData(prev => ({ ...prev, locationLng: e.target.value }))}
                                className="mt-1"
                                placeholder="e.g. -118.2437"
                            />
                        </div>

                        {/* Pothole Items Section */}
                        <div className="col-span-2 mt-4">
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pothole Items</Label>
                                <Button type="button" size="sm" variant="outline" onClick={handleAddPotholeItem}>
                                    <Plus size={14} className="mr-1" /> Add Item
                                </Button>
                            </div>
                            
                            {formData.potholeItems.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-sm border border-dashed rounded-xl">
                                    No pothole items yet. Click "Add Item" to add one.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {formData.potholeItems.map((item, idx) => (
                                        <div key={idx} className="border rounded-xl p-4 bg-slate-50 relative">
                                            <button 
                                                onClick={() => handleRemovePotholeItem(idx)}
                                                className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                                            >
                                                <X size={16} />
                                            </button>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <Label className="text-[9px] text-slate-400">Pothole No</Label>
                                                    <Input 
                                                        value={item.potholeNo} 
                                                        onChange={e => handlePotholeItemChange(idx, 'potholeNo', e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[9px] text-slate-400">Type of Utility</Label>
                                                    <select 
                                                        value={item.typeOfUtility} 
                                                        onChange={e => handlePotholeItemChange(idx, 'typeOfUtility', e.target.value)}
                                                        className="w-full h-8 text-xs border rounded-lg px-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                                                    >
                                                        <option value="">Select type...</option>
                                                        {UTILITY_TYPES.map(type => (
                                                            <option key={type} value={type}>{type}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <Label className="text-[9px] text-slate-400">Soil Type</Label>
                                                    <select 
                                                        value={item.soilType} 
                                                        onChange={e => handlePotholeItemChange(idx, 'soilType', e.target.value)}
                                                        className="w-full h-8 text-xs border rounded-lg px-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                                                    >
                                                        <option value="">Select soil...</option>
                                                        {SOIL_TYPES.map(type => (
                                                            <option key={type} value={type}>{type}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <Label className="text-[9px] text-slate-400">Top Depth</Label>
                                                    <Input 
                                                        value={item.topDepthOfUtility} 
                                                        onChange={e => handlePotholeItemChange(idx, 'topDepthOfUtility', e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[9px] text-slate-400">Bottom Depth</Label>
                                                    <Input 
                                                        value={item.bottomDepthOfUtility} 
                                                        onChange={e => handlePotholeItemChange(idx, 'bottomDepthOfUtility', e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-[9px] text-slate-400">Pin</Label>
                                                    <Input 
                                                        value={item.pin || ''} 
                                                        onChange={e => handlePotholeItemChange(idx, 'pin', e.target.value)}
                                                        className="h-8 text-xs"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <Label className="text-[9px] text-slate-400">Photos</Label>
                                                    <div className="mt-1 flex flex-wrap gap-2 items-center">
                                                        {item.photos?.map((photo, pIdx) => (
                                                            <div key={pIdx} className="relative group">
                                                                <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-blue-400 transition-colors">
                                                                    <img src={photo} alt={`Photo ${pIdx + 1}`} className="w-full h-full object-cover" />
                                                                </div>
                                                                <button
                                                                    onClick={() => handleRemovePhoto(idx, pIdx)}
                                                                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <label className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 cursor-pointer flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 transition-colors">
                                                            <Upload size={16} />
                                                            <span className="text-[8px] mt-1">Add</span>
                                                            <input
                                                                type="file"
                                                                multiple
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
                        <DialogTitle>Delete Pothole Log</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this pothole log for estimate <strong>{logToDelete?.estimate}</strong>?
                            <br/>This will also delete all {logToDelete?.potholeItems?.length || 0} pothole items.
                            <br/>This action cannot be undone.
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
                        {galleryImages.length > 1 && (
                            <div className="flex gap-1.5 border-l border-white/20 pl-3">
                                {galleryImages.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setCurrentImageIndex(i)}
                                        className={cn(
                                            "w-1.5 h-1.5 rounded-full transition-all",
                                            i === currentImageIndex ? "bg-white w-4" : "bg-white/30 hover:bg-white/50"
                                        )}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
