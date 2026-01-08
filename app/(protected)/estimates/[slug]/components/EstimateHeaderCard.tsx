'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Layers, Activity, HardHat, Percent, Calculator, FileSpreadsheet, Plus, Check, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MyDropDown, Modal, Input, Button } from '@/components/ui';

import { CostBreakdownChart } from './CostBreakdownChart';
import { VersionTimeline } from './VersionTimeline';




interface FormData {
    customerName?: string;
    customerId?: string;
    contactName?: string;
    contactId?: string;
    contactEmail?: string;
    contactPhone?: string;
    jobAddress?: string;



    projectName?: string;
    date?: string;
    estimate?: string;
    bidMarkUp?: string | number;
    fringe?: string;
    status?: string;
    proposalWriter?: string;
    certifiedPayroll?: string;
    services?: string[];

    [key: string]: unknown;
}

interface ChartSlice {
    id: string;
    label: string;
    value: number;
    color: string;
}

interface VersionEntry {
    _id: string;
    proposalNo?: string;
    versionNumber?: number;
    date?: string;
    totalAmount?: number;
}

interface EstimateHeaderCardProps {
    formData: FormData;
    chartData: {
        slices: ChartSlice[];
        subTotal: number;
        grandTotal: number;
        markupPct: number;
    };
    versionHistory: VersionEntry[];
    currentEstimateId: string;
    chartAnimate: boolean;

    onStatusChange: (val: string) => void;
    statusOptions: { id: string; label: string; value: string; color?: string }[];
    onServicesChange: (val: string[]) => void;
    serviceOptions: { id: string; label: string; value: string; color?: string }[];
    fringeOptions: { id: string; label: string; value: string; color?: string }[];
    onFringeChange: (val: string) => void;
    certifiedPayrollOptions: { id: string; label: string; value: string; color?: string }[];
    employeeOptions: { id: string; label: string; value: string; color?: string; profilePicture?: string }[];

    onHeaderUpdate: (field: string, value: string | number | boolean) => void;
    onVersionClick: (id: string) => void;
    onAddConstant?: (data: any) => Promise<any>;

    clientOptions: { id: string; label: string; value: string }[];
    contactOptions: { id: string; label: string; value: string; email?: string; phone?: string }[];
    addressOptions: { id: string; label: string; value: string }[];
    onAddClient: (name: string) => Promise<{ id: string, name: string } | null>;
    onUpdateClientContacts: (contacts: any[]) => Promise<void>;
    onUpdateClientAddresses: (addresses: string[]) => Promise<void>;
    onCloneVersion?: (id: string, versionNumber: number) => void;
}


