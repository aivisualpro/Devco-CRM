import { useEffect, useState } from 'react';
import { X, Building2, User, Briefcase, Users, Landmark, Shield, Heart, Settings, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui';
import { ContactSelector } from './ContactSelector';

interface EstimateDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    formData: Record<string, any>;
    customerId?: string;
    onUpdate: (field: string, value: string) => void;
}

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
    { id: 'accounting', label: 'Accounting', icon: Building2, color: 'from-blue-500 to-blue-600' },
    { id: 'owner', label: 'Property Owner', icon: User, color: 'from-emerald-500 to-emerald-600' },
    { id: 'contractor', label: 'Original Contractor', icon: Briefcase, color: 'from-amber-500 to-amber-600' },
    { id: 'subcontractor', label: 'Sub-Contractor', icon: Users, color: 'from-purple-500 to-purple-600' },
    { id: 'lender', label: 'Lending Institution', icon: Landmark, color: 'from-cyan-500 to-cyan-600' },
    { id: 'surety', label: 'Surety Company', icon: Shield, color: 'from-rose-500 to-rose-600' },
    { id: 'fringe', label: 'Fringe Benefits', icon: Heart, color: 'from-pink-500 to-pink-600' },
    { id: 'others', label: 'Others', icon: Settings, color: 'from-slate-500 to-slate-600' }
];

const FIELDS_BY_TAB: Record<string, { key: string; label: string; type?: string; readOnly?: boolean; placeholder?: string; span?: number }[]> = {
    accounting: [
        { key: 'projectId', label: 'Project ID', span: 2 },
        { key: 'accountingContact', label: 'Accounting Contact' },
        { key: 'accountingEmail', label: 'Accounting Email', type: 'email', readOnly: true },
        { key: 'accountingPhone', label: 'Accounting Phone' }
    ],
    owner: [
        { key: 'poName', label: 'Owner / Agency Name', span: 2 },
        { key: 'PoAddress', label: 'Address', span: 2 },
        { key: 'PoPhone', label: 'Phone' }
    ],
    contractor: [
        { key: 'ocName', label: 'Contractor Name', span: 2 },
        { key: 'ocAddress', label: 'Address', span: 2 },
        { key: 'ocPhone', label: 'Phone' }
    ],
    subcontractor: [
        { key: 'subCName', label: 'Sub-Contractor Name', span: 2 },
        { key: 'subCAddress', label: 'Address', span: 2 },
        { key: 'subCPhone', label: 'Phone' }
    ],
    lender: [
        { key: 'liName', label: 'Institution Name', span: 2 },
        { key: 'liAddress', label: 'Address', span: 2 },
        { key: 'liPhone', label: 'Phone' }
    ],
    surety: [
        { key: 'scName', label: 'Company Name', span: 2 },
        { key: 'scAddress', label: 'Address', span: 2 },
        { key: 'scPhone', label: 'Phone' },
        { key: 'bondNumber', label: 'Bond Number' }
    ],
    fringe: [
        { key: 'fbName', label: 'Trust Name', span: 2 },
        { key: 'fbAddress', label: 'Trust Address', span: 2 },
        { key: 'eCPRSystem', label: 'eCPR System', span: 2 }
    ],
    others: [
        { key: 'typeOfServiceRequired', label: 'Type of Service' },
        { key: 'wetUtilities', label: 'Wet Utilities' },
        { key: 'dryUtilities', label: 'Dry Utilities' },
        { key: 'projectDescription', label: 'Project Description', type: 'textarea', span: 2 }
    ]
};

