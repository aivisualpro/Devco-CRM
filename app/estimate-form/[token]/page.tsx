'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import {
    Building2, User, Briefcase, Users, Landmark, Shield, Heart, Settings,
    ChevronRight, Check, Loader2, AlertCircle, Send, Sparkles, ArrowRight,
    Phone, Mail, MapPin, FileText
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';

const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

const TABS = [
    { id: 'accounting', label: 'Accounting', icon: Building2, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-500/20', text: 'text-blue-600' },
    { id: 'owner', label: 'Property Owner', icon: User, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-500/20', text: 'text-emerald-600' },
    { id: 'contractor', label: 'Original Contractor', icon: Briefcase, color: 'from-amber-500 to-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-500/20', text: 'text-amber-600' },
    { id: 'subcontractor', label: 'Sub-Contractor', icon: Users, color: 'from-purple-500 to-purple-600', bg: 'bg-purple-50', ring: 'ring-purple-500/20', text: 'text-purple-600' },
    { id: 'lender', label: 'Lending Institution', icon: Landmark, color: 'from-cyan-500 to-cyan-600', bg: 'bg-cyan-50', ring: 'ring-cyan-500/20', text: 'text-cyan-600' },
    { id: 'surety', label: 'Surety Company', icon: Shield, color: 'from-rose-500 to-rose-600', bg: 'bg-rose-50', ring: 'ring-rose-500/20', text: 'text-rose-600' },
    { id: 'fringe', label: 'Fringe Benefits', icon: Heart, color: 'from-pink-500 to-pink-600', bg: 'bg-pink-50', ring: 'ring-pink-500/20', text: 'text-pink-600' },
    { id: 'others', label: 'Others', icon: Settings, color: 'from-slate-500 to-slate-600', bg: 'bg-slate-50', ring: 'ring-slate-500/20', text: 'text-slate-600' }
];

const FIELDS_BY_TAB: Record<string, { key: string; label: string; type?: string; placeholder?: string; span?: number; icon?: any }[]> = {
    accounting: [
        { key: 'accountingContact', label: 'Accounting Contact', icon: User },
        { key: 'accountingEmail', label: 'Accounting Email', type: 'email', icon: Mail },
        { key: 'accountingPhone', label: 'Accounting Phone', icon: Phone },
        { key: 'projectId', label: 'Project ID', icon: FileText }
    ],
    owner: [
        { key: 'poName', label: 'Owner / Agency Name', span: 2, icon: Building2 },
        { key: 'PoAddress', label: 'Address', span: 2, icon: MapPin },
        { key: 'PoPhone', label: 'Phone', icon: Phone }
    ],
    contractor: [
        { key: 'ocName', label: 'Contractor Name', span: 2, icon: Briefcase },
        { key: 'ocPhone', label: 'Phone', icon: Phone },
        { key: 'ocAddress', label: 'Address', span: 3, icon: MapPin },
        { key: 'customerPONo', label: 'Customer PO#', icon: FileText },
        { key: 'workRequestNo', label: 'Work Request#', icon: FileText },
        { key: 'subContractAgreementNo', label: 'Sub Contract Agreement #', icon: FileText },
        { key: 'customerJobNo', label: 'Customer Job#', icon: FileText },
        { key: 'DIRProjectNo', label: 'DIR Project#', icon: FileText }
    ],
    subcontractor: [
        { key: 'subCName', label: 'Sub-Contractor Name', span: 2, icon: Users },
        { key: 'subCAddress', label: 'Address', span: 2, icon: MapPin },
        { key: 'subCPhone', label: 'Phone', icon: Phone }
    ],
    lender: [
        { key: 'liName', label: 'Institution Name', span: 2, icon: Landmark },
        { key: 'liAddress', label: 'Address', span: 2, icon: MapPin },
        { key: 'liPhone', label: 'Phone', icon: Phone }
    ],
    surety: [
        { key: 'scName', label: 'Company Name', span: 2, icon: Shield },
        { key: 'scAddress', label: 'Address', span: 2, icon: MapPin },
        { key: 'scPhone', label: 'Phone', icon: Phone },
        { key: 'bondNumber', label: 'Bond Number', icon: FileText }
    ],
    fringe: [
        { key: 'fbName', label: 'Trust Name', span: 2, icon: Heart },
        { key: 'fbAddress', label: 'Trust Address', span: 2, icon: MapPin },
        { key: 'eCPRSystem', label: 'eCPR System', span: 2, icon: Settings }
    ],
    others: [
        { key: 'typeOfServiceRequired', label: 'Type of Service', icon: Settings },
        { key: 'wetUtilities', label: 'Wet Utilities', icon: Settings },
        { key: 'dryUtilities', label: 'Dry Utilities', icon: Settings },
        { key: 'prelimAmount', label: 'Prelims Amount', placeholder: 'Enter prelims amount...', icon: FileText },
        { key: 'projectDescription', label: 'Project Description', type: 'textarea', span: 2, icon: FileText }
    ]
};

export default function EstimateFormPage() {
    const params = useParams();
    const token = params?.token as string;

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [estimateInfo, setEstimateInfo] = useState<any>(null);
    const [activeTab, setActiveTab] = useState('accounting');
    const [completedTabs, setCompletedTabs] = useState<Set<string>>(new Set());
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch estimate data
    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            try {
                const res = await fetch(`/api/estimate-form?token=${token}`);
                const data = await res.json();

                if (data.success) {
                    setEstimateInfo(data.result);
                    // Pre-populate form with existing data
                    const initial: Record<string, string> = {};
                    Object.keys(FIELDS_BY_TAB).forEach(tab => {
                        FIELDS_BY_TAB[tab].forEach(field => {
                            initial[field.key] = data.result[field.key] || '';
                        });
                    });
                    setFormData(initial);
                } else {
                    setError(data.error || 'Failed to load form');
                }
            } catch (err) {
                setError('Failed to load form. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token]);

    // Track completed tabs
    useEffect(() => {
        const completed = new Set<string>();
        Object.keys(FIELDS_BY_TAB).forEach(tab => {
            const fields = FIELDS_BY_TAB[tab];
            const hasData = fields.some(f => formData[f.key]?.trim());
            if (hasData) completed.add(tab);
        });
        setCompletedTabs(completed);
    }, [formData]);

    const handleUpdate = useCallback((key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    }, []);

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/estimate-form', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, formData })
            });
            const data = await res.json();

            if (data.success) {
                setSubmitted(true);
                toast.success('Form submitted successfully!');
            } else {
                toast.error(data.error || 'Failed to submit form');
            }
        } catch (err) {
            toast.error('Failed to submit form. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const currentFields = FIELDS_BY_TAB[activeTab] || [];
    const currentTabData = TABS.find(t => t.id === activeTab);
    const TabIcon = currentTabData?.icon || Settings;
    const currentTabIndex = TABS.findIndex(t => t.id === activeTab);

    const goToNextTab = () => {
        if (currentTabIndex < TABS.length - 1) {
            setActiveTab(TABS[currentTabIndex + 1].id);
        }
    };

    const goToPrevTab = () => {
        if (currentTabIndex > 0) {
            setActiveTab(TABS[currentTabIndex - 1].id);
        }
    };

    // ── Loading State ──
    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                        <div className="absolute inset-0 rounded-full border-4 border-blue-500/20" />
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 animate-spin" />
                        <div className="absolute inset-2 rounded-full border-4 border-transparent border-t-blue-300 animate-spin" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                    </div>
                    <p className="text-blue-200 text-sm font-medium animate-pulse">Loading your form...</p>
                </div>
            </div>
        );
    }

    // ── Error State ──
    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-white/10 backdrop-blur-2xl rounded-3xl p-10 text-center max-w-md border border-white/10 shadow-2xl">
                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-10 h-10 text-red-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Link Unavailable</h2>
                    <p className="text-blue-200/70 text-sm leading-relaxed">{error}</p>
                </div>
            </div>
        );
    }

    // ── Success State ──
    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
                <Toaster position="top-center" />
                <div className={`bg-white/10 backdrop-blur-2xl rounded-3xl p-10 text-center max-w-md border border-white/10 shadow-2xl transition-all duration-700 ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                    <div className="relative w-24 h-24 mx-auto mb-8">
                        <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                            <Check className="w-12 h-12 text-white" strokeWidth={3} />
                        </div>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-3">Thank You!</h2>
                    <p className="text-blue-200/70 text-sm leading-relaxed mb-6">
                        Your information has been successfully submitted. The team will review your details shortly.
                    </p>
                    <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 rounded-full border border-white/10">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-blue-200 uppercase tracking-wider">
                            Estimate #{estimateInfo?.estimate}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // ── Main Form ──
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
            <Toaster position="top-center" />

            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0F4C75] to-[#1A5980] flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800">Project Details</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Estimate #{estimateInfo?.estimate}
                            </p>
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-3">
                        {estimateInfo?.projectName && (
                            <div className="px-4 py-2 bg-blue-50 rounded-xl border border-blue-100">
                                <span className="text-xs font-bold text-blue-700">{estimateInfo.projectName}</span>
                            </div>
                        )}
                        {estimateInfo?.customerName && (
                            <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-xs font-bold text-slate-600">{estimateInfo.customerName}</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 py-6">
                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            {completedTabs.size} of {TABS.length} sections
                        </span>
                        <span className="text-xs font-bold text-blue-600">
                            {Math.round((completedTabs.size / TABS.length) * 100)}% complete
                        </span>
                    </div>
                    <div className="h-2 bg-slate-200/50 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${(completedTabs.size / TABS.length) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="flex gap-6 lg:gap-8">
                    {/* Sidebar */}
                    <div className="hidden lg:block w-72 shrink-0">
                        <div className="sticky top-24 bg-white rounded-2xl border border-slate-200/50 shadow-xl shadow-slate-200/30 overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/30">
                                <h2 className="text-sm font-bold text-slate-700">Sections</h2>
                                <p className="text-[10px] text-slate-400 mt-0.5">Fill in as much as you can</p>
                            </div>
                            <div className="py-2 px-2">
                                {TABS.map((tab) => {
                                    const Icon = tab.icon;
                                    const isActive = activeTab === tab.id;
                                    const isCompleted = completedTabs.has(tab.id);
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-200 mb-0.5 group ${isActive
                                                ? 'bg-white shadow-lg shadow-blue-100/50 border border-blue-100'
                                                : 'hover:bg-slate-50 border border-transparent'
                                                }`}
                                        >
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${isActive
                                                ? `bg-gradient-to-br ${tab.color} text-white shadow-lg`
                                                : isCompleted
                                                    ? 'bg-emerald-50 text-emerald-500'
                                                    : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
                                                }`}>
                                                {isCompleted && !isActive ? (
                                                    <Check className="w-4 h-4" strokeWidth={3} />
                                                ) : (
                                                    <Icon className="w-4 h-4" />
                                                )}
                                            </div>
                                            <span className={`text-sm font-semibold truncate ${isActive ? 'text-slate-800' : isCompleted ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                {tab.label}
                                            </span>
                                            {isActive && <ChevronRight className="w-4 h-4 text-blue-400 ml-auto shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Mobile Tab Bar */}
                    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-slate-200 px-2 py-2">
                        <div className="flex gap-1 overflow-x-auto no-scrollbar">
                            {TABS.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                const isCompleted = completedTabs.has(tab.id);
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all shrink-0 ${isActive ? `${tab.bg} ${tab.text}` : isCompleted ? 'text-emerald-500' : 'text-slate-400'}`}
                                    >
                                        {isCompleted && !isActive ? (
                                            <Check className="w-4 h-4" strokeWidth={3} />
                                        ) : (
                                            <Icon className="w-4 h-4" />
                                        )}
                                        <span className="text-[8px] font-bold uppercase tracking-wider whitespace-nowrap">{tab.label.split(' ')[0]}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0 pb-24 lg:pb-8">
                        <div className="bg-white rounded-2xl border border-slate-200/50 shadow-xl shadow-slate-200/30 overflow-hidden">
                            {/* Content Header */}
                            <div className="flex items-center justify-between px-6 sm:px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/50 to-transparent">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${currentTabData?.color} flex items-center justify-center shadow-lg`}>
                                        <TabIcon className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">{currentTabData?.label}</h3>
                                        <p className="text-xs text-slate-400">Fill in the details below</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {currentTabIndex + 1} / {TABS.length}
                                    </span>
                                </div>
                            </div>

                            {/* Fields Grid */}
                            <div className="px-6 sm:px-8 py-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                                    {currentFields.map((field, idx) => {
                                        const FieldIcon = field.icon;
                                        return (
                                            <div
                                                key={field.key}
                                                className={`space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300 ${field.span === 2 ? 'sm:col-span-2' : field.span === 3 ? 'sm:col-span-2 lg:col-span-3' : ''}`}
                                                style={{ animationDelay: `${idx * 50}ms` }}
                                            >
                                                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">
                                                    {FieldIcon && <FieldIcon className="w-3 h-3" />}
                                                    {field.label}
                                                </label>

                                                {field.type === 'textarea' ? (
                                                    <textarea
                                                        className="w-full p-3.5 bg-slate-50/80 border-2 border-slate-100 rounded-xl text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none resize-none h-28 placeholder:text-slate-300"
                                                        value={formData[field.key] || ''}
                                                        onChange={(e) => handleUpdate(field.key, e.target.value)}
                                                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                                    />
                                                ) : (
                                                    <input
                                                        type={field.type || 'text'}
                                                        className="w-full px-3.5 py-3 bg-slate-50/80 border-2 border-slate-100 rounded-xl text-sm font-medium text-slate-700 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none placeholder:text-slate-300"
                                                        value={formData[field.key] || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (field.key.toLowerCase().includes('phone')) {
                                                                handleUpdate(field.key, formatPhoneNumber(val));
                                                            } else {
                                                                handleUpdate(field.key, val);
                                                            }
                                                        }}
                                                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Footer Navigation */}
                            <div className="px-6 sm:px-8 py-5 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                                <button
                                    onClick={goToPrevTab}
                                    disabled={currentTabIndex === 0}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    ← Previous
                                </button>

                                <div className="flex items-center gap-1.5">
                                    {TABS.map((tab, i) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`w-2 h-2 rounded-full transition-all duration-300 ${activeTab === tab.id
                                                ? 'w-6 bg-blue-500'
                                                : completedTabs.has(tab.id)
                                                    ? 'bg-emerald-400'
                                                    : 'bg-slate-200 hover:bg-slate-300'
                                                }`}
                                        />
                                    ))}
                                </div>

                                {currentTabIndex < TABS.length - 1 ? (
                                    <button
                                        onClick={goToNextTab}
                                        className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                                    >
                                        Next <ArrowRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitting}
                                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-60"
                                    >
                                        {submitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                Submit Form
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Background Decoration */}
            <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-blue-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="fixed bottom-0 left-0 w-[400px] h-[400px] bg-emerald-400/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        </div>
    );
}
