'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft, Calendar, MapPin, FileText, Pencil, Trash2,
    Loader2, Download, Mail, Send, X, ChevronLeft, ChevronRight,
    Clock, Drill, User
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Header, Button, Badge, Input, PageHeader, UserChip, EmptyState } from '@/components/ui';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import { cn } from '@/lib/utils';
import { formatWallDate, formatWallTime, formatWallDateTime } from '@/lib/format/date';

interface PreBoreLogItem {
    _id?: string;
    rodNumber: string;
    distance: string;
    topDepth: string;
    bottomDepth: string;
    overOrUnder: string;
    existingUtilities: string;
    picture?: string;
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
    reamers: string;
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

interface Employee {
    _id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
}

const PRE_BORE_TEMPLATE_ID = '1oz3s9qdfMnMdEivJhr8T4qPS-lwVGsb1A79eB-Djgic';

export default function PreBoreLogDetailPage() {
    const router = useRouter();
    const params = useParams();
    const rawId = params.id as string;

    // Parse the combined id — format: "scheduleId___preBoreId"
    const parts = rawId?.split('___') || [];
    const scheduleId = parts[0] || '';
    const preBoreId = parts[1] || '';

    const { can } = usePermissions();
    const canEdit = can(MODULES.JHA, ACTIONS.EDIT);
    const canDelete = can(MODULES.JHA, ACTIONS.DELETE);

    const [loading, setLoading] = useState(true);
    const [log, setLog] = useState<PreBoreLog | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // PDF / Email States
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    // Gallery State
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);
    const [galleryImages, setGalleryImages] = useState<string[]>([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    useEffect(() => {
        if (scheduleId && preBoreId) fetchData();
    }, [scheduleId, preBoreId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [logRes, empRes] = await Promise.all([
                fetch('/api/pre-bore-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getPreBoreLogDetail', payload: { scheduleId, preBoreId } })
                }),
                fetch(`/api/employees`)
            ]);

            const [logData, empData] = await Promise.all([logRes.json(), empRes.json()]);

            if (logData.success && logData.result) {
                setLog(logData.result);
            } else {
                toast.error('Pre-bore log not found');
                router.push('/docs/pre-bore-logs');
            }

            if (empData.success) setEmployees(empData.result || []);
        } catch (err) {
            console.error(err);
            toast.error('Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    const getEmployeeByEmail = (email: string) => {
        if (!email) return null;
        return employees.find(e => e.email?.toLowerCase() === email.toLowerCase());
    };

    const getCreatorName = () => {
        if (!log?.createdBy) return '-';
        const emp = getEmployeeByEmail(log.createdBy);
        return emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : log.createdBy;
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

    // ==================== Delete ====================
    const handleDelete = async () => {
        if (!log) return;
        setDeleting(true);
        try {
            const res = await fetch('/api/pre-bore-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'deletePreBoreLog',
                    payload: { id: log.scheduleId || scheduleId, legacyId: log.legacyId }
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Pre-bore log deleted');
                router.push('/docs/pre-bore-logs');
            } else {
                toast.error(data.error || 'Failed to delete');
            }
        } catch {
            toast.error('Failed to delete');
        } finally {
            setDeleting(false);
            setIsDeleteOpen(false);
        }
    };

    // ==================== Build PDF Payload ====================
    const buildPdfPayload = () => {
        if (!log) return null;

        const dateStr = log.date && !isNaN(new Date(log.date).getTime())
            ? formatWallDate(log.date)
            : '';

        const startTimeStr = log.startTime && !isNaN(new Date(log.startTime).getTime())
            ? formatWallDate(log.startTime)
            : log.startTime || '';

        const variables: Record<string, any> = {
            date: dateStr,
            start_time: startTimeStr,
            estimate: log.estimate || '',
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
            reamers: log.reamers || [log.reamerSize6, log.reamerSize8, log.reamerSize10, log.reamerSize12].filter(Boolean).map(s => `${s}"`).join(', ') || '',
            soil_type: log.soilType || '',
            bore_length: log.boreLength || '',
            pipe_size: log.pipeSize || '',
            foreman_signature: log.foremanSignature || '',
            customer_signature: log.customerSignature || '',
            total_rods: String(log.preBoreLogs?.length || 0),
            created_by: getCreatorName(),
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
    const handleDownloadPDF = async () => {
        if (!log) return;
        setIsGeneratingPDF(true);
        try {
            const payload = buildPdfPayload();
            if (!payload) throw new Error('No data');

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
        }
    };

    // ==================== Email PDF ====================
    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!log || !emailTo) return;
        setIsSendingEmail(true);

        try {
            const payload = buildPdfPayload();
            if (!payload) throw new Error('No data');

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
                        subject: `Pre-Bore Log Report - ${log.estimate || 'Report'}`,
                        emailBody: `Please find attached the Pre-Bore Log Report for estimate ${log.estimate || ''}.`,
                        attachment: base64data
                    })
                });

