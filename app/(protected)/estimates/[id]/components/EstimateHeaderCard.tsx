'use client';

import { ChevronDown } from 'lucide-react';
import { ServiceIcon, servicesList, statusIcon } from './ServiceIcon';
import { CostBreakdownChart } from './CostBreakdownChart';
import { VersionTimeline } from './VersionTimeline';

interface FormData {
    customerName?: string;
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
    const isConfirmed = formData.status === 'confirmed';

    return (
        <div className="bg-[#eef2f6] rounded-[40px] shadow-[12px_12px_24px_#d1d9e6,-12px_-12px_24px_#ffffff] p-4 sm:p-6 lg:p-8 mb-6">
            {/* 4-Column Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">

                {/* PART 1: Customer + Services */}
                <div className="flex flex-col gap-4 sm:gap-6 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff]">
                    {/* Customer */}
                    <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                            Customer
                        </label>
                        <div
                            className="text-lg sm:text-xl lg:text-2xl font-black text-slate-800 tracking-tight truncate"
                            title={formData.customerName || 'No Customer'}
                        >
                            {formData.customerName || 'No Customer'}
                        </div>
                    </div>

                    {/* Services */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">
                            Services
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 xl:grid-cols-3 gap-3">
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
                </div>

                {/* PART 2: Date/Project Title + Markup/Fringe */}
                <div className="flex flex-col gap-4 sm:gap-5 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff]">
                    {/* Date & Project Title (inline) */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                                Date
                            </label>
                            <div className="text-base sm:text-lg font-bold text-slate-600">
                                {formData.date || '-'}
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                                Estimate No.
                            </label>
                            <div
                                className="text-base sm:text-lg font-bold text-slate-600 truncate"
                                title={formData.estimate || '-'}
                            >
                                {formData.estimate || '-'}
                            </div>
                        </div>
                    </div>

                    {/* Markup */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                            Markup
                        </label>
                        <div className="relative shadow-[inset_4px_4px_8px_#d1d9e6,inset_-4px_-4px_8px_#ffffff] rounded-2xl p-1 bg-[#eef2f6] h-12 flex items-center">
                            <input
                                type="number"
                                value={formData.bidMarkUp || ''}
                                onChange={e => onHeaderUpdate('bidMarkUp', e.target.value)}
                                className="w-full bg-transparent text-lg sm:text-xl font-bold text-slate-700 h-full px-4 outline-none text-left"
                                placeholder="0"
                            />
                            <span className="absolute right-4 text-lg font-bold text-slate-400">%</span>
                        </div>
                    </div>

                    {/* Fringe */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                            Fringe Rate
                        </label>
                        <div className="relative shadow-[inset_4px_4px_8px_#d1d9e6,inset_-4px_-4px_8px_#ffffff] rounded-2xl p-1 bg-[#eef2f6] h-12 flex items-center">
                            <select
                                value={formData.fringe || ''}
                                onChange={e => onHeaderUpdate('fringe', e.target.value)}
                                className="w-full appearance-none bg-transparent text-base sm:text-lg font-bold text-slate-700 h-full px-4 outline-none cursor-pointer text-left"
                            >
                                <option value="">None</option>
                                <option value="HDD Public">HDD Public</option>
                                <option value="HDD Private">HDD Private</option>
                                <option value="Light Commercial">Light Commercial</option>
                            </select>
                            <div className="absolute right-4 pointer-events-none text-slate-400">
                                <ChevronDown className="w-[18px] h-[18px]" />
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
