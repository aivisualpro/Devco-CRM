import React, { useState } from 'react';
import { Check, Edit, Trash2, User, Download, Mail, Loader2 } from 'lucide-react';
import { formatWallDate, formatWallTime, formatWallDateTime } from '@/lib/format/date';

interface JHACardProps {
    jha: any;
    schedule: any;
    clientName: string;
    employees: any[];
    canViewEstimates: boolean;
    canEdit: boolean;
    canDelete: boolean;
    onView: (jha: any) => void;
    onEdit?: (jha: any) => void;
    onDelete?: (jha: any) => void;
    onDownloadPDF?: (jha: any, setDownloading: (b: boolean) => void) => void;
    onEmail?: (jha: any) => void;
    router: any;
}

export const JHACard: React.FC<JHACardProps> = ({
    jha,
    schedule,
    clientName,
    employees,
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
    
    const dateStr = (jha.date || schedule?.fromDate) ? formatWallDate(jha.date || schedule?.fromDate) : 'N/A';
    const creator = employees.find(e => e.value === jha.createdBy);
    const sigCount = (jha.signatures || []).length;

    const dailyWorkFields = ['operatingMiniEx', 'operatingAVacuumTruck', 'excavatingTrenching', 'acConcWork', 'operatingBackhoe', 'workingInATrench', 'trafficControl', 'roadWork', 'operatingHdd', 'confinedSpace', 'settingUgBoxes', 'otherDailyWork', 'sidewalks'];
    const hazardsFields = ['heatAwareness', 'ladderWork', 'overheadLifting', 'materialHandling', 'roadHazards', 'heavyLifting', 'highNoise', 'pinchPoints', 'sharpObjects', 'trippingHazards', 'otherJobsiteHazards'];
    const emergencyFields = ['stagingAreaDiscussed', 'rescueProceduresDiscussed', 'evacuationRoutesDiscussed', 'emergencyContactNumberWillBe911', 'firstAidAndCPREquipmentOnsite', 'closestHospitalDiscussed'];
    
    const dailyWorkCount = dailyWorkFields.filter(f => jha[f]).length;
    const hazardsCount = hazardsFields.filter(f => jha[f]).length;
    const emergencyCount = emergencyFields.filter(f => jha[f]).length;
    const hasHospitalInfo = !!(jha.nameOfHospital || jha.addressOfHospital);

    return (
        <div
            className="group relative bg-white rounded-2xl border border-slate-200 hover:border-[#0F4C75]/40 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
            onClick={() => onView(jha)}
        >
            <div className="p-5 flex flex-col gap-4 flex-1">
                {/* Top Section Wrapper (First 3 lines forced together) */}
                <div className="flex flex-col gap-1.5">
                    {/* Row 1: Date & Time + Estimate */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-800">
                            <div className={`w-2 h-2 rounded-full ${sigCount > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <p className="text-sm font-bold">{dateStr} <span className="text-slate-400 font-medium ml-1">at {jha.jhaTime || '--:--'}</span></p>
                        </div>
                        {canViewEstimates && schedule?.estimate ? (
                            <button 
                                onMouseEnter={() => router.prefetch(`/estimates/${schedule.estimate}`)} onClick={(e) => { e.stopPropagation(); router.push(`/estimates/${schedule.estimate}`); }}
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

                {/* Row 4: Assignees list with avatars and signatures */}
                {schedule && schedule.assignees && schedule.assignees.length > 0 && (
                    <div className="flex flex-col pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Assignees</p>
                        <div className="grid grid-cols-2 gap-2">
                            {schedule.assignees.map((assigneeEmail: string, i: number) => {
                                const emp = employees.find(e => e.value === assigneeEmail);
                                const hasSigned = (jha.signatures || []).some((s: any) => s.employee === assigneeEmail);
                                return (
                                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg p-2 border border-slate-100 min-w-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                                                {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : <User size={12} className="text-slate-500" />}
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

                {/* 4 Extra Chips Grid */}
                <div className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-slate-100">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate pr-2">Daily Work</span>
                        <span className="bg-white px-2 py-0.5 rounded text-[10px] font-black text-slate-700 shadow-sm shrink-0">{dailyWorkCount}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate pr-2">Hazards</span>
                        <span className="bg-white px-2 py-0.5 rounded text-[10px] font-black text-slate-700 shadow-sm shrink-0">{hazardsCount}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate pr-2">Emergency Plan</span>
                        <span className="bg-white px-2 py-0.5 rounded text-[10px] font-black text-slate-700 shadow-sm shrink-0">{emergencyCount}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-lg py-1.5 px-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate pr-2">Hospital Info</span>
                        {hasHospitalInfo ? (
                            <div className="bg-emerald-50 w-4 h-4 rounded flex items-center justify-center shrink-0">
                                <Check size={10} className="text-emerald-500" strokeWidth={3} />
                            </div>
                        ) : (
                            <span className="bg-white px-2 py-0.5 rounded text-[10px] font-black text-slate-400 shadow-sm shrink-0">None</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 5: Footer - Created By & Actions */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between mt-auto">
                <div className="flex items-center gap-2.5 min-w-0">
                    {creator ? (
                        <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden shrink-0 shadow-inner">
                            {creator.image ? <img src={creator.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500">{creator.label?.[0]}</div>}
                        </div>
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center shrink-0"><User size={12} className="text-slate-400"/></div>
                    )}
                    <span className="text-[12px] font-bold text-slate-600 truncate">{creator?.label || jha.createdBy || 'Unknown'}</span>
                    <div className="w-1 h-1 rounded-full bg-slate-300 mx-0.5 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-500 shrink-0">{jha.createdAt ? new Date(jha.createdAt).toLocaleDateString('en-US') : 'N/A'}</span>
                </div>
                
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    {onEmail && (
                        <button onClick={() => onEmail(jha)} className="p-2 rounded-xl text-slate-400 hover:text-blue-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-blue-100 transition-all" title="Email JHA">
                            <Mail size={14} />
                        </button>
                    )}
                    {onDownloadPDF && (
                        <button onClick={() => onDownloadPDF(jha, setIsDownloading)} disabled={isDownloading} className="p-2 rounded-xl text-slate-400 hover:text-[#0F4C75] hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all" title="Download PDF">
                            {isDownloading ? <Loader2 size={14} className="animate-spin text-[#0F4C75]" /> : <Download size={14} />}
                        </button>
                    )}
                    {canEdit && onEdit && (
                        <button onClick={() => onEdit(jha)} className="p-2 rounded-xl text-slate-400 hover:text-orange-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-orange-100 transition-all" title="Edit">
                            <Edit size={14} />
                        </button>
                    )}
                    {canDelete && onDelete && (
                        <button onClick={() => onDelete(jha)} className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-rose-100 transition-all" title="Delete">
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