                const emailData = await emailRes.json();
                if (emailData.success) {
                    toast.success('PDF emailed successfully!');
                    setIsEmailModalOpen(false);
                    setEmailTo('');
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

    const EmployeeDisplay = ({ email }: { email?: string }) => {
        if (!email) return <span className="text-slate-400">-</span>;
        const emp = getEmployeeByEmail(email);
        if (!emp) return <span className="text-slate-600">{email}</span>;

        return <UserChip user={emp} size="md" />;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col bg-[#eef2f6]">
                <Header showDashboardActions />
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#0F4C75]" />
                </div>
            </div>
        );
    }

    if (!log) {
        return (
            <div className="min-h-screen flex flex-col bg-[#eef2f6]">
                <Header showDashboardActions />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <p className="text-slate-500 mb-4">Pre-bore log not found</p>
                        <Button onClick={() => router.push('/docs/pre-bore-logs')}>
                            <ArrowLeft size={16} className="mr-2" /> Back to Logs
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    const dateFormatted = log.date && !isNaN(new Date(log.date).getTime())
        ? formatWallDate(log.date)
        : '-';

    const startTimeFormatted = log.startTime && !isNaN(new Date(log.startTime).getTime())
        ? formatWallDate(log.startTime)
        : log.startTime || '-';

    return (
        <div className="min-h-screen flex flex-col bg-[#eef2f6]">
            <Header showDashboardActions />

            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-6xl mx-auto space-y-6 pb-10">

                    <PageHeader
                        title="Pre-Bore Log Details"
                        breadcrumbs={[
                            { label: 'Pre-Bore Logs', href: '/docs/pre-bore-logs' },
                            { label: 'Details' }
                        ]}
                        actions={
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-slate-300 hover:bg-slate-50"
                                    onClick={handleDownloadPDF}
                                    disabled={isGeneratingPDF}
                                >
                                    {isGeneratingPDF ? (
                                        <Loader2 size={14} className="mr-1.5 animate-spin" />
                                    ) : (
                                        <Download size={14} className="mr-1.5" />
                                    )}
                                    PDF
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-slate-300 hover:bg-slate-50"
                                    onClick={() => setIsEmailModalOpen(true)}
                                >
                                    <Mail size={14} className="mr-1.5" /> Email
                                </Button>
                                {canEdit && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-slate-300 hover:bg-slate-50"
                                        onClick={() => router.push(`/docs/pre-bore-logs?edit=${scheduleId}_${preBoreId}&returnTo=${encodeURIComponent(`/docs/pre-bore-logs/${rawId}`)}`)}
                                    >
                                        <Pencil size={14} className="mr-1.5" /> Edit
                                    </Button>
                                )}
                                {canDelete && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => setIsDeleteOpen(true)}
                                    >
                                        <Trash2 size={14} className="mr-1.5" /> Delete
                                    </Button>
                                )}
                            </>
                        }
                    />

                    {/* Info Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="divide-y divide-slate-100">
                            {/* Row 1: Customer Name | Devco Operator */}
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Name</label>
                                    <p className="text-slate-800 font-semibold mt-1">
                                        {log.customerName || log.scheduleCustomerName || '-'}
                                    </p>
                                </div>
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Devco Operator</label>
                                    <p className="text-slate-800 font-semibold mt-1 flex items-center gap-2">
                                        <User size={14} className="text-[#0F4C75]" />
                                        {log.devcoOperator || '-'}
                                    </p>
                                </div>
                            </div>

                            {/* Row 2: Date | Start Time */}
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</label>
                                    <p className="text-slate-800 font-semibold flex items-center gap-2 mt-1">
                                        <Calendar size={14} className="text-[#0F4C75]" />
                                        {dateFormatted}
                                    </p>
                                </div>
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Time</label>
                                    <p className="text-slate-800 font-semibold flex items-center gap-2 mt-1">
                                        <Clock size={14} className="text-[#0F4C75]" />
                                        {startTimeFormatted}
                                    </p>
                                </div>
                            </div>

                            {/* Row 3: Customer Foreman | Work Request # */}
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Foreman</label>
                                    <p className="text-slate-800 font-semibold mt-1">{log.customerForeman || '-'}</p>
                                </div>
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Work Request #</label>
                                    <p className="text-slate-800 font-semibold mt-1">{log.customerWorkRequestNumber || '-'}</p>
                                </div>
                            </div>

                            {/* Row 4: Bore Start | Bore End */}
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address Bore Start</label>
                                    <p className="text-slate-700 flex items-center gap-2 mt-1">
                                        <MapPin size={14} className="text-emerald-500 shrink-0" />
                                        {log.addressBoreStart || '-'}
                                    </p>
                                </div>
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address Bore End</label>
                                    <p className="text-slate-700 flex items-center gap-2 mt-1">
                                        <MapPin size={14} className="text-red-500 shrink-0" />
                                        {log.addressBoreEnd || '-'}
                                    </p>
                                </div>
                            </div>

                            {/* Row 5: Estimate | Soil Type */}
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimate</label>
                                    <p className="text-[#0F4C75] font-bold mt-1">{log.estimate || '-'}</p>
                                </div>
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Soil Type</label>
                                    <p className="text-slate-800 font-semibold mt-1">{log.soilType || '-'}</p>
                                </div>
                            </div>

                            {/* Row 6: Created By | Bore Length */}
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Created By</label>
                                    <div className="mt-1">
                                        <EmployeeDisplay email={log.createdBy} />
                                    </div>
                                </div>
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bore Length</label>
                                    <p className="text-slate-800 font-semibold mt-1">{log.boreLength ? `${log.boreLength} ft` : '-'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bore Specifications Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-4 border-b border-slate-100">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <Drill size={16} className="text-[#0F4C75]" />
                                Bore Specifications
                            </h2>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100">
                            <div className="p-4">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Drill Size</label>
                                <p className="text-slate-800 font-semibold mt-1 text-lg">{log.drillSize || '-'}</p>
                            </div>
                            <div className="p-4">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pilot Bore Size</label>
                                <p className="text-slate-800 font-semibold mt-1 text-lg">{log.pilotBoreSize || '-'}</p>
                            </div>
                            <div className="p-4">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bore Length</label>
                                <p className="text-slate-800 font-semibold mt-1 text-lg">{log.boreLength || '-'}</p>
                            </div>
                            <div className="p-4">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pipe Size</label>
                                <p className="text-slate-800 font-semibold mt-1 text-lg">{log.pipeSize || '-'}</p>
                            </div>
                        </div>
                        <div className="border-t border-slate-100">
                            <div className="p-4">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reamer(s)</label>
                                <p className="text-slate-800 font-bold mt-1 text-lg">
                                    {log.reamers
                                        ? log.reamers.split(',').map(s => s.trim()).filter(Boolean).map(s => `${s}"`).join(', ')
                                        : [log.reamerSize6 && `6"`, log.reamerSize8 && `8"`, log.reamerSize10 && `10"`, log.reamerSize12 && `12"`].filter(Boolean).join(', ') || '-'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Signatures Card — Side-by-Side, drawn-signature style */}
                    {(log.foremanSignature || log.customerSignature) && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="p-4 border-b border-slate-100">
                                <h2 className="font-bold text-slate-800">Signatures</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="p-5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Foreman Signature</label>
                                    {log.foremanSignature ? (
                                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center justify-center min-h-[120px]">
                                            <img
                                                src={log.foremanSignature}
                                                alt="Foreman Signature"
                                                className="max-w-full max-h-[140px] object-contain"
                                                onError={(e) => {
                                                    const el = e.target as HTMLImageElement;
                                                    el.style.display = 'none';
                                                    el.parentElement!.innerHTML = '<span class="text-xs text-slate-400 italic">Signature could not be loaded</span>';
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4 flex items-center justify-center min-h-[120px]">
                                            <span className="text-xs text-slate-300 italic">No signature</span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Customer Signature</label>
                                    {log.customerSignature ? (
                                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex items-center justify-center min-h-[120px]">
                                            <img
                                                src={log.customerSignature}
                                                alt="Customer Signature"
                                                className="max-w-full max-h-[140px] object-contain"
                                                onError={(e) => {
                                                    const el = e.target as HTMLImageElement;
                                                    el.style.display = 'none';
                                                    el.parentElement!.innerHTML = '<span class="text-xs text-slate-400 italic">Signature could not be loaded</span>';
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4 flex items-center justify-center min-h-[120px]">
                                            <span className="text-xs text-slate-300 italic">No signature</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rod Items Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileText size={16} className="text-[#0F4C75]" />
                                Rod Log Items
                                <Badge variant="default" className="ml-2">{log.preBoreLogs?.length || 0}</Badge>
                            </h2>
                        </div>

                        {log.preBoreLogs?.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[70px]">Rod #</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Distance</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Top Depth</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bottom Depth</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Over/Under</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Existing Utilities</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[100px]">Photo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {log.preBoreLogs.map((item, idx) => (
                                            <tr key={item._id || idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0F4C75] text-white font-bold text-xs">
                                                        {item.rodNumber || idx + 1}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-700 font-medium">{item.distance || '-'}</td>
                                                <td className="px-4 py-3 text-slate-700">{item.topDepth || '-'}</td>
                                                <td className="px-4 py-3 text-slate-700">{item.bottomDepth || '-'}</td>
                                                <td className="px-4 py-3">
                                                    {item.overOrUnder ? (
                                                        <Badge variant="default" className={cn(
                                                            "text-[10px]",
                                                            item.overOrUnder.toLowerCase() === 'over' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                                item.overOrUnder.toLowerCase() === 'under' ? 'bg-blue-100 text-blue-700 border-blue-200' : ''
                                                        )}>
                                                            {item.overOrUnder}
                                                        </Badge>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-slate-700">{item.existingUtilities || '-'}</td>
                                                <td className="px-4 py-3">
                                                    {item.picture ? (
                                                        <div
                                                            className="w-20 h-16 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-[#0F4C75] cursor-pointer transition-all shadow-sm hover:shadow-md"
                                                            onClick={() => openGallery([item.picture!], 0)}
                                                        >
                                                            <img
                                                                src={item.picture}
                                                                alt={`Rod ${idx + 1}`}
                                                                className="w-full h-full object-cover hover:scale-110 transition-transform"
                                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState 
                                icon={<FileText className="w-8 h-8 text-slate-400" />} 
                                title="No rod log items recorded" 
                                className="p-8"
                            />
                        )}
                    </div>

                </div>
            </div>

            {/* Delete Confirmation */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Pre-Bore Log</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this pre-bore log? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                            {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Email Modal */}
            <Dialog open={isEmailModalOpen} onOpenChange={(open) => !isSendingEmail && setIsEmailModalOpen(open)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Email Pre-Bore Log Report</DialogTitle>
                        <DialogDescription>
                            The pre-bore log report will be generated as a PDF and sent as an email attachment.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSendEmail} className="space-y-4 mt-2">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                            <div className="bg-blue-100 p-2 rounded-full text-[#0F4C75]">
                                <Mail size={20} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-[#0F4C75]">Send PDF via Email</p>
                                <p className="text-xs text-blue-800/70 mt-1">The report will be attached as a PDF and sent to the recipient below.</p>
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
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsEmailModalOpen(false)}
                                disabled={isSendingEmail}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSendingEmail}
                                className="bg-[#0F4C75] hover:bg-[#0b3c5e]"
                            >
                                {isSendingEmail ? (
                                    <Loader2 size={16} className="animate-spin mr-2" />
                                ) : (
                                    <Send size={16} className="mr-2" />
                                )}
                                {isSendingEmail ? 'Sending...' : 'Send Email'}
                            </Button>
                        </div>
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