export function EstimateDetailsModal({ isOpen, onClose, formData, customerId, onUpdate }: EstimateDetailsModalProps) {
    const [activeTab, setActiveTab] = useState('accounting');

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const currentFields = FIELDS_BY_TAB[activeTab] || [];
    const currentTabData = TABS.find(t => t.id === activeTab);
    const TabIcon = currentTabData?.icon || Settings;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-white w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl flex overflow-hidden animate-scale-in">
                
                {/* Sidebar Navigation */}
                <div className="w-64 bg-gradient-to-b from-slate-50 to-slate-100 border-r border-slate-200 flex flex-col">
                    {/* Sidebar Header */}
                    <div className="p-6 border-b border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800">Estimate Details</h2>
                        <p className="text-xs text-slate-500 mt-1">Project information</p>
                    </div>

                    {/* Tab List */}
                    <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
                        {TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200
                                        ${isActive 
                                            ? 'bg-white shadow-lg shadow-slate-200/50 border border-slate-100' 
                                            : 'hover:bg-white/60 border border-transparent'
                                        }
                                    `}
                                >
                                    <div className={`
                                        w-9 h-9 rounded-xl flex items-center justify-center transition-all
                                        ${isActive 
                                            ? `bg-gradient-to-br ${tab.color} text-white shadow-lg` 
                                            : 'bg-slate-100 text-slate-400'
                                        }
                                    `}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className={`text-sm font-semibold truncate block ${isActive ? 'text-slate-800' : 'text-slate-600'}`}>
                                            {tab.label}
                                        </span>
                                    </div>
                                    {isActive && (
                                        <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Sidebar Footer */}
                    <div className="p-4 border-t border-slate-200">
                        <div className="text-xs text-slate-400 text-center">
                            {TABS.length} sections available
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col bg-white">
                    {/* Content Header */}
                    <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${currentTabData?.color} flex items-center justify-center shadow-lg`}>
                                <TabIcon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{currentTabData?.label}</h3>
                                <p className="text-sm text-slate-400">Fill in the details below</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors group"
                        >
                            <X className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                        </button>
                    </div>

                    {/* Fields Grid */}
                    <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
                        <div className="grid grid-cols-2 gap-6 max-w-3xl">
                            {currentFields.map((field, idx) => (
                                <div 
                                    key={field.key} 
                                    className={`space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300 ${field.span === 2 ? 'col-span-2' : ''}`}
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                >
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-blue-500" />
                                        {field.label}
                                    </label>

                                    {field.key === 'accountingContact' ? (
                                        <ContactSelector
                                            value={formData.accountingContact}
                                            customerId={customerId}
                                            filterType="Accounting"
                                            onChange={(name: string, id?: string, email?: string, phone?: string) => {
                                                onUpdate('accountingContact', name);
                                                if (email) onUpdate('accountingEmail', email);
                                                if (phone) onUpdate('accountingPhone', phone);
                                            }}
                                        />
                                    ) : field.type === 'textarea' ? (
                                        <textarea
                                            className={`
                                                w-full p-4 bg-slate-50/80 border-2 border-slate-100 rounded-2xl text-sm font-medium text-slate-700
                                                focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 
                                                transition-all outline-none resize-none h-32
                                                placeholder:text-slate-300
                                                ${field.readOnly ? 'opacity-60 cursor-not-allowed' : ''}
                                            `}
                                            value={formData[field.key] || ''}
                                            onChange={(e) => onUpdate(field.key, e.target.value)}
                                            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                                            readOnly={field.readOnly}
                                        />
                                    ) : (
                                        <input
                                            type={field.type || 'text'}
                                            className={`
                                                w-full px-4 py-3.5 bg-slate-50/80 border-2 border-slate-100 rounded-2xl text-sm font-medium text-slate-700
                                                focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 
                                                transition-all outline-none
                                                placeholder:text-slate-300
                                                ${field.readOnly ? 'opacity-60 cursor-not-allowed bg-slate-100/50' : ''}
                                            `}
                                            value={formData[field.key] || ''}
                                            onChange={(e) => {
                                                if (field.readOnly) return;
                                                const val = e.target.value;
                                                if (field.key.toLowerCase().includes('phone')) {
                                                    onUpdate(field.key, formatPhoneNumber(val));
                                                } else {
                                                    onUpdate(field.key, val);
                                                }
                                            }}
                                            placeholder={field.readOnly ? 'Auto-populated' : `Enter ${field.label.toLowerCase()}...`}
                                            readOnly={field.readOnly}
                                        />
                                    )}
                                </div>
                            ))}

                            {currentFields.length === 0 && (
                                <div className="col-span-2 text-center py-16 text-slate-400">
                                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                        <Settings className="w-8 h-8 text-slate-300" />
                                    </div>
                                    No fields in this section.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Changes save automatically
                        </div>
                        <Button 
                            onClick={onClose} 
                            size="lg" 
                            className="px-8 bg-gradient-to-r from-[#0F4C75] to-[#1A5980] hover:from-[#0D3D5F] hover:to-[#0F4C75] shadow-lg shadow-blue-500/20"
                        >
                            Done
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