export function EstimateHeaderCard({
    formData,
    chartData,
    versionHistory,
    currentEstimateId,
    chartAnimate,

    onStatusChange,
    statusOptions,
    onServicesChange,
    serviceOptions,
    fringeOptions,
    onFringeChange,
    certifiedPayrollOptions,
    employeeOptions,
    onHeaderUpdate,

    onVersionClick,
    onAddConstant,

    clientOptions,
    contactOptions,
    addressOptions,
    onAddClient,
    onUpdateClientContacts,
    onUpdateClientAddresses,
    onCloneVersion
}: EstimateHeaderCardProps) {
    const router = useRouter();

    const [isAddingContact, setIsAddingContact] = useState(false);
    const [newContactData, setNewContactData] = useState({ name: '', email: '', phone: '', type: 'Main Contact' });
    const [isEditingProjectName, setIsEditingProjectName] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<'services' | 'status' | 'fringe' | 'markup' | 'proposalWriter' | 'certifiedPayroll' | 'client' | 'contact' | 'address' | null>(null);
    const [isAddingService, setIsAddingService] = useState(false);


    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setActiveDropdown(null);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setActiveDropdown(null);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    const toggleService = (value: string) => {
        const current = formData.services || [];
        const exists = current.includes(value);
        let updated: string[];
        if (exists) {
            updated = current.filter(s => s !== value);
        } else {
            updated = [...current, value];
        }
        onServicesChange(updated);
    };

    const isServiceActive = (value: string) => (formData.services || []).includes(value);

    const handleAddNewService = async (name: string) => {
        if (!onAddConstant) return;
        setIsAddingService(true);
        try {
            const newService = await onAddConstant({
                type: 'Services',
                description: name,
                value: '', // Value should be empty/dollar value, not description
                color: '#0F4C75'
            });
            if (newService) {
                toggleService(newService.description || newService.value);
            }
        } finally {
            setIsAddingService(false);
        }
    };

    const handleAddNewFringe = async (name: string) => {
        if (!onAddConstant) return;
        try {
            const newItem = await onAddConstant({
                type: 'Fringe',
                description: name,
                value: name,
                color: '#4A90E2'
            });
            if (newItem) {
                onFringeChange(newItem.description || newItem.value);
            }
        } catch (e) { console.error(e); }
    };

    const handleAddNewCertifiedPayroll = async (name: string) => {
        if (!onAddConstant) return;
        try {
            const newItem = await onAddConstant({
                type: 'Certified Payroll',
                description: name,
                value: name,
                color: '#10B981'
            });
            if (newItem) {
                onHeaderUpdate('certifiedPayroll', newItem.description || newItem.value);
            }
        } catch (e) { console.error(e); }
    };

    const handleAddNewStatus = async (name: string) => {
        if (!onAddConstant) return;
        try {
            const newItem = await onAddConstant({
                type: 'Estimate Status',
                description: name,
                value: name,
                color: '#64748B'
            });
            if (newItem) {
                onStatusChange(newItem.description || newItem.value);
            }
        } catch (e) { console.error(e); }
    };

    const handleSaveNewContact = async () => {
        if (!newContactData.name) return;
        const currentContacts = contactOptions.map(c => ({
            name: c.label,
            email: c.email,
            phone: c.phone,
            type: c.value === c.label ? 'Main Contact' : 'Other' // rough mapping
        }));
        
        // Find existing contact types or use default
        const updated = [...currentContacts, newContactData];
        await onUpdateClientContacts(updated);
        
        onHeaderUpdate('contactName', newContactData.name);
        onHeaderUpdate('contactId', newContactData.name);
        if (newContactData.email) onHeaderUpdate('contactEmail', newContactData.email);
        if (newContactData.phone) onHeaderUpdate('contactPhone', newContactData.phone);
        
        setIsAddingContact(false);
        setNewContactData({ name: '', email: '', phone: '', type: 'Main Contact' });
    };

    return (
        <>
            <div className="bg-[#eef2f6] rounded-[40px] p-4">
            {/* 4-Column Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                {/* PART 1: Customer Info column */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff]">
                    {/* Customer */}
                    <div className="relative group">
                        <div className="flex items-center justify-between mb-1 px-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                                Customer
                            </label>
                            {formData.customerId && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/clients/${formData.customerId}?from=${encodeURIComponent(window.location.pathname)}`);
                                    }}
                                    className="p-1 text-slate-400 hover:text-[#0F4C75] transition-colors"
                                    title="Go to Client Profile"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        <div 
                            id="field-client"
                            onClick={() => setActiveDropdown(activeDropdown === 'client' ? null : 'client')}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-300
                                ${activeDropdown === 'client' 
                                    ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff]' 
                                    : 'bg-white/50 hover:bg-white shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] border border-white'}
                            `}
                        >
                            <span className={`text-xs font-bold leading-tight ${formData.customerName ? 'text-[#0F4C75]' : 'text-slate-400'}`}>
                                {formData.customerName || 'Select Customer'}
                            </span>
                        </div>
                        <MyDropDown
                            isOpen={activeDropdown === 'client'}
                            onClose={() => setActiveDropdown(null)}
                            options={clientOptions}
                            selectedValues={formData.customerId ? [formData.customerId] : []}
                            onSelect={(val) => {
                                const opt = clientOptions.find(o => o.value === val);
                                if (opt) {
                                    onHeaderUpdate('customerName', opt.label);
                                    onHeaderUpdate('customerId', opt.value);
                                    onHeaderUpdate('contactName', '');
                                    onHeaderUpdate('contactId', '');
                                    onHeaderUpdate('contactEmail', '');
                                    onHeaderUpdate('contactPhone', '');
                                    onHeaderUpdate('jobAddress', '');
                                }
                                setActiveDropdown(null);
                            }}
                            onAdd={async (name) => {
                                const newClient = await onAddClient(name);
                                if (newClient) {
                                    onHeaderUpdate('customerName', newClient.name);
                                    onHeaderUpdate('customerId', newClient.id);
                                }
                                setActiveDropdown(null);
                            }}
                            placeholder="Search or add customer..."
                            anchorId="field-client"
                            positionMode="overlay"
                        />
                    </div>

                    {/* Contact */}
                    <div className="relative group">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block px-1">
                            Contact
                        </label>
                        <div
                            id="field-contact"
                            onClick={() => {
                                if (!formData.customerId) return;
                                setActiveDropdown(activeDropdown === 'contact' ? null : 'contact');
                            }}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-300
                                ${!formData.customerId ? 'opacity-50 cursor-not-allowed' : ''}
                                ${activeDropdown === 'contact' 
                                    ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff]' 
                                    : 'bg-white/50 hover:bg-white shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] border border-white'}
                            `}
                        >
                            <span className={`text-xs font-bold leading-tight ${formData.contactName ? 'text-[#0F4C75]' : 'text-slate-400'}`}>
                                {formData.contactName || 'Select Contact'}
                            </span>
                        </div>
                        <MyDropDown
                            isOpen={activeDropdown === 'contact'}
                            onClose={() => setActiveDropdown(null)}
                            options={contactOptions}
                            selectedValues={formData.contactName ? [formData.contactName] : []}
                            onSelect={(val) => {
                                const opt = contactOptions.find(o => o.value === val);
                                if (opt) {
                                    onHeaderUpdate('contactName', opt.label);
                                    onHeaderUpdate('contactId', opt.id);
                                    onHeaderUpdate('contactEmail', opt.email || '');
                                    onHeaderUpdate('contactPhone', opt.phone || '');
                                }
                                setActiveDropdown(null);
                            }}
                            onAdd={async (name) => {
                                setNewContactData({ ...newContactData, name });
                                setIsAddingContact(true);
                                setActiveDropdown(null);
                            }}
                            placeholder="Select or add contact..."
                            anchorId="field-contact"
                            positionMode="overlay"
                        />
                    </div>

                    {/* Job Address */}
                    <div className="relative group">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block px-1">
                            Job Address
                        </label>
                        <div
                            id="field-address"
                            onClick={() => {
                                if (!formData.customerId) return;
                                setActiveDropdown(activeDropdown === 'address' ? null : 'address');
                            }}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-300
                                ${!formData.customerId ? 'opacity-50 cursor-not-allowed' : ''}
                                ${activeDropdown === 'address' 
                                    ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff]' 
                                    : 'bg-white/50 hover:bg-white shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] border border-white'}
                            `}
                        >
                            <span className={`text-xs font-bold leading-tight ${formData.jobAddress ? 'text-[#0F4C75]' : 'text-slate-400'}`}>
                                {formData.jobAddress || 'Select Address'}
                            </span>
                        </div>
                        <MyDropDown
                            isOpen={activeDropdown === 'address'}
                            onClose={() => setActiveDropdown(null)}
                            options={addressOptions}
                            selectedValues={formData.jobAddress ? [formData.jobAddress] : []}
                            onSelect={(val) => {
                                onHeaderUpdate('jobAddress', val);
                                setActiveDropdown(null);
                            }}
                            onAdd={async (address) => {
                                const current = addressOptions.map(o => o.value);
                                if (!current.includes(address)) {
                                    await onUpdateClientAddresses([...current, address]);
                                }
                                onHeaderUpdate('jobAddress', address);
                                setActiveDropdown(null);
                            }}
                            placeholder="Select or add address..."
                            anchorId="field-address"
                            positionMode="overlay"
                        />
                    </div>

                    {/* Project Name */}
                    <div className="relative group">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block px-1">
                            Project Name
                        </label>
                        <div 
                            onClick={() => setIsEditingProjectName(true)}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-300
                                ${isEditingProjectName 
                                    ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff]' 
                                    : 'bg-white/50 hover:bg-white shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] border border-white'}
                            `}
                        >
                            {isEditingProjectName ? (
                                <textarea
                                    autoFocus
                                    rows={2}
                                    className="w-full bg-transparent outline-none text-xs font-bold text-[#0F4C75] resize-none"
                                    value={formData.projectName || ''}
                                    onChange={e => onHeaderUpdate('projectName', e.target.value)}
                                    onBlur={() => setIsEditingProjectName(false)}
                                    placeholder="Enter Project Name"
                                />
                            ) : (
                                <span className={`text-xs font-bold leading-tight ${formData.projectName ? 'text-[#0F4C75]' : 'text-slate-400'}`}>
                                    {formData.projectName || 'Project Title...'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* PART 2: Estimate Details Column */}
                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff]">

                    {/* Row 1: Date & Est No */}
                    <div className="flex flex-col sm:flex-row gap-2 border-b border-slate-200/50 pb-2">
                        <div className="flex-1 text-center">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                                Date
                            </label>
                            <div className="text-base font-bold text-slate-600">
                                {formData.date || '-'}
                            </div>
                        </div>
                        <div className="flex-1 text-center">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                                Estimate No.
                            </label>
                            <div
                                className="text-base font-bold text-slate-600 truncate"
                                title={formData.estimate || '-'}
                            >
                                {formData.estimate || '-'}
                            </div>
                        </div>
                    </div>

                    {/* Dropdown Container-ref for click-outside handling */}
                    <div ref={dropdownRef}>
                        {/* Row 2: Fringe Rate & Certified Payroll */}
                        <div className="flex gap-2 mb-2">
                            {/* Fringe */}
                            <div className="flex-1 relative flex flex-col items-center p-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                    Fringe Rate
                                </label>
                                {(() => {
                                    const selectedFringe = fringeOptions.find(f => f.value === formData.fringe);
                                    const isDropdownOpen = activeDropdown === 'fringe';
                                    const hasValue = !!formData.fringe;
                                    const activeColor = selectedFringe?.color || '#4f46e5';

                                    return (
                                        <div
                                            id="field-fringe"
                                            onClick={() => setActiveDropdown(activeDropdown === 'fringe' ? null : 'fringe')}
                                            className={`
                                            w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden
                                            ${isDropdownOpen
                                                    ? 'shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)]'
                                                    : hasValue
                                                        ? 'shadow-[4px_4px_10px_rgba(0,0,0,0.15),-4px_-4px_10px_rgba(255,255,255,0.8)]'
                                                        : 'shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] hover:shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] hover:-translate-y-0.5 bg-[#eef2f6]'}
                                        `}
                                            style={hasValue ? { backgroundColor: activeColor } : {}}
                                        >
                                            <HardHat className={`w-5 h-5 ${hasValue ? 'text-white' : 'text-slate-400'}`} />
                                        </div>
                                    );
                                })()}

                                {/* Fringe Dropdown */}
                                <MyDropDown
                                    isOpen={activeDropdown === 'fringe'}
                                    onClose={() => setActiveDropdown(null)}
                                    options={fringeOptions}
                                    selectedValues={formData.fringe ? [formData.fringe] : []}
                                    onSelect={(val) => {
                                        onFringeChange(val === formData.fringe ? '' : val);
                                        setActiveDropdown(null);
                                    }}
                                    onAdd={handleAddNewFringe}
                                    placeholder="Search fringe rates..."
                                    anchorId="field-fringe"
                                    positionMode="overlay"
                                />
                            </div>

                            {/* Certified Payroll */}
                            <div className="flex-1 relative flex flex-col items-center p-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                    Certified Payroll
                                </label>
                                {(() => {
                                    const selectedOpt = certifiedPayrollOptions.find(f => f.value === formData.certifiedPayroll);
                                    const isDropdownOpen = activeDropdown === 'certifiedPayroll';
                                    const hasValue = !!formData.certifiedPayroll;
                                    const activeColor = selectedOpt?.color || '#10b981';

                                    return (
                                        <div
                                            id="field-certifiedPayroll"
                                            onClick={() => setActiveDropdown(activeDropdown === 'certifiedPayroll' ? null : 'certifiedPayroll')}
                                            className={`
                                            w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden
                                            ${isDropdownOpen
                                                    ? 'shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)]'
                                                    : hasValue
                                                        ? 'shadow-[4px_4px_10px_rgba(0,0,0,0.15),-4px_-4px_10px_rgba(255,255,255,0.8)]'
                                                        : 'shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] hover:shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] hover:-translate-y-0.5 bg-[#eef2f6]'}
                                        `}
                                            style={hasValue ? { backgroundColor: activeColor } : {}}
                                        >
                                            <Calculator className={`w-5 h-5 ${hasValue ? 'text-white' : 'text-slate-400'}`} />
                                        </div>
                                    );
                                })()}

                                {/* Certified Payroll Dropdown */}
                                <MyDropDown
                                    isOpen={activeDropdown === 'certifiedPayroll'}
                                    onClose={() => setActiveDropdown(null)}
                                    options={certifiedPayrollOptions}
                                    selectedValues={formData.certifiedPayroll ? [formData.certifiedPayroll] : []}
                                    onSelect={(val) => {
                                        onHeaderUpdate('certifiedPayroll', val === formData.certifiedPayroll ? '' : val);
                                        setActiveDropdown(null);
                                    }}
                                    onAdd={handleAddNewCertifiedPayroll}
                                    placeholder="Search payroll types..."
                                    anchorId="field-certifiedPayroll"
                                    positionMode="overlay"
                                />
                            </div>

                        </div>

                        {/* Row 3: Services & Markup % */}
                        <div className="flex gap-2 mb-2">
                            {/* Services Column */}
                            <div className="flex-1 relative flex flex-col items-center p-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block text-center">
                                    Services
                                </label>
                                {(() => {
                                    const selectedCount = formData.services?.length || 0;
                                    const hasSelection = selectedCount > 0;
                                    const isOpen = activeDropdown === 'services';

                                    return (
                                        <div
                                            id="field-services"
                                            onClick={() => setActiveDropdown(isOpen ? null : 'services')}
                                            className={`
                                                w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden
                                                ${isOpen
                                                    ? 'shadow-[4px_4px_10px_rgba(15,76,117,0.4),-4px_-4px_10px_rgba(255,255,255,0.8)] text-white'
                                                    : 'shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] hover:shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] hover:-translate-y-0.5 bg-[#eef2f6] text-slate-400'}
                                            `}
                                            style={hasSelection ? { backgroundColor: '#0F4C75' } : {}}
                                        >
                                            {hasSelection ? (
                                                <span className="font-bold text-lg">{selectedCount}</span>
                                            ) : (
                                                <Layers className="w-5 h-5" />
                                            )}
                                        </div>
                                    );
                                })()}

                                {activeDropdown === 'services' && (
                                        <MyDropDown
                                            isOpen={activeDropdown === 'services'}
                                            onClose={() => setActiveDropdown(null)}
                                            options={serviceOptions}
                                            selectedValues={formData.services || []}
                                            onSelect={toggleService}
                                            onAdd={handleAddNewService}
                                            isAdding={isAddingService}
                                            placeholder="Search or add services..."
                                            anchorId="field-services"
                                            positionMode="overlay"
                                            multiSelect={true}
                                        />
                                )}
                            </div>

                            {/* Markup */}
                            <div className="flex-1 relative flex flex-col items-center p-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                    Markup %
                                </label>
                                {(() => {
                                    const isDropdownOpen = activeDropdown === 'markup';
                                    const markupValue = Number(formData.bidMarkUp) || 0;
                                    const hasValue = markupValue > 0;

                                    // Determine fill color and text color based on percentage
                                    let fillColor = '#CCE0FF';
                                    let textColor = 'text-slate-800';

                                    if (markupValue >= 91) { fillColor = '#001433'; textColor = 'text-white'; }
                                    else if (markupValue >= 81) { fillColor = '#001433'; textColor = 'text-white'; }
                                    else if (markupValue >= 71) { fillColor = '#003D99'; textColor = 'text-white'; }
                                    else if (markupValue >= 61) { fillColor = '#003D99'; textColor = 'text-white'; }
                                    else if (markupValue >= 51) { fillColor = '#0F4C75'; textColor = 'text-white'; }
                                    else if (markupValue >= 41) { fillColor = '#0F4C75'; textColor = 'text-slate-800'; }
                                    else if (markupValue >= 31) { fillColor = '#66A3FF'; textColor = 'text-slate-800'; }
                                    else if (markupValue >= 21) { fillColor = '#66A3FF'; textColor = 'text-slate-800'; }
                                    else if (markupValue >= 11) { fillColor = '#CCE0FF'; textColor = 'text-slate-800'; }
                                    // 0-10% uses default #CCE0FF

                                    // Calculate fill height (max 100%)
                                    const fillPercent = Math.min(markupValue, 100);

                                    return (
                                        <div
                                            onClick={() => setActiveDropdown(activeDropdown === 'markup' ? null : 'markup')}
                                            className={`
                                    w-12 h-12 rounded-full flex items-center justify-center cursor-pointer relative overflow-hidden bg-[#eef2f6]
                                                ${isDropdownOpen
                                                    ? 'shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)]'
                                                    : hasValue
                                                        ? 'shadow-[4px_4px_10px_rgba(0,0,0,0.15),-4px_-4px_10px_rgba(255,255,255,0.8)]'
                                                        : 'shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] hover:shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] hover:-translate-y-0.5'
                                                }
                                    `}
                                        >
                                            {hasValue && (
                                                <div
                                                    className="absolute bottom-0 left-0 right-0 animate-[liquidRise_1.5s_ease-out_forwards]"
                                                    style={{
                                                        height: `${fillPercent}%`,
                                                        backgroundColor: fillColor,
                                                        borderRadius: '0 0 24px 24px',
                                                    }}
                                                />
                                            )}
                                            {/* Content */}
                                            <span className={`relative z-10 font-bold text-xs ${hasValue ? textColor : 'text-slate-400'} `}>
                                                {hasValue ? `${markupValue}%` : <Percent className="w-5 h-5" />}
                                            </span>
                                        </div>
                                    );
                                })()}

                                {/* Markup Popup */}
                                {activeDropdown === 'markup' && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-40 p-4 rounded-2xl bg-[#eef2f6] shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] z-50 border border-white/40">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 text-center">
                                            Enter Markup %
                                        </div>
                                        <div className="relative shadow-[inset_2px_2px_4px_#d1d9e6,inset_-2px_-2px_4px_#ffffff] rounded-xl p-1 bg-[#eef2f6] h-10 flex items-center">
                                            <input
                                                type="number"
                                                value={formData.bidMarkUp || ''}
                                                onChange={e => onHeaderUpdate('bidMarkUp', e.target.value)}
                                                onFocus={(e) => e.target.select()}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') setActiveDropdown(null);
                                                }}
                                                autoFocus
                                                className="w-full bg-transparent text-base font-bold text-slate-700 h-full px-3 outline-none text-center"
                                                placeholder="0"
                                            />
                                        </div>
                                        <button
                                            onClick={() => setActiveDropdown(null)}
                                            className="mt-3 w-full py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] hover:bg-emerald-600 transition-colors"
                                        >
                                            Done
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Row 4: Proposal Writer & Status */}
                        <div className="flex gap-2">
                            {/* Proposal Writer */}
                            <div className="flex-1 relative flex flex-col items-center p-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block text-center">
                                    Proposal Writer
                                </label>
                                {(() => {
                                    const selectedEmp = employeeOptions.find(e => e.value === formData.proposalWriter);
                                    const writerLabel = selectedEmp?.label || '';
                                    const writerPic = selectedEmp?.profilePicture;
                                    const hasValue = !!formData.proposalWriter;
                                    const isOpen = activeDropdown === 'proposalWriter';

                                    return (
                                        <div
                                            id="field-writer"
                                            onClick={() => setActiveDropdown(isOpen ? null : 'proposalWriter')}
                                            className={`
                                    w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden
                                                ${isOpen
                                                    ? 'shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)]'
                                                    : hasValue
                                                        ? 'shadow-[4px_4px_10px_rgba(0,0,0,0.15),-4px_-4px_10px_rgba(255,255,255,0.8)]'
                                                        : 'shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] hover:shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] hover:-translate-y-0.5 bg-[#eef2f6] text-slate-400'
                                                }
                                    `}
                                        >
                                            {hasValue && writerPic ? (
                                                <img
                                                    src={writerPic}
                                                    alt={writerLabel}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : hasValue ? (
                                                <div className="w-full h-full flex items-center justify-center bg-[#0F4C75] text-white text-xs font-bold">
                                                    {writerLabel.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                                </div>
                                            ) : (
                                                <span className="text-[10px] uppercase font-bold text-slate-400">Add</span>
                                            )}

                                        </div>
                                    );
                                })()}


                                {/* Proposal Writer Dropdown */}
                                <MyDropDown
                                    isOpen={activeDropdown === 'proposalWriter'}
                                    onClose={() => setActiveDropdown(null)}
                                    options={employeeOptions}
                                    selectedValues={formData.proposalWriter ? [formData.proposalWriter] : []}
                                    onSelect={(val) => {
                                        onHeaderUpdate('proposalWriter', val === formData.proposalWriter ? '' : val);
                                        setActiveDropdown(null);
                                    }}
                                    placeholder="Search writers..."
                                    anchorId="field-writer"
                                    positionMode="overlay"
                                />
                            </div>


                            {/* Status Column */}
                            <div className="flex-1 relative flex flex-col items-center p-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block text-center">
                                    Status
                                </label>
                                {(() => {
                                    const selectedStatus = statusOptions.find(s => s.value === formData.status) ||
                                        [{ id: 'draft', label: 'Draft', value: 'draft', color: '#94a3b8' }, { id: 'confirmed', label: 'Confirmed', value: 'confirmed', color: '#10b981' }].find(s => s.value === formData.status);
                                    const isDropdownOpen = activeDropdown === 'status';
                                    const hasValue = !!formData.status;
                                    const activeColor = selectedStatus?.color || '#3b82f6';

                                    return (
                                        <div
                                            id="field-status"
                                            onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                            className={`
                                    w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden
                                            ${isDropdownOpen
                                                    ? 'shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)]'
                                                    : hasValue
                                                        ? 'shadow-[4px_4px_10px_rgba(0,0,0,0.15),-4px_-4px_10px_rgba(255,255,255,0.8)] text-white'
                                                        : 'shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] hover:shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] hover:-translate-y-0.5 bg-[#eef2f6] text-slate-400'
                                                }
                                    `}
                                            style={hasValue ? { backgroundColor: activeColor } : {}}
                                        >
                                            <Activity className="w-5 h-5" />
                                        </div>
                                    );
                                })()}

                                {/* Status Dropdown */}
                                <MyDropDown
                                    isOpen={activeDropdown === 'status'}
                                    onClose={() => setActiveDropdown(null)}
                                    options={[
                                        { id: 'draft', label: 'Draft', value: 'draft', color: '#94a3b8' },
                                        { id: 'confirmed', label: 'Confirmed', value: 'confirmed', color: '#10b981' },
                                        ...statusOptions
                                    ]}
                                    selectedValues={formData.status ? [formData.status] : []}
                                    onSelect={(val) => {
                                        onStatusChange(val);
                                        setActiveDropdown(null);
                                    }}
                                    onAdd={handleAddNewStatus}
                                    placeholder="Search status..."
                                    anchorId="field-status"
                                    positionMode="overlay"
                                />
                            </div>
                        </div>
                    </div> {/* End dropdownRef container */}
                </div>

                {/* PART 3: Chart */}
                <CostBreakdownChart
                    slices={chartData.slices}
                    subTotal={chartData.subTotal}
                    grandTotal={chartData.grandTotal}
                    markupPct={chartData.markupPct}
                    animate={chartAnimate}
                />

                {/* PART 4: Version History */}
                <VersionTimeline
                    versions={versionHistory}
                    currentId={currentEstimateId}
                    onVersionClick={onVersionClick}
                    onCloneVersion={onCloneVersion}
                />
            </div>

            {/* Modal for adding new contact */}
            <Modal
                isOpen={isAddingContact}
                onClose={() => setIsAddingContact(false)}
                title="Add New Contact"
                footer={(
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setIsAddingContact(false)}>Cancel</Button>
                        <Button onClick={handleSaveNewContact}>Save Contact</Button>
                    </div>
                )}
            >
                <div className="space-y-4 p-1">
                    <Input
                        label="Full Name"
                        value={newContactData.name}
                        onChange={e => setNewContactData({ ...newContactData, name: e.target.value })}
                        placeholder="John Doe"
                    />
                    <Input
                        label="Email Address"
                        value={newContactData.email}
                        onChange={e => setNewContactData({ ...newContactData, email: e.target.value })}
                        placeholder="john@example.com"
                    />
                    <Input
                        label="Phone Number"
                        value={newContactData.phone}
                        onChange={e => setNewContactData({ ...newContactData, phone: e.target.value })}
                        placeholder="(555) 000-0000"
                    />
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                            Contact Type
                        </label>
                        <select
                            className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#0F4C75] focus:border-[#0F4C75] outline-none transition-all"
                            value={newContactData.type}
                            onChange={e => setNewContactData({ ...newContactData, type: e.target.value })}
                        >
                            <option value="Main Contact">Main Contact</option>
                            <option value="Accounting">Accounting</option>
                            <option value="Billing">Billing</option>
                            <option value="Site Contact">Site Contact</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>
            </Modal>
        </div>
        </>
    );
}
