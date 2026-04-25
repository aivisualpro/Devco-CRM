'use client';

import { cld } from '@/lib/cld';
import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft, Calendar, Pencil, Trash2,
    Loader2, Download, Mail, Send, X,
    ClipboardCheck, Shield, MapPin, Wrench, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Header, Button, Badge, Input, PageHeader, UserChip } from '@/components/ui';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import { cn } from '@/lib/utils';
import { formatWallDate, formatWallTime, formatWallDateTime } from '@/lib/format/date';

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

interface Employee {
    _id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
}

export default function EquipmentInspectionDetailPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const { can } = usePermissions();
    const canEdit = can(MODULES.JHA, ACTIONS.EDIT);
    const canDelete = can(MODULES.JHA, ACTIONS.DELETE);

    const [record, setRecord] = useState<EquipmentInspection | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    // UI state
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [inspRes, empRes] = await Promise.all([
                fetch('/api/equipment-inspection', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getById', payload: { id } })
                }),
                fetch(`/api/employees`)
            ]);

            const [inspData, empData] = await Promise.all([inspRes.json(), empRes.json()]);

            if (inspData.success) setRecord(inspData.result);
            if (empData.success) setEmployees(empData.result || []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to load inspection');
        } finally {
            setLoading(false);
        }
    };

    const getEmployeeByEmail = (email: string) => {
        if (!email) return null;
        return employees.find(e => e.email?.toLowerCase() === email.toLowerCase());
    };

    const buildPdfPayload = () => {
        if (!record) return null;
        const dateStr = record.date && !isNaN(new Date(record.date).getTime())
            ? formatWallDate(record.date)
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

    const handleDownloadPDF = async () => {
        setIsGeneratingPDF(true);
        try {
            const payload = buildPdfPayload();
            if (!payload) throw new Error('No data');
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
            a.download = `Equipment_Inspection_${record?.equipment || 'Report'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            toast.success('PDF downloaded!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to download PDF');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!record || !emailTo) return;
        setIsSendingEmail(true);
        try {
            const payload = buildPdfPayload();
            if (!payload) throw new Error('No data');
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
                        subject: `Equipment Inspection Checklist - ${record.equipment || ''}`,
                        emailBody: `Please find attached the Equipment Inspection Checklist for ${record.equipment || 'equipment'}.`,
                        attachment: base64data
                    })
                });
                const emailData = await emailRes.json();
                if (emailData.success) {
                    toast.success('Email sent successfully!');
                    setIsEmailModalOpen(false);
                    setEmailTo('');
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

    const handleDelete = async () => {
        if (!record) return;
        setSaving(true);
        try {
            const res = await fetch('/api/equipment-inspection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', payload: { id: record._id } })
            });
            const result = await res.json();
            if (result.success) {
                toast.success('Inspection deleted');
                router.push('/docs/equipment-inspection');
            } else {
                toast.error(result.error || 'Failed to delete');
            }
        } catch {
            toast.error('Failed to delete');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-slate-50">
                <Header />
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-[#0F4C75]" size={28} />
                        <span className="text-sm text-slate-500">Loading inspection...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!record) {
        return (
            <div className="flex flex-col h-full bg-slate-50">
                <Header />
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-slate-500">Inspection not found.</p>
                </div>
            </div>
        );
    }

    const okCount = record.inspectionItems?.filter(i => i.status === 'ok').length || 0;
    const attentionCount = record.inspectionItems?.filter(i => i.status === 'needs_attention').length || 0;
    const totalItems = record.inspectionItems?.length || 0;
    const createdByEmp = getEmployeeByEmail(record.createdBy);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header />

            <div className="flex-1 overflow-auto">
                <div className="max-w-4xl mx-auto p-4 lg:p-8">
                    {/* Back button */}
                    <button
                        onClick={() => router.push('/docs/equipment-inspection')}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#0F4C75] transition-colors mb-4 font-medium"
                    >
                        <ArrowLeft size={14} /> Back to Equipment Inspections
                    </button>

                    <PageHeader
                        title={
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0F4C75] to-[#3282B8] flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <ClipboardCheck size={24} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-black text-slate-900">Equipment Inspection</h1>
                                    <p className="text-xs text-slate-400 mt-0.5">{record.equipment || 'N/A'}</p>
                                </div>
                            </div>
                        }
                        actions={
                            <>
                                <Button variant="outline" size="sm" className="border-slate-300 hover:bg-slate-50"
                                    onClick={handleDownloadPDF} disabled={isGeneratingPDF}>
                                    {isGeneratingPDF ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Download size={14} className="mr-1.5" />}
                                    PDF
                                </Button>
                                <Button variant="outline" size="sm" className="border-slate-300 hover:bg-slate-50"
                                    onClick={() => setIsEmailModalOpen(true)}>
                                    <Mail size={14} className="mr-1.5" /> Email
                                </Button>
                                {canEdit && (
                                    <Button variant="outline" size="sm" className="border-slate-300 hover:bg-slate-50"
                                        onClick={() => router.push(`/docs/equipment-inspection?edit=${record._id}&returnTo=${encodeURIComponent(`/docs/equipment-inspection/${record._id}`)}`)}>
                                        <Pencil size={14} className="mr-1.5" /> Edit
                                    </Button>
                                )}
                                {canDelete && (
                                    <Button variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)}>
                                        <Trash2 size={14} className="mr-1.5" /> Delete
                                    </Button>
                                )}
                            </>
                        }
                    />

                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm text-center">
                            <div className="text-3xl font-black text-slate-800">{totalItems}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Total Items</div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl border border-emerald-100 p-4 shadow-sm text-center">
                            <div className="text-3xl font-black text-emerald-600">{okCount}</div>
                            <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mt-1">OK</div>
                        </div>
                        <div className={cn(
                            "rounded-2xl border p-4 shadow-sm text-center",
                            attentionCount > 0 ? "bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-100" : "bg-white border-slate-100"
                        )}>
                            <div className={cn("text-3xl font-black", attentionCount > 0 ? "text-amber-600" : "text-slate-300")}>{attentionCount}</div>
                            <div className={cn("text-[10px] font-bold uppercase tracking-wider mt-1", attentionCount > 0 ? "text-amber-500" : "text-slate-400")}>Needs Attention</div>
                        </div>
                    </div>

                    {/* Details Card */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2">
                            <div className="p-4 border-b sm:border-r border-slate-100">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Calendar size={10} /> Date
                                </label>
                                <p className="text-slate-800 font-bold mt-1 text-lg">
                                    {record.date && !isNaN(new Date(record.date).getTime()) ? formatWallDate(record.date) : '-'}
                                </p>
                            </div>
                            <div className="p-4 border-b border-slate-100">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Shield size={10} /> Type
                                </label>
                                <p className="mt-1">
                                    <Badge className={cn(
                                        "text-xs font-bold",
                                        record.type === 'General Maintenance' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'
                                    )}>
                                        {record.type || '-'}
                                    </Badge>
                                </p>
                            </div>
                            <div className="p-4 border-b sm:border-r border-slate-100">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inspection Frequency</label>
                                <p className="text-slate-800 font-bold mt-1">{record.inspectionFrequency || '-'}</p>
                            </div>
                            <div className="p-4 border-b border-slate-100">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimate</label>
                                <p className="text-blue-600 font-bold mt-1">{record.estimate || '-'}</p>
                            </div>
                            <div className="p-4 border-b sm:border-r border-slate-100">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project Name</label>
                                <p className="text-slate-800 font-bold mt-1">{record.projectName || '-'}</p>
                            </div>
                            <div className="p-4 border-b border-slate-100">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <MapPin size={10} /> Job Location
                                </label>
                                <p className="text-slate-800 font-bold mt-1">{record.jobLocation || '-'}</p>
                            </div>
                            <div className="p-4 sm:border-r border-slate-100">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Wrench size={10} /> Equipment
                                </label>
                                <p className="text-slate-800 font-bold mt-1 text-lg">{record.equipment || '-'}</p>
                            </div>
                            <div className="p-4">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Created By</label>
                                <div className="mt-1 flex items-center gap-2">
                                    {createdByEmp ? (
                                        <UserChip user={createdByEmp} size="md" />
                                    ) : (
                                        <span className="text-slate-600">{record.createdBy || '-'}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Inspection Items Table */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                            <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                <ClipboardCheck size={16} className="text-[#0F4C75]" /> Inspection Items
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-8">#</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Inspection Item</th>
                                        <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[140px]">Status</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {record.inspectionItems?.map((item, idx) => (
                                        <tr key={idx} className={cn(
                                            "transition-colors",
                                            item.status === 'needs_attention' ? "bg-amber-50/30" : "hover:bg-slate-50/30"
                                        )}>
                                            <td className="px-4 py-3 text-slate-400 font-bold text-xs">{idx + 1}</td>
                                            <td className="px-4 py-3 text-slate-800 font-semibold">{item.name}</td>
                                            <td className="px-4 py-3 text-center">
                                                {item.status === 'ok' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                                                        <CheckCircle2 size={12} /> OK
                                                    </span>
                                                ) : item.status === 'needs_attention' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                                                        <AlertTriangle size={12} /> Attention
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 text-xs">{item.notes || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

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
                                <p className="text-xs text-blue-800/70 mt-1">The checklist report will be attached as a PDF.</p>
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
