'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
    ArrowLeft, Calendar, MapPin, FileText, Pencil, Trash2, 
    Loader2, ExternalLink, Image as ImageIcon, Plus, X,
    ChevronLeft, ChevronRight
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
}

interface Employee {
    _id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profilePicture?: string;
}

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
                
                // Fetch estimate info
                if (logData.result.estimate) {
                    const estRes = await fetch('/api/webhook/devcoBackend', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'getEstimate', payload: { id: logData.result.estimate } })
                    });
                    const estData = await estRes.json();
                    if (estData.success) setEstimate(estData.result);
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
                                    onClick={() => router.push(`/estimates/${log.estimate}`)}
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
                                        {item.pin && (
                                            <div className="mt-2 ml-14">
                                                <span className="text-xs text-slate-500">
                                                    <strong>Pin:</strong> {item.pin}
                                                </span>
                                            </div>
                                        )}
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
