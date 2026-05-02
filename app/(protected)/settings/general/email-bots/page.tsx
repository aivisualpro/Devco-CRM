'use client';

import { cld } from '@/lib/cld';
import Image from 'next/image';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Plus, Save, MessageSquare, FileText, ToggleLeft, ToggleRight, Variable, Info, ChevronDown, Sparkles, Settings2, X, Search, Users, Check, Mail, Send, Clock, Bot, Zap, CheckCircle2, AlertCircle, CalendarPlus, Bell, CheckSquare } from 'lucide-react';
import BotCards from './BotCards';
import { Header } from '@/components/ui';
import { AppContext, useAppSettings } from '@/lib/context/AppContext';
import { useContext } from 'react';
import { useAllEmployees } from '@/lib/hooks/api';

/* ─── Types ─── */
interface ConstantItem {
    _id: string;
    type: string;
    value: string;
    templateId?: string;
    description?: string;
}

interface CustomizationItem {
    _id: string;
    key: string;
    label: string;
    category: string;
    template: string;
    enabled: boolean;
    variables: string[];
}

/* ─── Variable Chip Component ─── */
function VariableChip({ name, onClick }: { name: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-violet-50 to-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-lg text-xs font-mono font-bold 
                       hover:from-violet-100 hover:to-indigo-100 hover:border-indigo-300 hover:shadow-sm
                       active:scale-95 transition-all cursor-pointer select-none group"
            title={`Click to insert {{${name}}}`}
        >
            <span className="text-indigo-400 group-hover:text-indigo-500 transition-colors">{'{{'}</span>
            <span>{name}</span>
            <span className="text-indigo-400 group-hover:text-indigo-500 transition-colors">{'}}'}</span>
        </button>
    );
}

