'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft, Calendar, MapPin, FileText, Pencil, Trash2,
    Loader2, ExternalLink, Image as ImageIcon, Plus, X,
    ChevronLeft, ChevronRight, Download, Mail, Send
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { Header, Button, Badge, Input } from '@/components/ui';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import { cn } from '@/lib/utils';

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
                    const estRes = await fetch('/api/webhook/devcoBackend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'getEstimatesByProposal', payload: { estimateNumber: logData.result.estimate } })
                    });
                    const estData = await estRes.json();
                    if (estData.success && estData.result?.length > 0) {
                        // Pick the latest version (last item since sorted by createdAt asc)
                        const latestVersion = estData.result[estData.result.length - 1];
                        // Now fetch the FULL estimate document by its _id
                        const fullEstRes = await fetch('/api/webhook/devcoBackend', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'getEstimateById', payload: { id: latestVersion._id } })
                        });
                        const fullEstData = await fullEstRes.json();
                        if (fullEstData.success) setEstimate(fullEstData.result);
                    }
                }
            } else {
                toast.error('Pothole log not found');
                router.push('/docs/pothole-logs');
            }

            // Fetch employees
            const empRes = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getEmployees', payload: { limit: 500 } })
            });
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
            ? format(new Date(log.date), 'MM/dd/yyyy')
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

        return (
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#0F4C75] text-white flex items-center justify-center text-xs font-bold overflow-hidden shrink-0">
                    {emp.profilePicture ? (
                        <img src={emp.profilePicture} alt="" className="w-full h-full object-cover" />
                    ) : (
                        `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`
                    )}
                </div>
                <span className="text-slate-700 font-medium">{emp.firstName} {emp.lastName}</span>
            </div>
        );
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
                <div className="max-w-5xl mx-auto space-y-6 pb-10">

                    {/* Back Button */}
                    <button
                        onClick={() => router.push('/docs/pothole-logs')}
                        className="flex items-center gap-2 text-slate-600 hover:text-[#0F4C75] transition-colors font-medium text-sm mb-4 group"
                    >
                        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                        Back to Pothole Logs
                    </button>

                    {/* Header Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#0F4C75] to-[#3282B8] p-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-white mb-2">
                                        Pothole Log
                                    </h1>
                                    <p className="text-white/70 text-sm">{log._id}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* PDF Download Button */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-white/90 hover:bg-white"
                                        onClick={handleDownloadPDF}
                                        disabled={isGeneratingPDF}
                                    >
                                        {isGeneratingPDF ? (
                                            <Loader2 size={14} className="mr-1 animate-spin" />
                                        ) : (
                                            <Download size={14} className="mr-1" />
                                        )}
                                        PDF
                                    </Button>
                                    {/* Email Button */}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-white/90 hover:bg-white"
                                        onClick={() => setIsEmailModalOpen(true)}
                                    >
                                        <Mail size={14} className="mr-1" /> Email
                                    </Button>
                                    {canEdit && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="bg-white/90 hover:bg-white"
                                            onClick={() => router.push(`/docs/pothole-logs?edit=${log._id}`)}
                                        >
                                            <Pencil size={14} className="mr-1" /> Edit
                                        </Button>
                                    )}
                                    {canDelete && (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => setIsDeleteOpen(true)}
                                        >
                                            <Trash2 size={14} className="mr-1" /> Delete
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</label>
                                <p className="text-slate-800 font-semibold flex items-center gap-2 mt-1">
                                    <Calendar size={14} className="text-[#0F4C75]" />
                                    {log.date && !isNaN(new Date(log.date).getTime())
                                        ? format(new Date(log.date), 'MMM dd, yyyy')
                                        : '-'}
                                </p>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimate</label>
                                <p
                                    className="text-[#0F4C75] font-bold flex items-center gap-2 mt-1 cursor-pointer hover:underline"
                                    onClick={() => router.push(`/estimates/${estimate?._id || log.estimate}`)}
                                >
                                    {estimate?.estimate || log.estimate || '-'}
                                    <ExternalLink size={12} />
                                </p>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project</label>
                                <p className="text-slate-800 font-medium mt-1">{estimate?.projectName || '-'}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Created By</label>
                                <div className="mt-1">
                                    <EmployeeDisplay email={log.createdBy} />
                                </div>
                            </div>
                        </div>

                        {(log.jobAddress || log.projectionLocation) && (
                            <div className="px-6 pb-6">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Job Address</label>
                                <p className="text-slate-700 flex items-center gap-2 mt-1">
                                    <MapPin size={14} className="text-orange-500" />
                                    {log.jobAddress || log.projectionLocation}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Pothole Items */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileText size={16} className="text-[#0F4C75]" />
                                Pothole Items
                                <Badge variant="default" className="ml-2">{log.potholeItems?.length || 0}</Badge>
                            </h2>
                        </div>

                        {log.potholeItems?.length > 0 ? (
                            <div className="divide-y divide-slate-100">
                                {log.potholeItems.map((item, idx) => (
                                    <div key={item._id || idx} className="p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-[#0F4C75] text-white flex items-center justify-center font-bold text-sm shrink-0">
                                                #{item.potholeNo || idx + 1}
                                            </div>
                                            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Type of Utility</label>
                                                    <p className="text-slate-700 font-medium text-sm">{item.typeOfUtility || '-'}</p>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Soil Type</label>
                                                    <p className="text-slate-700 font-medium text-sm">{item.soilType || '-'}</p>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Top Depth</label>
                                                    <p className="text-slate-700 font-medium text-sm">{item.topDepthOfUtility || '-'}</p>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Bottom Depth</label>
                                                    <p className="text-slate-700 font-medium text-sm">{item.bottomDepthOfUtility || '-'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0 flex-wrap">
                                                {(() => {
                                                    const allPhotos = [
                                                        ...(item.photos || []),
                                                        ...(item.photo1 ? [item.photo1] : []),
                                                        ...(item.photo2 ? [item.photo2] : [])
                                                    ].filter((v, i, a) => a.indexOf(v) === i);

                                                    return (
                                                        <>
                                                            {allPhotos.map((photo, pIdx) => (
                                                                <div
                                                                    key={pIdx}
                                                                    className="relative group cursor-pointer"
                                                                    onClick={() => openGallery(allPhotos, pIdx)}
                                                                >
                                                                    <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-200 hover:border-[#0F4C75] transition-all shadow-sm group-hover:shadow-md">
                                                                        <img
                                                                            src={photo}
                                                                            alt={`Photo ${pIdx + 1}`}
                                                                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                                        />
                                                                    </div>
                                                                    {allPhotos.length > 1 && pIdx === 0 && (
                                                                        <div className="absolute -top-2 -right-2 bg-[#0F4C75] text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-sm border border-white">
                                                                            {allPhotos.length}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        {/* Location & Pin Info */}
                                        <div className="mt-2 ml-14 flex items-center gap-4 flex-wrap">
                                            {(item.latitude && item.longitude) && (
                                                <a
                                                    href={`https://maps.google.com/?q=${item.latitude},${item.longitude}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                                >
                                                    <MapPin size={10} />
                                                    {Number(item.latitude).toFixed(6)}, {Number(item.longitude).toFixed(6)}
                                                    <ExternalLink size={9} />
                                                </a>
                                            )}
                                            {item.pin && (
                                                <span className="text-xs text-slate-500">
                                                    <strong>Pin:</strong> {item.pin}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 text-center text-slate-400">
                                No pothole items recorded
                            </div>
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
