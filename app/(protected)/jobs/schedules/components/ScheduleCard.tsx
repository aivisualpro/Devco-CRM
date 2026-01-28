'use client';

import React from 'react';
import { 
    Edit, Copy, Trash2, Shield, ShieldCheck, FilePlus, FileCheck, 
    StopCircle, Droplets, Warehouse, Car 
} from 'lucide-react';
import { 
    Tooltip, TooltipTrigger, TooltipContent, TooltipProvider 
} from '@/components/ui';

interface Objective {
    text: string;
    completed: boolean;
    completedBy?: string;
    completedAt?: string;
}

export interface ScheduleItem {
    _id: string;
    title: string;
    fromDate: string;
    toDate: string;
    customerId: string;
    customerName: string;
    estimate: string;
    jobLocation: string;
    projectManager: string;
    foremanName: string;
    assignees: string[];
    description: string;
    service: string;
    item: string;
    fringe: string;
    certifiedPayroll: string | boolean;
    notifyAssignees: string | boolean;
    perDiem: string | boolean;
    aerialImage?: string;
    siteLayout?: string;
    createdAt?: string;
    updatedAt?: string;
    timesheet?: any[];
    hasJHA?: boolean;
    jha?: any;
    JHASignatures?: any[];
    hasDJT?: boolean;
    djt?: any;
    DJTSignatures?: any[];
    todayObjectives?: Objective[];
    syncedToAppSheet?: boolean;
}

interface ScheduleCardProps {
    item: ScheduleItem;
    initialData: {
        employees: any[];
        clients: any[];
        constants: any[];
        estimates: any[];
    };
    currentUser: any;
    isSelected?: boolean;
    onClick?: () => void;
    onEdit?: (item: ScheduleItem, e: React.MouseEvent) => void;
    onCopy?: (item: ScheduleItem, e: React.MouseEvent) => void;
    onDelete?: (item: ScheduleItem, e: React.MouseEvent) => void;
    onViewJHA?: (item: ScheduleItem, e: React.MouseEvent) => void;
    onCreateJHA?: (item: ScheduleItem, e: React.MouseEvent) => void;
    onViewDJT?: (item: ScheduleItem, e: React.MouseEvent) => void;
    onCreateDJT?: (item: ScheduleItem, e: React.MouseEvent) => void;
    onToggleDriveTime?: (item: ScheduleItem, activeTs: any, e: React.MouseEvent) => void;
    onQuickTimesheet?: (item: ScheduleItem, type: 'Dump Washout' | 'Shop Time', e: React.MouseEvent) => void;
    onViewTimesheet?: (item: ScheduleItem, ts: any, e: React.MouseEvent) => void;
}

