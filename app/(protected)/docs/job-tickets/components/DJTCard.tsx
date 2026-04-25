import React, { useState } from 'react';
import { Check, Edit, Trash2, User, Download, Mail, Loader2 } from 'lucide-react';
import { formatWallDate, formatWallTime, formatWallDateTime } from '@/lib/format/date';

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
    
    // date
    const dateStr = (djt.date || schedule?.fromDate) ? formatWallDate(djt.date || schedule?.fromDate) : 'N/A';
    const creator = employees.find(e => e.value === djt.createdBy);
    const hasCustSig = !!djt.customerSignature;
    const eqCount = (djt.equipmentUsed || []).length;

    return (
        <div
            className="group relative bg-white rounded-2xl border border-slate-200 hover:border-[#0F4C75]/40 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
            onClick={() => onView(djt)}
        >
            <div className="p-5 flex flex-col gap-4 flex-1">
                {/* Top Section */}
                <div className="flex flex-col gap-1.5">
                    {/* Row 1: Date & Time + Estimate */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-800">
                            <p className="text-sm font-bold">{dateStr} <span className="text-slate-400 font-medium ml-1">at {djt.djtTime || '--:--'}</span></p>
                        </div>
                        {canViewEstimates && schedule?.estimate ? (
                            <button 
                                onClick={(e) => { e.stopPropagation(); router.push(`/estimates/${schedule.estimate}`); }}
                                className="bg-[#0F4C75]/10 text-[#0F4C75] hover:bg-[#0F4C75]/20 text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors"
                            >
                                {schedule.estimate}
                            </button>
                        ) : (
                            <span className="bg-slate-100/80 text-slate-500 text-[11px] font-bold px-2.5 py-1 rounded-md border border-slate-200/60">
                                {schedule?.estimate || 'No Est'}
                            </span>
                        )}
                    </div>

                    {/* Row 2: Customer Name */}
                    <div>
                        <p className="text-base font-extrabold text-[#0F4C75] leading-tight line-clamp-1">{clientName}</p>
                    </div>

                    {/* Row 3: Schedule Title */}
                    <div>
                        <p className="text-sm font-semibold text-slate-700 line-clamp-1">{schedule?.title || 'No Title'}</p>
                    </div>
                </div>

                {/* Row 4: Assignees */}
                {schedule && schedule.assignees && schedule.assignees.length > 0 && (
                    <div className="flex flex-col pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Assignees</p>
                        <div className="grid grid-cols-2 gap-2">
                            {schedule.assignees.map((assigneeEmail: string, i: number) => {
                                const emp = employees.find(e => e.value === assigneeEmail);
                                const hasSigned = (djt.signatures || []).some((s: any) => s.employee === assigneeEmail);
                                return (
                                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg p-2 border border-slate-100 min-w-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                                                {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" alt={emp?.label} /> : <User size={12} className="text-slate-500" />}
                                            </div>
                                            <span className="text-[11px] font-medium text-slate-700 truncate">{emp?.label || assigneeEmail}</span>
                                        </div>
                                        {hasSigned && (
                                            <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shrink-0">
                                                <Check size={8} className="text-white font-bold" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Row 5: Customer Signature Name and Checkmark */}
                <div className="flex flex-col pt-2 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Customer Signature</p>
                    <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2 border border-slate-100 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] font-medium text-slate-700 truncate">{djt.customerPrintName || clientName || 'Customer'}</span>
                        </div>
                        {hasCustSig && (
                            <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shrink-0">
                                <Check size={8} className="text-white font-bold" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Row 6: Equipment Used */}
                <div className="flex flex-col pt-2 border-t border-slate-100 mb-2">
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

            {/* Row 7: Footer - Created By & Actions */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between mt-auto">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Created:</span>
                    {(() => {
                        const creatorEmail = djt.createdBy;
                        const validCreator = employees.find(e => 
                            e.value === String(creatorEmail).trim().toLowerCase() ||
                            e.label === creatorEmail ||
                            e.email === creatorEmail
                        );
                        return (
                            <span className="text-[11px] font-bold text-slate-700 truncate pr-1">
                                {validCreator?.label || creatorEmail || 'Unknown'}
                            </span>
                        );
                    })()}
                    <div className="w-1 h-1 rounded-full bg-slate-300 mx-0.5 shrink-0" />
                    <span className="text-[10px] font-medium text-slate-500 shrink-0">{djt.createdAt ? new Date(djt.createdAt).toLocaleDateString('en-US') : 'N/A'}</span>
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
        </div>
    );
};
