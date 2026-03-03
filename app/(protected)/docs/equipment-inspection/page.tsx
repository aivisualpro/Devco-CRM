'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Plus, Search, ChevronRight, Loader2, ArrowUpDown,
    ClipboardCheck, Download, Mail, Pencil, Trash2,
    X, Calendar, ChevronDown, Shield, Wrench, Send
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import {
    Header, Button, Badge, Input,
    Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from '@/components/ui';
import { Label } from '@/components/ui/label';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { MyDropDown } from '@/components/ui/MyDropDown';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import { cn } from '@/lib/utils';

const INSPECTION_TYPES = ['General Maintenance', 'Project Specific'];
const INSPECTION_FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Bi-Annually', 'Annually'];
const DEFAULT_INSPECTION_ITEMS = [
    'Engine Oil Level',
    'Hydraulic Fluid',
    'Coolant Level',
    'Fuel System / Leaks',
    'Battery / Electrical',
    'Tires / Tracks Condition',
    'Lights / Alarms',
    'Brakes',
    'Safety Equipment',
    'Attachments / Teeth / Wear Parts',
    'General Condition'
];

const TEMPLATE_ID = '1hrcARBznVAnT3sqCC2LB5s9rAXX9MpX1C2M24m77qCQ';

interface InspectionItem {
    name: string;
    status: 'ok' | 'needs_attention' | '';
    notes: string;
}

interface EquipmentInspection {
    _id: string;
    date: string;
    type: string;
    inspectionFrequency: string;
    estimate: string;
    projectName: string;
    jobLocation: string;
    equipment: string;
    inspectionItems: InspectionItem[];
    createdBy: string;
    createdAt: string;
}

interface Estimate {
    _id: string;
    estimate: string;
    projectName?: string;
    jobLocation?: string;
    versionNumber?: number;
}

interface VehicleDoc {
    _id: string;
    unit: string;
    unitNumber: string;
    vinSerialNumber: string;
}

interface Employee {
    _id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
}

export default function EquipmentInspectionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get('returnTo');
    const editId = searchParams.get('edit');
    const { can } = usePermissions();
    const canCreate = can(MODULES.JHA, ACTIONS.CREATE);
    const canEdit = can(MODULES.JHA, ACTIONS.EDIT);
    const canDelete = can(MODULES.JHA, ACTIONS.DELETE);

    // Data states
    const [inspections, setInspections] = useState<EquipmentInspection[]>([]);
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [vehicles, setVehicles] = useState<VehicleDoc[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    // UI states
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<string>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<EquipmentInspection | null>(null);
    const [saving, setSaving] = useState(false);

    // Delete states
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<EquipmentInspection | null>(null);

    // PDF/Email states
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [pdfTarget, setPdfTarget] = useState<EquipmentInspection | null>(null);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    // Dropdown states
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

    // Form data
    const [formData, setFormData] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        type: '',
        inspectionFrequency: '',
        estimate: '',
        projectName: '',
        jobLocation: '',
        equipment: '',
        inspectionItems: DEFAULT_INSPECTION_ITEMS.map(name => ({
            name,
            status: '' as 'ok' | 'needs_attention' | '',
            notes: ''
        }))
    });

    // Fetch data
    useEffect(() => { fetchData(); }, []);

    // Handle edit query parameter (e.g. coming from detail page)
    useEffect(() => {
        if (editId && inspections.length > 0 && !isModalOpen) {
            const record = inspections.find(i => i._id === editId);
            if (record) handleEdit(record);
        }
    }, [editId, inspections]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [inspRes, estRes, vehRes, empRes] = await Promise.all([
                fetch('/api/equipment-inspection', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getAll', payload: {} })
                }),
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getEstimates', payload: { limit: 1000 } })
                }),
                fetch('/api/vehicle-docs'),
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getEmployees', payload: { limit: 500 } })
                })
            ]);

            const [inspData, estData, vehData, empData] = await Promise.all([
                inspRes.json(), estRes.json(), vehRes.json(), empRes.json()
            ]);

            if (inspData.success) setInspections(inspData.result || []);
            if (estData.success) setEstimates(estData.result || []);
            if (vehData.success) setVehicles(vehData.docs || []);
            if (empData.success) setEmployees(empData.result || []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    // Get unique estimates (latest version only)
    const uniqueEstimates = useMemo(() => {
        const map = new Map<string, Estimate>();
        for (const e of estimates) {
            const key = e.estimate;
            if (!key) continue;
            const existing = map.get(key);
            if (!existing || (e.versionNumber || 0) > (existing.versionNumber || 0)) {
                map.set(key, e);
            }
        }
        return Array.from(map.values()).sort((a, b) => (a.estimate || '').localeCompare(b.estimate || ''));
    }, [estimates]);

    // Equipment options from vehicles
    const equipmentOptions = useMemo(() => {
        return vehicles.map(v => ({
            id: v._id,
            label: `${v.unit} - ${v.unitNumber}`,
            value: `${v.unit} - ${v.unitNumber}`
        }));
    }, [vehicles]);

    const getEmployeeByEmail = (email: string) => {
        if (!email) return null;
        return employees.find(e => e.email?.toLowerCase() === email.toLowerCase());
    };

    // Sorting
    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    // Filtered & sorted data
    const filteredInspections = useMemo(() => {
        let result = [...inspections];
        if (search) {
            const s = search.toLowerCase();
            result = result.filter(i =>
                (i.equipment || '').toLowerCase().includes(s) ||
                (i.type || '').toLowerCase().includes(s) ||
                (i.estimate || '').toLowerCase().includes(s) ||
                (i.projectName || '').toLowerCase().includes(s) ||
                (i.inspectionFrequency || '').toLowerCase().includes(s)
            );
        }
        result.sort((a, b) => {
            const aVal = (a as any)[sortKey] || '';
            const bVal = (b as any)[sortKey] || '';
            const cmp = String(aVal).localeCompare(String(bVal));
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return result;
    }, [inspections, search, sortKey, sortDir]);

    // Estimate selection handler
    const handleEstimateSelect = (estNum: string) => {
        const est = uniqueEstimates.find(e => e.estimate === estNum);
        setFormData(prev => ({
            ...prev,
            estimate: estNum,
            projectName: est?.projectName || '',
            jobLocation: est?.jobLocation || ''
        }));
        setOpenDropdownId(null);
    };

    // Modal handlers
    const handleAddNew = () => {
        setEditingRecord(null);
        setFormData({
            date: format(new Date(), 'yyyy-MM-dd'),
            type: '',
            inspectionFrequency: '',
            estimate: '',
            projectName: '',
            jobLocation: '',
            equipment: '',
            inspectionItems: DEFAULT_INSPECTION_ITEMS.map(name => ({
                name, status: '' as const, notes: ''
            }))
        });
        setOpenDropdownId(null);
        setIsModalOpen(true);
    };

    const handleEdit = (record: EquipmentInspection) => {
        setEditingRecord(record);
        setFormData({
            date: record.date ? format(new Date(record.date), 'yyyy-MM-dd') : '',
            type: record.type || '',
            inspectionFrequency: record.inspectionFrequency || '',
            estimate: record.estimate || '',
            projectName: record.projectName || '',
            jobLocation: record.jobLocation || '',
            equipment: record.equipment || '',
            inspectionItems: record.inspectionItems?.length > 0
                ? record.inspectionItems
                : DEFAULT_INSPECTION_ITEMS.map(name => ({ name, status: '' as const, notes: '' }))
        });
        setOpenDropdownId(null);
        setIsModalOpen(true);
    };

    // Save
    const handleSave = async () => {
        if (!formData.type) { toast.error('Please select an inspection type'); return; }
        if (!formData.inspectionFrequency) { toast.error('Please select an inspection frequency'); return; }

        setSaving(true);
        try {
            const user = JSON.parse(localStorage.getItem('devco_user') || '{}');
            const item = {
                ...formData,
                date: formData.date ? new Date(formData.date) : new Date(),
                createdBy: editingRecord?.createdBy || user?.email || ''
            };

            const action = editingRecord ? 'update' : 'create';
            const res = await fetch('/api/equipment-inspection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    payload: editingRecord ? { id: editingRecord._id, item } : { item }
                })
            });

            const result = await res.json();
            if (result.success) {
                toast.success(editingRecord ? 'Inspection updated' : 'Inspection created');
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

    // Delete
    const handleDelete = async () => {
        if (!recordToDelete) return;
        setSaving(true);
        try {
            const res = await fetch('/api/equipment-inspection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', payload: { id: recordToDelete._id } })
            });
            const result = await res.json();
            if (result.success) {
                toast.success('Inspection deleted');
                setIsDeleteOpen(false);
                setRecordToDelete(null);
                fetchData();
            } else {
                toast.error(result.error || 'Failed to delete');
            }
        } catch {
            toast.error('Failed to delete');
        } finally {
            setSaving(false);
        }
    };

    // Build PDF payload
    const buildPdfPayload = (record: EquipmentInspection) => {
        const dateStr = record.date && !isNaN(new Date(record.date).getTime())
            ? format(new Date(record.date), 'MM/dd/yyyy')
            : '';

        const emp = getEmployeeByEmail(record.createdBy);
        const createdByName = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : record.createdBy || '';

        const variables: Record<string, any> = {
            date: dateStr,
            type: record.type || '',
            inspection_frequency: record.inspectionFrequency || '',
            estimate: record.estimate || '',
            project_name: record.projectName || '',
            job_location: record.jobLocation || '',
            equipment: record.equipment || '',
            created_by: createdByName,
            total_items: String(record.inspectionItems?.length || 0),
            ok_count: String(record.inspectionItems?.filter(i => i.status === 'ok').length || 0),
            attention_count: String(record.inspectionItems?.filter(i => i.status === 'needs_attention').length || 0),
        };

        const items = (record.inspectionItems || []).map(item => ({
            name: item.name || '',
            status: item.status || '',
            notes: item.notes || ''
        }));

        return { templateId: TEMPLATE_ID, variables, items };
    };

    // Download PDF
    const handleDownloadPDF = async (record: EquipmentInspection) => {
        setIsGeneratingPDF(true);
        setPdfTarget(record);
        try {
            const payload = buildPdfPayload(record);
            const response = await fetch('/api/generate-inspection-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to generate PDF');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Equipment_Inspection_${record.equipment || 'Report'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast.success('PDF downloaded!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to download PDF');
        } finally {
            setIsGeneratingPDF(false);
            setPdfTarget(null);
        }
    };

    // Send email
    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pdfTarget || !emailTo) return;
        setIsSendingEmail(true);
        try {
            const payload = buildPdfPayload(pdfTarget);
            const pdfRes = await fetch('/api/generate-inspection-pdf', {
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
                const emailRes = await fetch('/api/email-inspection', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        emailTo,
                        subject: `Equipment Inspection Checklist - ${pdfTarget.equipment || ''}`,
                        emailBody: `Please find attached the Equipment Inspection Checklist for ${pdfTarget.equipment || 'equipment'}.`,
                        attachment: base64data
                    })
                });
                const emailData = await emailRes.json();
                if (emailData.success) {
                    toast.success('PDF emailed successfully!');
                    setIsEmailModalOpen(false);
                    setEmailTo('');
                    setPdfTarget(null);
                } else {
                    throw new Error(emailData.error || 'Failed to send email');
                }
                setIsSendingEmail(false);
            };
        } catch (error: any) {
            toast.error(error.message || 'Failed to send email');
            setIsSendingEmail(false);
        }
    };

    // Update inspection item
    const updateInspectionItem = (index: number, field: keyof InspectionItem, value: string) => {
        setFormData(prev => ({
            ...prev,
            inspectionItems: prev.inspectionItems.map((item, i) =>
                i === index ? { ...item, [field]: value } : item
            )
        }));
    };

    // Add custom inspection item
    const addInspectionItem = () => {
        setFormData(prev => ({
            ...prev,
            inspectionItems: [...prev.inspectionItems, { name: '', status: '' as const, notes: '' }]
        }));
    };

    const removeInspectionItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            inspectionItems: prev.inspectionItems.filter((_, i) => i !== index)
        }));
    };

    // Status badge helper
    const getStatusBadge = (status: string) => {
        if (status === 'ok') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">✓ OK</Badge>;
        if (status === 'needs_attention') return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">⚠ Attention</Badge>;
        return <Badge className="bg-slate-100 text-slate-400 border-slate-200 text-[10px]">—</Badge>;
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header
                rightContent={
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
                        <div className="relative flex-1 max-w-[200px] sm:max-w-[264px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                placeholder="Search inspections..."
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
                {loading || returnTo ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin text-[#0F4C75]" />
                            <span className="text-sm text-slate-500">{returnTo ? 'Loading editor...' : 'Loading inspections...'}</span>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="lg:hidden space-y-3">
                            {filteredInspections.length === 0 ? (
                                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                                    <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-500 font-medium text-sm">No inspections found.</p>
                                    {canCreate && (
                                        <Button onClick={handleAddNew} className="bg-[#0F4C75] hover:bg-[#0a3a5c] text-white mt-3" size="sm">
                                            <Plus size={14} className="mr-1" /> New Inspection
                                        </Button>
                                    )}
                                </div>
                            ) : filteredInspections.map((record) => {
                                const okCount = record.inspectionItems?.filter(i => i.status === 'ok').length || 0;
                                const attentionCount = record.inspectionItems?.filter(i => i.status === 'needs_attention').length || 0;
                                const creator = getEmployeeByEmail(record.createdBy);
                                return (
                                    <div
                                        key={record._id}
                                        className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm"
                                    >
                                        {/* Top row: Date + Type badge */}
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-slate-800">
                                                    {record.date && !isNaN(new Date(record.date).getTime()) ? format(new Date(record.date), 'MMM dd, yyyy') : '-'}
                                                </div>
                                                <p className="text-xs text-slate-500 truncate mt-0.5">{record.equipment || '-'}</p>
                                            </div>
                                            <Badge className={cn(
                                                "text-[10px] shrink-0 ml-2",
                                                record.type === 'General Maintenance' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'
                                            )}>
                                                {record.type || 'N/A'}
                                            </Badge>
                                        </div>

                                        {/* Project + Estimate */}
                                        {(record.estimate || record.projectName) && (
                                            <div className="flex items-center gap-2 mb-2 text-xs">
                                                {record.estimate && (
                                                    <span className="font-semibold text-[#0F4C75]">{record.estimate}</span>
                                                )}
                                                {record.estimate && record.projectName && <span className="text-slate-300">•</span>}
                                                {record.projectName && (
                                                    <span className="text-slate-500 truncate">{record.projectName}</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Status badges */}
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <Shield size={10} className="text-slate-400" />
                                            <span>{record.inspectionFrequency}</span>
                                            <span className="text-slate-300">•</span>
                                            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                                                <span className="w-4 h-4 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">{okCount}</span> OK
                                            </span>
                                            {attentionCount > 0 && (
                                                <>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                                                        <span className="w-4 h-4 rounded bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold">{attentionCount}</span> ⚠
                                                    </span>
                                                </>
                                            )}
                                        </div>

                                        {/* Footer: Creator + Actions */}
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                                            <div className="flex items-center gap-2">
                                                {creator?.profilePicture ? (
                                                    <img src={creator.profilePicture} className="w-5 h-5 rounded-full object-cover border border-slate-200" />
                                                ) : (
                                                    <div className="w-5 h-5 rounded-full bg-[#0F4C75] text-white flex items-center justify-center text-[8px] font-bold shrink-0">
                                                        {creator ? `${creator.firstName?.[0] || ''}${creator.lastName?.[0] || ''}` : (record.createdBy?.[0]?.toUpperCase() || '?')}
                                                    </div>
                                                )}
                                                <span className="text-[10px] text-slate-500 truncate max-w-[80px]">
                                                    {creator ? `${creator.firstName || ''} ${creator.lastName?.[0] || ''}.` : (record.createdBy || '-')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-slate-400 hover:text-[#0F4C75]"
                                                    onClick={(e) => { e.stopPropagation(); router.push(`/docs/equipment-inspection/${record._id}`); }}
                                                    title="View Details"
                                                >
                                                    <ChevronRight size={14} />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-slate-400 hover:text-[#0F4C75]"
                                                    onClick={(e) => { e.stopPropagation(); handleDownloadPDF(record); }}
                                                    disabled={isGeneratingPDF && pdfTarget?._id === record._id}
                                                    title="Download PDF"
                                                >
                                                    {isGeneratingPDF && pdfTarget?._id === record._id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-slate-400 hover:text-emerald-600"
                                                    onClick={(e) => { e.stopPropagation(); setPdfTarget(record); setIsEmailModalOpen(true); }}
                                                    title="Email PDF"
                                                >
                                                    <Mail size={14} />
                                                </Button>
                                                {canEdit && (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-slate-400 hover:text-blue-600"
                                                        onClick={(e) => { e.stopPropagation(); handleEdit(record); }}
                                                        title="Edit"
                                                    >
                                                        <Pencil size={14} />
                                                    </Button>
                                                )}
                                                {canDelete && (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-slate-400 hover:text-red-600"
                                                        onClick={(e) => { e.stopPropagation(); setRecordToDelete(record); setIsDeleteOpen(true); }}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden lg:flex flex-col flex-1 min-h-0">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 overflow-hidden">
                                <Table containerClassName="flex-1 overflow-auto">
                                    <TableHead>
                                        <TableRow>
                                            <TableHeader className="w-[100px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('date')}>
                                                <div className="flex items-center gap-1">Date <ArrowUpDown size={12} className="opacity-50" /></div>
                                            </TableHeader>
                                            <TableHeader className="w-[150px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('type')}>
                                                <div className="flex items-center gap-1">Type <ArrowUpDown size={12} className="opacity-50" /></div>
                                            </TableHeader>
                                            <TableHeader className="w-[100px]">Frequency</TableHeader>
                                            <TableHeader className="w-[100px] cursor-pointer hover:bg-slate-100" onClick={() => handleSort('estimate')}>
                                                <div className="flex items-center gap-1">Estimate <ArrowUpDown size={12} className="opacity-50" /></div>
                                            </TableHeader>
                                            <TableHeader className="min-w-[140px]">Equipment</TableHeader>
                                            <TableHeader className="w-[80px] text-center">OK</TableHeader>
                                            <TableHeader className="w-[80px] text-center">⚠</TableHeader>
                                            <TableHeader className="w-[100px]">Created By</TableHeader>
                                            <TableHeader className="w-[120px] text-right">Actions</TableHeader>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredInspections.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={9} className="h-48 text-center text-slate-500">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <ClipboardCheck size={40} className="text-slate-200" />
                                                        <span>No equipment inspections found.</span>
                                                        {canCreate && (
                                                            <Button onClick={handleAddNew} className="bg-[#0F4C75] hover:bg-[#0a3a5c] text-white mt-2">
                                                                <Plus size={14} className="mr-1" /> New Inspection
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredInspections.map((record) => {
                                            const okCount = record.inspectionItems?.filter(i => i.status === 'ok').length || 0;
                                            const attentionCount = record.inspectionItems?.filter(i => i.status === 'needs_attention').length || 0;
                                            return (
                                                <TableRow
                                                    key={record._id}
                                                    className="group hover:bg-slate-50 transition-colors cursor-pointer"
                                                    onClick={() => router.push(`/docs/equipment-inspection/${record._id}`)}
                                                >
                                                    <TableCell className="font-medium text-slate-700 text-xs whitespace-nowrap">
                                                        {record.date && !isNaN(new Date(record.date).getTime()) ? format(new Date(record.date), 'MMM dd, yyyy') : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={cn(
                                                            "text-[10px]",
                                                            record.type === 'General Maintenance' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'
                                                        )}>
                                                            {record.type || '-'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-slate-600">{record.inspectionFrequency || '-'}</TableCell>
                                                    <TableCell className="text-xs text-blue-600 font-medium">{record.estimate || '-'}</TableCell>
                                                    <TableCell className="text-xs text-slate-700 font-semibold">{record.equipment || '-'}</TableCell>
                                                    <TableCell className="text-center">
                                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">
                                                            {okCount}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <span className={cn(
                                                            "inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold",
                                                            attentionCount > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-300"
                                                        )}>
                                                            {attentionCount}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        {(() => {
                                                            const emp = getEmployeeByEmail(record.createdBy);
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
                                                            return <span className="text-xs text-slate-500 truncate">{record.createdBy || '-'}</span>;
                                                        })()}
                                                    </TableCell>
                                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-[#0F4C75]" onClick={() => handleDownloadPDF(record)} disabled={isGeneratingPDF && pdfTarget?._id === record._id} title="Download PDF">
                                                                {isGeneratingPDF && pdfTarget?._id === record._id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                                            </Button>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-emerald-600" onClick={() => { setPdfTarget(record); setIsEmailModalOpen(true); }} title="Email PDF">
                                                                <Mail size={14} />
                                                            </Button>
                                                            {canEdit && (
                                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-blue-600" onClick={() => handleEdit(record)} title="Edit">
                                                                    <Pencil size={14} />
                                                                </Button>
                                                            )}
                                                            {canDelete && (
                                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => { setRecordToDelete(record); setIsDeleteOpen(true); }} title="Delete">
                                                                    <Trash2 size={14} />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Mobile FAB */}
                        {canCreate && (
                            <button
                                className="lg:hidden fixed bottom-24 right-6 z-40 w-14 h-14 rounded-full bg-[#0F4C75] text-white shadow-2xl flex items-center justify-center hover:bg-[#0a3a5c] active:scale-95 transition-all border-4 border-white"
                                onClick={handleAddNew}
                            >
                                <Plus size={24} />
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Add/Edit Modal */}
            <Dialog open={isModalOpen} onOpenChange={(open) => {
                setIsModalOpen(open);
                if (!open && returnTo) router.push(returnTo);
            }}>
                <DialogContent className="!max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRecord ? 'Edit Inspection' : 'New Equipment Inspection Checklist'}</DialogTitle>
                        <DialogDescription>
                            {editingRecord ? 'Update the equipment inspection details.' : 'Create a new equipment inspection checklist.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                        {/* Date */}
                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date *</Label>
                            <Input
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                className="h-9 text-sm mt-1"
                            />
                        </div>

                        {/* Type */}
                        <div className="relative">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type *</Label>
                            <div className="mt-1">
                                <div
                                    className="w-full flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer bg-white hover:border-slate-400 transition-colors"
                                    onClick={() => setOpenDropdownId(openDropdownId === 'type' ? null : 'type')}
                                >
                                    <span className={`text-sm truncate ${formData.type ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                                        {formData.type || 'Select type...'}
                                    </span>
                                    <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${openDropdownId === 'type' ? 'rotate-180' : ''}`} />
                                </div>
                                {openDropdownId === 'type' && (
                                    <MyDropDown
                                        isOpen={true}
                                        onClose={() => setOpenDropdownId(null)}
                                        options={INSPECTION_TYPES.map(t => ({ id: t, label: t, value: t }))}
                                        selectedValues={formData.type ? [formData.type] : []}
                                        onSelect={(val) => {
                                            setFormData(prev => ({ ...prev, type: val }));
                                            setOpenDropdownId(null);
                                        }}
                                        placeholder="Search..."
                                        width="w-full"
                                        modal={false}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Frequency */}
                        <div className="relative">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Frequency *</Label>
                            <div className="mt-1">
                                <div
                                    className="w-full flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer bg-white hover:border-slate-400 transition-colors"
                                    onClick={() => setOpenDropdownId(openDropdownId === 'frequency' ? null : 'frequency')}
                                >
                                    <span className={`text-sm truncate ${formData.inspectionFrequency ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                                        {formData.inspectionFrequency || 'Select frequency...'}
                                    </span>
                                    <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${openDropdownId === 'frequency' ? 'rotate-180' : ''}`} />
                                </div>
                                {openDropdownId === 'frequency' && (
                                    <MyDropDown
                                        isOpen={true}
                                        onClose={() => setOpenDropdownId(null)}
                                        options={INSPECTION_FREQUENCIES.map(f => ({ id: f, label: f, value: f }))}
                                        selectedValues={formData.inspectionFrequency ? [formData.inspectionFrequency] : []}
                                        onSelect={(val) => {
                                            setFormData(prev => ({ ...prev, inspectionFrequency: val }));
                                            setOpenDropdownId(null);
                                        }}
                                        placeholder="Search..."
                                        width="w-full"
                                        modal={false}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Estimate */}
                        <div className="relative">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimate</Label>
                            <div className="mt-1">
                                <div
                                    className="w-full flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer bg-white hover:border-slate-400 transition-colors"
                                    onClick={() => setOpenDropdownId(openDropdownId === 'estimate' ? null : 'estimate')}
                                >
                                    <span className={`text-sm truncate ${formData.estimate ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                                        {formData.estimate || 'Select estimate...'}
                                    </span>
                                    <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${openDropdownId === 'estimate' ? 'rotate-180' : ''}`} />
                                </div>
                                {openDropdownId === 'estimate' && (
                                    <MyDropDown
                                        isOpen={true}
                                        onClose={() => setOpenDropdownId(null)}
                                        options={uniqueEstimates.map(e => ({ id: e.estimate, label: `${e.estimate} — ${e.projectName || ''}`, value: e.estimate }))}
                                        selectedValues={formData.estimate ? [formData.estimate] : []}
                                        onSelect={handleEstimateSelect}
                                        placeholder="Search estimates..."
                                        width="w-full"
                                        modal={false}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Project Name (auto-filled) */}
                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Name</Label>
                            <Input
                                value={formData.projectName}
                                onChange={e => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
                                className="h-9 text-sm mt-1 bg-slate-50"
                                placeholder="Auto-filled from estimate"
                            />
                        </div>

                        {/* Job Location (auto-filled) */}
                        <div>
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Job Location</Label>
                            <Input
                                value={formData.jobLocation}
                                onChange={e => setFormData(prev => ({ ...prev, jobLocation: e.target.value }))}
                                className="h-9 text-sm mt-1 bg-slate-50"
                                placeholder="Auto-filled from estimate"
                            />
                        </div>

                        {/* Equipment */}
                        <div className="relative col-span-2 sm:col-span-3">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipment</Label>
                            <div className="mt-1">
                                <div
                                    className="w-full flex items-center justify-between px-3 py-2 border rounded-xl cursor-pointer bg-white hover:border-slate-400 transition-colors"
                                    onClick={() => setOpenDropdownId(openDropdownId === 'equipment' ? null : 'equipment')}
                                >
                                    <span className={`text-sm truncate ${formData.equipment ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
                                        {formData.equipment || 'Select equipment...'}
                                    </span>
                                    <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${openDropdownId === 'equipment' ? 'rotate-180' : ''}`} />
                                </div>
                                {openDropdownId === 'equipment' && (
                                    <MyDropDown
                                        isOpen={true}
                                        onClose={() => setOpenDropdownId(null)}
                                        options={equipmentOptions}
                                        selectedValues={formData.equipment ? [formData.equipment] : []}
                                        onSelect={(val) => {
                                            setFormData(prev => ({ ...prev, equipment: val }));
                                            setOpenDropdownId(null);
                                        }}
                                        placeholder="Search equipment..."
                                        width="w-full"
                                        modal={false}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Inspection Items Table */}
                    <div className="mt-6">
                        <div className="flex items-center justify-between mb-3">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inspection Items</Label>
                            <Button type="button" size="sm" variant="outline" onClick={addInspectionItem}>
                                <Plus size={14} className="mr-1" /> Add Item
                            </Button>
                        </div>
                        <div className="border rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[35%]">Inspection Item</th>
                                        <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[25%]">Status</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[35%]">Notes</th>
                                        <th className="w-[5%]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {formData.inspectionItems.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-2.5">
                                                <Input
                                                    value={item.name}
                                                    onChange={e => updateInspectionItem(idx, 'name', e.target.value)}
                                                    className="h-8 text-xs border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500/20 rounded-lg"
                                                    placeholder="Item name..."
                                                />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateInspectionItem(idx, 'status', item.status === 'ok' ? '' : 'ok')}
                                                        className={cn(
                                                            "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border",
                                                            item.status === 'ok'
                                                                ? "bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200"
                                                                : "bg-white text-slate-400 border-slate-200 hover:border-emerald-300 hover:text-emerald-500"
                                                        )}
                                                    >
                                                        ✓ OK
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateInspectionItem(idx, 'status', item.status === 'needs_attention' ? '' : 'needs_attention')}
                                                        className={cn(
                                                            "px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border",
                                                            item.status === 'needs_attention'
                                                                ? "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-200"
                                                                : "bg-white text-slate-400 border-slate-200 hover:border-amber-300 hover:text-amber-500"
                                                        )}
                                                    >
                                                        ⚠ Attention
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <Input
                                                    value={item.notes}
                                                    onChange={e => updateInspectionItem(idx, 'notes', e.target.value)}
                                                    className="h-8 text-xs border-0 bg-transparent focus:bg-white focus:ring-1 focus:ring-blue-500/20 rounded-lg"
                                                    placeholder="Optional notes..."
                                                />
                                            </td>
                                            <td className="px-2 py-2.5">
                                                <button
                                                    type="button"
                                                    onClick={() => removeInspectionItem(idx)}
                                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={() => { setIsModalOpen(false); if (returnTo) router.push(returnTo); }}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C75] hover:bg-[#0a3a5c]">
                            {saving ? 'Saving...' : (editingRecord ? 'Update' : 'Create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Inspection</DialogTitle>
                        <DialogDescription>Are you sure you want to delete this inspection? This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Email Modal */}
            <Dialog open={isEmailModalOpen} onOpenChange={(open) => !isSendingEmail && setIsEmailModalOpen(open)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Email Inspection Report</DialogTitle>
                        <DialogDescription>The inspection report will be generated as a PDF and sent as an email attachment.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSendEmail} className="space-y-4 mt-2">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                            <div className="bg-blue-100 p-2 rounded-full text-[#0F4C75]"><Mail size={20} /></div>
                            <div>
                                <p className="text-sm font-bold text-[#0F4C75]">Send PDF via Email</p>
                                <p className="text-xs text-blue-800/70 mt-1">The report will be attached as a PDF.</p>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Recipient Email</label>
                            <input
                                type="email"
                                required
                                className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                                placeholder="Enter email address"
                                value={emailTo}
                                onChange={(e) => setEmailTo(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <Button type="button" variant="outline" onClick={() => setIsEmailModalOpen(false)} disabled={isSendingEmail}>Cancel</Button>
                            <Button type="submit" disabled={isSendingEmail} className="bg-[#0F4C75] hover:bg-[#0a3a5c]">
                                {isSendingEmail ? <Loader2 size={14} className="animate-spin mr-2" /> : <Send size={14} className="mr-2" />}
                                {isSendingEmail ? 'Sending...' : 'Send Email'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
