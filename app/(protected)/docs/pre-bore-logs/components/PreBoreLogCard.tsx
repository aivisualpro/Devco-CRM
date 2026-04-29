import React, { useState, useRef, useMemo } from 'react';
import { Trash2, User, Download, Mail, Loader2, Camera, ChevronLeft, ChevronRight, X, Drill } from 'lucide-react';
import { cld } from '@/lib/cld';

interface PreBoreLogCardProps {
    log: any;
    schedule?: any;
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
    compact?: boolean;
}

export const PreBoreLogCard: React.FC<PreBoreLogCardProps> = ({
    log,
    schedule,
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
    const timeStr = log.startTime || '';
    const creator = employees.find(e => e.value === log.createdBy);
    const rodCount = (log.preBoreLogs || []).length;

    // Operator info
    const operatorName = log.devcoOperator || '';
    const operator = employees.find(e => {
        const name = `${e.firstName || ''} ${e.lastName || ''}`.trim();
        return name === operatorName || e.value === operatorName || e.label === operatorName;
    });

    // Collect all photos from rod items (comma-separated support)
    const allPhotos = useMemo(() => {
        const photos: string[] = [];
        const seen = new Set<string>();
        for (const item of (log.preBoreLogs || [])) {
            if (item.picture) {
                const pics = item.picture.split(',').filter(Boolean);
                for (const p of pics) {
                    const trimmed = p.trim();
                    if (trimmed && !seen.has(trimmed)) { seen.add(trimmed); photos.push(trimmed); }
                }
            }
        }
        return photos;
    }, [log.preBoreLogs]);

    const photoCount = allPhotos.length;

    // Bore specs as pills
    const specs = [
        log.drillSize && { label: 'Drill', value: log.drillSize, color: 'indigo' },
        log.pilotBoreSize && { label: 'Pilot', value: log.pilotBoreSize, color: 'indigo' },
        log.boreLength && { label: 'Length', value: `${log.boreLength} ft`, color: 'sky' },
        log.pipeSize && { label: 'Pipe', value: log.pipeSize, color: 'slate' },
        log.reamers && { label: 'Reamers', value: log.reamers, color: 'purple' },
        log.soilType && { label: 'Soil', value: log.soilType, color: 'amber' },
    ].filter(Boolean) as { label: string; value: string; color: string }[];

    const pillColors: Record<string, string> = {
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        sky: 'bg-sky-50 text-sky-600 border-sky-100',
        slate: 'bg-slate-50 text-slate-600 border-slate-100',
        purple: 'bg-purple-50 text-purple-600 border-purple-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
    };

    const scrollCarousel = (dir: 'left' | 'right') => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollBy({ left: dir === 'left' ? -180 : 180, behavior: 'smooth' });
    };

    return (
        <div
            className="group relative bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
            onClick={() => (canEdit && onEdit) ? onEdit(log) : onView(log)}
        >
            <div className="p-5 flex flex-col gap-3.5 flex-1">
                {/* Row 1: Date+Time & Operator Avatar */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${rodCount > 0 ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]' : 'bg-slate-300'}`} />
                            <p className="text-sm font-bold text-slate-800">{dateStr}</p>
                        </div>
                        {timeStr && (
                            <>
                                <div className="w-px h-4 bg-slate-200" />
                                <p className="text-[11px] font-semibold text-slate-500">{timeStr}</p>
                            </>
                        )}
                    </div>
                    {/* Operator Avatar */}
                    {operatorName && (
                        <div className="flex items-center gap-2" title={operatorName}>
                            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-indigo-100 shadow-sm bg-gradient-to-br from-indigo-50 to-slate-50 shrink-0">
                                {operator?.image || operator?.profilePicture ? (
                                    <img src={operator.image || operator.profilePicture} alt={operatorName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-indigo-500">
                                        {operatorName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Row 2: Bore Specs */}
                {specs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {specs.map((spec, i) => (
                            <span key={i} className={`text-[9px] font-bold px-2 py-1 rounded-lg border ${pillColors[spec.color]}`}>
                                {spec.label}: {spec.value}
                            </span>
                        ))}
                    </div>
                )}

                {/* Row 3: Rod Items Counter */}
                <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-50/80 border border-slate-100 rounded-xl py-2 px-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Drill size={12} className="text-indigo-400" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rod Items</span>
                        </div>
                        <span className={`min-w-[24px] text-center px-2 py-0.5 rounded-md text-[10px] font-black shadow-sm ${rodCount > 0 ? 'bg-indigo-500 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                            {rodCount}
                        </span>
                    </div>
                    {photoCount > 0 && (
                        <div className="bg-slate-50/80 border border-slate-100 rounded-xl py-2 px-3 flex items-center gap-2">
                            <Camera size={12} className="text-slate-400" />
                            <span className="text-[10px] font-black text-slate-600">{photoCount}</span>
                        </div>
                    )}
                </div>

                {/* Row 4: Photo Carousel */}
                {allPhotos.length > 0 && (
                    <div className="relative rounded-xl overflow-hidden bg-slate-50 border border-slate-100" onClick={e => e.stopPropagation()}>
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
                                        alt={`Rod ${i + 1}`}
                                        loading="lazy"
                                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                                    />
                                </div>
                            ))}
                        </div>
                        {/* Photo count overlay */}
                        <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <Camera size={9} /> {photoCount}
                        </div>
                        {/* Scroll arrows */}
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
            </div>

            {/* Footer: CreatedBy + Actions */}
            <div className="px-5 py-3 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-slate-50/50 flex items-center justify-between mt-auto">
                <div className="flex items-center gap-2.5 min-w-0">
                    {creator ? (
                        <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden shrink-0 shadow-inner ring-1 ring-white">
                            {creator.image ? <img src={creator.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500">{creator.label?.[0]}</div>}
                        </div>
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><User size={12} className="text-slate-400"/></div>
                    )}
                    <span className="text-[11px] font-bold text-slate-600 truncate max-w-[80px]">{creator?.label || log.createdBy || 'Unknown'}</span>
                    <div className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                    <span className="text-[10px] font-medium text-slate-400 shrink-0">{log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-US') : 'N/A'}</span>
                </div>
                
                <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                    {onEmail && (
                        <button onClick={() => onEmail(log)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all" title="Email Report">
                            <Mail size={13} />
                        </button>
                    )}
                    {onDownloadPDF && (
                        <button onClick={() => onDownloadPDF(log, setIsDownloading)} disabled={isDownloading} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all" title="Download PDF">
                            {isDownloading ? <Loader2 size={13} className="animate-spin text-indigo-600" /> : <Download size={13} />}
                        </button>
                    )}
                    {canDelete && onDelete && (
                        <button onClick={() => onDelete(log)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all" title="Delete">
                            <Trash2 size={13} />
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
                        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 transition-colors"
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
                        alt="Pre-Bore Log Photo"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
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
                    
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
                        {selectedPhotoIndex + 1} / {allPhotos.length}
                    </div>
                </div>
            )}
        </div>
    );
};
