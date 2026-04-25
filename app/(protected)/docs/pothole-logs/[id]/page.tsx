'use client';

import { cld } from '@/lib/cld';
import Image from 'next/image';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft, Calendar, MapPin, FileText, Pencil, Trash2,
    Loader2, ExternalLink, Image as ImageIcon, Plus, X,
    ChevronLeft, ChevronRight, Download, Mail, Send
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

interface PotholeItem {
    _id?: string;
    potholeNo: string;
    typeOfUtility: string;
    soilType: string;
    topDepthOfUtility: string;
    bottomDepthOfUtility: string;
    photos?: string[];
    photo1?: string;  // Legacy field
    photo2?: string;  // Legacy field
    latitude?: number;
    longitude?: number;
    pin?: string;
    createdBy?: string;
    createdAt?: string;
}

interface PotholeLog {
    _id: string;
    date: string;
    estimate: string;
    jobAddress?: string;
    projectionLocation?: string;  // Legacy field
    locationOfPothole?: { lat: number; lng: number };
    potholeItems: PotholeItem[];
    createdBy?: string;
    createdAt?: string;
    oldrefid?: string;
}

interface Estimate {
    _id: string;
    estimate: string;
    projectName?: string;
    customerName?: string;
    customer?: string;
    customerJobNo?: string;
    customerJobNumber?: string;
    ocName?: string;
    jobAddress?: string;
}

interface Employee {
    _id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
}

const TEMPLATE_ID = '1wB2BrBGgkX_tVSJ0YsfFpEMuhKRLf0eQjs5tf9d27zI';

