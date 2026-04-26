import React, { useState } from 'react';
import { Edit, Trash2, User, Download, Mail, Loader2, MapPin, HardHat, Drill } from 'lucide-react';

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
    router
}) => {
    const [isDownloading, setIsDownloading] = useState(false);

    const dateStr = log.date ? new Date(log.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : 'N/A';
    const creator = employees.find(e => e.value === log.createdBy);
    const rodCount = (log.preBoreLogs || []).length;
    const estimateNumber = log.estimate || estimate?.estimate || '';
    const title = log.scheduleTitle || log.addressBoreStart || 'Pre-Bore Log';

    // Signatures
    const hasForemanSig = !!log.foremanSignature;
    const hasCustomerSig = !!log.customerSignature;

    // Photo count
    const photoCount = (log.preBoreLogs || []).filter((rod: any) => rod.picture).length;

    // Reamers
    const reamers = log.reamers
        ? log.reamers.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [log.reamerSize6, log.reamerSize8, log.reamerSize10, log.reamerSize12].filter(Boolean);

    return (
        <div
            className="group relative bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
            onClick={() => onView(log)}
        >
            <div className="p-5 flex flex-col gap-4 flex-1">
                {/* Top Section */}
                <div className="flex flex-col gap-1.5">
                    {/* Row 1: Date + Estimate */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-800">
                            <div className={`w-2 h-2 rounded-full ${rodCount > 0 ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                            <p className="text-sm font-bold">{dateStr}</p>
                        </div>
                        {estimateNumber ? (
                            <button
                                onMouseEnter={() => router.prefetch(`/estimates/${estimateNumber}`)}
                                onClick={(e) => { e.stopPropagation(); router.push(`/estimates/${estimateNumber}`); }}
                                className="bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors"
                            >
                                {estimateNumber}
                            </button>
                        ) : (
                            <span className="bg-slate-100/80 text-slate-500 text-[11px] font-bold px-2.5 py-1 rounded-md border border-slate-200/60">
                                No Est
                            </span>
                        )}
                    </div>

                    {/* Row 2: Title */}
                    <div>
                        <p className="text-base font-extrabold text-indigo-700 leading-tight line-clamp-1">
                            {title}
                        </p>
                    </div>

                    {/* Row 3: Operator */}
                    {log.devcoOperator && (
                        <div className="flex items-center gap-1.5">
                            <HardHat size={12} className="text-slate-400" />
                            <p className="text-sm font-semibold text-slate-700 line-clamp-1">
                                {log.devcoOperator}
                            </p>
                        </div>
                    )}
                </div>

                {/* Row 4: Bore Specs */}
                <div className="flex flex-col pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bore Details</p>
                    <div className="flex flex-wrap gap-1.5">
                        {log.drillSize && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                                Drill: {log.drillSize}
                            </span>
                        )}
                        {log.boreLength && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                                {log.boreLength} ft
                            </span>
                        )}
                        {log.pipeSize && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
                                Pipe: {log.pipeSize}
                            </span>
                        )}
                        {log.soilType && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
                                {log.soilType}
                            </span>
                        )}
                        {reamers.length > 0 && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                                Reamers: {reamers.length}
                            </span>
                        )}
                    </div>
                </div>

                {/* Row 5: Address */}
                {(log.addressBoreStart || log.addressBoreEnd) && (
                    <div className="flex flex-col pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Route</p>
                        <div className="flex items-start gap-2 text-[11px]">
                            <div className="flex flex-col items-center gap-0.5 mt-0.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <div className="w-px h-3 bg-slate-200" />
                                <div className="w-2 h-2 rounded-full bg-rose-500" />
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                                <p className="font-medium text-slate-700 truncate">{log.addressBoreStart || '-'}</p>
                                <p className="font-medium text-slate-700 truncate">{log.addressBoreEnd || '-'}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Row 6: Stats Grid */}
                <div className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-slate-100">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate pr-2">Rods</span>
                        <span className="bg-white px-2 py-0.5 rounded text-[10px] font-black text-indigo-600 shadow-sm shrink-0">{rodCount}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate pr-2">Photos</span>
                        <span className="bg-white px-2 py-0.5 rounded text-[10px] font-black text-slate-700 shadow-sm shrink-0">{photoCount}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate pr-2">Foreman Sig</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black shadow-sm shrink-0 ${hasForemanSig ? 'bg-emerald-50 text-emerald-600' : 'bg-white text-slate-400'}`}>
                            {hasForemanSig ? '✓' : 'No'}
                        </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate pr-2">Customer Sig</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black shadow-sm shrink-0 ${hasCustomerSig ? 'bg-emerald-50 text-emerald-600' : 'bg-white text-slate-400'}`}>
                            {hasCustomerSig ? '✓' : 'No'}
                        </span>
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
                    <span className="text-[12px] font-bold text-slate-600 truncate">{creator?.label || log.createdBy || log.customerForeman || 'Unknown'}</span>
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
                        <button onClick={() => onDownloadPDF(log, setIsDownloading)} disabled={isDownloading} className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-indigo-100 transition-all" title="Download PDF">
                            {isDownloading ? <Loader2 size={14} className="animate-spin text-indigo-600" /> : <Download size={14} />}
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
