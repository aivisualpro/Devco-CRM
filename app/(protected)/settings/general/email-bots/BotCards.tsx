'use client';
import { cld } from '@/lib/cld';
import Image from 'next/image';
import React, { useState, useRef, useMemo } from 'react';
import { Loader2, Save, ToggleLeft, ToggleRight, X, Search, Users, Check, Mail, Clock, Zap, CheckCircle2, AlertCircle, Bell, CalendarPlus, CheckSquare, MessageSquare, FileText, ChevronDown, Plus } from 'lucide-react';

/* ─── Reusable Employee Dropdown ─── */
function RecipientPicker({ employees, selected, onToggle, accentColor = 'violet' }: { employees: any[]; selected: string[]; onToggle: (e: string) => void; accentColor?: string }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const filtered = useMemo(() => {
        const active = employees.filter((e: any) => e.status !== 'Inactive' && e.status !== 'Terminated');
        if (!search.trim()) return active;
        const q = search.toLowerCase();
        return active.filter((e: any) => (e.label || '').toLowerCase().includes(q) || (e.email || e.value || '').toLowerCase().includes(q));
    }, [employees, search]);

    React.useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Send To ({selected.length})
            </label>
            {/* Avatar row */}
            <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                {selected.length === 0 && <span className="text-[10px] text-slate-400 italic flex items-center gap-1"><AlertCircle className="w-3 h-3" /> No recipients</span>}
                {selected.map(email => {
                    const emp = employees.find((e: any) => (e.email || e.value || '').toLowerCase() === email.toLowerCase());
                    const name = emp?.label || (emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : email);
                    return (
                        <div key={email} className="relative group">
                            {emp?.image || emp?.profilePicture ? (
                                <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-white shadow-sm">
                                    <Image fill sizes="32px" alt={name} src={cld(emp.image || emp.profilePicture, { w: 64, q: 'auto' })} className="rounded-full object-cover w-full h-full" />
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-black ring-2 ring-white shadow-sm">{name[0]?.toUpperCase()}</div>
                            )}
                            <button onClick={() => onToggle(email)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"><X className="w-2.5 h-2.5" /></button>
                        </div>
                    );
                })}
            </div>
            {/* Dropdown */}
            <div className="relative" ref={ref}>
                <div onClick={() => setOpen(!open)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs cursor-pointer hover:border-slate-300 transition-all flex items-center justify-between">
                    <span className="text-slate-400">Add employees...</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                </div>
                {open && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[250px] overflow-hidden">
                        <div className="p-2 border-b border-slate-100"><div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-100" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} autoFocus onClick={e => e.stopPropagation()} />
                        </div></div>
                        <div className="overflow-y-auto max-h-[190px]">
                            {filtered.length === 0 ? <div className="p-3 text-xs text-slate-400 text-center">No employees found</div> : filtered.map((emp: any) => {
                                const email = emp.email || emp.value || '';
                                const name = emp.label || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || email;
                                const sel = selected.includes(email);
                                return (
                                    <button key={email} className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 transition-colors ${sel ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`} onClick={e => { e.stopPropagation(); onToggle(email); }}>
                                        {emp.image || emp.profilePicture ? (
                                            <div className="relative w-6 h-6 rounded-full overflow-hidden"><Image fill sizes="24px" alt="" src={cld(emp.image || emp.profilePicture, { w: 64, q: 'auto' })} className="rounded-full object-cover w-full h-full" /></div>
                                        ) : <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 border border-slate-200">{name[0]?.toUpperCase()}</div>}
                                        <div className="flex-1 min-w-0"><p className="font-medium truncate">{name}</p><p className="text-[9px] text-slate-400 truncate">{email}</p></div>
                                        {sel && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Inline Recipient Picker ─── */
function InlineRecipientPicker({ employees, selected, onToggle }: { employees: any[]; selected: string[]; onToggle: (e: string) => void }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const filtered = useMemo(() => {
        const active = employees.filter((e: any) => e.status !== 'Inactive' && e.status !== 'Terminated');
        if (!search.trim()) return active;
        const q = search.toLowerCase();
        return active.filter((e: any) => (e.label || '').toLowerCase().includes(q) || (e.email || e.value || '').toLowerCase().includes(q));
    }, [employees, search]);

    React.useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button 
                type="button"
                onClick={() => setOpen(!open)} 
                className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 border-dashed text-slate-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center justify-center shadow-sm"
            >
                <Plus className="w-4 h-4" />
            </button>
            {open && (
                <div className="absolute z-50 top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[250px] overflow-hidden">
                    <div className="p-2 border-b border-slate-100"><div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-100" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} autoFocus onClick={e => e.stopPropagation()} />
                    </div></div>
                    <div className="overflow-y-auto max-h-[190px]">
                        {filtered.length === 0 ? <div className="p-3 text-xs text-slate-400 text-center">No employees found</div> : filtered.map((emp: any) => {
                            const email = emp.email || emp.value || '';
                            const name = emp.label || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || email;
                            const sel = selected.includes(email);
                            return (
                                <button key={email} className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 transition-colors ${sel ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`} onClick={e => { e.stopPropagation(); onToggle(email); }}>
                                    {emp.image || emp.profilePicture ? (
                                        <div className="relative w-6 h-6 rounded-full overflow-hidden"><Image fill sizes="24px" alt="" src={cld(emp.image || emp.profilePicture, { w: 64, q: 'auto' })} className="rounded-full object-cover w-full h-full" /></div>
                                    ) : <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 border border-slate-200">{name[0]?.toUpperCase()}</div>}
                                    <div className="flex-1 min-w-0"><p className="font-medium truncate">{name}</p><p className="text-[9px] text-slate-400 truncate">{email}</p></div>
                                    {sel && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Shared input styles ─── */
const inputCls = "w-full bg-slate-50/80 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-200 focus:bg-white transition-all";
const labelCls = "text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1";

/* ─── Modern Card Layout ─── */
function ModernCard({ 
    gradient, icon: Icon, title, trigger, triggerIcon: TriggerIcon = Zap, 
    enabled, onToggle, saving, 
    children, footer 
}: { 
    gradient: string; icon: any; title: string; trigger: string; triggerIcon?: any;
    enabled: boolean; onToggle: () => void; saving?: boolean;
    children: React.ReactNode; footer?: React.ReactNode;
}) {
    return (
        <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient}`} />
            
            {/* Header */}
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-slate-100 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md`}>
                        <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                            {title}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                <TriggerIcon className="w-2.5 h-2.5" /> {trigger}
                            </span>
                        </h3>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 ml-auto">
                    {saving && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                    <button 
                        type="button" 
                        onClick={onToggle} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'}`}
                    >
                        {enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        {enabled ? 'Active' : 'Off'}
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="px-5 py-4 space-y-5 flex-1 flex flex-col">
                {children}
            </div>

            {/* Footer */}
            {footer && (
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                    {footer}
                </div>
            )}
        </div>
    );
}

function useAutoSave(deps: any[], saveFn: () => void) {
    const saveFnRef = React.useRef(saveFn);
    const snapshotRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        saveFnRef.current = saveFn;
    }, [saveFn]);

    const depsString = JSON.stringify(deps);

    React.useEffect(() => {
        // First time seeing this value (mount or data load) — capture as baseline
        if (snapshotRef.current === null) {
            snapshotRef.current = depsString;
            return;
        }
        // Value unchanged from last snapshot — skip
        if (depsString === snapshotRef.current) {
            return;
        }
        // Value genuinely changed — save after debounce
        const timer = setTimeout(() => {
            snapshotRef.current = depsString;
            saveFnRef.current();
        }, 1000);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [depsString]);
}

export interface BotCardsProps {
    employees: any[];
    // Daily Summary
    emailBotEnabled: boolean; setEmailBotEnabled: (v: boolean) => void;
    emailBotRecipients: string[]; toggleEmailBotRecipient: (e: string) => void;
    emailBotSubject: string; setEmailBotSubject: (v: string) => void;
    emailBotFromName: string; setEmailBotFromName: (v: string) => void;
    emailBotBody: string; setEmailBotBody: (v: string) => void;
    emailBotTime: string; setEmailBotTime: (v: string) => void;
    emailBotSaving: boolean; handleSaveEmailBot: () => void;
    emailBotSending: boolean; handleForceSend: () => void;
    emailBotLastSent: string | null; emailBotLastStats: any;
    showForceSendModal: boolean; setShowForceSendModal: (v: boolean) => void;
    forceSendDate: string; setForceSendDate: (v: string) => void;
    executeForceSend: (d?: string) => void;
    // Schedule Alert
    schedAlertEnabled: boolean; setSchedAlertEnabled: (v: boolean) => void;
    schedAlertFromName: string; setSchedAlertFromName: (v: string) => void;
    schedAlertRecipients: string[]; toggleSchedAlertRecipient: (e: string) => void;
    schedAlertSaving: boolean; handleSaveScheduleAlert: () => void;
    // Task Alert
    taskAlertEnabled: boolean; setTaskAlertEnabled: (v: boolean) => void;
    taskAlertFromName: string; setTaskAlertFromName: (v: string) => void;
    taskAlertSaving: boolean; handleSaveTaskAlert: () => void;
    // Chat Alert
    chatAlertEnabled: boolean; setChatAlertEnabled: (v: boolean) => void;
    chatAlertFromName: string; setChatAlertFromName: (v: string) => void;
    chatAlertSaving: boolean; handleSaveChatAlert: () => void;
    // Day Off Alert
    dayOffAlertEnabled: boolean; setDayOffAlertEnabled: (v: boolean) => void;
    dayOffAlertFromName: string; setDayOffAlertFromName: (v: string) => void;
    dayOffAlertRecipients: string[]; toggleDayOffAlertRecipient: (e: string) => void;
    dayOffAlertSaving: boolean; handleSaveDayOffAlert: () => void;
    // Estimate Alert
    estimateAlertEnabled: boolean; setEstimateAlertEnabled: (v: boolean) => void;
    estimateAlertFromName: string; setEstimateAlertFromName: (v: string) => void;
    estimateAlertRecipients: string[]; toggleEstimateAlertRecipient: (e: string) => void;
    estimateAlertStatuses: string[]; toggleEstimateAlertStatus: (s: string) => void;
    availableEstimateStatuses: string[];
    estimateAlertSaving: boolean; handleSaveEstimateAlert: () => void;
}

export default function BotCards(props: BotCardsProps) {
    const { employees } = props;
    const [localForceSendOpen, setLocalForceSendOpen] = React.useState(false);
    const [localForceSendDate, setLocalForceSendDate] = React.useState(() => new Date().toISOString().split('T')[0]);

    // Auto-save hooks
    useAutoSave([props.emailBotEnabled, props.emailBotRecipients, props.emailBotTime, props.emailBotSubject, props.emailBotFromName, props.emailBotBody], props.handleSaveEmailBot);
    useAutoSave([props.schedAlertEnabled, props.schedAlertFromName, props.schedAlertRecipients], props.handleSaveScheduleAlert);
    useAutoSave([props.taskAlertEnabled, props.taskAlertFromName], props.handleSaveTaskAlert);
    useAutoSave([props.chatAlertEnabled, props.chatAlertFromName], props.handleSaveChatAlert);
    useAutoSave([props.dayOffAlertEnabled, props.dayOffAlertFromName, props.dayOffAlertRecipients], props.handleSaveDayOffAlert);
    useAutoSave([props.estimateAlertEnabled, props.estimateAlertFromName, props.estimateAlertRecipients, props.estimateAlertStatuses], props.handleSaveEstimateAlert);

    // Render avatar stack with inline picker
    const renderRecipientList = (selected: string[], onToggle: (e: string) => void) => (
        <div className="flex items-center gap-3 flex-wrap">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                <Users className="w-3.5 h-3.5" /> Send To ({selected.length})
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
                {selected.length === 0 && <span className="text-[10px] text-slate-400 italic flex items-center gap-1"><AlertCircle className="w-3 h-3" /> No recipients</span>}
                {selected.map(email => {
                    const emp = employees.find((e: any) => (e.email || e.value || '').toLowerCase() === email.toLowerCase());
                    const name = emp?.label || (emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : email);
                    return (
                        <div key={email} className="relative group">
                            {emp?.image || emp?.profilePicture ? (
                                <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-white shadow-sm">
                                    <Image fill sizes="32px" alt={name} src={cld(emp.image || emp.profilePicture, { w: 64, q: 'auto' })} className="rounded-full object-cover w-full h-full" />
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-black ring-2 ring-white shadow-sm">{name[0]?.toUpperCase()}</div>
                            )}
                            <button onClick={() => onToggle(email)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"><X className="w-2.5 h-2.5" /></button>
                        </div>
                    );
                })}
                <InlineRecipientPicker employees={employees} selected={selected} onToggle={onToggle} />
            </div>
        </div>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ════ 1. Everyday Summary ════ */}
            <ModernCard
                gradient="from-violet-500 to-pink-600"
                icon={Mail}
                title="Everyday Summary"
                trigger="Scheduled · Daily"
                triggerIcon={Clock}
                enabled={props.emailBotEnabled}
                onToggle={() => props.setEmailBotEnabled(!props.emailBotEnabled)}
                saving={props.emailBotSaving}
                footer={
                    <>
                        <div>
                            {props.emailBotLastSent ? (
                                <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    <p className="text-[11px] font-bold text-slate-600">Last sent: {new Date(props.emailBotLastSent).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })} PST</p>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-slate-400" />
                                    <p className="text-[11px] font-bold text-slate-500">Not sent yet</p>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap mb-0">Schedule Time (PST)</label>
                                <select 
                                    value={props.emailBotTime} 
                                    onChange={e => props.setEmailBotTime(e.target.value)} 
                                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-violet-100 focus:border-violet-200 cursor-pointer shadow-sm"
                                >
                                    {Array.from({ length: 24 }, (_, i) => {
                                        const l = i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`;
                                        return <option key={i} value={String(i)}>{l}</option>;
                                    })}
                                </select>
                            </div>
                            <div className="relative">
                                {!localForceSendOpen ? (
                                    <button onClick={() => setLocalForceSendOpen(true)} disabled={props.emailBotSending || props.emailBotRecipients.length === 0} className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-violet-600 to-pink-600 text-white rounded-lg text-[11px] font-bold hover:from-violet-700 hover:to-pink-700 transition-all shadow-sm disabled:opacity-50 active:scale-[0.97]">
                                        {props.emailBotSending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</> : <><Zap className="w-3.5 h-3.5" /> Send Now</>}
                                    </button>
                                ) : (
                                    <div className="absolute bottom-full right-0 mb-2 p-2 bg-white border border-slate-200 rounded-xl shadow-xl w-48 z-10 flex flex-col gap-2">
                                        <input type="date" value={localForceSendDate} onChange={e => setLocalForceSendDate(e.target.value)} className={inputCls} />
                                        <div className="flex gap-1.5">
                                            <button onClick={() => setLocalForceSendOpen(false)} className="flex-1 px-2 py-1.5 text-[10px] font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all">Cancel</button>
                                            <button onClick={() => { setLocalForceSendOpen(false); props.executeForceSend(localForceSendDate); }} disabled={props.emailBotSending} className="flex-1 px-2 py-1.5 text-[10px] font-bold text-white bg-gradient-to-r from-violet-600 to-pink-600 rounded-lg disabled:opacity-50 flex items-center justify-center gap-1">
                                                {props.emailBotSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Send
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                }
            >
                {renderRecipientList(props.emailBotRecipients, props.toggleEmailBotRecipient)}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>Subject</label>
                        <input type="text" value={props.emailBotSubject} onChange={e => props.setEmailBotSubject(e.target.value)} className={inputCls} placeholder="Subject..." />
                    </div>
                    <div>
                        <label className={labelCls}>From Name</label>
                        <input type="text" value={props.emailBotFromName} onChange={e => props.setEmailBotFromName(e.target.value)} className={inputCls} placeholder="Sender name..." />
                    </div>
                </div>
                <div className="flex flex-col flex-1 min-h-[120px]">
                    <label className={labelCls}>Email Body</label>
                    <textarea value={props.emailBotBody} onChange={e => props.setEmailBotBody(e.target.value)} className={inputCls + ' resize-y flex-1'} placeholder="Intro message..." />
                </div>
            </ModernCard>

            {/* ════ 2. Schedule Alert ════ */}
            <ModernCard
                gradient="from-amber-500 to-orange-600"
                icon={Bell}
                title="Schedule Alert"
                trigger="On Create"
                enabled={props.schedAlertEnabled}
                onToggle={() => props.setSchedAlertEnabled(!props.schedAlertEnabled)}
                saving={props.schedAlertSaving}
                footer={
                    <div>
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <p className="text-[11px] font-bold text-slate-500">Last sent: Not tracked yet <span className="text-slate-400 font-normal">(Schedule #--, Est #--)</span></p>
                        </div>
                    </div>
                }
            >
                <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                        <Users className="w-3.5 h-3.5" /> Send To ({props.schedAlertRecipients.length + 1})
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Check className="w-3 h-3" /> Assigned Employees
                        </span>
                        <div className="w-px h-4 bg-slate-200 mx-1" />
                        {props.schedAlertRecipients.map(email => {
                            const emp = employees.find((e: any) => (e.email || e.value || '').toLowerCase() === email.toLowerCase());
                            const name = emp?.label || (emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : email);
                            return (
                                <div key={email} className="relative group">
                                    {emp?.image || emp?.profilePicture ? (
                                        <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-white shadow-sm">
                                            <Image fill sizes="32px" alt={name} src={cld(emp.image || emp.profilePicture, { w: 64, q: 'auto' })} className="rounded-full object-cover w-full h-full" />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-black ring-2 ring-white shadow-sm">{name[0]?.toUpperCase()}</div>
                                    )}
                                    <button onClick={() => props.toggleSchedAlertRecipient(email)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"><X className="w-2.5 h-2.5" /></button>
                                </div>
                            );
                        })}
                        <InlineRecipientPicker employees={employees} selected={props.schedAlertRecipients} onToggle={props.toggleSchedAlertRecipient} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>From Name</label>
                        <input type="text" value={props.schedAlertFromName} onChange={e => props.setSchedAlertFromName(e.target.value)} className={inputCls} placeholder="Sender name..." />
                    </div>
                    <div>
                        <label className={labelCls}>Subject Line</label>
                        <input type="text" disabled value="[Auto-generated Schedule Title]" className={inputCls + ' opacity-60 cursor-not-allowed bg-slate-100'} />
                    </div>
                </div>
            </ModernCard>

            {/* ════ 3. Task Alert ════ */}
            <ModernCard
                gradient="from-blue-500 to-indigo-600"
                icon={CheckSquare}
                title="Task Alert"
                trigger="On Create"
                enabled={props.taskAlertEnabled}
                onToggle={() => props.setTaskAlertEnabled(!props.taskAlertEnabled)}
                saving={props.taskAlertSaving}
                footer={
                    <div>
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <p className="text-[11px] font-bold text-slate-500">Last sent: Not tracked yet</p>
                        </div>
                    </div>
                }
            >
                <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                        <Users className="w-3.5 h-3.5" /> Send To
                    </label>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <Users className="w-3 h-3" /> Task Assignees
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>From Name</label>
                        <input type="text" value={props.taskAlertFromName} onChange={e => props.setTaskAlertFromName(e.target.value)} className={inputCls} placeholder="Sender name..." />
                    </div>
                    <div>
                        <label className={labelCls}>Subject Line</label>
                        <input type="text" disabled value="New task assigned" className={inputCls + ' opacity-60 cursor-not-allowed bg-slate-100'} />
                    </div>
                </div>
            </ModernCard>

            {/* ════ 4. Chat Alert ════ */}
            <ModernCard
                gradient="from-emerald-500 to-teal-600"
                icon={MessageSquare}
                title="Chat Alert"
                trigger="On Message"
                enabled={props.chatAlertEnabled}
                onToggle={() => props.setChatAlertEnabled(!props.chatAlertEnabled)}
                saving={props.chatAlertSaving}
                footer={
                    <div>
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <p className="text-[11px] font-bold text-slate-500">Last sent: Not tracked yet</p>
                        </div>
                    </div>
                }
            >
                <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                        <Users className="w-3.5 h-3.5" /> Send To
                    </label>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Users className="w-3 h-3" /> Message Assignees
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>From Name</label>
                        <input type="text" value={props.chatAlertFromName} onChange={e => props.setChatAlertFromName(e.target.value)} className={inputCls} placeholder="Sender name..." />
                    </div>
                    <div>
                        <label className={labelCls}>Subject Line</label>
                        <input type="text" disabled value="New chat message" className={inputCls + ' opacity-60 cursor-not-allowed bg-slate-100'} />
                    </div>
                </div>
            </ModernCard>

            {/* ════ 5. Day Off Alert ════ */}
            <ModernCard
                gradient="from-rose-500 to-red-600"
                icon={CalendarPlus}
                title="Day Off Alert"
                trigger="Item = Day Off"
                enabled={props.dayOffAlertEnabled}
                onToggle={() => props.setDayOffAlertEnabled(!props.dayOffAlertEnabled)}
                saving={props.dayOffAlertSaving}
                footer={
                    <div>
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <p className="text-[11px] font-bold text-slate-500">Last sent: Not tracked yet</p>
                        </div>
                    </div>
                }
            >
                {renderRecipientList(props.dayOffAlertRecipients, props.toggleDayOffAlertRecipient)}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>From Name</label>
                        <input type="text" value={props.dayOffAlertFromName} onChange={e => props.setDayOffAlertFromName(e.target.value)} className={inputCls} placeholder="Sender name..." />
                    </div>
                    <div>
                        <label className={labelCls}>Subject Line</label>
                        <input type="text" disabled value="Day Off Scheduled" className={inputCls + ' opacity-60 cursor-not-allowed bg-slate-100'} />
                    </div>
                </div>
            </ModernCard>

            {/* ════ 6. Estimate Notifications ════ */}
            <ModernCard
                gradient="from-indigo-500 to-blue-600"
                icon={FileText}
                title="Estimate Notifications"
                trigger="Status Change"
                enabled={props.estimateAlertEnabled}
                onToggle={() => props.setEstimateAlertEnabled(!props.estimateAlertEnabled)}
                saving={props.estimateAlertSaving}
                footer={
                    <div>
                        <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <p className="text-[11px] font-bold text-slate-500">Last sent: Not tracked yet</p>
                        </div>
                    </div>
                }
            >
                {renderRecipientList(props.estimateAlertRecipients, props.toggleEstimateAlertRecipient)}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={labelCls}>From Name</label>
                        <input type="text" value={props.estimateAlertFromName} onChange={e => props.setEstimateAlertFromName(e.target.value)} className={inputCls} placeholder="Sender name..." />
                    </div>
                    <div>
                        <label className={labelCls}>Trigger on Statuses</label>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            {props.availableEstimateStatuses.map(status => (
                                <button key={status} onClick={() => props.toggleEstimateAlertStatus(status)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${props.estimateAlertStatuses.includes(status) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                    <div className="flex items-center gap-1.5">{status}{props.estimateAlertStatuses.includes(status) && <Check className="w-3 h-3" />}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </ModernCard>
        </div>
    );
}
