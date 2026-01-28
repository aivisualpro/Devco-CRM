'use client';

import React, { useState, useEffect } from 'react';
import { 
    X, Calendar, Clock, MapPin, User, Shield, ShieldCheck, 
    FilePlus, FileCheck, Car, Droplets, Warehouse, Circle, 
    CheckCircle2, ExternalLink, Mail, Phone, Info, ClipboardList,
    ArrowLeft, ChevronRight
} from 'lucide-react';
import { Modal, Badge, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';

interface Objective {
    text: string;
    completed: boolean;
    completedBy?: string;
    completedAt?: string;
}

interface Schedule {
    _id: string;
    title: string;
    fromDate: string;
    toDate: string;
    customerId: string;
    customerName: string;
    jobLocation: string;
    projectManager: string;
    foremanName: string;
    assignees: string[];
    estimate: string;
    service?: string;
    item?: string;
    description?: string;
    hasJHA?: boolean;
    jha?: any;
    JHASignatures?: any[];
    hasDJT?: boolean;
    djt?: any;
    DJTSignatures?: any[];
    timesheet?: any[];
    todayObjectives?: Objective[];
    aerialImage?: string;
    siteLayout?: string;
    syncedToAppSheet?: boolean;
    notifyAssignees?: string | boolean;
    perDiem?: string | boolean;
    certifiedPayroll?: string | boolean;
}

interface ScheduleDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: Schedule | null;
    initialData: any;
    onOpenMedia: (type: 'image' | 'map', url: string, title: string) => void;
}

const toUTCDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
        const literalTime = (dateStr.split('T')[1] || dateStr.split(' ')[1] || '').split(/[+-]|Z/)[0];
        const datePart = dateStr.split('T')[0].split(' ')[0];
        
        if (datePart && literalTime) {
            return new Date(`${datePart}T${literalTime}Z`);
        }
        return new Date(dateStr);
    } catch { return new Date(dateStr); }
};

const formatTimeOnly = (dateStr?: any) => {
    if (!dateStr) return '--:--';
    
    let str = '';
    try {
        // Safe string conversion
        if (dateStr instanceof Date) {
            str = dateStr.toISOString();
        } else {
            str = String(dateStr);
        }
    } catch (e) {
        str = String(dateStr);
    }
    
    // 1. Robust Regex - Find ANY "HH:mm" pattern
    // This catches "T08:00", " 08:00", "8:00", etc.
    const match = str.match(/(\d{1,2}):(\d{2})/);
    
    if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2];
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }
    
    // 2. Fallback: UTC Date Methods
    // If regex fails (e.g. funny format), parse as Date and read UTC values directly.
    // This avoids local timezone shifts.
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '--:--';
        
        let h = d.getUTCHours();
        const m = d.getUTCMinutes().toString().padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    } catch { return '--:--'; }
};

const calculateTimesheetData = (ts: any, scheduleDate: string) => {
    try {
        const qty = ts.qty || 1;
        if (ts.hours !== undefined && ts.hours !== null) {
            return { hours: Number(ts.hours), distance: Number(ts.distance || 0), qty };
        }
        const cin = toUTCDate(ts.clockIn);
        const cout = ts.clockOut ? toUTCDate(ts.clockOut) : null;
        let hours = 0;
        if (cin && cout) {
            hours = (cout.getTime() - cin.getTime()) / (1000 * 60 * 60);
        }
        let distance = 0;
        if (ts.locationIn && ts.locationOut && typeof ts.locationIn === 'string' && ts.locationIn.includes(',')) {
            const [lat1, lon1] = ts.locationIn.split(',').map(Number);
            const [lat2, lon2] = ts.locationOut.split(',').map(Number);
            const R = 3958.8;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * 
                    Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance = R * c;
        }
        return { hours, distance, qty };
    } catch { return { hours: 0, distance: 0, qty: 1 }; }
};

