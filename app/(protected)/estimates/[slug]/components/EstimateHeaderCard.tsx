'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ServiceIcon, servicesList, statusIcon } from './ServiceIcon';
import { CostBreakdownChart } from './CostBreakdownChart';
import { VersionTimeline } from './VersionTimeline';
import { CustomerSelector } from './CustomerSelector';

import { ContactSelector } from './ContactSelector';

interface FormData {
    customerName?: string;
    customerId?: string;
    contactName?: string;
    contactId?: string;
    jobAddress?: string;
    projectName?: string;
    date?: string;
    estimate?: string;
    bidMarkUp?: string | number;
    fringe?: string;
    status?: string;
    directionalDrilling?: boolean;
    excavationBackfill?: boolean;
    hydroExcavation?: boolean;
    potholingCoring?: boolean;
    asphaltConcrete?: boolean;
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
    onServiceToggle: (serviceId: string) => void;
    onStatusToggle: () => void;
    onHeaderUpdate: (field: string, value: string | number) => void;
    onVersionClick: (id: string) => void;
}

export function EstimateHeaderCard({
    formData,
    chartData,
    versionHistory,
    currentEstimateId,
    chartAnimate,
    onServiceToggle,
    onStatusToggle,
    onHeaderUpdate,
    onVersionClick
}: EstimateHeaderCardProps) {
    const [isEditingCustomer, setIsEditingCustomer] = useState(false);
    const [isEditingContact, setIsEditingContact] = useState(false);
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [isEditingProjectName, setIsEditingProjectName] = useState(false);

    const isConfirmed = formData.status === 'confirmed';

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
                                className="text-base font-medium text-slate-600 cursor-pointer hover:text-indigo-600 transition-colors"
                                onDoubleClick={() => setIsEditingContact(true)}
                            >
                                {formData.contactName}
                            </div>
                        ) : (
                            <ContactSelector
                                value={formData.contactName}
                                customerId={formData.customerId as string}
                                onChange={(val: string, id?: string, address?: string) => {
                                    onHeaderUpdate('contactName', val);
                                    if (id) onHeaderUpdate('contactId', id);
                                    if (address) onHeaderUpdate('jobAddress', address);
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
                        {isEditingAddress ? (
                            <input
                                autoFocus
                                className="w-full bg-transparent border-b border-indigo-300 focus:border-indigo-600 outline-none text-sm text-slate-700 py-1"
                                value={formData.jobAddress || ''}
                                onChange={e => onHeaderUpdate('jobAddress', e.target.value)}
                                onBlur={() => setIsEditingAddress(false)}
                                onKeyDown={e => e.key === 'Enter' && setIsEditingAddress(false)}
                            />
                        ) : (
                            <div
                                className="text-sm text-slate-600 cursor-pointer hover:text-indigo-600 transition-colors leading-snug"
                                onDoubleClick={() => setIsEditingAddress(true)}
                            >
                                {formData.jobAddress || <span className="text-slate-400 italic">No address set</span>}
                            </div>
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
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                                Date
                            </label>
                            <div className="text-base font-bold text-slate-600">
                                {formData.date || '-'}
                            </div>
                        </div>
                        <div className="flex-1">
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

                    {/* Row 2: Services */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                            Services
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {servicesList.map((s) => (
                                <ServiceIcon
                                    key={s.id}
                                    id={s.id}
                                    label={s.label}
                                    icon={s.icon}
                                    isActive={!!formData[s.id]}
                                    onClick={() => onServiceToggle(s.id)}
                                />
                            ))}
                            <ServiceIcon
                                id={statusIcon.id}
                                label={isConfirmed ? 'Confirmed' : 'Draft'}
                                icon={statusIcon.icon}
                                isActive={isConfirmed}
                                isStatus={true}
                                onClick={onStatusToggle}
                            />
                        </div>
                    </div>

                    {/* Row 3: Markup & Fringe (Inline) */}
                    <div className="flex flex-row gap-4 pt-2">
                        {/* Markup */}
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                Markup %
                            </label>
                            <div className="relative shadow-[inset_2px_2px_4px_#d1d9e6,inset_-2px_-2px_4px_#ffffff] rounded-xl p-1 bg-[#eef2f6] h-10 flex items-center">
                                <input
                                    type="number"
                                    value={formData.bidMarkUp || ''}
                                    onChange={e => onHeaderUpdate('bidMarkUp', e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    className="w-full bg-transparent text-base font-bold text-slate-700 h-full px-3 outline-none text-center"
                                />
                            </div>
                        </div>

                        {/* Fringe */}
                        <div className="flex-[1.5]">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
                                Fringe Rate
                            </label>
                            <div className="relative shadow-[inset_2px_2px_4px_#d1d9e6,inset_-2px_-2px_4px_#ffffff] rounded-xl p-1 bg-[#eef2f6] h-10 flex items-center">
                                <select
                                    value={formData.fringe || ''}
                                    onChange={e => onHeaderUpdate('fringe', e.target.value)}
                                    className="w-full appearance-none bg-transparent text-sm font-bold text-slate-700 h-full px-3 outline-none cursor-pointer truncate"
                                >
                                    <option value="">None</option>
                                    <option value="HDD Public">HDD Public</option>
                                    <option value="HDD Private">HDD Private</option>
                                    <option value="Light Commercial">Light Commercial</option>
                                </select>
                                <div className="absolute right-2 pointer-events-none text-slate-400">
                                    <ChevronDown className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>
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
            </div>
        </div>
    );
}
