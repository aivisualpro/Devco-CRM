'use client';

import React, { useState, useEffect } from 'react';
import { 
    X, Calendar, Clock, MapPin, User, Users, FileText, 
    CheckCircle2, AlertCircle, Phone, Mail, Building2, 
    Droplets, Warehouse, Car, Info, ClipboardList,
    ArrowLeft, ChevronRight, ExternalLink, Image as ImageIcon,
    FileCheck, Briefcase, MessageSquare
} from 'lucide-react';
import { Modal, Badge, Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/ui';
import { EstimateChat } from '@/components/ui/EstimateChat';
import { calculateTimesheetData, formatDateOnly, formatTimeOnly } from '@/lib/timeCardUtils';

export interface ConstantData {
    _id?: string;
    category?: string;
    value?: string;
    color?: string;
}

// Interface matching the Schedule DB Schema + Estimate Context
export interface SchedulePopupData {
    _id: string;
    title: string;
    fromDate: string | Date;
    toDate: string | Date;
    customerId?: string;
    customerName?: string;
    estimate?: string;
    jobLocation?: string;
    projectManager?: string;
    foremanName?: string;
    assignees?: string[];
    description?: string;
    service?: string;
    item?: string;
    fringe?: string | boolean;
    certifiedPayroll?: string | boolean; 
    notifyAssignees?: string | boolean;
    perDiem?: string | boolean;
    aerialImage?: string;
    siteLayout?: string;
    timesheet?: any[];
    todayObjectives?: any[];
    hasJHA?: boolean;
    hasDJT?: boolean;
    jobPlanningDocs?: any[]; // From Estimate
    // Context
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    projectName?: string;
}

interface ScheduleDetailsPopupProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: SchedulePopupData | null;
    employees?: any[];
    constants?: any[]; // Passed for service colors
    onToggleObjective?: (scheduleId: string, objectiveIndex: number, currentStatus: boolean) => void;
    currentUserEmail?: string;
}

