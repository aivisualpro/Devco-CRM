'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import {
    SlidersHorizontal, PanelLeftOpen, PanelLeftClose,
    RotateCcw, Calendar, CalendarCheck, Activity, Building2, User,
    Briefcase, TrendingUp, DollarSign, BarChart3, Percent,
} from 'lucide-react';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { fmtMoney } from '@/lib/format/money';

export type DatePreset = 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'all_time' | 'custom';

interface FinancialsSidebarProps {
    // Date filters
    datePreset: DatePreset;
    setDatePreset: (v: DatePreset) => void;
    dateFrom: string;
    setDateFrom: (v: string) => void;
    dateTo: string;
    setDateTo: (v: string) => void;
    // Multi-select filters
    proposalWriters: string[];
    setProposalWriters: (v: string[]) => void;
    statuses: string[];
    setStatuses: (v: string[]) => void;
    customers: string[];
    setCustomers: (v: string[]) => void;
    // Options
    proposalWriterOptions: { value: string; label: string }[];
    statusOptions: { value: string; label: string }[];
    customerOptions: { value: string; label: string }[];
    // Summary
    projectCount: number;
    income: number;
    profit: number;
    avgMargin: number;
    backlog: number;
    arOutstanding: number;
    // Reset
    hasActiveFilters: boolean;
    onReset: () => void;
}

// Row 1: All Time | This Year | This Month
// Row 2: Last Year | Last Month | Custom
const PRESETS: { id: DatePreset; label: string }[][] = [
    [
        { id: 'all_time',   label: 'All Time' },
        { id: 'this_year',  label: 'This Year' },
        { id: 'this_month', label: 'This Month' },
    ],
    [
        { id: 'last_year',  label: 'Last Year' },
        { id: 'last_month', label: 'Last Month' },
        { id: 'custom',     label: 'Custom' },
    ],
];

export function FinancialsSidebar(props: FinancialsSidebarProps) {
    const [collapsed, setCollapsed] = useState(false);

    // Persist collapse state
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('financials_sidebar_collapsed');
            if (saved === 'true') setCollapsed(true);
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('financials_sidebar_collapsed', String(collapsed));
        }
    }, [collapsed]);

    const activeFilterCount = [
        props.proposalWriters.length > 0,
        props.statuses.length > 0,
        props.customers.length > 0,
        props.datePreset !== 'all_time',
    ].filter(Boolean).length;

    return (
        <div
            className={`shrink-0 border-r border-slate-200/80 bg-white flex flex-col min-h-0 h-full transition-all duration-300 ease-in-out ${
                collapsed ? 'w-12' : 'w-[280px]'
            }`}
        >
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
                {!collapsed && (
                    <>
                        <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs font-bold text-slate-800">Filters & Summary</span>
                    </>
                )}
                <div className="flex items-center gap-1 ml-auto">
                    {props.hasActiveFilters && !collapsed && (
                        <button
                            className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-red-50 transition-colors"
                            title="Reset all filters"
                            onClick={props.onReset}
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-red-500" />
                        </button>
                    )}
                    <button
                        className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-slate-100 transition-colors relative"
                        onClick={() => setCollapsed(v => !v)}
                    >
                        {collapsed ? (
                            <PanelLeftOpen className="w-3.5 h-3.5 text-slate-500" />
                        ) : (
                            <PanelLeftClose className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        {/* Active filter badge when collapsed */}
                        {collapsed && activeFilterCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Scrollable content */}
            {!collapsed && (
                <div className="flex-1 overflow-y-auto p-3 pr-4 pb-8 space-y-5">
                    {/* Filters section */}
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Date Range
                        </h3>

                        {/* Preset chips — 2 rows of 3 */}
                        <div className="space-y-1.5">
                            {PRESETS.map((row, rowIdx) => (
                                <div key={rowIdx} className="grid grid-cols-3 gap-1.5">
                                    {row.map((preset) => (
                                        <button
                                            key={preset.id}
                                            className={`px-1.5 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-200 text-center ${
                                                props.datePreset === preset.id
                                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                            onClick={() => props.setDatePreset(preset.id)}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* Custom date inputs */}
                        {props.datePreset === 'custom' && (
                            <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                                        <Calendar className="w-3 h-3" />
                                        From
                                    </label>
                                    <input
                                        type="date"
                                        value={props.dateFrom}
                                        onChange={(e) => props.setDateFrom(e.target.value)}
                                        className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-medium text-slate-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                                        <CalendarCheck className="w-3 h-3" />
                                        To
                                    </label>
                                    <input
                                        type="date"
                                        value={props.dateTo}
                                        onChange={(e) => props.setDateTo(e.target.value)}
                                        className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-medium text-slate-700"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Multi-select filters */}
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Filters
                        </h3>

                        <MultiSelect
                            label="Proposal Writer"
                            icon={<User className="w-3 h-3" />}
                            options={props.proposalWriterOptions}
                            selected={props.proposalWriters}
                            onChange={props.setProposalWriters}
                        />

                        <MultiSelect
                            label="Status"
                            icon={<Activity className="w-3 h-3" />}
                            options={props.statusOptions}
                            selected={props.statuses}
                            onChange={props.setStatuses}
                        />

                        <MultiSelect
                            label="Customer"
                            icon={<Building2 className="w-3 h-3" />}
                            options={props.customerOptions}
                            selected={props.customers}
                            onChange={props.setCustomers}
                        />
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                    {/* Quick Summary */}
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Quick Summary
                        </h3>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-blue-50/80 to-blue-100/30 p-3">
                                <p className="text-lg font-black tabular-nums text-blue-700 leading-none">
                                    {props.projectCount}
                                </p>
                                <p className="text-[10px] text-slate-500 font-semibold mt-1">Projects</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-emerald-50/80 to-emerald-100/30 p-3">
                                <p className="text-lg font-black tabular-nums text-emerald-700 leading-none">
                                    {fmtMoney(props.income)}
                                </p>
                                <p className="text-[10px] text-slate-500 font-semibold mt-1">Income</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-green-50/80 to-green-100/30 p-3">
                                <p className={`text-lg font-black tabular-nums leading-none ${props.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                    {fmtMoney(props.profit)}
                                </p>
                                <p className="text-[10px] text-slate-500 font-semibold mt-1">Profit</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-violet-50/80 to-violet-100/30 p-3">
                                <p className={`text-lg font-black tabular-nums leading-none ${props.avgMargin >= 0 ? 'text-violet-700' : 'text-red-600'}`}>
                                    {props.avgMargin.toFixed(1)}%
                                </p>
                                <p className="text-[10px] text-slate-500 font-semibold mt-1">Avg Margin</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-indigo-50/80 to-indigo-100/30 p-3">
                                <p className="text-lg font-black tabular-nums text-indigo-700 leading-none">
                                    {fmtMoney(props.backlog)}
                                </p>
                                <p className="text-[10px] text-slate-500 font-semibold mt-1">Backlog</p>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-gradient-to-br from-red-50/80 to-red-100/30 p-3">
                                <p className="text-lg font-black tabular-nums text-red-700 leading-none">
                                    {fmtMoney(props.arOutstanding)}
                                </p>
                                <p className="text-[10px] text-slate-500 font-semibold mt-1">A/R Owed</p>
                            </div>
                        </div>
                    </div>

                    {/* Reset button (bottom) */}
                    {props.hasActiveFilters && (
                        <button
                            onClick={props.onReset}
                            className="w-full py-2 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 transition-colors flex items-center justify-center gap-1.5"
                        >
                            <RotateCcw className="w-3 h-3" />
                            Reset All Filters
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default FinancialsSidebar;