export const ScheduleDetailModal = ({ isOpen, onClose, schedule, initialData, onOpenMedia }: ScheduleDetailModalProps) => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (!schedule) return null;

    const getCustomerName = () => {
        if (schedule.customerName && schedule.customerName !== 'Client') return schedule.customerName;
        if (schedule.customerId) {
            const client = initialData.clients?.find((c: any) => String(c._id) === String(schedule.customerId));
            return client ? client.name : 'Client';
        }
        return 'Client';
    };

    const getJobLocation = () => {
        if (schedule.jobLocation && schedule.jobLocation !== 'Job Location TBD') return schedule.jobLocation;
        if (schedule.estimate && initialData.estimates) {
            const est = initialData.estimates.find((e: any) => e.value === schedule.estimate);
            if (est?.jobAddress) return est.jobAddress;
        }
        return 'Job Location TBD';
    };

    const driveTimeEntries = schedule.timesheet?.filter(ts => {
        const t = (ts.type || '').toLowerCase().trim();
        const isShop = ts.shopTime === 'Yes' || ts.shopTime === 'true' || ts.shopTime === true;
        return t === 'drive time' || t === 'shop time' || isShop;
    }) || [];
    const siteTimeEntries = schedule.timesheet?.filter(ts => !driveTimeEntries.includes(ts)) || [];

    const renderTable = (entries: any[], title: string, icon: React.ReactNode, titleColor: string, isDriveTime: boolean = false) => {
        if (entries.length === 0) return null;
        
        return (
            <div className="mb-10 last:mb-0">
                {!isMobile ? (
                    <div className="mb-8 last:mb-0">
                        <div className="flex items-center gap-2 mb-3 px-1">
                            <div className="p-1.5 rounded-lg bg-slate-50 text-slate-400">
                                {icon}
                            </div>
                            <h4 className={`text-sm font-black uppercase tracking-wider ${titleColor}`}>{title}</h4>
                            <span className="ml-auto text-[10px] font-bold text-slate-300 bg-slate-50 px-2 py-0.5 rounded-full">
                                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                            </span>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">Employee</th>
                                        <th className="px-6 py-4 text-center">{isDriveTime ? 'Drive Start' : 'Clock In'}</th>
                                        <th className="px-6 py-4 text-center">{isDriveTime ? 'Drive End' : 'Clock Out'}</th>
                                        {isDriveTime && <th className="px-6 py-4 text-center">Distance</th>}
                                        <th className="px-6 py-4 text-right">Hours</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {entries.map((ts, idx) => {
                                        const { hours, qty, distance } = calculateTimesheetData(ts, schedule.fromDate);
                                        const emp = initialData.employees?.find((e: any) => e.value === ts.employee);
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 overflow-hidden shrink-0 group-hover:ring-2 group-hover:ring-slate-100 transition-all">
                                                            {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : (ts.employee?.[0] || 'U').toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-700">{emp?.label || ts.employee}</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                {ts.dumpWashout && (
                                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-teal-50 rounded text-teal-600 border border-teal-100">
                                                                        <Droplets size={10} strokeWidth={3} />
                                                                        <span className="text-[9px] font-black">Washout {qty > 1 && `x${qty}`}</span>
                                                                    </div>
                                                                )}
                                                                {ts.shopTime && (
                                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 rounded text-amber-600 border border-amber-100">
                                                                        <Warehouse size={10} strokeWidth={3} />
                                                                        <span className="text-[9px] font-black">Shop {qty > 1 && `x${qty}`}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`text-[11px] font-bold px-2 py-1 rounded-md border ${isDriveTime ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-slate-600 bg-emerald-50 border-emerald-100'}`}>
                                                        {formatTimeOnly(ts.clockIn)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`text-[11px] font-bold px-2 py-1 rounded-md border ${ts.clockOut ? (isDriveTime ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-slate-600 bg-rose-50 border-rose-100') : 'text-slate-300 bg-slate-50 border-slate-100 italic'}`}>
                                                        {formatTimeOnly(ts.clockOut)}
                                                    </span>
                                                </td>
                                                {isDriveTime && (
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`text-[11px] font-bold px-2 py-1 rounded-md border ${distance > 0 ? 'text-blue-600 bg-blue-50 border-blue-100' : 'text-slate-400 bg-slate-50 border-slate-100'}`}>
                                                            {distance > 0 ? `${distance.toFixed(1)} mi` : '--'}
                                                        </span>
                                                    </td>
                                                )}
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-xs font-black text-[#0F4C75] bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                                                        {hours.toFixed(2)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="mb-10 last:mb-0">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-[#F8FAFC] rounded-2xl text-[#0F4C75] border border-slate-100 shadow-sm">
                                {icon}
                            </div>
                            <h4 className={`text-[11px] font-black uppercase tracking-[0.15em] ${titleColor}`}>{title}</h4>
                        </div>
                        <div className="space-y-5">
                            {entries.map((ts, idx) => {
                                const { hours, qty, distance } = calculateTimesheetData(ts, schedule.fromDate);
                                const emp = initialData.employees?.find((e: any) => e.value === ts.employee);
                                return (
                                    <div key={idx} className="bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm relative overflow-hidden group active:bg-slate-50/50 transition-all">
                                        <div className="flex items-center justify-between mb-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-sm font-black text-slate-500 overflow-hidden ring-4 ring-slate-50 shadow-inner shrink-0">
                                                    {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : (ts.employee?.[0] || 'U').toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[15px] font-black text-slate-900 tracking-tight truncate">{emp?.label || ts.employee}</p>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        {ts.dumpWashout && (
                                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-teal-50 rounded-lg text-teal-700 border border-teal-100">
                                                                <Droplets size={10} className="text-teal-600" />
                                                                <span className="text-[8px] font-black uppercase">Washout {qty > 1 && `x${qty}`}</span>
                                                            </div>
                                                        )}
                                                        {ts.shopTime && (
                                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 rounded-lg text-amber-700 border border-amber-100">
                                                                <Warehouse size={10} className="text-amber-600" />
                                                                <span className="text-[8px] font-black uppercase">Shop {qty > 1 && `x${qty}`}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end shrink-0">
                                                <div className="text-[18px] font-black text-[#0F4C75] tracking-tighter">
                                                    {hours.toFixed(2)} <span className="text-[10px] text-slate-400 font-bold ml-0.5">HRS</span>
                                                </div>
                                                {isDriveTime && distance > 0 && (
                                                    <div className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-1 border border-blue-100/50">
                                                        {distance.toFixed(1)} MI
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-5 border-t border-slate-50">
                                            <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100/30">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{isDriveTime ? 'Start' : 'Clock In'}</p>
                                                <div className="flex items-center gap-2 text-[13px] font-black text-slate-800">
                                                    <div className={`w-2 h-2 rounded-full ${isDriveTime ? 'bg-blue-500' : 'bg-emerald-500'} shadow-sm`} />
                                                    {formatTimeOnly(ts.clockIn)}
                                                </div>
                                            </div>
                                            <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100/30">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{isDriveTime ? 'Finish' : 'Clock Out'}</p>
                                                <div className="flex items-center gap-2 text-[13px] font-black text-slate-800">
                                                    <div className={`w-2 h-2 rounded-full ${ts.clockOut ? 'bg-rose-500' : 'bg-slate-300'} shadow-sm`} />
                                                    {ts.clockOut ? formatTimeOnly(ts.clockOut) : 'ACTIVE'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Schedule Details"
            maxWidth="3xl"
            hideHeader={isMobile}
            fullScreenOnMobile={true}
        >
            <div className={`space-y-6 ${isMobile ? 'pb-24 pt-0' : ''}`}>
                {isMobile && (
                    <div className="flex items-center px-4 pt-[env(safe-area-inset-top,20px)] pb-4 bg-white sticky top-0 z-[60] border-b border-slate-50 shadow-sm">
                        <button 
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onClose();
                            }}
                            className="p-3 -ml-3 hover:bg-slate-100 rounded-full transition-colors active:scale-90"
                        >
                            <ArrowLeft className="w-6 h-6 text-slate-700" />
                        </button>
                    </div>
                )}

                <div className={`${isMobile ? 'px-4' : ''}`}>
                    {!isMobile ? (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-[#E6EEF8] shadow-sm flex items-center justify-center text-[#0F4C75] font-black text-xl">
                                    {(schedule.item || schedule.service || 'S').substring(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-2xl font-black text-[#0F4C75] leading-tight truncate">{getCustomerName()}</h2>
                                    <p className="text-sm font-bold text-slate-500 flex items-center gap-1.5 mt-1">
                                        <MapPin size={14} className="text-rose-500" />
                                        {getJobLocation()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <Badge variant="info" className="px-3 py-1 bg-[#E6EEF8] text-[#0F4C75] border-none font-bold">
                                    {schedule.estimate || 'No Estimate'}
                                </Badge>
                                <div className="text-xs font-bold text-slate-400 flex items-center gap-2">
                                    <Calendar size={12} />
                                    {toUTCDate(schedule.fromDate)?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-5">
                            <div className="flex flex-col items-center gap-3">
                                {(() => {
                                    const tagConstant = initialData.constants?.find((c: any) => c.description === schedule.item);
                                    const tagImage = tagConstant?.image;
                                    const tagColor = tagConstant?.color;
                                    const tagLabel = schedule.item || schedule.service || 'S';

                                    if (tagImage) {
                                        return (
                                            <div className="w-14 h-14 shrink-0 rounded-full overflow-hidden shadow-lg border-2 border-white ring-1 ring-slate-100">
                                                <img src={tagImage} alt={tagLabel} className="w-full h-full object-cover" />
                                            </div>
                                        );
                                    } else if (tagColor) {
                                        return (
                                            <div
                                                className="w-14 h-14 shrink-0 rounded-full shadow-inner flex items-center justify-center text-white font-black text-xs ring-1 ring-slate-100"
                                                style={{ backgroundColor: tagColor }}
                                            >
                                                {tagLabel.substring(0, 2).toUpperCase()}
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div className="w-14 h-14 shrink-0 rounded-full bg-[#E6EEF8] border-2 border-white ring-1 ring-blue-100 flex items-center justify-center text-[#0F4C75] font-black text-xs shadow-sm">
                                                {tagLabel.substring(0, 2).toUpperCase()}
                                            </div>
                                        );
                                    }
                                })()}
                                <h2 className="text-xl font-black text-[#0F4C75] leading-tight px-2">
                                    {getCustomerName()}
                                </h2>
                            </div>
                            <div className="text-[13px] font-bold text-slate-500 flex items-center justify-center gap-2 px-4">
                                <MapPin size={14} className="text-rose-500 shrink-0" />
                                <span className="line-clamp-1">{getJobLocation()}</span>
                            </div>
                            <div className="px-2">
                                <h3 className="text-[22px] font-black text-slate-900 leading-[1.1] tracking-tight">
                                    {schedule.title}
                                </h3>
                            </div>
                            <div className="flex flex-col items-center gap-3 w-full pt-5 border-t border-slate-50">
                                <div className="flex flex-wrap justify-center gap-2">
                                    <span className="text-[11px] font-black text-[#0F4C75] bg-[#E6EEF8] px-4 py-2 rounded-2xl shadow-sm border border-blue-100/50">
                                        {schedule.estimate || 'No Estimate'}
                                    </span>
                                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 uppercase tracking-tight bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100/50">
                                        <Calendar size={13} className="text-[#0F4C75]" />
                                        {toUTCDate(schedule.fromDate)?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 uppercase tracking-tight bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100/50 shadow-sm">
                                    <Clock size={14} className="text-[#0F4C75]" />
                                    {formatTimeOnly(schedule.fromDate)} - {formatTimeOnly(schedule.toDate)}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 ${isMobile ? 'px-4' : 'px-2'}`}>
                    <div className="space-y-6">
                        {!isMobile && (
                            <div>
                                <h3 className="text-lg font-black text-slate-800 mb-2 truncate">{schedule.title}</h3>
                                <div className="hidden md:flex items-center gap-3 text-[14px] font-bold text-slate-500 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm md:shadow-none">
                                    <Clock size={16} className="text-[#0F4C75]" />
                                    <span className="flex items-center gap-2">
                                        {formatTimeOnly(schedule.fromDate)}
                                        <span className="text-slate-300">~</span>
                                        {formatTimeOnly(schedule.toDate)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {isMobile ? (
                            <div className="p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm space-y-8">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em]">Participants</h4>
                                    <span className="text-[#0F4C75] bg-[#E6EEF8] px-3 py-1.5 rounded-full text-[10px] font-black shadow-sm">
                                        {((schedule.assignees || []).length + (schedule.projectManager ? 1 : 0) + (schedule.foremanName ? 1 : 0))} TOTAL
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-6 pb-6 border-b border-slate-50">
                                    {[
                                        { label: 'Project Manager', email: schedule.projectManager, color: 'bg-blue-600', role: 'P' },
                                        { label: 'Foreman', email: schedule.foremanName, color: 'bg-[#0F4C75]', role: 'F' }
                                    ].map((person, idx) => {
                                        if (!person.email) return null;
                                        const emp = initialData.employees?.find((e: any) => e.value === person.email);
                                        return (
                                            <div key={idx} className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 ${person.color} overflow-hidden shadow-md ring-4 ring-white`}>
                                                    {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : person.role}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[13px] font-black text-slate-900 leading-tight">
                                                        {emp?.label?.split(' ')[0] || person.email.split('@')[0]}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">{person.label}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">Field Technicians</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {(schedule.assignees || []).map((email, i) => {
                                            const emp = initialData.employees?.find((e: any) => e.value === email);
                                            return (
                                                <div key={i} className="flex items-center gap-3 p-2.5 bg-[#F8FAFC] rounded-2xl border border-slate-100/50 shadow-sm">
                                                    <div className="w-8 h-8 rounded-full bg-white shadow-sm overflow-hidden flex items-center justify-center text-[11px] font-black text-slate-500 shrink-0 border border-slate-100">
                                                        {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : email[0].toUpperCase()}
                                                    </div>
                                                    <span className="text-[12px] font-black text-slate-800 truncate">{emp?.label?.split(' ')[0] || email.split('@')[0]}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: 'Project Manager', email: schedule.projectManager, color: 'bg-blue-600', role: 'P' },
                                        { label: 'Foreman', email: schedule.foremanName, color: 'bg-[#0F4C75]', role: 'F' }
                                    ].map((person, idx) => {
                                        if (!person.email) return null;
                                        const emp = initialData.employees?.find((e: any) => e.value === person.email);
                                        return (
                                            <div key={idx} className="p-3.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">{person.label}</p>
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${person.color} overflow-hidden shadow-inner`}>
                                                        {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : person.role}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-black text-slate-800 truncate">{emp?.label?.split(' ')[0] || person.email.split('@')[0]}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between">
                                        <span>Field Technicians</span>
                                        <span className="text-[#0F4C75] bg-blue-50 px-2 py-0.5 rounded-full">{schedule.assignees?.length || 0}</span>
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {(schedule.assignees || []).map((email, i) => {
                                            const emp = initialData.employees?.find((e: any) => e.value === email);
                                            return (
                                                <div key={i} className="inline-flex items-center gap-2 pl-1 pr-3 py-1 bg-white rounded-full border border-slate-100 shadow-sm">
                                                    <div className="w-5 h-5 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
                                                        {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : email[0].toUpperCase()}
                                                    </div>
                                                    <span className="text-[11px] font-bold text-slate-600">{emp?.label || email.split('@')[0]}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Notify', active: schedule.notifyAssignees },
                                { label: 'Per Diem', active: schedule.perDiem },
                                { label: 'Payroll', active: schedule.certifiedPayroll },
                                { label: 'JHA', active: schedule.hasJHA }
                            ].map((flag, idx) => (
                                <div key={idx} className="flex flex-col gap-1.5">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{flag.label}</span>
                                    <div className={`px-3 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 transition-all ${flag.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${flag.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                                        {flag.active ? 'YES' : 'NO'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-6">
                        {schedule.description && (
                            <div className="p-4 md:p-5 bg-[#F8FAFC] rounded-3xl md:rounded-2xl border border-slate-100 shadow-sm md:shadow-none">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-100 rounded-lg">
                                        <ClipboardList size={14} className="text-blue-600" />
                                    </div>
                                    Scope of Work
                                </h4>
                                <div className="text-[13px] md:text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                                    {schedule.description.split('\n').map((line, i) => (
                                        <div key={i} className="mb-1 flex items-start gap-2">
                                            <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                                            {line}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {schedule.todayObjectives && schedule.todayObjectives.length > 0 && (
                            <div className={`${isMobile ? 'pb-4' : ''}`}>
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Today's Objectives</h4>
                                <div className="space-y-2.5">
                                    {schedule.todayObjectives.map((obj, i) => (
                                        <div key={i} className="flex items-start gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-slate-200">
                                            {obj.completed ? (
                                                <div className="p-0.5 bg-emerald-100 rounded-full">
                                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                                </div>
                                            ) : (
                                                <Circle className="w-6 h-6 text-slate-200 shrink-0" />
                                            )}
                                            <span className={`text-[13px] font-bold leading-tight ${obj.completed ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                                                {obj.text}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            {schedule.aerialImage && (
                                <button 
                                    onClick={() => onOpenMedia('image', schedule.aerialImage!, 'Aerial View')}
                                    className="relative group h-32 md:h-24 rounded-2xl overflow-hidden border-2 border-white shadow-md transition-transform active:scale-95"
                                >
                                    <img src={schedule.aerialImage} className="w-full h-full object-cover" alt="Aerial" />
                                </button>
                            )}
                            {schedule.siteLayout && (
                                <button 
                                    onClick={() => onOpenMedia('map', schedule.siteLayout!, 'Site Layout')}
                                    className="relative group h-32 md:h-24 rounded-2xl overflow-hidden border-2 border-white shadow-md transition-transform active:scale-95 flex items-center justify-center bg-sky-50"
                                >
                                    <MapPin size={24} className="text-sky-500" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {schedule.timesheet && schedule.timesheet.length > 0 && (
                    <div className={`mt-10 border-t border-slate-100 pt-10 ${isMobile ? 'px-4' : ''}`}>
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black text-[#0F4C75] tracking-tight">Time Card</h3>
                            <div className="px-4 py-1.5 bg-slate-100 rounded-full text-[10px] font-black text-slate-600 shadow-sm">
                                {schedule.timesheet.length} ENTRIES
                            </div>
                        </div>
                        <div className="space-y-4">
                            {renderTable(siteTimeEntries, 'Site Work Time', <Calendar size={isMobile ? 18 : 14} />, 'text-emerald-600')}
                            {renderTable(driveTimeEntries, 'Drive & Shop Time', <Car size={isMobile ? 18 : 14} />, 'text-blue-600', true)}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
