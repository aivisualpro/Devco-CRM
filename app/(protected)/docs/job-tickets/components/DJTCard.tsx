import React, { useState, useRef, useMemo } from 'react';
import { Check, Edit, Trash2, User, Download, Mail, Loader2, Camera, ChevronLeft, ChevronRight, X, DollarSign, Calendar } from 'lucide-react';
import { formatWallDate } from '@/lib/format/date';
import { cld } from '@/lib/cld';

interface DJTCardProps {
    djt: any;
    schedule: any;
    clientName: string;
    employees: any[];
    equipmentItems: any[];
    canViewEstimates: boolean;
    canEdit: boolean;
    canDelete: boolean;
    onView: (djt: any) => void;
    onEdit?: (djt: any) => void;
    onDelete?: (djt: any) => void;
    onDownloadPDF?: (djt: any) => Promise<void> | void;
    onEmail?: (djt: any) => void;
    router: any;
}

export const DJTCard: React.FC<DJTCardProps> = ({
    djt,
    schedule,
    clientName,
    employees,
    equipmentItems,
    canViewEstimates,
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
    const sigScrollRef = useRef<HTMLDivElement>(null);
    const imgScrollRef = useRef<HTMLDivElement>(null);
    const [selectedSigIndex, setSelectedSigIndex] = useState<number | null>(null);
    const [selectedImgIndex, setSelectedImgIndex] = useState<number | null>(null);

    // Data
    const dateStr = (djt.fromDate || djt.date || schedule?.fromDate) ? formatWallDate(djt.fromDate || djt.date || schedule?.fromDate) : 'N/A';
    const creator = employees.find(e => e.value === djt.createdBy);
    const hasCustSig = !!djt.customerSignature;
    const eqCount = (djt.equipmentUsed || []).length;
    const emailCount = djt.emailCounter || (djt.djtEmails || []).length || 0;
    const djtCost = djt.djtCost || 0;
    const signatures = djt.signatures || [];
    const djtImages = djt.djtimages || [];
    const scheduleTitle = schedule?.title || djt.scheduleRef?.title || 'No Title';

    const scrollCarousel = (ref: React.RefObject<HTMLDivElement | null>, dir: 'left' | 'right') => {
        if (!ref.current) return;
        ref.current.scrollBy({ left: dir === 'left' ? -180 : 180, behavior: 'smooth' });
    };

    return (
        <div
            className="group relative bg-white rounded-2xl border border-slate-200 hover:border-cyan-400/50 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
            onClick={() => onView(djt)}
        >
            <div className="p-4 flex flex-col gap-3 flex-1">
                {/* Row 1: fromDate + Chips (emailCounter, djtCost) */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="text-slate-400" />
                        <span className="text-sm font-bold text-slate-800">{dateStr}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {emailCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                <Mail size={9} /> {emailCount}
                            </span>
                        )}
                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${djtCost > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                            <DollarSign size={9} /> {djtCost > 0 ? `$${djtCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0'}
                        </span>
                    </div>
                </div>

                {/* Row 2: Schedule Title */}
                <div>
                    <p className="text-sm font-extrabold text-[#0F4C75] leading-tight line-clamp-2">{scheduleTitle}</p>
                </div>

                {/* Row 3: dailyJobDescription (scrollable box like Billing Tickets) */}
                {djt.dailyJobDescription && (
                    <div className="text-[12px] text-slate-600 leading-relaxed bg-cyan-50/40 p-2.5 rounded-lg border border-cyan-100/50 overflow-y-auto max-h-20" onClick={e => e.stopPropagation()}>
                        {djt.dailyJobDescription}
                    </div>
                )}

                {/* Row 4: Signatures Carousel */}
                {signatures.length > 0 && (
                    <div className="flex flex-col pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Signatures ({signatures.length})</p>
                        <div className="relative rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div
                                ref={sigScrollRef}
                                className="flex gap-0.5 overflow-x-auto"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {signatures.map((sig: any, i: number) => {
                                    const emp = employees.find(e => e.value === sig.employee);
                                    return (
                                        <div
                                            key={i}
                                            className="shrink-0 w-[80px] h-[52px] bg-slate-50 border border-slate-100 rounded-lg overflow-hidden cursor-pointer relative group/sig"
                                            onClick={() => setSelectedSigIndex(i)}
                                        >
                                            {sig.signature ? (
                                                <img
                                                    src={sig.signature}
                                                    alt={emp?.label || sig.employee}
                                                    className="w-full h-full object-contain p-1"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400 font-bold">No Sig</div>
                                            )}
                                            {/* Name overlay */}
                                            <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[7px] font-bold text-center py-0.5 truncate px-1">
                                                {emp?.label || sig.employee?.split('@')[0] || 'Unknown'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {signatures.length > 3 && (
                                <>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); scrollCarousel(sigScrollRef, 'left'); }}
                                        className="absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 bg-white/90 backdrop-blur-sm rounded-full shadow flex items-center justify-center text-slate-600 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                                    ><ChevronLeft size={12} /></button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); scrollCarousel(sigScrollRef, 'right'); }}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 bg-white/90 backdrop-blur-sm rounded-full shadow flex items-center justify-center text-slate-600 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                                    ><ChevronRight size={12} /></button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Row 5: Customer Print Name & Customer Signature */}
                <div className="flex flex-col pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Customer Signature</p>
                    <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-2 border border-slate-100">
                        <span className="text-[11px] font-medium text-slate-700 truncate flex-1">{djt.customerPrintName || clientName || 'Customer'}</span>
                        {hasCustSig ? (
                            <img
                                src={djt.customerSignature}
                                alt="Customer Signature"
                                className="h-8 max-w-[80px] object-contain bg-white rounded border border-slate-200 p-0.5"
                            />
                        ) : (
                            <span className="text-[9px] text-slate-400 italic">Not signed</span>
                        )}
                    </div>
                </div>

                {/* Row 6: DJT Images Carousel */}
                {djtImages.length > 0 && (
                    <div className="flex flex-col pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Photos ({djtImages.length})</p>
                        <div className="relative rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div
                                ref={imgScrollRef}
                                className="flex gap-0.5 overflow-x-auto"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {djtImages.map((photo: string, i: number) => (
                                    <div
                                        key={i}
                                        className="shrink-0 w-[72px] h-[56px] bg-slate-100 overflow-hidden cursor-pointer rounded-md"
                                        onClick={() => setSelectedImgIndex(i)}
                                    >
                                        <img
                                            src={cld(photo, { w: 144, h: 112, q: 'auto' })}
                                            alt={`DJT Photo ${i + 1}`}
                                            loading="lazy"
                                            className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                                        />
                                    </div>
                                ))}
                            </div>
                            {/* Photo count badge */}
                            <div className="absolute top-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                <Camera size={9} /> {djtImages.length}
                            </div>
                            {djtImages.length > 4 && (
                                <>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); scrollCarousel(imgScrollRef, 'left'); }}
                                        className="absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 bg-white/90 backdrop-blur-sm rounded-full shadow flex items-center justify-center text-slate-600 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                                    ><ChevronLeft size={12} /></button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); scrollCarousel(imgScrollRef, 'right'); }}
                                        className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 bg-white/90 backdrop-blur-sm rounded-full shadow flex items-center justify-center text-slate-600 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                                    ><ChevronRight size={12} /></button>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Row 7: Equipment Used (table — same as before) */}
                <div className="flex flex-col pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Equipment Used</p>
                    {eqCount > 0 ? (
                        <div className="w-full border border-slate-200 rounded-lg overflow-hidden bg-white">
                            <table className="w-full text-[10px] text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-2 py-1.5 font-bold text-slate-600">Equipment Name</th>
                                        <th className="px-2 py-1.5 font-bold text-slate-600 w-12 text-center">Qty</th>
                                        <th className="px-2 py-1.5 font-bold text-slate-600 w-16 text-center">Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(djt.equipmentUsed || []).map((eq: any, i: number) => {
                                        const eqItem = equipmentItems.find((e: any) => String(e.value) === String(eq.equipment));
                                        const name = eqItem ? eqItem.label : (eq.equipment || 'Equipment');
                                        const isRental = eq.type?.toLowerCase() === 'rental';
                                        return (
                                            <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                                <td className="px-2 py-1.5 font-medium text-slate-700 truncate max-w-[120px]" title={name}>{name}</td>
                                                <td className="px-2 py-1.5 text-center text-slate-600 font-semibold">{eq.qty || 1}</td>
                                                <td className="px-2 py-1.5 text-center">
                                                    <span className={`px-1.5 py-0.5 rounded-[4px] font-bold text-[8px] uppercase tracking-wider ${isRental ? 'bg-amber-100 text-amber-700 outline outline-1 outline-amber-200' : 'bg-blue-100 text-blue-700 outline outline-1 outline-blue-200'}`}>
                                                        {eq.type || 'OWNED'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <span className="text-[11px] text-slate-400 italic">No equipment logged</span>
                    )}
                </div>
            </div>

            {/* Footer - Created By, createdAt & Actions */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between mt-auto">
                <div className="flex items-center gap-2 min-w-0">
                    {creator ? (
                        <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden shrink-0 shadow-inner">
                            {creator.image ? <img src={creator.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500">{creator.label?.[0]}</div>}
                        </div>
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><User size={12} className="text-slate-400"/></div>
                    )}
                    <span className="text-[12px] font-bold text-slate-600 truncate">{creator?.label || djt.createdBy || 'Unknown'}</span>
                    <div className="w-1 h-1 rounded-full bg-slate-300 mx-0.5 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-500 shrink-0">{djt.createdAt ? new Date(djt.createdAt).toLocaleDateString('en-US') : 'N/A'}</span>
                </div>
                
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {onEmail && (
                        <button onClick={() => onEmail(djt)} className="p-2 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-blue-100 transition-all" title="Email DJT">
                            <Mail size={14} />
                        </button>
                    )}
                    {onDownloadPDF && (
                        <button onClick={async () => {
                            setIsDownloading(true);
                            await onDownloadPDF(djt);
                            setIsDownloading(false);
                        }} disabled={isDownloading} className="p-2 rounded-xl text-slate-400 hover:text-[#0F4C75] hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all" title="Download PDF">
                            {isDownloading ? <Loader2 size={14} className="animate-spin text-[#0F4C75]" /> : <Download size={14} />}
                        </button>
                    )}
                    {canEdit && onEdit && (
                        <button onClick={() => onEdit(djt)} className="p-2 rounded-xl text-slate-400 hover:text-orange-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-orange-100 transition-all" title="Edit">
                            <Edit size={14} />
                        </button>
                    )}
                    {canDelete && onDelete && (
                        <button onClick={() => onDelete(djt)} className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-rose-100 transition-all" title="Delete">
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Signature Lightbox */}
            {selectedSigIndex !== null && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
                    onClick={(e) => { e.stopPropagation(); setSelectedSigIndex(null); }}
                >
                    <button 
                        className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
                        onClick={(e) => { e.stopPropagation(); setSelectedSigIndex(null); }}
                    >
                        <X size={24} />
                    </button>
                    
                    {signatures.length > 1 && (
                        <button 
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setSelectedSigIndex((prev) => prev! === 0 ? signatures.length - 1 : prev! - 1); 
                            }}
                        >
                            <ChevronLeft size={32} />
                        </button>
                    )}
                    
                    <div className="flex flex-col items-center gap-4">
                        <div className="bg-white rounded-2xl p-6 max-w-[90vw] max-h-[70vh]">
                            <img 
                                src={signatures[selectedSigIndex]?.signature} 
                                alt="Signature"
                                className="max-w-[500px] max-h-[300px] object-contain"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                        <div className="text-white text-sm font-bold">
                            {(() => {
                                const sig = signatures[selectedSigIndex];
                                const emp = employees.find(e => e.value === sig?.employee);
                                return emp?.label || sig?.employee || 'Unknown';
                            })()}
                        </div>
                    </div>
                    
                    {signatures.length > 1 && (
                        <button 
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setSelectedSigIndex((prev) => prev! === signatures.length - 1 ? 0 : prev! + 1); 
                            }}
                        >
                            <ChevronRight size={32} />
                        </button>
                    )}
                    
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
                        {selectedSigIndex + 1} / {signatures.length}
                    </div>
                </div>
            )}

            {/* Image Lightbox */}
            {selectedImgIndex !== null && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
                    onClick={(e) => { e.stopPropagation(); setSelectedImgIndex(null); }}
                >
                    <button 
                        className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
                        onClick={(e) => { e.stopPropagation(); setSelectedImgIndex(null); }}
                    >
                        <X size={24} />
                    </button>
                    
                    {djtImages.length > 1 && (
                        <button 
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setSelectedImgIndex((prev) => prev! === 0 ? djtImages.length - 1 : prev! - 1); 
                            }}
                        >
                            <ChevronLeft size={32} />
                        </button>
                    )}
                    
                    <img 
                        src={cld(djtImages[selectedImgIndex], { w: 1200, h: 1200, q: 'auto' })} 
                        alt="DJT Photo Fullscreen"
                        className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                    
                    {djtImages.length > 1 && (
                        <button 
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setSelectedImgIndex((prev) => prev! === djtImages.length - 1 ? 0 : prev! + 1); 
                            }}
                        >
                            <ChevronRight size={32} />
                        </button>
                    )}
                    
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
                        {selectedImgIndex + 1} / {djtImages.length}
                    </div>
                </div>
            )}
        </div>
    );
};