export default function PotholeLogDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const logId = params.id as string;
    const { can } = usePermissions();

    const canEdit = can(MODULES.JHA, ACTIONS.EDIT);
    const canDelete = can(MODULES.JHA, ACTIONS.DELETE);

    const [loading, setLoading] = useState(true);
    const [log, setLog] = useState<PotholeLog | null>(null);
    const [estimate, setEstimate] = useState<Estimate | null>(null);
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
        if (logId) fetchData();
    }, [logId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch pothole log
            const logRes = await fetch('/api/pothole-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getPotholeLog', payload: { id: logId } })
            });
            const logData = await logRes.json();

            if (logData.success && logData.result) {
                setLog(logData.result);

                // Fetch estimate info - pothole log stores estimate NUMBER (e.g. "25-0638"), not the _id (e.g. "25-0638-V1")
                // Use getEstimatesByProposal to find all versions, then pick latest
                if (logData.result.estimate) {
                    const estRes = await fetch(`/api/estimates/proposal/${logData.result.estimate}`);
                    const estData = await estRes.json();
                    if (estData.success && estData.result?.length > 0) {
                        // Pick the latest version (last item since sorted by createdAt asc)
                        const latestVersion = estData.result[estData.result.length - 1];
                        // Now fetch the FULL estimate document by its _id
                        const fullEstRes = await fetch(`/api/estimates/${latestVersion._id}`);
                        const fullEstData = await fullEstRes.json();
                        if (fullEstData.success) setEstimate(fullEstData.result);
                    }
                }
            } else {
                toast.error('Pothole log not found');
                router.push('/docs/pothole-logs');
            }

            // Fetch employees
            const empRes = await fetch(`/api/employees`);
            const empData = await empRes.json();
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


    const handleDelete = async () => {
        if (!log) return;
        setDeleting(true);
        try {
            const res = await fetch('/api/pothole-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deletePotholeLog', payload: { id: log._id } })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Pothole log deleted');
                router.push('/docs/pothole-logs');
            } else {
                toast.error(data.error || 'Failed to delete');
            }
        } catch (err) {
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

        // Header variables (flat)
        const variables: Record<string, any> = {
            date: dateStr,
            estimate: estimate?.estimate || log.estimate || '',
            projectName: estimate?.projectName || '',
            jobAddress: log.jobAddress || log.projectionLocation || estimate?.jobAddress || '',
            createdBy: getCreatorName(),
            totalPotholes: String(log.potholeItems?.length || 0),
            customerName: estimate?.customerName || estimate?.customer || estimate?.ocName || '',
            customerJobNo: estimate?.customerJobNo || estimate?.customerJobNumber || '',
        };

        // Pothole items as raw array — the API route handles numbering & cleanup
        const items = (log.potholeItems || []).map((item, idx) => ({
            potholeNo: item.potholeNo || String(idx + 1),
            typeOfUtility: item.typeOfUtility || '',
            soilType: item.soilType || '',
            topDepthOfUtility: item.topDepthOfUtility || '',
            bottomDepthOfUtility: item.bottomDepthOfUtility || '',
            pin: item.pin || '',
            latitude: item.latitude,
            longitude: item.longitude,
            photos: item.photos || [],
            photo1: item.photo1,
            photo2: item.photo2,
        }));

        return { templateId: TEMPLATE_ID, variables, items };
    };

    // ==================== PDF Download ====================
    const handleDownloadPDF = async () => {
        if (!log) return;
        setIsGeneratingPDF(true);
        try {
            const payload = buildPdfPayload();
            if (!payload) throw new Error('No data');

            const response = await fetch('/api/generate-pothole-pdf', {
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
            a.download = `Pothole_Log_${estimate?.estimate || log.estimate || 'Report'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
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
            // 1. Generate PDF via dedicated pothole PDF route
            const payload = buildPdfPayload();
            if (!payload) throw new Error('No data');

            const pdfRes = await fetch('/api/generate-pothole-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!pdfRes.ok) throw new Error('Failed to generate PDF');
            const blob = await pdfRes.blob();

            // 2. Convert blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;

                // 3. Send email with PDF attachment
                const emailRes = await fetch('/api/email-pothole-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        emailTo,
                        subject: `Pothole Log Report - ${estimate?.estimate || log.estimate || 'Report'}`,
                        emailBody: `Please find attached the Pothole Log Report for estimate ${estimate?.estimate || log.estimate || ''}.`,
                        attachment: base64data,
                        potholeLogId: log._id
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
        } finally {
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
                        <p className="text-slate-500 mb-4">Pothole log not found</p>
                        <Button onClick={() => router.push('/docs/pothole-logs')}>
                            <ArrowLeft size={16} className="mr-2" /> Back to Logs
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-[#eef2f6]">
            <Header showDashboardActions />

            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-6xl mx-auto space-y-6 pb-10">

                    <PageHeader
                        title="Pothole Log Details"
                        breadcrumbs={[
                            { label: 'Pothole Logs', href: '/docs/pothole-logs' },
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
                                        onClick={() => router.push(`/docs/pothole-logs?edit=${log._id}`)}
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

                    {/* Info Card — 2 column grid matching PDF layout */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="divide-y divide-slate-100">
                            {/* Row 1: Customer Name | Job Location */}
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Name</label>
                                    <p className="text-slate-800 font-semibold mt-1">
                                        {estimate?.customerName || estimate?.customer || estimate?.ocName || '-'}
                                    </p>
                                </div>
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Job Location</label>
                                    <p className="text-slate-700 flex items-center gap-2 mt-1">
                                        <MapPin size={14} className="text-orange-500 shrink-0" />
                                        {log.jobAddress || log.projectionLocation || estimate?.jobAddress || '-'}
                                    </p>
                                </div>
                            </div>

                            {/* Row 2: Customer Job Number | DEVCO Job Number */}
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Job Number</label>
                                    <p className="text-slate-800 font-semibold mt-1">
                                        {estimate?.customerJobNo || estimate?.customerJobNumber || '-'}
                                    </p>
                                </div>
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DEVCO Job Number</label>
                                    <p
                                        className="text-[#0F4C75] font-bold flex items-center gap-2 mt-1 cursor-pointer hover:underline"
                                        onClick={() => router.push(`/estimates/${estimate?._id || log.estimate}`)}
                                    >
                                        {estimate?.estimate || log.estimate || '-'}
                                        <ExternalLink size={12} />
                                    </p>
                                </div>
                            </div>

                            {/* Row 3: Date | Potholes Completed By */}
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</label>
                                    <p className="text-slate-800 font-semibold flex items-center gap-2 mt-1">
                                        <Calendar size={14} className="text-[#0F4C75]" />
                                        {log.date && !isNaN(new Date(log.date).getTime())
                                            ? formatWallDate(log.date)
                                            : '-'}
                                    </p>
                                </div>
                                <div className="p-4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Potholes Completed By</label>
                                    <div className="mt-1">
                                        <EmployeeDisplay email={log.createdBy} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pothole Items Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileText size={16} className="text-[#0F4C75]" />
                                Pothole Items
                                <Badge variant="default" className="ml-2">{log.potholeItems?.length || 0}</Badge>
                            </h2>
                        </div>

                        {log.potholeItems?.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[70px]">Pothole #</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type of Utility</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[80px]">Soil Type</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Top Depth</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Bottom Depth</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pin</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[100px]">Photo 1</th>
                                            <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[100px]">Photo 2</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {log.potholeItems.map((item, idx) => {
                                            const allPhotos = [
                                                ...(item.photos || []),
                                                ...(item.photo1 ? [item.photo1] : []),
                                                ...(item.photo2 ? [item.photo2] : [])
                                            ].filter((v, i, a) => a.indexOf(v) === i);

                                            return (
                                                <tr key={item._id || idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0F4C75] text-white font-bold text-xs">
                                                            {item.potholeNo || idx + 1}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-700 font-medium">{item.typeOfUtility || '-'}</td>
                                                    <td className="px-4 py-3 text-slate-700">{item.soilType || '-'}</td>
                                                    <td className="px-4 py-3 text-slate-700">{item.topDepthOfUtility || '-'}</td>
                                                    <td className="px-4 py-3 text-slate-700">{item.bottomDepthOfUtility || '-'}</td>
                                                    <td className="px-4 py-3">
                                                        {(item.latitude && item.longitude) ? (
                                                            <a
                                                                href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-xs text-[#0F4C75] hover:underline flex items-center gap-1"
                                                            >
                                                                <MapPin size={10} className="shrink-0" />
                                                                {Number(item.latitude).toFixed(6)},<br />{Number(item.longitude).toFixed(6)}
                                                                <ExternalLink size={9} className="shrink-0" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">{item.pin || '-'}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {allPhotos[0] ? (
                                                            <div
                                                                className="relative w-20 h-16 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-[#0F4C75] cursor-pointer transition-all shadow-sm hover:shadow-md"
                                                                onClick={() => openGallery(allPhotos, 0)}
                                                            >
                                                                <Image fill sizes="(max-width: 768px) 100vw, 33vw"
                                                                    src={allPhotos[0]}
                                                                    alt="Photo 1"
                                                                    className="w-full h-full object-cover hover:scale-110 transition-transform"
                                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {allPhotos[1] ? (
                                                            <div
                                                                className="relative w-20 h-16 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-[#0F4C75] cursor-pointer transition-all shadow-sm hover:shadow-md"
                                                                onClick={() => openGallery(allPhotos, 1)}
                                                            >
                                                                <Image fill sizes="(max-width: 768px) 100vw, 33vw"
                                                                    src={allPhotos[1]}
                                                                    alt="Photo 2"
                                                                    className="w-full h-full object-cover hover:scale-110 transition-transform"
                                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 text-xs">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyState 
                                icon={<FileText className="w-8 h-8 text-slate-400" />} 
                                title="No pothole items recorded" 
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
                        <DialogTitle>Delete Pothole Log</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this pothole log? This action cannot be undone.
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
                        <DialogTitle>Email Pothole Log Report</DialogTitle>
                        <DialogDescription>
                            The pothole log report will be generated as a PDF and sent as an email attachment.
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
                        <Image fill sizes="(max-width: 768px) 100vw, 33vw"
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
