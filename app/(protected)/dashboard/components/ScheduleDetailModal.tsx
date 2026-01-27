'use client';

import React from 'react';
import { 
    X, Calendar, Clock, MapPin, User, Shield, ShieldCheck, 
    FilePlus, FileCheck, Car, Droplets, Warehouse, Circle, 
    CheckCircle2, ExternalLink, Mail, Phone, Info, ClipboardList
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

export const ScheduleDetailModal = ({ isOpen, onClose, schedule, initialData, onOpenMedia }: ScheduleDetailModalProps) => {
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
        // First check the schedule's direct jobLocation field
        if (schedule.jobLocation && schedule.jobLocation !== 'Job Location TBD') {
            return schedule.jobLocation;
        }
        // Fallback: check the linked estimate's jobAddress
        if (schedule.estimate && initialData.estimates) {
            const est = initialData.estimates.find((e: any) => e.value === schedule.estimate);
            if (est?.jobAddress) {
                return est.jobAddress;
            }
        }
        return 'Job Location TBD';
    };

    const formatTimeOnly = (dateStr?: string) => {
        if (!dateStr) return '--:--';
        try {
            const d = new Date(dateStr);
            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
        } catch { return '--:--'; }
    };

    const calculateTimesheetData = (ts: any, scheduleDate: string) => {
        try {
            const qty = ts.qty || 1;
            // If hours is explicitly provided (Quick Timesheet or edited), use it
            if (ts.hours !== undefined && ts.hours !== null) {
                return { hours: Number(ts.hours), distance: Number(ts.distance || 0), qty };
            }

            const cin = new Date(ts.clockIn);
            const cout = ts.clockOut ? new Date(ts.clockOut) : null;
            let hours = 0;
            if (cout) {
                hours = (cout.getTime() - cin.getTime()) / (1000 * 60 * 60);
            }
            
            let distance = 0;
            if (ts.locationIn && ts.locationOut && typeof ts.locationIn === 'string' && ts.locationIn.includes(',')) {
                const [lat1, lon1] = ts.locationIn.split(',').map(Number);
                const [lat2, lon2] = ts.locationOut.split(',').map(Number);
                
                const R = 3958.8; // Miles
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

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Schedule Details"
            maxWidth="3xl"
        >
            <div className="space-y-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-[#E6EEF8] shadow-sm flex items-center justify-center text-[#0F4C75] font-black text-xl">
                            {(schedule.item || schedule.service || 'S').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-[#0F4C75] leading-tight">{getCustomerName()}</h2>
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
                            {new Date(schedule.fromDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-2">
                    {/* Left Column - Info */}
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-black text-slate-800 mb-2">{schedule.title}</h3>
                            <div className="flex items-center gap-3 text-sm font-bold text-slate-500 bg-white p-3 rounded-xl border border-slate-100">
                                <Clock size={16} className="text-[#0F4C75]" />
                                <span>{formatTimeOnly(schedule.fromDate)}</span>
                                <span className="text-slate-300">~</span>
                                <span>{formatTimeOnly(schedule.toDate)}</span>
                            </div>
                        </div>

                        {/* Personnel */}
                        <div className="grid grid-cols-2 gap-4">
                             {[
                                { label: 'Project Manager', email: schedule.projectManager, color: 'bg-blue-600', role: 'P' },
                                { label: 'Foreman', email: schedule.foremanName, color: 'bg-emerald-600', role: 'F' }
                            ].map((person, idx) => {
                                if (!person.email) return null;
                                const emp = initialData.employees?.find((e: any) => e.value === person.email);
                                return (
                                    <div key={idx} className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">{person.label}</p>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${person.color} overflow-hidden`}>
                                                {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : person.role}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-slate-700 truncate">{emp?.label || person.email}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Assignees */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Field Technicians</p>
                            <div className="flex flex-wrap gap-2">
                                {(schedule.assignees || []).map((email, i) => {
                                    const emp = initialData.employees?.find((e: any) => e.value === email);
                                    return (
                                        <div key={i} className="inline-flex items-center gap-2 pl-1 pr-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0">
                                                {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : email[0].toUpperCase()}
                                            </div>
                                            <span className="text-xs font-bold text-slate-600">{emp?.label || email.split('@')[0]}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Flags */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Notify', active: schedule.notifyAssignees },
                                { label: 'Per Diem', active: schedule.perDiem },
                                { label: 'Payroll', active: schedule.certifiedPayroll },
                                { label: 'JHA', active: schedule.hasJHA }
                            ].map((flag, idx) => (
                                <div key={idx} className="flex flex-col gap-1">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{flag.label}</span>
                                    <div className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center justify-center gap-1.5 ${flag.active ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${flag.active ? 'bg-green-500' : 'bg-slate-300'}`} />
                                        {flag.active ? 'YES' : 'NO'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Column - Work Details */}
                    <div className="space-y-6">
                        {/* Scope of Work */}
                        {schedule.description && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <ClipboardList size={12} />
                                    Scope of Work
                                </h4>
                                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{schedule.description}</p>
                            </div>
                        )}

                        {/* Today's Objectives */}
                        {schedule.todayObjectives && schedule.todayObjectives.length > 0 && (
                            <div>
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Today's Objectives</h4>
                                <div className="space-y-2">
                                    {schedule.todayObjectives.map((obj, i) => (
                                        <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                            {obj.completed ? (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                            ) : (
                                                <Circle className="w-5 h-5 text-slate-200 shrink-0" />
                                            )}
                                            <span className={`text-xs font-medium ${obj.completed ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                                                {obj.text}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Media Section */}
                        <div className="grid grid-cols-2 gap-4">
                            {schedule.aerialImage && (
                                <button 
                                    onClick={() => onOpenMedia('image', schedule.aerialImage!, 'Aerial View')}
                                    className="relative group h-24 rounded-xl overflow-hidden border border-slate-200"
                                >
                                    <img src={schedule.aerialImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Aerial" />
                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ExternalLink size={20} className="text-white" />
                                    </div>
                                </button>
                            )}
                            {schedule.siteLayout && (
                                <button 
                                    onClick={() => onOpenMedia('map', schedule.siteLayout!, 'Site Layout')}
                                    className="relative group h-24 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center bg-sky-50"
                                >
                                    <MapPin size={24} className="text-sky-500" />
                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ExternalLink size={20} className="text-white" />
                                    </div>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Timesheets Section */}
                {schedule.timesheet && schedule.timesheet.length > 0 && (
                    <div className="mt-8 border-t border-slate-100 pt-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-[#0F4C75]">Timesheet Records</h3>
                            <Badge className="bg-slate-100 text-slate-500 border-none font-bold px-3 py-1">
                                {schedule.timesheet.length} Total Entries
                            </Badge>
                        </div>
                        
                        {(() => {
                            const driveTimeEntries = schedule.timesheet.filter(ts => {
                                const t = (ts.type || '').toLowerCase().trim();
                                const isShop = ts.shopTime === 'Yes' || ts.shopTime === 'true' || ts.shopTime === true;
                                return t === 'drive time' || t === 'shop time' || isShop;
                            });
                            const siteTimeEntries = schedule.timesheet.filter(ts => !driveTimeEntries.includes(ts));

                            const renderTable = (entries: any[], title: string, icon: React.ReactNode, titleColor: string, isDriveTime: boolean = false) => {
                                if (entries.length === 0) return null;
                                return (
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
                                                                            {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : ts.employee[0].toUpperCase()}
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
                                );
                            };

                            return (
                                <div className="space-y-2">
                                    {renderTable(siteTimeEntries, 'Site Work Time', <Calendar size={14} />, 'text-emerald-600')}
                                    {renderTable(driveTimeEntries, 'Drive & Shop Time', <Car size={14} />, 'text-blue-600', true)}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </Modal>
    );
};
