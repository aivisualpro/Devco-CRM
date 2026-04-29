'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Plus, Search, ArrowUpDown, Pencil, Trash2, Eye,
    Loader2, ChevronDown, Check, Calendar,
    Image as ImageIcon, X, ChevronRight, Upload, ChevronLeft, Drill, MapPin,
    FileText, Mail, Download, Send
} from 'lucide-react';
import { SignaturePad } from '@/components/ui/SignaturePad';
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
import { formatWallDate, formatWallTime, formatWallDateTime } from '@/lib/format/date';
import { useAllEmployees } from '@/lib/hooks/api';

const SOIL_TYPES = [
    'Base & Sand',
    'Clay',
    'Dirt Backfill',
    'Hard Clay',
    'Loamy',
    'Rocky',
    'Sandy',
    'Slurry',
    'Tight Sand'
];

// Reamer options: numbers 1 through 60
const REAMER_OPTIONS = Array.from({ length: 60 }, (_, i) => ({
    id: String(i + 1),
    label: `${i + 1}"`,
    value: String(i + 1)
}));

const PRE_BORE_TEMPLATE_ID = '1oz3s9qdfMnMdEivJhr8T4qPS-lwVGsb1A79eB-Djgic';

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
    customerId?: string;
    foremanName?: string;
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
    const { employees, getByEmail: getEmployeeByEmail } = useAllEmployees();
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
        const [editingLog, setEditingLog] = useState<PreBoreLog | null>(null);
        const [saving, setSaving] = useState(false);

    // PDF & Email States
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [pdfTargetLog, setPdfTargetLog] = useState<PreBoreLog | null>(null);

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
        reamers: '',
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

    // Custom soil types added by user during session
    const [customSoilTypes, setCustomSoilTypes] = useState<string[]>([]);

    // Gallery State
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Geolocation loading state for address fields
    const [geoLoadingField, setGeoLoadingField] = useState<'start' | 'end' | null>(null);

    // Drop pin: get GPS, then reverse geocode to an address
    const handleDropPinAddress = (field: 'addressBoreStart' | 'addressBoreEnd') => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }
        setGeoLoadingField(field === 'addressBoreStart' ? 'start' : 'end');
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
                        { headers: { 'Accept-Language': 'en' } }
                    );
                    const data = await res.json();
                    const address = data?.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                    setFormData(prev => ({ ...prev, [field]: address }));
                    toast.success('📍 Location pinned!');
                } catch {
                    // Fallback to raw coords if geocoding fails
                    setFormData(prev => ({ ...prev, [field]: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` }));
                    toast.success('📍 Location pinned (coordinates)');
                }
                setGeoLoadingField(null);
            },
            (error) => {
                setGeoLoadingField(null);
                toast.error(`Location error: ${error.message}`);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

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
            const [logsRes, estimatesRes, clientsRes] = await Promise.all([
                fetch('/api/pre-bore-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'getPreBoreLogs',
                        payload: { limit: 500 }
                    })
                }),
                fetch(`/api/estimates?limit=500`),
                fetch(`/api/clients?lite=true&limit=500`)
            ]);

            const [logsData, estimatesData, clientsData] = await Promise.all([logsRes.json(), estimatesRes.json(), clientsRes.json()]);

            if (logsData.success) setLogs(logsData.result || []);
            if (estimatesData.success) setEstimates(estimatesData.result || []);
            // Clients API uses paginated response shape { items: [...] }
            if (clientsData.items) setClients(clientsData.items || []);
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

    // Handle ?edit= query param from detail page
    const returnTo = searchParams.get('returnTo');
    useEffect(() => {
        if (!loading && logs.length > 0) {
            const editParam = searchParams.get('edit');
            if (editParam) {
                // editParam is now the direct document _id
                const logToEdit = logs.find(l => l._id === editParam);
                if (logToEdit) {
                    handleEdit(logToEdit);
                    router.replace('/docs/pre-bore-logs', { scroll: false });
                } else {
                    // Legacy fallback: "scheduleId_preBoreId" format
                    const parts = editParam.split('_');
                    if (parts.length === 2) {
                        const [sId, pbId] = parts;
                        const legacyLog = logs.find(l => (l._id === pbId || l.legacyId === pbId));
                        if (legacyLog) {
                            handleEdit(legacyLog);
                            router.replace('/docs/pre-bore-logs', { scroll: false });
                        }
                    }
                }
            }
        }
    }, [loading, logs, searchParams]);

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
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setEditingLog(null);
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
                label: s.fromDate ? formatWallDate(s.fromDate) : 'No date',
                value: s._id
            }));
    }, [schedules]);

    // Employee options for Devco Operator dropdown
    const employeeOptions = useMemo(() => {
        return employees
            .filter(e => e.firstName || e.lastName)
            .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
            .map(e => ({
                id: e.email,
                label: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
                value: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
                profilePicture: e.profilePicture || ''
            }));
    }, [employees]);

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

    const [uploadingItems, setUploadingItems] = useState<Record<number, number>>({}); // rodIndex → count of files uploading

    const handlePhotoUpload = async (index: number, files: FileList | null) => {
        if (!files || files.length === 0) return;

        const fileArr = Array.from(files);
        setUploadingItems(prev => ({ ...prev, [index]: (prev[index] || 0) + fileArr.length }));

        for (const file of fileArr) {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);

            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formDataUpload
                });
                const data = await res.json();
                if (data.success && data.url) {
                    // Append to existing pictures (comma-separated)
                    setFormData(prev => {
                        const updated = [...prev.preBoreLogs];
                        const existing = updated[index].picture || '';
                        const pics = existing ? existing.split(',').filter(Boolean) : [];
                        pics.push(data.url);
                        updated[index] = { ...updated[index], picture: pics.join(',') };
                        return { ...prev, preBoreLogs: updated };
                    });
                }
            } catch (err) {
                console.error('Upload error:', err);
                toast.error(`Failed to upload ${file.name}`);
            } finally {
                setUploadingItems(prev => {
                    const count = (prev[index] || 1) - 1;
                    if (count <= 0) { const { [index]: _, ...rest } = prev; return rest; }
                    return { ...prev, [index]: count };
                });
            }
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
        if (!editingLog && (!selectedCustomerId || !selectedEstimateId)) {
            toast.error('Please select a customer and estimate');
            return;
        }

        setSaving(true);
        try {
            // Upload base64 signatures to Cloudinary if they are still raw base64
            let foremanSigUrl = formData.foremanSignature;
            let customerSigUrl = formData.customerSignature;

            if (foremanSigUrl && foremanSigUrl.startsWith('data:')) {
                try {
                    const sigRes = await fetch('/api/upload-signature', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ base64: foremanSigUrl })
                    });
                    const sigData = await sigRes.json();
                    if (sigData.success && sigData.url) foremanSigUrl = sigData.url;
                } catch (err) {
                    console.error('Failed to upload foreman signature:', err);
                }
            }

            if (customerSigUrl && customerSigUrl.startsWith('data:')) {
                try {
                    const sigRes = await fetch('/api/upload-signature', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ base64: customerSigUrl })
                    });
                    const sigData = await sigRes.json();
                    if (sigData.success && sigData.url) customerSigUrl = sigData.url;
                } catch (err) {
                    console.error('Failed to upload customer signature:', err);
                }
            }

            const preBoreData = {
                estimate: selectedEstimateId || '',
                customerId: selectedCustomerId || '',
                date: formData.date ? new Date(formData.date) : new Date(),
                customerForeman: formData.customerForeman,
                customerWorkRequestNumber: formData.customerWorkRequestNumber,
                startTime: formData.startTime,
                addressBoreStart: formData.addressBoreStart,
                addressBoreEnd: formData.addressBoreEnd,
                devcoOperator: formData.devcoOperator,
                drillSize: formData.drillSize,
                pilotBoreSize: formData.pilotBoreSize,
                reamers: formData.reamers,
                soilType: formData.soilType,
                boreLength: formData.boreLength,
                pipeSize: formData.pipeSize,
                foremanSignature: foremanSigUrl,
                customerName: formData.customerName,
                customerSignature: customerSigUrl,
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
                        ? { id: editingLog._id, item: { ...preBoreData, legacyId: editingLog.legacyId } }
                        : { item: preBoreData }
                })
            });

            const result = await res.json();
            if (result.success) {
                toast.success(editingLog ? 'Pre-Bore Log updated' : 'Pre-Bore Log created');
                setIsModalOpen(false);
                if (returnTo) {
                    router.push(returnTo);
                } else {
                    fetchData();
                }
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

    const handleDelete = async (logToDelete: any) => {
        if (!logToDelete) return;
        setSaving(true);
        try {
            const res = await fetch('/api/pre-bore-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deletePreBoreLog', payload: { id: logToDelete._id, legacyId: logToDelete.legacyId } })
            });

            if (res.ok) {
                toast.success('Pre-Bore Log deleted');
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

    // ==================== Build PDF Payload ====================
    const buildPdfPayload = (log: PreBoreLog) => {
        const dateStr = log.date && !isNaN(new Date(log.date).getTime())
            ? formatWallDate(log.date)
            : '';

        const startTimeStr = log.startTime && !isNaN(new Date(log.startTime).getTime())
            ? formatWallDate(log.startTime)
            : log.startTime || '';

        const estInfo = estimates.find(e => e._id === log.estimate || e.estimate === log.estimate);

        const variables: Record<string, any> = {
            date: dateStr,
            start_time: startTimeStr,
            estimate: estInfo?.estimate || log.estimate || '',
            customer_name: log.customerName || log.scheduleCustomerName || '',
            customer_foreman: log.customerForeman || '',
            customer_work_request: log.customerWorkRequestNumber || '',
            devco_operator: log.devcoOperator || '',
            address_bore_start: log.addressBoreStart || '',
            address_bore_end: log.addressBoreEnd || '',
            drill_size: log.drillSize || '',
            pilot_bore_size: log.pilotBoreSize || '',
            reamer_size_6: log.reamerSize6 || '',
            reamer_size_8: log.reamerSize8 || '',
            reamer_size_10: log.reamerSize10 || '',
            reamer_size_12: log.reamerSize12 || '',
            reamers: (log as any).reamers || [log.reamerSize6, log.reamerSize8, log.reamerSize10, log.reamerSize12].filter(Boolean).map(s => `${s}"`).join(', ') || '',
            soil_type: log.soilType || '',
            bore_length: log.boreLength || '',
            pipe_size: log.pipeSize || '',
            foreman_signature: log.foremanSignature || '',
            customer_signature: log.customerSignature || '',
            total_rods: String(log.preBoreLogs?.length || 0),
            created_by: (() => {
                const emp = employees.find(e => e.email?.toLowerCase() === log.createdBy?.toLowerCase());
                return emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : log.createdBy || '';
            })(),
        };

        const items = (log.preBoreLogs || []).map((item, idx) => ({
            rodNumber: item.rodNumber || String(idx + 1),
            distance: item.distance || '',
            topDepth: item.topDepth || '',
            bottomDepth: item.bottomDepth || '',
            overOrUnder: item.overOrUnder || '',
            existingUtilities: item.existingUtilities || '',
            picture: item.picture || '',
        }));

        return { templateId: PRE_BORE_TEMPLATE_ID, variables, items };
    };

    // ==================== Download PDF ====================
    const handleDownloadPDF = async (log: PreBoreLog) => {
        setIsGeneratingPDF(true);
        setPdfTargetLog(log);
        try {
            const payload = buildPdfPayload(log);
            const response = await fetch('/api/generate-prebore-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Pre_Bore_Log_${log.estimate || 'Report'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            toast.success('PDF downloaded successfully!');
        } catch (error: any) {
            console.error('PDF Error:', error);
            toast.error(error.message || 'Failed to download PDF');
        } finally {
            setIsGeneratingPDF(false);
            setPdfTargetLog(null);
        }
    };

    // ==================== Email PDF ====================
    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pdfTargetLog || !emailTo) return;
        setIsSendingEmail(true);

        try {
            const payload = buildPdfPayload(pdfTargetLog);

            const pdfRes = await fetch('/api/generate-prebore-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!pdfRes.ok) throw new Error('Failed to generate PDF');
            const blob = await pdfRes.blob();

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;

                const emailRes = await fetch('/api/email-prebore-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        emailTo,
                        subject: `Pre-Bore Log Report - ${pdfTargetLog.estimate || 'Report'}`,
                        emailBody: `Please find attached the Pre-Bore Log Report for estimate ${pdfTargetLog.estimate || ''}.`,
                        attachment: base64data
                    })
                });

                const emailData = await emailRes.json();
                if (emailData.success) {
                    toast.success('PDF emailed successfully!');
                    setIsEmailModalOpen(false);
                    setEmailTo('');
                    setPdfTargetLog(null);
                } else {
                    throw new Error(emailData.error || 'Failed to send email');
                }
                setIsSendingEmail(false);
            };
        } catch (error: any) {
            console.error('Email Error:', error);
            toast.error(error.message || 'Failed to send email');
            setIsSendingEmail(false);
        }
    };

    // ==================== Export / Import ====================
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const importFileRef = useRef<HTMLInputElement>(null);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const res = await fetch('/api/pre-bore-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'exportPreBoreLogs', payload: {} })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Export failed');

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pre-bore-logs-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            a.remove();
            toast.success(`Exported ${data.result?.length || 0} schedule records`);
        } catch (err: any) {
            console.error('Export error:', err);
            toast.error(err.message || 'Failed to export');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsImporting(true);
        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const records = parsed.result || parsed;
            if (!Array.isArray(records)) throw new Error('Invalid format: expected array of schedule records');

            const res = await fetch('/api/pre-bore-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'importPreBoreLogsJSON', payload: { records } })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Import failed');
            toast.success(data.message);
            fetchData();
        } catch (err: any) {
            console.error('Import error:', err);
            toast.error(err.message || 'Failed to import');
        } finally {
            setIsImporting(false);
            if (importFileRef.current) importFileRef.current.value = '';
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
                        <div className="hidden lg:flex items-center gap-2">
                            <input
                                ref={importFileRef}
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={handleImport}
                            />
                            <Button
                                onClick={() => importFileRef.current?.click()}
                                disabled={isImporting}
                                className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 w-8 h-8 p-0 rounded-full flex items-center justify-center shadow-sm"
                                title="Import JSON"
                            >
                                {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                            </Button>
                            <Button
                                onClick={handleExport}
                                disabled={isExporting}
                                className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 w-8 h-8 p-0 rounded-full flex items-center justify-center shadow-sm"
                                title="Export JSON"
                            >
                                {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            </Button>
                            {canCreate && (
                                <Button
                                    onClick={handleAddNew}
                                    className="bg-[#0F4C75] hover:bg-[#0a3a5c] text-white w-8 h-8 p-0 rounded-full flex items-center justify-center"
                                >
                                    <Plus size={16} />
                                </Button>
                            )}
                        </div>
                    </div>
                }
            />

            <div className="flex-1 p-4 lg:p-6 overflow-auto flex flex-col min-h-0">
                {loading || returnTo ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin text-[#0F4C75]" />
                            <span className="text-sm text-slate-500">{returnTo ? 'Loading editor...' : 'Loading pre-bore logs...'}</span>
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
                                                        {log.date && !isNaN(new Date(log.date).getTime()) ? formatWallDate(log.date) : '-'}
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
                                            <TableHeader className="w-[100px]">Reamers</TableHeader>
                                            <TableHeader className="w-[80px] text-center">Rods</TableHeader>
                                            <TableHeader className="w-[100px]">Created By</TableHeader>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredLogs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={13} className="h-48 text-center text-slate-500">
                                                    No pre-bore logs found.
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredLogs.map((log) => {
                                            const isExpanded = expandedRows.has(log._id);
                                            const estInfo = estimates.find(e => e._id === log.estimate || e.estimate === log.estimate);
                                            const latestSlug = log.estimate ? (estimates.filter(e => e.estimate === log.estimate).sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0))[0]?._id || log.estimate) : '';
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
                                                            {log.date && !isNaN(new Date(log.date).getTime()) ? formatWallDate(log.date) : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-slate-700 font-semibold max-w-[130px] truncate">
                                                            {(() => {
                                                                // Resolve customer name: customerId → clients list
                                                                if (log.customerId) {
                                                                    const client = clients.find(c => c._id === log.customerId);
                                                                    if (client) return client.name;
                                                                }
                                                                return log.scheduleCustomerName || log.customerName || '-';
                                                            })()}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-blue-600 font-medium cursor-pointer hover:underline" onMouseEnter={() => latestSlug && router.prefetch(`/estimates/${latestSlug}`)} onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!latestSlug) return;
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
                                                        <TableCell className="text-xs text-slate-600">
                                                            {(log as any).reamers
                                                                ? (log as any).reamers.split(',').map((s: string) => s.trim()).filter(Boolean).map((s: string) => `${s}"`).join(', ')
                                                                : [log.reamerSize6 && '6"', log.reamerSize8 && '8"', log.reamerSize10 && '10"', log.reamerSize12 && '12"'].filter(Boolean).join(', ') || '-'}
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
                                                            <TableCell colSpan={12}>
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
                            <button
                                onClick={() => { handleDownloadPDF(actionSheetItem); setActionSheetItem(null); }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#0F4C75] hover:bg-blue-50"
                            >
                                <Download size={18} /> Download PDF
                            </button>
                            <button
                                onClick={() => { setPdfTargetLog(actionSheetItem); setIsEmailModalOpen(true); setActionSheetItem(null); }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                            >
                                <Mail size={18} /> Email PDF
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
                                    onClick={() => {
                                        toast('Confirm Deletion', {
                                            description: `Are you sure you want to delete this log?`,
                                            action: {
                                                label: 'Delete',
                                                onClick: () => handleDelete(actionSheetItem)
                                            },
                                            cancel: { label: 'Cancel', onClick: () => {} }
                                        });
                                        setActionSheetItem(null);
                                    }}}
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
            <PreBoreLogFormModal
                open={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    if (returnTo) router.push(returnTo);
                }}
                editingLog={editingLog}
                estimates={estimates}
                clients={clients}
                onSaved={() => {
                    fetchData();
                }}
            />

            {/* Email PDF Modal */}
            <Dialog open={isEmailModalOpen} onOpenChange={(open) => { setIsEmailModalOpen(open); if (!open) { setEmailTo(''); setPdfTargetLog(null); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Mail size={18} className="text-emerald-600" />
                            Email Pre-Bore Log PDF
                        </DialogTitle>
                        <DialogDescription>
                            Send the Pre-Bore Log as a PDF attachment for{' '}
                            <strong>{pdfTargetLog?.customerName || pdfTargetLog?.devcoOperator || 'this record'}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSendEmail}>
                        <div className="space-y-4 py-2">
                            <div>
                                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email To</Label>
                                <Input
                                    type="email"
                                    required
                                    value={emailTo}
                                    onChange={e => setEmailTo(e.target.value)}
                                    placeholder="recipient@example.com"
                                    className="mt-1"
                                />
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
                                <p className="font-medium text-slate-700 mb-1">Subject:</p>
                                <p>Pre-Bore Log Report - {pdfTargetLog?.estimate || 'Report'}</p>
                            </div>
                        </div>
                        <DialogFooter className="mt-4">
                            <Button type="button" variant="outline" onClick={() => { setIsEmailModalOpen(false); setEmailTo(''); setPdfTargetLog(null); }}>Cancel</Button>
                            <Button type="submit" disabled={isSendingEmail || !emailTo} className="bg-emerald-600 hover:bg-emerald-700">
                                {isSendingEmail ? (
                                    <><Loader2 size={14} className="animate-spin mr-2" /> Sending...</>
                                ) : (
                                    <><Send size={14} className="mr-2" /> Send Email</>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
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
