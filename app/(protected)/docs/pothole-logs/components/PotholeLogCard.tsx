import React, { useState } from 'react';
import { Edit, Trash2, User, Download, Mail, Loader2, MapPin, Camera } from 'lucide-react';

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
    router
}) => {
    const [isDownloading, setIsDownloading] = useState(false);

    const dateStr = log.date ? new Date(log.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'N/A';
    const creator = employees.find(e => e.value === log.createdBy);
    const itemCount = (log.potholeItems || []).length;
    const hasGPS = !!(log.locationOfPothole?.lat);
    const estimateNumber = log.estimate || estimate?.estimate || '';
    const jobAddress = log.jobAddress || log.projectionLocation || estimate?.jobAddress || '';

    // Count items with photos
    const photoCount = (log.potholeItems || []).reduce((acc: number, item: any) => {
        const photos = [
            ...(item.photos || []),
            ...(item.photo1 ? [item.photo1] : []),
            ...(item.photo2 ? [item.photo2] : [])
        ].filter(Boolean);
        return acc + photos.length;
    }, 0);

    // Utility types summary
    const utilityTypes = [...new Set<string>((log.potholeItems || []).map((item: any) => item.typeOfUtility).filter(Boolean))];

    return (
        <div
            className="group relative bg-white rounded-2xl border border-slate-200 hover:border-rose-300 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
            onClick={() => onView(log)}
        >
            <div className="p-5 flex flex-col gap-4 flex-1">
                {/* Top Section */}
                <div className="flex flex-col gap-1.5">
                    {/* Row 1: Date + Estimate */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-800">
                            <div className={`w-2 h-2 rounded-full ${itemCount > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <p className="text-sm font-bold">{dateStr}</p>
                        </div>
                        {estimateNumber ? (
                            <button
                                onMouseEnter={() => router.prefetch(`/estimates/${estimateNumber}`)}
                                onClick={(e) => { e.stopPropagation(); router.push(`/estimates/${estimateNumber}`); }}
                                className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors"
                            >
                                {estimateNumber}
                            </button>
                        ) : (
                            <span className="bg-slate-100/80 text-slate-500 text-[11px] font-bold px-2.5 py-1 rounded-md border border-slate-200/60">
                                No Est
                            </span>
                        )}
                    </div>

                    {/* Row 2: Job Address */}
                    <div>
                        <p className="text-base font-extrabold text-rose-700 leading-tight line-clamp-1">
                            {jobAddress || 'Pothole Log'}
                        </p>
                    </div>

                    {/* Row 3: Location subtitle */}
                    <div>
                        <p className="text-sm font-semibold text-slate-700 line-clamp-1">
                            {log.projectionLocation || jobAddress || 'No Location'}
                        </p>
                    </div>
                </div>

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
                <div className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-slate-100">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate pr-2">Potholes</span>
                        <span className="bg-white px-2 py-0.5 rounded text-[10px] font-black text-rose-600 shadow-sm shrink-0">{itemCount}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate pr-2">Photos</span>
                        <span className="bg-white px-2 py-0.5 rounded text-[10px] font-black text-slate-700 shadow-sm shrink-0 flex items-center gap-1">
                            <Camera size={9} className="text-slate-400" />
                            {photoCount}
                        </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate pr-2">GPS</span>
                        {hasGPS ? (
                            <span className="bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-black text-emerald-600 shadow-sm shrink-0 flex items-center gap-1">
                                <MapPin size={9} /> Yes
                            </span>
                        ) : (
                            <span className="bg-white px-2 py-0.5 rounded text-[10px] font-black text-slate-400 shadow-sm shrink-0">No</span>
                        )}
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate pr-2">Utilities</span>
                        <span className="bg-white px-2 py-0.5 rounded text-[10px] font-black text-slate-700 shadow-sm shrink-0">{utilityTypes.length}</span>
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
                    {canEdit && onEdit && (
                        <button onClick={() => onEdit(log)} className="p-2 rounded-xl text-slate-400 hover:text-orange-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-orange-100 transition-all" title="Edit">
                            <Edit size={14} />
                        </button>
                    )}
                    {canDelete && onDelete && (
                        <button onClick={() => onDelete(log)} className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-rose-100 transition-all" title="Delete">
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
