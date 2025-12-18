'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Layers, Activity, HardHat, Percent, Calculator, PenSquare } from 'lucide-react';

import { CostBreakdownChart } from './CostBreakdownChart';
import { VersionTimeline } from './VersionTimeline';
import { CustomerSelector } from './CustomerSelector';
import { ContactSelector } from './ContactSelector';
import { AddressSelector } from './AddressSelector';




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

    onVersionClick
}: EstimateHeaderCardProps) {

    const [isEditingCustomer, setIsEditingCustomer] = useState(false);
    const [isEditingContact, setIsEditingContact] = useState(false);
    const [isEditingAddress, setIsEditingAddress] = useState(false);

    const [isEditingProjectName, setIsEditingProjectName] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<'services' | 'status' | 'fringe' | 'markup' | 'proposalWriter' | 'certifiedPayroll' | null>(null);


    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setActiveDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
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

    return (
        <div className="bg-[#eef2f6] rounded-[40px] shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] p-4 sm:p-6 lg:p-8 mb-6">
            {/* 4-Column Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">

                {/* PART 1: Customer Info column */}
                <div className="flex flex-col gap-4 sm:gap-6 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff]">
                    {/* Customer */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                            Customer
                        </label>
                        {formData.customerName && !isEditingCustomer ? (
                            <div
                                className="text-base sm:text-lg font-bold text-slate-800 tracking-tight truncate cursor-pointer hover:text-indigo-600 transition-colors"
                                title="Double click to change customer"
                                onDoubleClick={() => setIsEditingCustomer(true)}
                            >
                                {formData.customerName}
                            </div>
                        ) : (
                            <CustomerSelector
                                value={formData.customerName}
                                onChange={(val: string, id?: string) => {
                                    onHeaderUpdate('customerName', val);
                                    if (id) {
                                        onHeaderUpdate('customerId', id);
                                    }
                                    setIsEditingCustomer(false);
                                }}
                            />
                        )}
                    </div>

                    {/* Contact */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                            Contact
                        </label>
                        {formData.contactName && !isEditingContact ? (
                            <div
                                className="text-sm font-medium text-indigo-600 truncate cursor-pointer hover:text-indigo-800 transition-colors"
                                onDoubleClick={() => setIsEditingContact(true)}
                                title="Double click to change contact"
                            >
                                {formData.contactName}
                            </div>
                        ) : (
                            <ContactSelector
                                value={formData.contactName}
                                customerId={formData.customerId}
                                onChange={(name: string, id?: string, email?: string, phone?: string) => {
                                    onHeaderUpdate('contactName', name);
                                    if (id) onHeaderUpdate('contactId', id);
                                    if (email) onHeaderUpdate('contactEmail', email);
                                    if (phone) onHeaderUpdate('contactPhone', phone);
                                    setIsEditingContact(false);
                                }}
                            />

                        )}
                    </div>



                    {/* Job Address */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                            Job Address
                        </label>
                        {formData.jobAddress && !isEditingAddress ? (
                            <div
                                className="text-sm text-slate-600 cursor-pointer hover:text-indigo-600 transition-colors leading-snug"
                                onDoubleClick={() => setIsEditingAddress(true)}
                                title="Double click to change address"
                            >
                                {formData.jobAddress}
                            </div>
                        ) : (
                            <AddressSelector
                                value={formData.jobAddress}
                                customerId={formData.customerId}
                                onChange={(val: string) => {
                                    onHeaderUpdate('jobAddress', val);
                                    setIsEditingAddress(false);
                                }}
                            />
                        )}
                    </div>


                    {/* Project Name */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                            Project Name
                        </label>
                        {isEditingProjectName ? (
                            <input
                                autoFocus
                                className="w-full bg-transparent border-b border-indigo-300 focus:border-indigo-600 outline-none text-base font-bold text-slate-700 py-1"
                                value={formData.projectName || ''}
                                onChange={e => onHeaderUpdate('projectName', e.target.value)}
                                onBlur={() => setIsEditingProjectName(false)}
                                onKeyDown={e => e.key === 'Enter' && setIsEditingProjectName(false)}
                                placeholder="Enter Project Name"
                            />
                        ) : (
                            <div
                                className="text-base font-bold text-slate-700 cursor-pointer hover:text-indigo-600 transition-colors truncate"
                                onDoubleClick={() => setIsEditingProjectName(true)}
                                title="Double click to edit"
                            >
                                {formData.projectName || <span className="text-slate-400 font-normal italic">No project name</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* PART 2: Estimate Details Column */}
                <div className="flex flex-col gap-5 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff]">

                    {/* Row 1: Date & Est No */}
                    <div className="flex flex-col sm:flex-row gap-4 border-b border-slate-200/50 pb-4">
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

                    {/* Dropdown Container - ref for click-outside handling */}
                    <div ref={dropdownRef}>
                        {/* Row 2: Fringe Rate & Certified Payroll */}
                        <div className="flex gap-4 mb-4">
                            {/* Fringe */}
                            <div className="flex-1 relative flex flex-col items-center">
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
                                {activeDropdown === 'fringe' && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-56 p-2 rounded-2xl bg-[#eef2f6] shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] z-50 border border-white/40">
                                        <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                            <div
                                                onClick={() => {
                                                    onFringeChange('');
                                                    setActiveDropdown(null);
                                                }}
                                                className={`
                                                flex items-center justify-center p-2 rounded-lg cursor-pointer transition-all duration-200
                                                ${!formData.fringe
                                                        ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff] text-slate-800'
                                                        : 'hover:bg-white/50 text-slate-500'}
                                            `}
                                            >
                                                <span className="text-sm font-bold">None</span>
                                            </div>
                                            {fringeOptions.map((opt) => {
                                                const isSelected = formData.fringe === opt.value;
                                                return (
                                                    <div
                                                        key={opt.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onFringeChange(opt.value);
                                                            setActiveDropdown(null);
                                                        }}
                                                        className={`
                                                        flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all duration-200
                                                        ${isSelected
                                                                ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff] text-slate-800'
                                                                : 'hover:bg-white/50 text-slate-500'}
                                                    `}
                                                    >
                                                        {opt.color && (
                                                            <div
                                                                className="w-2 h-2 rounded-full"
                                                                style={{ backgroundColor: opt.color }}
                                                            />
                                                        )}
                                                        <span className="text-sm font-bold truncate">{opt.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Certified Payroll */}
                            <div className="flex-1 relative flex flex-col items-center">
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
                                {activeDropdown === 'certifiedPayroll' && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-56 p-2 rounded-2xl bg-[#eef2f6] shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] z-50 border border-white/40">
                                        <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1">
                                            <div
                                                onClick={() => {
                                                    onHeaderUpdate('certifiedPayroll', '');
                                                    setActiveDropdown(null);
                                                }}
                                                className={`
                                                flex items-center justify-center p-2 rounded-lg cursor-pointer transition-all duration-200
                                                ${!formData.certifiedPayroll
                                                        ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff] text-slate-800'
                                                        : 'hover:bg-white/50 text-slate-500'}
                                            `}
                                            >
                                                <span className="text-sm font-bold">None</span>
                                            </div>
                                            {certifiedPayrollOptions.map((opt) => {
                                                const isSelected = formData.certifiedPayroll === opt.value;
                                                return (
                                                    <div
                                                        key={opt.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onHeaderUpdate('certifiedPayroll', opt.value);
                                                            setActiveDropdown(null);
                                                        }}
                                                        className={`
                                                        flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all duration-200
                                                        ${isSelected
                                                                ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff] text-slate-800'
                                                                : 'hover:bg-white/50 text-slate-500'}
                                                    `}
                                                    >
                                                        {opt.color && (
                                                            <div
                                                                className="w-2 h-2 rounded-full"
                                                                style={{ backgroundColor: opt.color }}
                                                            />
                                                        )}
                                                        <span className="text-sm font-bold truncate">{opt.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Row 3: Services & Markup % */}
                        <div className="flex gap-4 mb-4">
                            {/* Services Column */}
                            <div className="flex-1 relative flex flex-col items-center">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block text-center">
                                    Services
                                </label>
                                {(() => {
                                    const selectedCount = formData.services?.length || 0;
                                    const hasSelection = selectedCount > 0;
                                    const isOpen = activeDropdown === 'services';

                                    return (
                                        <div
                                            onClick={() => setActiveDropdown(isOpen ? null : 'services')}
                                            className={`
                                                w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden
                                                ${isOpen
                                                    ? 'shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)]'
                                                    : hasSelection
                                                        ? 'shadow-[4px_4px_10px_rgba(0,102,255,0.4),-4px_-4px_10px_rgba(255,255,255,0.8)] text-white bg-[#0066FF]'
                                                        : 'shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] hover:shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] hover:-translate-y-0.5 bg-[#eef2f6] text-slate-400'}
                                            `}
                                        >
                                            {hasSelection ? (
                                                <span className="font-bold text-lg">{selectedCount}</span>
                                            ) : (
                                                <Layers className="w-5 h-5" />
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* Services Dropdown */}
                                {activeDropdown === 'services' && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 p-4 rounded-2xl bg-[#eef2f6] shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] z-50 border border-white/40">
                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                            {serviceOptions.map((opt) => {
                                                const isActive = isServiceActive(opt.value);
                                                return (
                                                    <div
                                                        key={opt.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleService(opt.value);
                                                        }}
                                                        className={`
                                                        group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200
                                                        ${isActive
                                                                ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff]'
                                                                : 'hover:bg-white/50'}
                                                    `}
                                                    >
                                                        <div className={`
                                                        w-4 h-4 rounded border flex items-center justify-center transition-colors
                                                        ${isActive ? 'bg-indigo-500 border-indigo-500' : 'border-slate-400 group-hover:border-indigo-400'}
                                                    `}>
                                                            {isActive && <ChevronDown className="w-3 h-3 text-white" />}
                                                        </div>
                                                        <span className={`text-sm font-medium ${isActive ? 'text-indigo-700' : 'text-slate-600'}`}>
                                                            {opt.label}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            {serviceOptions.length === 0 && (
                                                <div className="text-xs text-slate-400 text-center py-2">No services available</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Markup */}
                            <div className="flex-1 relative flex flex-col items-center">
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
                                    else if (markupValue >= 51) { fillColor = '#0066FF'; textColor = 'text-white'; }
                                    else if (markupValue >= 41) { fillColor = '#0066FF'; textColor = 'text-slate-800'; }
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
                                                        : 'shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] hover:shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] hover:-translate-y-0.5'}
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
                                            <span className={`relative z-10 font-bold text-xs ${hasValue ? textColor : 'text-slate-400'}`}>
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
                        <div className="flex gap-4">
                            {/* Proposal Writer */}
                            <div className="flex-1 relative flex flex-col items-center">
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
                                            onClick={() => setActiveDropdown(isOpen ? null : 'proposalWriter')}
                                            className={`
                                                w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden
                                                ${isOpen
                                                    ? 'shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)]'
                                                    : hasValue
                                                        ? 'shadow-[4px_4px_10px_rgba(0,0,0,0.15),-4px_-4px_10px_rgba(255,255,255,0.8)]'
                                                        : 'shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] hover:shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] hover:-translate-y-0.5 bg-[#eef2f6] text-slate-400'}
                                            `}
                                        >
                                            {hasValue && writerPic ? (
                                                <img
                                                    src={writerPic}
                                                    alt={writerLabel}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : hasValue ? (
                                                <div className="w-full h-full flex items-center justify-center bg-indigo-500 text-white text-xs font-bold">
                                                    {writerLabel.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                                </div>
                                            ) : (
                                                <PenSquare className="w-5 h-5" />
                                            )}

                                        </div>
                                    );
                                })()}


                                {/* Proposal Writer Dropdown */}
                                {activeDropdown === 'proposalWriter' && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 p-2 rounded-2xl bg-[#eef2f6] shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] z-50 border border-white/40">
                                        <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                                            <div
                                                onClick={() => {
                                                    onHeaderUpdate('proposalWriter', '');
                                                    setActiveDropdown(null);
                                                }}
                                                className={`
                                                flex items-center justify-center p-2 rounded-lg cursor-pointer transition-all duration-200
                                                ${!formData.proposalWriter
                                                        ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff] text-slate-800'
                                                        : 'hover:bg-white/50 text-slate-500'}
                                            `}
                                            >
                                                <span className="text-sm font-bold">None</span>
                                            </div>
                                            {employeeOptions.map((emp) => {
                                                const isSelected = formData.proposalWriter === emp.value;
                                                return (
                                                    <div
                                                        key={emp.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onHeaderUpdate('proposalWriter', emp.id);
                                                            setActiveDropdown(null);
                                                        }}
                                                        className={`
                                                        flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all duration-200
                                                        ${isSelected
                                                                ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff] text-indigo-700'
                                                                : 'hover:bg-white/50 text-slate-600'}
                                                    `}
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-indigo-500 border border-indigo-100 shadow-sm overflow-hidden">
                                                            {emp.profilePicture ? (
                                                                <img src={emp.profilePicture} alt={emp.label} className="w-full h-full object-cover" />
                                                            ) : (
                                                                emp.label.split(' ').map(n => n[0]).join('')
                                                            )}
                                                        </div>

                                                        <span className="text-sm font-bold truncate">{emp.label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>


                            {/* Status Column */}
                            <div className="flex-1 relative flex flex-col items-center">
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
                                            onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                                            className={`
                                            w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 relative overflow-hidden
                                            ${isDropdownOpen
                                                    ? 'shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)]'
                                                    : hasValue
                                                        ? 'shadow-[4px_4px_10px_rgba(0,0,0,0.15),-4px_-4px_10px_rgba(255,255,255,0.8)] text-white'
                                                        : 'shadow-[6px_6px_12px_#d1d9e6,-6px_-6px_12px_#ffffff] hover:shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] hover:-translate-y-0.5 bg-[#eef2f6] text-slate-400'}
                                        `}
                                            style={hasValue ? { backgroundColor: activeColor } : {}}
                                        >
                                            <Activity className="w-5 h-5" />
                                        </div>
                                    );
                                })()}

                                {/* Status Dropdown */}
                                {activeDropdown === 'status' && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-56 p-3 rounded-2xl bg-[#eef2f6] shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] z-50 border border-white/40">
                                        <div className="space-y-1">
                                            {[
                                                { id: 'draft', label: 'Draft', value: 'draft', color: '#94a3b8' },
                                                { id: 'confirmed', label: 'Confirmed', value: 'confirmed', color: '#10b981' },
                                                ...statusOptions
                                            ].map((opt) => {
                                                const isSelected = formData.status === opt.value;
                                                return (
                                                    <div
                                                        key={opt.id}
                                                        onClick={() => {
                                                            onStatusChange(opt.value);
                                                            setActiveDropdown(null);
                                                        }}
                                                        className={`
                                                        flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-200
                                                        ${isSelected
                                                                ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff]'
                                                                : 'hover:bg-white/50'}
                                                    `}
                                                    >
                                                        <div className="w-2 h-2 rounded-full bg-current" style={{ color: opt.color || '#64748b' }} />
                                                        <span className={`text-sm font-medium ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}>
                                                            {opt.label}
                                                        </span>
                                                        {isSelected && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
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
                />
            </div >
        </div >
    );
}