/* ─── SMS Template Editor ─── */
function TemplateEditor({ item, onSave }: { item: CustomizationItem; onSave: (updated: CustomizationItem) => void }) {
    const [template, setTemplate] = useState(item.template);
    const [enabled, setEnabled] = useState(item.enabled);
    const [saving, setSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Keep in sync with parent
    useEffect(() => {
        setTemplate(item.template);
        setEnabled(item.enabled);
    }, [item]);

    const insertVariable = useCallback((varName: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = template;
        const insertion = `{{${varName}}}`;
        const newText = text.substring(0, start) + insertion + text.substring(end);
        setTemplate(newText);

        // Restore cursor position after insertion
        setTimeout(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
        }, 0);
    }, [template]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/customizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update',
                    payload: { _id: item._id, template, enabled }
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Template saved');
                onSave({ ...item, template, enabled });
            } else {
                toast.error('Failed to save');
            }
        } catch {
            toast.error('Error saving template');
        } finally {
            setSaving(false);
        }
    };

    // Highlight {{variables}} in preview
    const renderPreview = () => {
        if (!template) return <span className="text-slate-400 italic">No template defined</span>;
        const parts = template.split(/(\{\{\w+\}\})/g);
        return parts.map((part, i) => {
            if (/^\{\{\w+\}\}$/.test(part)) {
                const varName = part.replace(/[{}]/g, '');
                return (
                    <span key={i} className="inline-flex items-center px-1.5 py-0.5 mx-0.5 bg-indigo-100 text-indigo-700 rounded font-mono text-[11px] font-bold border border-indigo-200/50">
                        {varName}
                    </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    const categoryIcon = item.category === 'sms' ? (
        <MessageSquare className="w-4 h-4" />
    ) : (
        <FileText className="w-4 h-4" />
    );

    const categoryLabel = item.category === 'sms' ? 'SMS' : item.category === 'email' ? 'Email' : item.category;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                        {categoryIcon}
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800">{item.label}</h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{categoryLabel} Template</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Enable/Disable Toggle */}
                    <button
                        type="button"
                        onClick={() => setEnabled(!enabled)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${enabled
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-400 border border-slate-200 hover:bg-slate-200'
                            }`}
                    >
                        {enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        {enabled ? 'Enabled' : 'Disabled'}
                    </button>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-1.5 bg-[#1A1A1A] text-white rounded-lg text-xs font-bold hover:bg-black transition-all shadow-sm disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                    </button>
                </div>
            </div>

            <div className="p-6 space-y-5">
                {/* Available Variables */}
                <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Available Variables</span>
                        <span className="text-[10px] text-slate-400 italic ml-1">(click to insert)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {item.variables.map((v) => (
                            <VariableChip key={v} name={v} onClick={() => insertVariable(v)} />
                        ))}
                    </div>
                </div>

                {/* Template Editor */}
                <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Message Template</label>
                    <textarea
                        ref={textareaRef}
                        value={template}
                        onChange={(e) => setTemplate(e.target.value)}
                        rows={4}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 font-mono leading-relaxed
                                   focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 focus:bg-white transition-all 
                                   resize-y placeholder:text-slate-400"
                        placeholder="Type your message template here... Use {{variableName}} for dynamic content."
                    />
                </div>

                {/* Live Preview */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Preview</span>
                    </div>
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200/60 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed min-h-[60px]">
                        {renderPreview()}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ─── */
export default function EmailBotsSettings() {
    const activeTab = 'emailBot' as string;
    const [constants, setConstants] = useState<ConstantItem[]>([]);
    const [customizations, setCustomizations] = useState<CustomizationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [custLoading, setCustLoading] = useState(false);

    // ─── Workflow Settings State ───
    const { employees } = useAllEmployees();
    const [billingTicketAssignees, setBillingTicketAssignees] = useState<string[]>([]);
    const [workflowLoading, setWorkflowLoading] = useState(false);
    const [workflowSaving, setWorkflowSaving] = useState(false);
    const [assigneeSearch, setAssigneeSearch] = useState('');
    const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);

    const appContext = useContext(AppContext);
    const settings: Record<string, any> = appContext?.settings || {};
    const refreshSettings = appContext?.refreshSettings || (async () => {});

    // ─── Email Bot State ───
    const [emailBotLoading, setEmailBotLoading] = useState(true);
    const [emailBotSaving, setEmailBotSaving] = useState(false);
    const [emailBotSending, setEmailBotSending] = useState(false);
    const [emailBotRecipients, setEmailBotRecipients] = useState<string[]>([]);
    const [showForceSendModal, setShowForceSendModal] = useState(false);
    const [forceSendDate, setForceSendDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [emailBotSubject, setEmailBotSubject] = useState('Everyday Summary Report');
    const [emailBotFromName, setEmailBotFromName] = useState('DEVCO Notifications');
    const [emailBotBody, setEmailBotBody] = useState('Hi Team,\n\nPlease find below the daily summary report for today\'s operations.\n\nBest regards,\nDEVCO CRM');
    const [emailBotTime, setEmailBotTime] = useState('23');
    const [emailBotEnabled, setEmailBotEnabled] = useState(true);
    const [emailBotLastSent, setEmailBotLastSent] = useState<string | null>(null);
    const [emailBotLastStats, setEmailBotLastStats] = useState<any>(null);
    const [emailBotSearch, setEmailBotSearch] = useState('');
    const [isEmailBotDropdownOpen, setIsEmailBotDropdownOpen] = useState(false);
    const emailBotDropdownRef = useRef<HTMLDivElement>(null);
    const [emailBotSubTab, setEmailBotSubTab] = useState<'dailySummary' | 'scheduleAlert' | 'taskAlert' | 'chatAlert' | 'dayOffAlert' | 'estimateAlert'>('dailySummary');


    // ─── Estimate Alert State ───
    const [estimateAlertEnabled, setEstimateAlertEnabled] = useState(true);
    const [estimateAlertFromName, setEstimateAlertFromName] = useState('DEVCO Notifications');
    const [estimateAlertSaving, setEstimateAlertSaving] = useState(false);
    const [estimateAlertRecipients, setEstimateAlertRecipients] = useState<string[]>([]);
    const [estimateAlertSearch, setEstimateAlertSearch] = useState('');
    const [estimateAlertStatuses, setEstimateAlertStatuses] = useState<string[]>(['Pending', 'Approved']);
    const [isEstimateAlertDropdownOpen, setIsEstimateAlertDropdownOpen] = useState(false);
    const estimateAlertDropdownRef = useRef<HTMLDivElement>(null);
    const [availableEstimateStatuses, setAvailableEstimateStatuses] = useState<string[]>([]);

    useEffect(() => {
        const fetchEstimateStatuses = async () => {
            try {
                const res = await fetch(`/api/constants?types=Estimate Status`);
                const data = await res.json();
                if (data.success) {
                    const statuses = data.result.map((item: any) => item.value || item.description).filter(Boolean);
                    setAvailableEstimateStatuses(Array.from(new Set(statuses)));
                }
            } catch (error) {
                console.error('Failed to fetch estimate statuses', error);
            }
        };
        fetchEstimateStatuses();
    }, []);

    // ─── Schedule Alert State ───
    const [schedAlertEnabled, setSchedAlertEnabled] = useState(true);
    const [schedAlertFromName, setSchedAlertFromName] = useState('DEVCO Notifications');
    const [schedAlertSaving, setSchedAlertSaving] = useState(false);
    const [schedAlertRecipients, setSchedAlertRecipients] = useState<string[]>([]);
    const [schedAlertSearch, setSchedAlertSearch] = useState('');
    const [isSchedAlertDropdownOpen, setIsSchedAlertDropdownOpen] = useState(false);
    const schedAlertDropdownRef = useRef<HTMLDivElement>(null);

    // ─── Task Alert State ───
    const [taskAlertEnabled, setTaskAlertEnabled] = useState(true);
    const [taskAlertFromName, setTaskAlertFromName] = useState('DEVCO Notifications');
    const [taskAlertSaving, setTaskAlertSaving] = useState(false);

    // ─── Chat Alert State ───
    const [chatAlertEnabled, setChatAlertEnabled] = useState(true);
    const [chatAlertFromName, setChatAlertFromName] = useState('DEVCO Notifications');
    const [chatAlertSaving, setChatAlertSaving] = useState(false);

    // ─── Day Off Alert State ───
    const [dayOffAlertEnabled, setDayOffAlertEnabled] = useState(true);
    const [dayOffAlertFromName, setDayOffAlertFromName] = useState('DEVCO Notifications');
    const [dayOffAlertSaving, setDayOffAlertSaving] = useState(false);
    const [dayOffAlertRecipients, setDayOffAlertRecipients] = useState<string[]>([]);
    const [dayOffAlertSearch, setDayOffAlertSearch] = useState('');
    const [isDayOffAlertDropdownOpen, setIsDayOffAlertDropdownOpen] = useState(false);
    const dayOffAlertDropdownRef = useRef<HTMLDivElement>(null);

    const assigneeDropdownRef = useRef<HTMLDivElement>(null);

    // Types to manage
    const DOC_TYPES = ['Releases', 'Prelims', 'Certified Payroll Reports'];

    const fetchConstants = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/constants?types=${DOC_TYPES.join(',')}`);
            const data = await res.json();
            if (data.success) {
                const mapped = data.result.map((item: any) => ({
                    ...item,
                    value: item.value || item.description || ''
                }));
                setConstants(mapped);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomizations = async () => {
        setCustLoading(true);
        try {
            const res = await fetch('/api/customizations');
            const data = await res.json();
            if (data.success) {
                setCustomizations(data.result);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load customizations');
        } finally {
            setCustLoading(false);
        }
    };

    useEffect(() => {
        fetchConstants();
    }, []);

    const fetchWorkflowSettings = useCallback(async () => {
        setWorkflowLoading(true);
        try {
            if (settings['billingTicketAssignees']) {
                setBillingTicketAssignees(settings['billingTicketAssignees']);
            } else {
                setBillingTicketAssignees(['dt@devco-inc.com', 'rosa@devco-inc.com']);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setWorkflowLoading(false);
        }
    }, [settings]);

    const fetchEmailBotSettings = useCallback(async () => {
        setEmailBotLoading(true);
        try {
            const res = await fetch('/api/email-bot');
            const data = await res.json();
            if (data.success && data.result) {
                const cfg = data.result;
                if (cfg.recipients) setEmailBotRecipients(cfg.recipients);
                if (cfg.subject) setEmailBotSubject(cfg.subject);
                if (cfg.fromName) setEmailBotFromName(cfg.fromName);
                if (cfg.body) setEmailBotBody(cfg.body);
                if (cfg.time) setEmailBotTime(cfg.time);
                if (cfg.enabled !== undefined) setEmailBotEnabled(cfg.enabled);
                if (cfg.lastSent) setEmailBotLastSent(cfg.lastSent);
                if (cfg.lastStats) setEmailBotLastStats(cfg.lastStats);
            }

            if (settings['emailBot_scheduleAlert']) {
                const acfg = settings['emailBot_scheduleAlert'];
                if (acfg.enabled !== undefined) setSchedAlertEnabled(acfg.enabled);
                if (acfg.fromName) setSchedAlertFromName(acfg.fromName);
                if (acfg.recipients) setSchedAlertRecipients(acfg.recipients);
            }
            if (settings['emailBot_taskAlert']) {
                const acfg = settings['emailBot_taskAlert'];
                if (acfg.enabled !== undefined) setTaskAlertEnabled(acfg.enabled);
                if (acfg.fromName) setTaskAlertFromName(acfg.fromName);
            }
            if (settings['emailBot_chatAlert']) {
                const acfg = settings['emailBot_chatAlert'];
                if (acfg.enabled !== undefined) setChatAlertEnabled(acfg.enabled);
                if (acfg.fromName) setChatAlertFromName(acfg.fromName);
            }
            if (settings['emailBot_dayOffAlert']) {
                const acfg = settings['emailBot_dayOffAlert'];
                if (acfg.enabled !== undefined) setDayOffAlertEnabled(acfg.enabled);
                if (acfg.fromName) setDayOffAlertFromName(acfg.fromName);
                if (acfg.recipients) setDayOffAlertRecipients(acfg.recipients);
            }
            if (settings['emailBot_estimateAlert']) {
                const acfg = settings['emailBot_estimateAlert'];
                if (acfg.enabled !== undefined) setEstimateAlertEnabled(acfg.enabled);
                if (acfg.fromName) setEstimateAlertFromName(acfg.fromName);
                if (acfg.recipients) setEstimateAlertRecipients(acfg.recipients);
                if (acfg.statuses) setEstimateAlertStatuses(acfg.statuses);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setEmailBotLoading(false);
        }
    }, [settings]);

    const handleSaveEmailBot = async () => {
        setEmailBotSaving(true);
        try {
            const res = await fetch('/api/email-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'saveSettings',
                    settings: {
                        recipients: emailBotRecipients,
                        subject: emailBotSubject,
                        fromName: emailBotFromName,
                        body: emailBotBody,
                        time: emailBotTime,
                        enabled: emailBotEnabled,
                        lastSent: emailBotLastSent,
                        lastStats: emailBotLastStats
                    }
                })
            });
            const data = await res.json();
            if (data.success) toast.success('Email bot settings saved!');
            else toast.error('Failed to save settings');
        } catch (err) {
            toast.error('Error saving email bot settings');
        } finally {
            setEmailBotSaving(false);
        }
    };

    const handleSaveScheduleAlert = async () => {
        setSchedAlertSaving(true);
        try {
            const res = await fetch('/api/app-settings/all', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: {
                        emailBot_scheduleAlert: {
                            enabled: schedAlertEnabled,
                            fromName: schedAlertFromName,
                            recipients: schedAlertRecipients
                        }
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Schedule alert saved!');
            } else toast.error('Failed to save settings');
        } catch (err) {
            toast.error('Error saving schedule alert settings');
        } finally {
            setSchedAlertSaving(false);
        }
    };

    const handleSaveTaskAlert = async () => {
        setTaskAlertSaving(true);
        try {
            const res = await fetch('/api/app-settings/all', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: {
                        emailBot_taskAlert: {
                            enabled: taskAlertEnabled,
                            fromName: taskAlertFromName
                        }
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Task alert saved!');
            } else toast.error('Failed to save settings');
        } catch (err) {
            toast.error('Error saving task alert settings');
        } finally {
            setTaskAlertSaving(false);
        }
    };

    const handleSaveChatAlert = async () => {
        setChatAlertSaving(true);
        try {
            const res = await fetch('/api/app-settings/all', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: {
                        emailBot_chatAlert: {
                            enabled: chatAlertEnabled,
                            fromName: chatAlertFromName
                        }
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Chat alert saved!');
            } else toast.error('Failed to save settings');
        } catch (err) {
            toast.error('Error saving chat alert settings');
        } finally {
            setChatAlertSaving(false);
        }
    };

    const handleSaveDayOffAlert = async () => {
        setDayOffAlertSaving(true);
        try {
            const res = await fetch('/api/app-settings/all', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: {
                        emailBot_dayOffAlert: {
                            enabled: dayOffAlertEnabled,
                            fromName: dayOffAlertFromName,
                            recipients: dayOffAlertRecipients
                        }
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Day off alert saved!');
            } else toast.error('Failed to save settings');
        } catch (err) {
            toast.error('Error saving day off alert settings');
        } finally {
            setDayOffAlertSaving(false);
        }
    };

    const handleSaveEstimateAlert = async () => {
        setEstimateAlertSaving(true);
        try {
            const res = await fetch('/api/app-settings/all', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: {
                        emailBot_estimateAlert: {
                            enabled: estimateAlertEnabled,
                            fromName: estimateAlertFromName,
                            recipients: estimateAlertRecipients,
                            statuses: estimateAlertStatuses
                        }
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Estimate alert saved!');
            } else toast.error('Failed to save settings');
        } catch (err) {
            toast.error('Error saving estimate alert settings');
        } finally {
            setEstimateAlertSaving(false);
        }
    };

    const toggleEstimateAlertRecipient = (email: string) => {
        setEstimateAlertRecipients(prev =>
            prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
        );
    };

    const toggleEstimateAlertStatus = (status: string) => {
        setEstimateAlertStatuses(prev =>
            prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
        );
    };

    const filteredEstimateAlertEmployees = useMemo(() => {
        const activeEmps = employees.filter((e: any) => e.status !== 'Inactive' && e.status !== 'Terminated');
        if (!estimateAlertSearch.trim()) return activeEmps;
        const q = estimateAlertSearch.toLowerCase();
        return activeEmps.filter((e: any) =>
            (e.label || '').toLowerCase().includes(q) ||
            (e.firstName || '').toLowerCase().includes(q) ||
            (e.lastName || '').toLowerCase().includes(q) ||
            (e.email || e.value || '').toLowerCase().includes(q)
        );
    }, [employees, estimateAlertSearch]);

    const executeForceSend = async (targetDate?: string) => {
        setEmailBotSending(true);
        try {
            // Save first to ensure latest config is used
            await fetch('/api/email-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'saveSettings',
                    settings: {
                        recipients: emailBotRecipients,
                        subject: emailBotSubject,
                        fromName: emailBotFromName,
                        body: emailBotBody,
                        time: emailBotTime,
                        enabled: emailBotEnabled
                    }
                })
            });

            const res = await fetch('/api/email-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sendNow', date: targetDate })

            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Daily summary sent to ${emailBotRecipients.length} recipients!`);
                setEmailBotLastSent(new Date().toISOString());
                if (data.stats) setEmailBotLastStats(data.stats);
            } else {
                toast.error(data.error || 'Failed to send email');
            }
        } catch (err) {
            toast.error('Error sending email');
        } finally {
            setEmailBotSending(false);
        }
    };

    const handleForceSend = () => {
        console.log("Force Send clicked!");
        setShowForceSendModal(true);
    };

    const toggleEmailBotRecipient = (email: string) => {
        setEmailBotRecipients(prev =>
            prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
        );
    };

    const filteredEmailBotEmployees = useMemo(() => {
        const activeEmps = employees.filter((e: any) => e.status !== 'Inactive' && e.status !== 'Terminated');
        if (!emailBotSearch.trim()) return activeEmps;
        const q = emailBotSearch.toLowerCase();
        return activeEmps.filter((e: any) =>
            (e.label || '').toLowerCase().includes(q) ||
            (e.firstName || '').toLowerCase().includes(q) ||
            (e.lastName || '').toLowerCase().includes(q) ||
            (e.email || e.value || '').toLowerCase().includes(q)
        );
    }, [employees, emailBotSearch]);

    const toggleSchedAlertRecipient = (email: string) => {
        setSchedAlertRecipients(prev =>
            prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
        );
    };

    const filteredSchedAlertEmployees = useMemo(() => {
        const activeEmps = employees.filter((e: any) => e.status !== 'Inactive' && e.status !== 'Terminated');
        if (!schedAlertSearch.trim()) return activeEmps;
        const q = schedAlertSearch.toLowerCase();
        return activeEmps.filter((e: any) =>
            (e.label || '').toLowerCase().includes(q) ||
            (e.firstName || '').toLowerCase().includes(q) ||
            (e.lastName || '').toLowerCase().includes(q) ||
            (e.email || e.value || '').toLowerCase().includes(q)
        );
    }, [employees, schedAlertSearch]);

    const toggleDayOffAlertRecipient = (email: string) => {
        setDayOffAlertRecipients(prev =>
            prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
        );
    };

    const filteredDayOffAlertEmployees = useMemo(() => {
        const activeEmps = employees.filter((e: any) => e.status !== 'Inactive' && e.status !== 'Terminated');
        if (!dayOffAlertSearch.trim()) return activeEmps;
        const q = dayOffAlertSearch.toLowerCase();
        return activeEmps.filter((e: any) =>
            (e.label || '').toLowerCase().includes(q) ||
            (e.firstName || '').toLowerCase().includes(q) ||
            (e.lastName || '').toLowerCase().includes(q) ||
            (e.email || e.value || '').toLowerCase().includes(q)
        );
    }, [employees, dayOffAlertSearch]);

    useEffect(() => {
        if (activeTab === 'workflow') {
            fetchWorkflowSettings();
        }
        if (activeTab === 'emailBot') {
            fetchEmailBotSettings();
        }
    }, [activeTab, fetchEmailBotSettings]);

    // Close email bot dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (emailBotDropdownRef.current && !emailBotDropdownRef.current.contains(e.target as Node)) {
                setIsEmailBotDropdownOpen(false);
            }
            if (dayOffAlertDropdownRef.current && !dayOffAlertDropdownRef.current.contains(e.target as Node)) {
                setIsDayOffAlertDropdownOpen(false);
            }
            if (schedAlertDropdownRef.current && !schedAlertDropdownRef.current.contains(e.target as Node)) {
                setIsSchedAlertDropdownOpen(false);
            }
            if (estimateAlertDropdownRef.current && !estimateAlertDropdownRef.current.contains(e.target as Node)) {
                setIsEstimateAlertDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) {
                setIsAssigneeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredEmployees = useMemo(() => {
        const activeEmps = employees.filter((e: any) => e.status !== 'Inactive' && e.status !== 'Terminated');
        if (!assigneeSearch.trim()) return activeEmps;
        const q = assigneeSearch.toLowerCase();
        return activeEmps.filter((e: any) =>
            (e.label || '').toLowerCase().includes(q) ||
            (e.firstName || '').toLowerCase().includes(q) ||
            (e.lastName || '').toLowerCase().includes(q) ||
            (e.email || e.value || '').toLowerCase().includes(q)
        );
    }, [employees, assigneeSearch]);

    const toggleAssignee = (email: string) => {
        setBillingTicketAssignees(prev =>
            prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
        );
    };

    const handleSaveWorkflowSettings = async () => {
        setWorkflowSaving(true);
        try {
            const res = await fetch('/api/app-settings/all', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: {
                        billingTicketAssignees: billingTicketAssignees
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Workflow settings saved');
                await refreshSettings();
            } else {
                toast.error('Failed to save settings');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error saving settings');
        } finally {
            setWorkflowSaving(false);
        }
    };

    // Lazy-load customizations when tab is activated
    useEffect(() => {
        if (activeTab === 'customizations' && customizations.length === 0) {
            fetchCustomizations();
        }
    }, [activeTab]);

    const handleChange = (id: string, field: keyof ConstantItem, value: string) => {
        setConstants(prev => prev.map(c => c._id === id ? { ...c, [field]: value } : c));
    };

    const handleSave = async (item: ConstantItem) => {
        try {
            const res = await fetch('/api/constants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update',
                    payload: item
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Saved');
            } else {
                toast.error('Failed to save');
            }
        } catch (e) {
            toast.error('Error saving');
        }
    };

    const handleAddItem = async (type: string) => {
        const newItem = {
            type,
            value: 'New Document',
            templateId: ''
        };
        try {
            const res = await fetch('/api/constants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    payload: newItem
                })
            });
            const data = await res.json();
            if (data.success) {
                setConstants(prev => [...prev, data.result]);
                toast.success('Added new item');
            }
        } catch (e) {
            toast.error('Error adding item');
        }
    };

    const handleCustomizationSave = (updated: CustomizationItem) => {
        setCustomizations(prev => prev.map(c => c._id === updated._id ? updated : c));
    };

    const tabs = [
        { id: 'docIds', label: 'Estimate Document Ids', icon: <FileText className="w-3.5 h-3.5" /> },
        { id: 'customizations', label: 'Customizations', icon: <Sparkles className="w-3.5 h-3.5" /> },
        { id: 'workflow', label: 'Workflow Settings', icon: <Settings2 className="w-3.5 h-3.5" /> },
        { id: 'emailBot', label: 'Email Bot', icon: <Bot className="w-3.5 h-3.5" /> },
    ];

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1">
                <div className="w-full space-y-6">
                    
                    {/* ─── Tab: Document IDs ─── */}
                    {activeTab === 'docIds' && (
                        loading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                            </div>
                        ) : (
                            <div className="space-y-12 pb-20">
                                {DOC_TYPES.map(type => (
                                    <div key={type} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-xl font-black text-slate-700">{type}</h2>
                                            <button
                                                onClick={() => handleAddItem(type)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-bold transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Add {type.slice(0, -1)}
                                            </button>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                            <table className="w-full text-left table-fixed">
                                                <thead className="bg-slate-50 border-b border-slate-100">
                                                    <tr>
                                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-1/3">Name</th>
                                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Google Doc Template ID</th>
                                                        <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 text-right"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {constants.filter(c => c.type === type).length > 0 ? (
                                                        constants.filter(c => c.type === type).map(item => (
                                                            <tr key={item._id} className="hover:bg-slate-50/50 transition-colors group">
                                                                <td className="px-6 py-3">
                                                                    <input 
                                                                        type="text" 
                                                                        value={item.value}
                                                                        placeholder="Document Name"
                                                                        onChange={(e) => handleChange(item._id, 'value', e.target.value)}
                                                                        className="w-full bg-transparent font-bold text-slate-700 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 rounded px-2 py-1 -ml-2 transition-all placeholder:text-slate-300"
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-3">
                                                                    <input 
                                                                        type="text" 
                                                                        value={item.templateId || ''}
                                                                        placeholder="Enter Google Doc ID..."
                                                                        onChange={(e) => handleChange(item._id, 'templateId', e.target.value)}
                                                                        className="w-full bg-transparent font-mono text-xs text-slate-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 rounded px-2 py-1 -ml-2 transition-all"
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-3 text-right">
                                                                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button 
                                                                            onClick={() => handleSave(item)}
                                                                            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                                            title="Save"
                                                                        >
                                                                            <Save className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={3} className="px-6 py-8 text-center text-slate-400 text-sm font-medium italic">
                                                                No documents found. Add a new one to get started.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {/* ─── Tab: Customizations ─── */}
                    {activeTab === 'customizations' && (
                        custLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                            </div>
                        ) : (
                            <div className="space-y-6 pb-20">
                                {/* Description */}
                                <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-indigo-50/50 to-violet-50/30 rounded-xl border border-indigo-100/50">
                                    <Info className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">Notification Templates</p>
                                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                            Customize the messages sent to employees via SMS. Click on any variable chip to insert it into your template. 
                                            Variables will be replaced with actual values when the notification is sent.
                                        </p>
                                    </div>
                                </div>

                                {/* Template editors */}
                                {customizations.length > 0 ? (
                                    customizations.map(item => (
                                        <TemplateEditor
                                            key={item._id}
                                            item={item}
                                            onSave={handleCustomizationSave}
                                        />
                                    ))
                                ) : (
                                    <div className="text-center py-16">
                                        <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                        <p className="text-sm text-slate-400 font-medium">No customizations found.</p>
                                        <p className="text-xs text-slate-300 mt-1">They will be created automatically when you first use the SMS feature.</p>
                                    </div>
                                )}
                            </div>
                        )
                    )}

                    {/* ─── Tab: Workflow Settings ─── */}
                    {activeTab === 'workflow' && (
                        workflowLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                            </div>
                        ) : (
                            <div className="space-y-6 pb-20">
                                {/* Info */}
                                <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-blue-50/50 to-cyan-50/30 rounded-xl border border-blue-100/50">
                                    <Settings2 className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">Workflow Automation Settings</p>
                                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                            Configure automatic task creation and assignment rules. Changes will apply to all future billing tickets created across the application.
                                        </p>
                                    </div>
                                </div>

                                {/* Billing Ticket Assignees Card */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Card Header */}
                                    <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
                                                <Users className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-slate-800">Billing Ticket Task Assignees</h3>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auto-assign when a new billing ticket is created</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleSaveWorkflowSettings}
                                            disabled={workflowSaving}
                                            className="flex items-center gap-2 px-4 py-1.5 bg-[#1A1A1A] text-white rounded-lg text-xs font-bold hover:bg-black transition-all shadow-sm disabled:opacity-50"
                                        >
                                            {workflowSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                            Save
                                        </button>
                                    </div>

                                    <div className="p-6 space-y-4">
                                        {/* Selected Assignees */}
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Selected Assignees ({billingTicketAssignees.length})</label>
                                            <div className="flex flex-wrap gap-2 min-h-[36px]">
                                                {billingTicketAssignees.length === 0 && (
                                                    <span className="text-xs text-slate-400 italic py-1">No assignees selected. Tasks will not be assigned to anyone.</span>
                                                )}
                                                {billingTicketAssignees.map(email => {
                                                    const emp = employees.find((e: any) => (e.email || e.value || '').toLowerCase() === email.toLowerCase());
                                                    const name = emp?.label || emp?.firstName ? `${emp.firstName} ${emp.lastName || ''}`.trim() : email;
                                                    return (
                                                        <span
                                                            key={email}
                                                            className="relative inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold group hover:bg-blue-100 transition-colors"
                                                        >
                                                            {emp?.image || emp?.profilePicture ? (
                                                                <div className="relative w-5 h-5 rounded-full overflow-hidden"><Image fill sizes="(max-width: 768px) 100vw, 33vw" alt="" src={cld(emp.image || emp.profilePicture, { w: 128, q: 'auto' })} className="rounded-full object-cover border border-blue-200 w-full h-full" /></div>
                                                            ) : (
                                                                <div className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-[9px] font-black">
                                                                    {name[0]?.toUpperCase()}
                                                                </div>
                                                            )}
                                                            {name}
                                                            <button
                                                                onClick={() => toggleAssignee(email)}
                                                                className="ml-0.5 p-0.5 rounded-full hover:bg-blue-200 text-blue-400 hover:text-blue-700 transition-colors"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Add Assignee Dropdown */}
                                        <div className="relative" ref={assigneeDropdownRef}>
                                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Add Employees</label>
                                            <div
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm cursor-pointer hover:border-blue-300 transition-all flex items-center justify-between"
                                                onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                                            >
                                                <span className="text-slate-400">Search and add employees...</span>
                                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isAssigneeDropdownOpen ? 'rotate-180' : ''}`} />
                                            </div>

                                            {isAssigneeDropdownOpen && (
                                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[300px] overflow-hidden">
                                                    <div className="p-2 border-b border-slate-100">
                                                        <div className="relative">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                            <input
                                                                type="text"
                                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                                                placeholder="Search employees..."
                                                                value={assigneeSearch}
                                                                onChange={(e) => setAssigneeSearch(e.target.value)}
                                                                autoFocus
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="overflow-y-auto max-h-[230px]">
                                                        {filteredEmployees.length === 0 ? (
                                                            <div className="p-4 text-xs text-slate-400 text-center">No employees found</div>
                                                        ) : (
                                                            filteredEmployees.map((emp: any) => {
                                                                const email = emp.email || emp.value || '';
                                                                const name = emp.label || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || email;
                                                                const isSelected = billingTicketAssignees.includes(email);
                                                                return (
                                                                    <button
                                                                        key={email}
                                                                        className={`relative w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                                                                            isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'
                                                                        }`}
                                                                        onClick={(e) => { e.stopPropagation(); toggleAssignee(email); }}
                                                                    >
                                                                        {emp.image || emp.profilePicture ? (
                                                                            <div className="relative w-7 h-7 rounded-full overflow-hidden"><Image fill sizes="(max-width: 768px) 100vw, 33vw" alt="" src={cld(emp.image || emp.profilePicture, { w: 128, q: 'auto' })} className="rounded-full object-cover border border-slate-200 w-full h-full" /></div>
                                                                        ) : (
                                                                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200">
                                                                                {name[0]?.toUpperCase()}
                                                                            </div>
                                                                        )}
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="font-medium truncate">{name}</p>
                                                                            <p className="text-[10px] text-slate-400 truncate">{email}</p>
                                                                        </div>
                                                                        {isSelected && (
                                                                            <Check className="w-4 h-4 text-blue-500 shrink-0" />
                                                                        )}
                                                                    </button>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                    {/* ─── Tab: Email Bot ─── */}
                    {activeTab === 'emailBot' && (
                        emailBotLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                            </div>
                        ) : (
                            <div className="space-y-6 pb-20">

                                <BotCards
                                    employees={employees}
                                    emailBotEnabled={emailBotEnabled} setEmailBotEnabled={setEmailBotEnabled}
                                    emailBotRecipients={emailBotRecipients} toggleEmailBotRecipient={toggleEmailBotRecipient}
                                    emailBotSubject={emailBotSubject} setEmailBotSubject={setEmailBotSubject}
                                    emailBotFromName={emailBotFromName} setEmailBotFromName={setEmailBotFromName}
                                    emailBotBody={emailBotBody} setEmailBotBody={setEmailBotBody}
                                    emailBotTime={emailBotTime} setEmailBotTime={setEmailBotTime}
                                    emailBotSaving={emailBotSaving} handleSaveEmailBot={handleSaveEmailBot}
                                    emailBotSending={emailBotSending} handleForceSend={handleForceSend}
                                    emailBotLastSent={emailBotLastSent} emailBotLastStats={emailBotLastStats}
                                    showForceSendModal={showForceSendModal} setShowForceSendModal={setShowForceSendModal}
                                    forceSendDate={forceSendDate} setForceSendDate={setForceSendDate}
                                    executeForceSend={executeForceSend}
                                    schedAlertEnabled={schedAlertEnabled} setSchedAlertEnabled={setSchedAlertEnabled}
                                    schedAlertFromName={schedAlertFromName} setSchedAlertFromName={setSchedAlertFromName}
                                    schedAlertRecipients={schedAlertRecipients} toggleSchedAlertRecipient={toggleSchedAlertRecipient}
                                    schedAlertSaving={schedAlertSaving} handleSaveScheduleAlert={handleSaveScheduleAlert}
                                    taskAlertEnabled={taskAlertEnabled} setTaskAlertEnabled={setTaskAlertEnabled}
                                    taskAlertFromName={taskAlertFromName} setTaskAlertFromName={setTaskAlertFromName}
                                    taskAlertSaving={taskAlertSaving} handleSaveTaskAlert={handleSaveTaskAlert}
                                    chatAlertEnabled={chatAlertEnabled} setChatAlertEnabled={setChatAlertEnabled}
                                    chatAlertFromName={chatAlertFromName} setChatAlertFromName={setChatAlertFromName}
                                    chatAlertSaving={chatAlertSaving} handleSaveChatAlert={handleSaveChatAlert}
                                    dayOffAlertEnabled={dayOffAlertEnabled} setDayOffAlertEnabled={setDayOffAlertEnabled}
                                    dayOffAlertFromName={dayOffAlertFromName} setDayOffAlertFromName={setDayOffAlertFromName}
                                    dayOffAlertRecipients={dayOffAlertRecipients} toggleDayOffAlertRecipient={toggleDayOffAlertRecipient}
                                    dayOffAlertSaving={dayOffAlertSaving} handleSaveDayOffAlert={handleSaveDayOffAlert}
                                    estimateAlertEnabled={estimateAlertEnabled} setEstimateAlertEnabled={setEstimateAlertEnabled}
                                    estimateAlertFromName={estimateAlertFromName} setEstimateAlertFromName={setEstimateAlertFromName}
                                    estimateAlertRecipients={estimateAlertRecipients} toggleEstimateAlertRecipient={toggleEstimateAlertRecipient}
                                    estimateAlertStatuses={estimateAlertStatuses} toggleEstimateAlertStatus={toggleEstimateAlertStatus}
                                    availableEstimateStatuses={availableEstimateStatuses}
                                    estimateAlertSaving={estimateAlertSaving} handleSaveEstimateAlert={handleSaveEstimateAlert}
                                />
                            </div>
                        )
                    )}
                </div>
            </div>


            {/* Force Send Date Modal */}
            {showForceSendModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div 
                        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-violet-50/50 to-pink-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                                    <Zap className="w-4 h-4 text-violet-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base">Send Summary Now</h3>
                                    <p className="text-[11px] font-semibold text-violet-500 uppercase tracking-wider">Manual Override</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowForceSendModal(false)}
                                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-600">
                                This will generate and email the daily summary report to <strong className="text-slate-800">{emailBotRecipients.length} recipient{emailBotRecipients.length !== 1 ? 's' : ''}</strong> immediately.
                            </p>
                            
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest block">Report Date</label>
                                <input 
                                    type="date"
                                    value={forceSendDate}
                                    onChange={(e) => setForceSendDate(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all"
                                />
                                <p className="text-[10px] text-slate-400">Select the date you want to pull data for.</p>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowForceSendModal(false)}
                                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowForceSendModal(false);
                                    executeForceSend(forceSendDate);
                                }}
                                disabled={emailBotSending}
                                className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700 rounded-xl transition-all shadow-md shadow-violet-200 flex items-center gap-2 disabled:opacity-50"
                            >
                                {emailBotSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                Send Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