export const ScheduleCard: React.FC<ScheduleCardProps> = ({
    item,
    initialData,
    currentUser,
    isSelected,
    onClick,
    onEdit,
    onCopy,
    onDelete,
    onViewJHA,
    onCreateJHA,
    onViewDJT,
    onCreateDJT,
    onToggleDriveTime,
    onQuickTimesheet,
    onViewTimesheet
}) => {
    // Helpers
    const formatLocalDate = (dateInput: string | Date) => {
        if (!dateInput) return '';
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return '';
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getDayName = (dateStr: string) => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return days[date.getDay()];
    };

    const getCustomerName = (schedule: ScheduleItem) => {
        if (schedule.customerName && schedule.customerName !== 'Client') return schedule.customerName;
        if (schedule.customerId) {
            const client = initialData.clients.find(c => String(c._id) === String(schedule.customerId) || String(c.recordId) === String(schedule.customerId));
            return client ? client.name : 'Client';
        }
        return 'Client';
    };

    const dayName = getDayName(formatLocalDate(item.fromDate));
    const dayBorderColor = {
        'Mon': 'border-t-blue-500',
        'Tue': 'border-t-green-500',
        'Wed': 'border-t-purple-500',
        'Thu': 'border-t-orange-500',
        'Fri': 'border-t-red-500',
        'Sat': 'border-t-teal-500',
        'Sun': 'border-t-pink-500'
    }[dayName] || 'border-t-slate-200';

    const chipColors: Record<string, string> = {
        'Mon': 'bg-blue-50 text-blue-600 border-blue-200 shadow-blue-100',
        'Tue': 'bg-green-50 text-green-600 border-green-200 shadow-green-100',
        'Wed': 'bg-purple-50 text-purple-600 border-purple-200 shadow-purple-100',
        'Thu': 'bg-orange-50 text-orange-600 border-orange-200 shadow-orange-100',
        'Fri': 'bg-red-50 text-red-600 border-red-200 shadow-red-100',
        'Sat': 'bg-teal-50 text-teal-600 border-teal-200 shadow-teal-100',
        'Sun': 'bg-pink-50 text-pink-600 border-pink-200 shadow-pink-100'
    };
    const chipColorClass = chipColors[dayName] || 'bg-slate-50 text-slate-600 border-slate-200 shadow-slate-100';

    const userEmail = currentUser?.email?.toLowerCase();
    const userTimesheets = item.timesheet?.filter((ts: any) => ts.employee?.toLowerCase() === userEmail) || [];
    const activeDriveTime = userTimesheets.find((ts: any) => ts.type === 'Drive Time' && !ts.clockOut);
    const hasDumpWashout = userTimesheets.some((ts: any) => String(ts.dumpWashout).toLowerCase() === 'true' || ts.dumpWashout === true || String(ts.dumpWashout).toLowerCase() === 'yes');
    const hasShopTime = userTimesheets.some((ts: any) => String(ts.shopTime).toLowerCase() === 'true' || ts.shopTime === true);

    return (
        <TooltipProvider>
            <div
                data-day={dayName}
                onClick={onClick}
                className={`group relative bg-white rounded-[32px] p-5 cursor-pointer transition-all duration-500 ease-out border shadow-sm border-t-[6px] ${dayBorderColor}
                    ${isSelected
                        ? 'border-x-[#0F4C75] border-b-[#0F4C75] ring-2 ring-[#0F4C75]/20 shadow-xl scale-[1.02] bg-blue-50/50'
                        : 'border-x-slate-100 border-b-slate-100 hover:border-x-[#0F4C75]/20 hover:border-b-[#0F4C75]/20 hover:shadow-md hover:-translate-y-1'
                    }
                `}
            >
                {isSelected && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0F4C75] text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg z-20 flex items-center gap-1.5 animate-in fade-in zoom-in duration-300">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                        VIEWING
                    </div>
                )}

                {/* Action Overlay & Day Chip */}
                <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
                    <div className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border shadow-sm ${chipColorClass} bg-gradient-to-b from-white/80 to-transparent backdrop-blur-sm`}>
                        {dayName}
                    </div>

                    <div className="hidden md:flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEdit?.(item, e); }}
                                    className="p-2 bg-white/90 backdrop-blur rounded-xl text-slate-500 hover:text-[#0F4C75] hover:bg-blue-50 shadow-sm border border-slate-100 transition-all active:scale-90"
                                >
                                    <Edit size={14} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit Schedule</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCopy?.(item, e); }}
                                    className="p-2 bg-white/90 backdrop-blur rounded-xl text-slate-500 hover:text-emerald-500 hover:bg-emerald-50 shadow-sm border border-slate-100 transition-all active:scale-90"
                                >
                                    <Copy size={14} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>Copy Schedule (+1 Day)</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete?.(item, e); }}
                                    className="p-2 bg-white/90 backdrop-blur rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-50 shadow-sm border border-slate-100 transition-all active:scale-90"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete Schedule</p></TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                <div className="flex flex-col h-full justify-between">
                    {/* Header: Icon (Tag) + Customer */}
                    <div className="flex justify-between items-start mb-3 sm:mb-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                            {(() => {
                                const tagConstant = initialData.constants.find(c => c.description === item.item);
                                const tagImage = tagConstant?.image;
                                const tagColor = tagConstant?.color;
                                const tagLabel = item.item || item.service || 'S';

                                if (tagImage) {
                                    return (
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full overflow-hidden shadow-md">
                                            <img src={tagImage} alt={tagLabel} className="w-full h-full object-cover" />
                                        </div>
                                    );
                                } else if (tagColor) {
                                    return (
                                        <div
                                            className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full shadow-[inset_5px_5px_10px_rgba(0,0,0,0.1),inset_-5px_-5px_10px_rgba(255,255,255,0.5)] flex items-center justify-center text-white font-black text-xs sm:text-sm"
                                            style={{ backgroundColor: tagColor }}
                                        >
                                            {tagLabel.substring(0, 2).toUpperCase()}
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full bg-[#E6EEF8] shadow-[inset_5px_5px_10px_#d1d9e6,inset_-5px_-5px_10px_#ffffff] flex items-center justify-center text-[#0F4C75] font-black text-xs sm:text-sm">
                                            {tagLabel.substring(0, 2).toUpperCase()}
                                        </div>
                                    );
                                }
                            })()}
                            <div className="flex flex-col">
                                {item.item !== 'Day Off' && (
                                    <>
                                        <span className="text-xs sm:text-sm font-bold text-slate-500 leading-tight">{getCustomerName(item)}</span>
                                        {(() => {
                                            const est = initialData.estimates.find(e => e.value === item.estimate);
                                            if (est?.jobAddress) {
                                                return (
                                                    <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                        {est.jobAddress}
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Title */}
                    <div className="mb-2">
                        <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-tight line-clamp-2">
                            {item.title || 'Untitled Schedule'}
                        </h3>
                    </div>

                    {/* Row 3: Estimate #, Date/Time & Assignees */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            {item.item !== 'Day Off' && item.estimate && (
                                <span className="text-[10px] sm:text-[11px] font-bold text-[#0F4C75] bg-[#E6EEF8] px-2 py-0.5 rounded-full">
                                    {item.estimate.replace(/-[vV]\d+$/, '')}
                                </span>
                            )}
                            <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-slate-500">
                                <span>{new Date(item.fromDate).toLocaleDateString('en-US', { timeZone: 'UTC' })}</span>
                                <span className="text-slate-300">|</span>
                                <span>{new Date(item.fromDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })}</span>
                                <span>-</span>
                                <span>{new Date(item.toDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })}</span>
                            </div>
                        </div>

                        <div className="flex -space-x-1.5 shrink-0">
                            {(item.assignees || []).filter(Boolean).slice(0, 3).map((email: string, i: number) => {
                                const emp = initialData.employees.find(e => e.value === email);
                                return (
                                    <Tooltip key={i}>
                                        <TooltipTrigger asChild>
                                            <div className="w-6 h-6 rounded-full border border-white flex items-center justify-center text-[8px] font-bold shadow-sm overflow-hidden bg-slate-200 text-slate-600">
                                                {emp?.image ? (
                                                    <img src={emp.image} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    email?.[0]?.toUpperCase() || '?'
                                                )}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent><p>{emp?.label || email}</p></TooltipContent>
                                    </Tooltip>
                                );
                            })}
                            {(item.assignees || []).filter(Boolean).length > 3 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[8px] font-bold text-slate-500 shadow-sm cursor-help">
                                            +{(item.assignees?.filter(Boolean).length || 0) - 3}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <div className="flex flex-col gap-1 text-xs">
                                            <p className="font-bold border-b border-slate-700/50 pb-1 mb-1 text-slate-300">More Assignees</p>
                                            {(item.assignees || []).filter(Boolean).slice(3).map((email: string, i: number) => {
                                                const emp = initialData.employees.find(e => e.value === email);
                                                return (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] overflow-hidden">
                                                            {emp?.image ? (
                                                                <img src={emp.image} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span>{emp?.label?.[0] || email?.[0] || '?'}</span>
                                                            )}
                                                        </div>
                                                        <span>{emp?.label || email}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </div>

                    {/* Bottom: Actions & Personnel */}
                    <div className={`flex items-center justify-between mt-auto pt-2 border-t border-slate-100 ${item.item === 'Day Off' ? 'hidden' : ''}`}>
                        <div className="flex items-center gap-1">
                            {/* JHA */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div 
                                        className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full transition-colors border-2 border-white shadow-sm cursor-pointer ${item.hasJHA ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' : 'bg-slate-100 text-slate-400 hover:bg-orange-100 hover:text-orange-600'}`} 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            item.hasJHA ? onViewJHA?.(item, e) : onCreateJHA?.(item, e);
                                        }}
                                    >
                                        {item.hasJHA ? <ShieldCheck size={12} strokeWidth={2.5} /> : <Shield size={12} strokeWidth={2.5} />}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent><p>{item.hasJHA ? 'View JHA' : 'Create JHA'}</p></TooltipContent>
                            </Tooltip>

                            {/* DJT */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div 
                                        className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full transition-colors border-2 border-white shadow-sm cursor-pointer ${(item.hasDJT || (item.djt && Object.keys(item.djt).length > 0)) ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200' : 'bg-slate-100 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600'}`} 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            (item.hasDJT || (item.djt && Object.keys(item.djt).length > 0)) ? onViewDJT?.(item, e) : onCreateDJT?.(item, e);
                                        }}
                                    >
                                        {(item.hasDJT || (item.djt && Object.keys(item.djt).length > 0)) ? <FileCheck size={12} strokeWidth={2.5} /> : <FilePlus size={12} strokeWidth={2.5} />}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent><p>{(item.hasDJT || (item.djt && Object.keys(item.djt).length > 0)) ? 'View DJT' : 'Create DJT'}</p></TooltipContent>
                            </Tooltip>

                            {/* Timesheet */}
                            {(() => {
                                const dwTs = userTimesheets.find(t => String(t.dumpWashout).toLowerCase() === 'true' || t.dumpWashout === true || String(t.dumpWashout).toLowerCase() === 'yes');
                                const stTs = userTimesheets.find(t => String(t.shopTime).toLowerCase() === 'true' || t.shopTime === true);
                                
                                return (
                                    <>
                                        {activeDriveTime ? (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div 
                                                        className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors cursor-pointer border-2 border-white shadow-sm animate-pulse" 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            onToggleDriveTime?.(item, activeDriveTime, e);
                                                        }}
                                                    >
                                                        <StopCircle size={14} strokeWidth={2.5} />
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Stop Drive Time</p></TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div 
                                                        className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:bg-sky-100 hover:text-sky-600 transition-colors cursor-pointer border-2 border-white shadow-sm" 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            onToggleDriveTime?.(item, null, e); 
                                                        }}
                                                    >
                                                        <Car size={14} strokeWidth={2.5} />
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent><p>Start Drive Time</p></TooltipContent>
                                            </Tooltip>
                                        )}
                                        
                                        <div className="flex items-center gap-1">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div 
                                                        className={`relative z-10 flex items-center gap-1.5 px-2 h-7 rounded-full transition-colors border-2 border-white shadow-sm cursor-pointer ${dwTs ? 'bg-teal-500 text-white hover:bg-teal-600' : 'bg-slate-100 text-slate-400 hover:bg-teal-100 hover:text-teal-600'}`} 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            onQuickTimesheet?.(item, 'Dump Washout', e); 
                                                        }}
                                                    >
                                                        <Droplets size={14} strokeWidth={2.5} />
                                                        {(dwTs?.qty || 1) > 1 && (
                                                            <span className="text-[10px] font-black">
                                                                x{dwTs.qty}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent><p>{dwTs ? `Increment Dump Washout (${dwTs.qty || 1})` : 'Register Dump Washout'}</p></TooltipContent>
                                            </Tooltip>
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div 
                                                        className={`relative z-10 flex items-center gap-1.5 px-2 h-7 rounded-full transition-colors border-2 border-white shadow-sm cursor-pointer ${stTs ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-600'}`} 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            onQuickTimesheet?.(item, 'Shop Time', e); 
                                                        }}
                                                    >
                                                        <Warehouse size={14} strokeWidth={2.5} />
                                                        {(stTs?.qty || 1) > 1 && (
                                                            <span className="text-[10px] font-black">
                                                                x{stTs.qty}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent><p>{stTs ? `Increment Shop Time (${stTs.qty || 1})` : 'Register Shop Time'}</p></TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        <div className="flex items-center -space-x-1.5">
                            {[item.projectManager, item.foremanName].map((email, i) => {
                                if (!email) return null;
                                const emp = initialData.employees.find(e => e.value === email);
                                const labels = ['P', 'F']; 
                                const colors = ['bg-[#0F4C75]', 'bg-[#10B981]'];
                                return (
                                    <Tooltip key={i}>
                                        <TooltipTrigger asChild>
                                            <div className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold shadow-sm overflow-hidden text-white ${colors[i]}`}>
                                                {emp?.image ? <img src={emp.image} alt="" className="w-full h-full object-cover" /> : labels[i]}
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent><p>{i === 0 ? 'Project Manager' : 'Foreman'}: {emp?.label || email}</p></TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
};
