import React, { useState, useRef, useMemo } from 'react';
import { Edit, Trash2, User, Download, Mail, Loader2, MapPin, Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cld } from '@/lib/cld';

interface PotholeLogCardProps {
    log: any;
    estimate?: any;
    employees: any[];
    canEdit: boolean;
    canDelete: boolean;
    onView: (log: any) => void;
    onEdit?: (log: any) => void;
    onDelete?: (log: any) => void;
    onDownloadPDF?: (log: any, setDownloading: (b: boolean) => void) => void;
    onEmail?: (log: any) => void;
    router: any;
    /** Hide estimate # and address (when already shown in parent context) */
    compact?: boolean;
}

export const PotholeLogCard: React.FC<PotholeLogCardProps> = ({
    log,
    estimate,
    employees,
    canEdit,
    canDelete,
    onView,
    onEdit,
    onDelete,
    onDownloadPDF,
    onEmail,
    router,
    compact = false
}) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

    const dateStr = log.date ? new Date(log.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'N/A';
    const creator = employees.find(e => e.value === log.createdBy);
    const itemCount = (log.potholeItems || []).length;
    const hasGPS = !!(log.locationOfPothole?.lat);
    const estimateNumber = log.estimate || estimate?.estimate || '';
    const jobAddress = log.jobAddress || log.projectionLocation || estimate?.jobAddress || '';

    // Collect all unique photos (deduplicated)
    const allPhotos = useMemo(() => {
        const seen = new Set<string>();
        const photos: string[] = [];
        for (const item of (log.potholeItems || [])) {
            for (const p of [...(item.photos || []), ...(item.photo1 ? [item.photo1] : []), ...(item.photo2 ? [item.photo2] : [])]) {
                if (p && !seen.has(p)) { seen.add(p); photos.push(p); }
            }
        }
        return photos;
    }, [log.potholeItems]);

    const photoCount = allPhotos.length;

    // Utility types summary
    const utilityTypes = [...new Set<string>((log.potholeItems || []).map((item: any) => item.typeOfUtility).filter(Boolean))];

    const scrollCarousel = (dir: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const amount = 180;
        scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
    };

    return (
        <div
            className="group relative bg-white rounded-2xl border border-slate-200 hover:border-rose-300 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
            onClick={() => (canEdit && onEdit) ? onEdit(log) : onView(log)}
        >
            <div className="p-5 flex flex-col gap-4 flex-1">
                {/* Top Section */}
                <div className="flex flex-col gap-1.5">
                    {/* Row 1: Date + Estimate */}
                    <div className="flex items-center justify-end">
                        {!compact && estimateNumber ? (
                            <button
                                onMouseEnter={() => router.prefetch(`/estimates/${estimateNumber}`)}
                                onClick={(e) => { e.stopPropagation(); router.push(`/estimates/${estimateNumber}`); }}
                                className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors"
                            >
                                {estimateNumber}
                            </button>
                        ) : !compact ? (
                            <span className="bg-slate-100/80 text-slate-500 text-[11px] font-bold px-2.5 py-1 rounded-md border border-slate-200/60">
                                No Est
                            </span>
                        ) : null}
                    </div>

                    {/* Row 2: Job Address (hidden in compact mode) */}
                    {!compact && (
                        <div>
                            <p className="text-base font-extrabold text-rose-700 leading-tight line-clamp-1">
                                {jobAddress || 'Pothole Log'}
                            </p>
                        </div>
                    )}

                    {/* Row 3: Location subtitle (hidden in compact mode) */}
                    {!compact && (
                        <div>
                            <p className="text-sm font-semibold text-slate-700 line-clamp-1">
                                {log.projectionLocation || jobAddress || 'No Location'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Photo Carousel Strip — after address rows */}
                {allPhotos.length > 0 && (
                    <div className="relative rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div
                            ref={scrollRef}
                            className="flex gap-0.5 overflow-x-auto"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {allPhotos.map((photo, i) => (
                                <div
                                    key={i}
                                    className="shrink-0 w-[72px] h-[56px] bg-slate-100 overflow-hidden cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); setSelectedPhotoIndex(i); }}
                                >
                                    <img
                                        src={cld(photo, { w: 144, h: 112, q: 'auto' })}
                                        alt={`Pothole ${i + 1}`}
                                        loading="lazy"
                                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                                    />
                                </div>
                            ))}
                        </div>
                        {/* Photo count badge */}
                        <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <Camera size={9} /> {photoCount}
                        </div>
                        {/* Scroll arrows — only when many photos */}
                        {allPhotos.length > 4 && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); scrollCarousel('left'); }}
                                    className="absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 bg-white/90 backdrop-blur-sm rounded-full shadow flex items-center justify-center text-slate-600 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <ChevronLeft size={12} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); scrollCarousel('right'); }}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 bg-white/90 backdrop-blur-sm rounded-full shadow flex items-center justify-center text-slate-600 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <ChevronRight size={12} />
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Row 4: Utility types */}
                {utilityTypes.length > 0 && (
                    <div className="flex flex-col pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Utility Types</p>
                        <div className="flex flex-wrap gap-1.5">
                            {utilityTypes.slice(0, 6).map((type: string, i: number) => (
                                <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                                    {type}
                                </span>
                            ))}
                            {utilityTypes.length > 6 && (
                                <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-50 text-slate-500 border border-slate-100">
                                    +{utilityTypes.length - 6}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Row 5: Stats Chips */}
                <div className="mt-auto pt-2 border-t border-slate-100">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate pr-2">Potholes</span>
                        <span className="bg-white px-2 py-0.5 rounded text-[10px] font-black text-rose-600 shadow-sm shrink-0">{itemCount}</span>
                    </div>
                </div>
            </div>

            {/* Footer - Created By & Actions */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between mt-auto">
                <div className="flex items-center gap-2.5 min-w-0">
                    {creator ? (
                        <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden shrink-0 shadow-inner">
                            {creator.image ? <img src={creator.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500">{creator.label?.[0]}</div>}
                        </div>
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><User size={12} className="text-slate-400"/></div>
                    )}
                    <span className="text-[12px] font-bold text-slate-600 truncate">{creator?.label || log.createdBy || 'Unknown'}</span>
                    <div className="w-1 h-1 rounded-full bg-slate-300 mx-0.5 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-500 shrink-0">{log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-US') : 'N/A'}</span>
                </div>
                
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {onEmail && (
                        <button onClick={() => onEmail(log)} className="p-2 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-blue-100 transition-all" title="Email Report">
                            <Mail size={14} />
                        </button>
                    )}
                    {onDownloadPDF && (
                        <button onClick={() => onDownloadPDF(log, setIsDownloading)} disabled={isDownloading} className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-rose-100 transition-all" title="Download PDF">
                            {isDownloading ? <Loader2 size={14} className="animate-spin text-rose-600" /> : <Download size={14} />}
                        </button>
                    )}

                    {canDelete && onDelete && (
                        <button onClick={() => onDelete(log)} className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-rose-100 transition-all" title="Delete">
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>
            {/* Image Lightbox */}
            {selectedPhotoIndex !== null && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
                    onClick={(e) => { e.stopPropagation(); setSelectedPhotoIndex(null); }}
                >
                    <button 
                        className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
                        onClick={(e) => { e.stopPropagation(); setSelectedPhotoIndex(null); }}
                    >
                        <X size={24} />
                    </button>
                    
                    {allPhotos.length > 1 && (
                        <button 
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setSelectedPhotoIndex((prev) => prev! === 0 ? allPhotos.length - 1 : prev! - 1); 
                            }}
                        >
                            <ChevronLeft size={32} />
                        </button>
                    )}
                    
                    <img 
                        src={cld(allPhotos[selectedPhotoIndex], { w: 1200, h: 1200, q: 'auto' })} 
                        alt="Pothole Fullscreen"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                    
                    {allPhotos.length > 1 && (
                        <button 
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setSelectedPhotoIndex((prev) => prev! === allPhotos.length - 1 ? 0 : prev! + 1); 
                            }}
                        >
                            <ChevronRight size={32} />
                        </button>
                    )}
                    
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
                        {selectedPhotoIndex + 1} / {allPhotos.length}
                    </div>
                </div>
            )}
        </div>
    );
};