// Local helpers replaced by robust utils
const formatDate = (d: string | Date | undefined) => {
    // Keep this for header display (e.g. "Mon, Jan 1") as it's different format than the table
     if (!d) return '-';
    try {
        const date = new Date(d);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch { return String(d); }
};

const formatTimeHeader = (d: string | Date | undefined) => {
    // Keep this for header display
    if (!d) return '--:--';
    try {
        const date = new Date(d);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch { return String(d); }
};

export const ScheduleDetailsPopup: React.FC<ScheduleDetailsPopupProps> = ({
    isOpen,
    onClose,
    schedule,
    employees = [],
    constants = [],
    onToggleObjective,
    currentUserEmail
}) => {
    const [isMobile, setIsMobile] = useState(false);
    const [activeTab, setActiveTab] = useState<'aerial' | 'planning' | 'timecard' | 'chat'>('aerial');

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (!schedule) return null;

    const resolveEmployee = (emailOrId: string | undefined) => {
        if (!emailOrId) return null;
        return employees.find(e => e.value === emailOrId || e.email === emailOrId) || { label: emailOrId, image: null };
    };

    const projectManager = resolveEmployee(schedule.projectManager);
    const foreman = resolveEmployee(schedule.foremanName);
    const technicians = (schedule.assignees || []).map(resolveEmployee).filter(Boolean);

    // Timesheet Filters
    const myTimesheet = schedule.timesheet?.filter(ts => {
        if (!currentUserEmail) return true; // Fallback if no user context
        return (ts.employee || '').toLowerCase() === currentUserEmail.toLowerCase();
    }) || [];

    const driveTimeEntries = myTimesheet.filter(ts => {
        const type = (ts.type || '').toLowerCase();
        return type.includes('drive') || type.includes('shop') || ts.shopTime === 'Yes';
    });
    
    const siteTimeEntries = myTimesheet.filter(ts => {
        const type = (ts.type || '').toLowerCase();
        return !type.includes('drive') && !type.includes('shop') && ts.shopTime !== 'Yes';
    });

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Schedule Details"
            maxWidth="4xl"
            hideHeader={isMobile}
            fullScreenOnMobile={true}
        >
            <div className={`flex flex-col h-full md:h-auto ${isMobile ? 'bg-slate-50' : 'bg-white'}`}>
                
                {/* Mobile Header */}
                {isMobile && (
                    <div className="flex items-center px-4 pt-[env(safe-area-inset-top,20px)] pb-4 bg-white sticky top-0 z-[60] border-b border-slate-100 shadow-sm">
                        <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-50 rounded-full text-slate-600">
                            <ArrowLeft size={24} />
                        </button>
                        <h2 className="flex-1 text-center text-lg font-bold text-[#0F4C75]">Schedule Details</h2>
                        <div className="w-8" />
                    </div>
                )}

                <div className={`${isMobile ? 'pb-24 overflow-y-auto' : ''}`}>
                    <div className="p-6 space-y-6">
                        
                        {/* ROW 1: Item Image | Customer | Location */}
                        <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0 text-slate-400 overflow-hidden">
                                {(() => {
                                    const constantImg = constants.find(c => c.value === schedule.item && (c.category === 'Item' || c.category === 'Service'))?.image;
                                    if (constantImg) return <img src={constantImg} alt={schedule.item} className="w-full h-full object-cover" />;
                                    if (schedule.item && schedule.item.toLowerCase().includes('drill')) return <img src="/icons/drill.png" alt="Drill" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />;
                                    return <Briefcase size={32} className="text-slate-400" />;
                                })()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl md:text-2xl font-black text-slate-800 truncate">
                                    {schedule.customerName || 'Unknown Customer'}
                                </h2>
                                <div className="flex items-center gap-1.5 text-slate-500 font-medium text-sm mt-1">
                                    <MapPin size={14} className="text-rose-500" />
                                    <span className="truncate">{schedule.jobLocation || 'No location provided'}</span>
                                </div>
                            </div>
                        </div>

                        {/* ROW 2: Title */}
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-[#0F4C75] leading-tight">
                                {schedule.title}
                            </h1>
                        </div>

                        {/* ROW 3: Estimate | Date | Times */}
                        {/* ROW 3: Estimate | Date | Times */}
                        <div className="flex flex-wrap items-stretch gap-3 h-9">
                            {schedule.estimate && (
                                <Badge className="bg-slate-100 text-slate-600 border border-slate-200 h-full flex items-center justify-center px-4 rounded-lg text-sm font-bold">
                                    Est: {schedule.estimate}
                                </Badge>
                            )}
                            <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-lg border border-slate-100 h-full">
                                <Calendar size={14} className="text-[#0F4C75]" />
                                <span className="text-sm font-bold text-slate-700">
                                    {formatDate(schedule.fromDate)}
                                    {formatDate(schedule.fromDate) !== formatDate(schedule.toDate) && ` - ${formatDate(schedule.toDate)}`}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-lg border border-slate-100 h-full">
                                <Clock size={14} className="text-slate-500" />
                                <span className="text-sm font-bold text-slate-600">
                                    {formatTimeHeader(schedule.fromDate)} - {formatTimeHeader(schedule.toDate)}
                                </span>
                            </div>
                        </div>

                        {/* ROW 4: People (2 Cols) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            {/* Col 1: PM & Foreman */}
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Project Manager</p>
                                    {projectManager ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs overflow-hidden border border-blue-200">
                                                {projectManager.image ? <img src={projectManager.image} className="w-full h-full object-cover" /> : (projectManager.label?.[0] || 'P')}
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{projectManager.label || schedule.projectManager}</span>
                                        </div>
                                    ) : <span className="text-sm text-slate-400 italic">None assigned</span>}
                                </div>
                                <div className="border-t border-slate-200 pt-4">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Foreman</p>
                                    {foreman ? (
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-[#0F4C75] text-white flex items-center justify-center font-bold text-xs overflow-hidden border border-[#0F4C75]">
                                                {foreman.image ? <img src={foreman.image} className="w-full h-full object-cover" /> : (foreman.label?.[0] || 'F')}
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{foreman.label || schedule.foremanName}</span>
                                        </div>
                                    ) : <span className="text-sm text-slate-400 italic">None assigned</span>}
                                </div>
                            </div>

                            {/* Col 2: Assignees */}
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Assignees ({technicians.length})</p>
                                <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto">
                                    {technicians.length > 0 ? technicians.map((tech: any, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-slate-200">
                                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 overflow-hidden">
                                                {tech.image ? <img src={tech.image} className="w-full h-full object-cover" /> : (tech.label?.[0] || 'T')}
                                            </div>
                                            <span className="text-sm font-medium text-slate-700">{tech.label}</span>
                                        </div>
                                    )) : <span className="text-sm text-slate-400 italic">No technicians assigned</span>}
                                </div>
                            </div>
                        </div>

                        {/* ROW 5: Services */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 text-center md:text-left">Service</p>
                            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                {(schedule.service || schedule.item || 'General Service').split(',').map((srv, idx) => {
                                    const trimmed = srv.trim();
                                    const constant = constants.find(c => c.value === trimmed && (c.category === 'Service' || c.category === 'Item'));
                                    const color = constant?.color || '#0F4C75';
                                    return (
                                        <Badge 
                                            key={idx}
                                            style={{ backgroundColor: `${color}15`, color: color, borderColor: `${color}30` }}
                                            className="border text-sm px-3 py-1"
                                        >
                                            {trimmed}
                                        </Badge>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ROW 6: Scope of Work */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <div className="flex items-center gap-2 mb-2 text-slate-400">
                                <FileText size={16} />
                                <span className="text-xs font-bold uppercase tracking-wider">Scope of Work</span>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {schedule.description || 'No description provided.'}
                            </p>
                        </div>

                        {/* ROW 7: Flags - Improved Logic */}
                        {/* ROW 7: Flags - Display Values */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'FRINGE', val: schedule.fringe },
                                { label: 'CERTIFIED', val: schedule.certifiedPayroll, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
                                { label: 'PER DIEM', val: schedule.perDiem },
                                { label: 'NOTIFY', val: schedule.notifyAssignees }
                            ].map((flag) => {
                                // Determine display value
                                const s = String(flag.val || '').trim();
                                const isFalse = !flag.val || s.toLowerCase() === 'no' || s.toLowerCase() === 'false' || s === '0';
                                
                                let displayVal = 'No';
                                if (!isFalse) {
                                    if (s.toLowerCase() === 'yes' || s.toLowerCase() === 'true' || s === '1') displayVal = 'Yes';
                                    else displayVal = s;
                                }

                                const isActive = !isFalse;
                                
                                return (
                                    <div key={flag.label} className={`
                                        rounded-xl border flex flex-col items-center justify-center p-3 h-20 transition-all text-center
                                        ${isActive ? (flag.color || 'text-slate-800 bg-slate-50 border-slate-300') : 'text-slate-300 border-slate-100 bg-white/50'}
                                    `}>
                                        <span className="text-[10px] font-black uppercase mb-1 opacity-70">{flag.label}</span>
                                        <span className={`text-xs font-bold leading-tight line-clamp-2 ${isActive ? '' : 'text-slate-300'}`}>
                                            {displayVal}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ROW 8: Objectives */}
                        {schedule.todayObjectives && schedule.todayObjectives.length > 0 && (
                            <div className="bg-white p-4 rounded-xl border border-slate-200">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <CheckCircle2 size={14} /> Today's Objectives
                                </h3>
                                <div className="space-y-2">
                                    {schedule.todayObjectives.map((obj: any, i: number) => {
                                        // Guard against null/undefined object
                                        if (!obj) return null;
                                        return (
                                            <div 
                                                key={i} 
                                                className={`flex items-start gap-3 p-2 rounded-lg border transition-colors cursor-pointer ${obj.completed ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                                onClick={() => {
                                                    if (onToggleObjective) {
                                                        onToggleObjective(schedule._id, i, obj.completed);
                                                    }
                                                }}
                                            >
                                                <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${obj.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                                                    {obj.completed && <CheckCircle2 size={10} />}
                                                </div>
                                                <span className={`text-sm select-none ${obj.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                                    {obj.text}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* TABS SECTION */}
                    <div className="mt-2 text-center border-t border-slate-100 sticky top-0 bg-white z-10">
                        <div className="flex justify-center">
                            <div className="flex items-center p-1 bg-slate-100 rounded-lg m-4 self-center">
                                <button 
                                    onClick={() => setActiveTab('aerial')}
                                    className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeTab === 'aerial' ? 'bg-white text-[#0F4C75] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Aerial Layout
                                </button>
                                <button 
                                    onClick={() => setActiveTab('planning')}
                                    className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'planning' ? 'bg-white text-[#0F4C75] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Job Planning
                                    {schedule.jobPlanningDocs?.length ? <span className="bg-slate-200 px-1.5 rounded-full text-[10px]">{schedule.jobPlanningDocs.length}</span> : null}
                                </button>
                                <button 
                                    onClick={() => setActiveTab('timecard')}
                                    className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'timecard' ? 'bg-white text-[#0F4C75] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Time Card
                                    {schedule.timesheet?.length ? <span className="bg-slate-200 px-1.5 rounded-full text-[10px]">{schedule.timesheet.length}</span> : null}
                                </button>
                                <button 
                                    onClick={() => setActiveTab('chat')}
                                    className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'chat' ? 'bg-white text-[#0F4C75] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Chat
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 pb-8 min-h-[300px] bg-slate-50 pt-6">
                        {/* TAB 1: AERIAL LAYOUT */}
                        {activeTab === 'aerial' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Col 1: Aerial Image */}
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                        <ImageIcon size={16} /> Aerial Image
                                    </h4>
                                    {schedule.aerialImage ? (
                                        <div className="aspect-video rounded-lg overflow-hidden border border-slate-100 relative group bg-slate-900">
                                            <img src={schedule.aerialImage} className="w-full h-full object-contain" alt="Aerial" />
                                            <a href={schedule.aerialImage} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ExternalLink className="text-white w-8 h-8" />
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="aspect-video bg-slate-50 rounded-lg flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200">
                                            <ImageIcon size={32} className="mb-2" />
                                            <span className="text-xs font-medium">No aerial image</span>
                                        </div>
                                    )}
                                </div>

                                {/* Col 2: Site Layout */}
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                    <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                        <MapPin size={16} /> Site Layout
                                    </h4>
                                    {schedule.siteLayout ? (
                                        <div className="aspect-video rounded-lg overflow-hidden border border-slate-100 relative group bg-slate-50">
                                            {schedule.siteLayout.includes('earth.google.com') ? (() => {
                                                const coordsMatch = schedule.siteLayout!.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                                                const lat = coordsMatch?.[1];
                                                const lng = coordsMatch?.[2];
                                                const embedUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}&t=k&z=19&ie=UTF8&iwloc=&output=embed` : '';
                                                
                                                return embedUrl ? (
                                                    <iframe
                                                        width="100%"
                                                        height="100%"
                                                        style={{ border: 0 }}
                                                        src={embedUrl}
                                                        allowFullScreen
                                                        title="Site Layout Map"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                                        <MapPin size={32} className="mx-auto text-blue-500 mb-2" />
                                                        <a href={schedule.siteLayout} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 underline truncate max-w-[200px] text-center hover:text-blue-700">
                                                            Open Link
                                                        </a>
                                                    </div>
                                                );
                                            })() : schedule.siteLayout.includes('google.com/maps') ? (
                                                <iframe
                                                    width="100%"
                                                    height="100%"
                                                    style={{ border: 0 }}
                                                    src={schedule.siteLayout}
                                                    allowFullScreen
                                                    title="Site Layout Map"
                                                />
                                            ) : schedule.siteLayout.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                                                <>
                                                    <img src={schedule.siteLayout} className="w-full h-full object-contain" alt="Layout" />
                                                    <a href={schedule.siteLayout} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ExternalLink className="text-white w-8 h-8" />
                                                    </a>
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                                    <MapPin size={32} className="mx-auto text-blue-500 mb-2" />
                                                    <a href={schedule.siteLayout} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 underline truncate max-w-[200px] text-center hover:text-blue-700">
                                                        Open Link
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="aspect-video bg-slate-50 rounded-lg flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200">
                                            <MapPin size={32} className="mb-2" />
                                            <span className="text-xs font-medium">No site layout</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 2: JOB PLANNING DOCS */}
                        {activeTab === 'planning' && (
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-slate-100 bg-slate-50">
                                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <FileCheck size={16} /> Job Planning Documents
                                    </h4>
                                </div>
                                {(schedule.jobPlanningDocs && schedule.jobPlanningDocs.length > 0) ? (
                                    <ul className="divide-y divide-slate-100">
                                        {schedule.jobPlanningDocs.map((doc, i) => (
                                            <li key={i} className="p-4 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h5 className="text-sm font-bold text-slate-800 mb-1">{doc.documentName || 'Untitled Document'}</h5>
                                                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                                            <span className="bg-slate-100 px-2 py-0.5 rounded">Type: {doc.planningType || 'N/A'}</span>
                                                            {doc.usaTicketNo && <span className="bg-slate-100 px-2 py-0.5 rounded">USA#: {doc.usaTicketNo}</span>}
                                                            {doc.activationDate && <span className="bg-slate-100 px-2 py-0.5 rounded">Active: {formatDate(doc.activationDate)}</span>}
                                                            {doc.expirationDate && <span className="bg-slate-100 px-2 py-0.5 rounded">Exp: {formatDate(doc.expirationDate)}</span>}
                                                            {doc.dateSubmitted && <span className="bg-slate-100 px-2 py-0.5 rounded">Sub: {formatDate(doc.dateSubmitted)}</span>}
                                                        </div>
                                                    </div>
                                                    {(doc.documents && doc.documents.length > 0) && (
                                                        <div className="flex flex-col gap-2">
                                                            {doc.documents.map((file: any, fi: number) => (
                                                                <a 
                                                                    key={fi} 
                                                                    href={file.url} 
                                                                    target="_blank" 
                                                                    rel="noreferrer"
                                                                    className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition-colors"
                                                                >
                                                                    <FileText size={12} />
                                                                    View File
                                                                </a>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="p-12 text-center text-slate-400">
                                        <FileText size={48} className="mx-auto mb-3 opacity-20" />
                                        <p className="text-sm font-medium">No job planning documents found.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 3: TIME CARD */}
                        {activeTab === 'timecard' && (
                            <div className="space-y-6">
                                {driveTimeEntries.length > 0 && (
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Car size={16} className="text-blue-500" />
                                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Drive & Shop Time</h3>
                                            </div>
                                            <Badge className="bg-blue-50 text-blue-700 border-blue-100">{driveTimeEntries.length} Entries</Badge>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <Table containerClassName="h-auto min-h-0 !border-none !shadow-none !bg-transparent">
                                                <TableHead>
                                                    <TableRow className="hover:bg-transparent border-slate-100">
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center">Date</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center">Estimate</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center">Washout</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center">Shop</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-right">Dist</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-right">Hrs</TableHeader>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {driveTimeEntries.map((ts: any, i: number) => {
                                                         const { hours, distance } = calculateTimesheetData(ts);
                                                         
                                                         const getQty = (val: any, numericQty?: number) => {
                                                             if (typeof numericQty === 'number' && numericQty > 0) return numericQty;
                                                             const str = String(val || '');
                                                             const match = str.match(/\((\d+)\s+qty\)/);
                                                             if (match) return parseFloat(match[1]);
                                                             if (val === true || str.toLowerCase() === 'true' || str.toLowerCase() === 'yes') return 1;
                                                             return 0;
                                                         };

                                                         const washoutQty = getQty(ts.dumpWashout, ts.dumpQty);
                                                         const shopQty = getQty(ts.shopTime, ts.shopQty);

                                                         return (
                                                            <TableRow key={i} className="hover:bg-slate-50">
                                                                <TableCell className="text-center text-[11px] font-medium text-slate-600">
                                                                    {formatDateOnly(ts.clockIn) || '-'}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <span className="text-[10px] font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 uppercase tracking-tighter">
                                                                        {schedule.estimate ? schedule.estimate.replace(/-[vV]\d+$/, '') : (ts.estimate || '-')}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    {washoutQty > 0 ? (
                                                                        <span className="text-[10px] font-black uppercase bg-orange-500 text-white px-2 py-1 rounded shadow-sm inline-flex flex-col items-center min-w-[70px] justify-center leading-none gap-0.5">
                                                                            <span className="flex items-center gap-1">WASHOUT <CheckCircle2 size={10} /></span>
                                                                            <span className="text-[9px] opacity-90">{washoutQty} QTY</span>
                                                                        </span>
                                                                    ) : <span className="text-slate-300">-</span>}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    {shopQty > 0 ? (
                                                                        <span className="text-[10px] font-black uppercase bg-blue-500 text-white px-2 py-1 rounded shadow-sm inline-flex flex-col items-center min-w-[70px] justify-center leading-none gap-0.5">
                                                                            <span className="flex items-center gap-1">SHOP <CheckCircle2 size={10} /></span>
                                                                            <span className="text-[9px] opacity-90">{shopQty} QTY</span>
                                                                        </span>
                                                                    ) : <span className="text-slate-300">-</span>}
                                                                </TableCell>
                                                                <TableCell className="text-right text-[11px] font-medium text-slate-600">
                                                                    {distance > 0 ? distance.toFixed(1) : '-'}
                                                                </TableCell>
                                                                <TableCell className="text-right text-[11px] font-black text-slate-800">
                                                                    {hours.toFixed(2)}
                                                                </TableCell>
                                                            </TableRow>
                                                         );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )}

                                {siteTimeEntries.length > 0 && (
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <MapPin size={16} className="text-emerald-500" />
                                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Site Time</h3>
                                            </div>
                                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">{siteTimeEntries.length} Entries</Badge>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <Table containerClassName="h-auto min-h-0 !border-none !shadow-none !bg-transparent">
                                                <TableHead>
                                                    <TableRow className="hover:bg-transparent border-slate-100">
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center">Date</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center">Estimate</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center">In</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center">Out</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-right">Hrs</TableHeader>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {siteTimeEntries.map((ts: any, i: number) => {
                                                        const { hours } = calculateTimesheetData(ts);
                                                        return (
                                                            <TableRow key={i} className="hover:bg-slate-50">
                                                                <TableCell className="text-center text-[11px] font-medium text-slate-600">
                                                                    {formatDateOnly(ts.clockIn)}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <span className="text-[10px] font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 uppercase tracking-tighter">
                                                                        {schedule.estimate ? schedule.estimate.replace(/-[vV]\d+$/, '') : '-'}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-center text-[11px] font-medium text-slate-600">
                                                                    {formatTimeOnly(ts.clockIn)}
                                                                </TableCell>
                                                                <TableCell className="text-center text-[11px] font-medium text-slate-600">
                                                                    {formatTimeOnly(ts.clockOut)}
                                                                </TableCell>
                                                                <TableCell className="text-right text-[11px] font-black text-slate-800">
                                                                    {hours.toFixed(2)}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 4: CHAT */}
                        {activeTab === 'chat' && (
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm min-h-[500px]">
                                {schedule.estimate ? (
                                    <EstimateChat 
                                        estimateId={schedule.estimate} 
                                        currentUserEmail={currentUserEmail} 
                                        employees={employees}
                                        height="450px"
                                    />
                                ) : (
                                    <div className="h-[400px] flex flex-col items-center justify-center text-slate-400">
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                            <MessageSquare size={24} className="opacity-50" />
                                        </div>
                                        <p className="text-sm font-medium">No estimate linked to this schedule.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ScheduleDetailsPopup;

