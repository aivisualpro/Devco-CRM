'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
    DollarSign, Receipt, Hammer, Wallet, FileText,
    TrendingUp, TrendingDown, Percent, CreditCard,
    BarChart3, Target, CircleDollarSign, ArrowDownToLine, SlidersHorizontal,
} from 'lucide-react';
import { fmtMoney, fmtCurrency } from '@/lib/format/money';
import { KpiCard } from './KpiCard';
import { AnimatedNumber } from './AnimatedNumber';
import { FinancialsSidebar, DatePreset } from './FinancialsSidebar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui';
import { computeInsights } from './computeInsights';
import { InsightCard } from './InsightCard';
import { DEFAULT_THRESHOLDS, FinancialThresholds } from '@/lib/constants/financialThresholds';

// Lazy-load recharts components
const MarginTrendChart = dynamic(() => import('./MarginTrendChart'), {
    ssr: false,
    loading: () => <ChartSkeleton />,
});
const ARAgingChart = dynamic(() => import('./ARAgingChart'), {
    ssr: false,
    loading: () => <ChartSkeleton />,
});
const CustomerConcentrationChart = dynamic(() => import('./CustomerConcentrationChart'), {
    ssr: false,
    loading: () => <ChartSkeleton />,
});
const RevenueBacklogWaterfall = dynamic(() => import('./RevenueBacklogWaterfall'), {
    ssr: false,
    loading: () => <ChartSkeleton />,
});

function ChartSkeleton() {
    return (
        <div className="w-full h-[300px] flex items-center justify-center">
            <div className="space-y-3 w-full px-6">
                <Skeleton className="h-4 w-1/3 rounded-md" />
                <Skeleton className="h-[240px] w-full rounded-xl" />
            </div>
        </div>
    );
}

function KpiSkeleton() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-slate-200/60 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-20 rounded" />
                        <Skeleton className="h-7 w-7 rounded-lg" />
                    </div>
                    <Skeleton className="h-7 w-28 rounded-md" />
                    <Skeleton className="h-3 w-16 rounded" />
                </div>
            ))}
        </div>
    );
}

interface Project {
    Id: string;
    DisplayName: string;
    CompanyName?: string;
    income?: number;
    cost?: number;
    qbCost?: number;
    devcoCost?: number;
    profitMargin?: number;
    startDate?: string;
    status?: string;
    proposalNumber?: string;
    proposalWriters?: string[];
    proposalSlug?: string;
    originalContract?: number;
    changeOrders?: number;
    ar?: number;
    ap?: number;
    avgCostPerHr?: number;
    MetaData: { CreateTime: string };
}

interface FinancialsViewProps {
    projects: Project[];
    loading: boolean;
    onExportPdf?: () => void;
    isExportingPdf?: boolean;
}

// PT timezone helper
function getPTDate(): Date {
    const now = new Date();
    const ptStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    return new Date(ptStr + 'T00:00:00');
}

function computeDateRange(preset: DatePreset): { from: string; to: string } {
    const pt = getPTDate();
    const y = pt.getFullYear();
    const m = pt.getMonth();
    const today = pt.toISOString().slice(0, 10);

    switch (preset) {
        case 'this_month':
            return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: today };
        case 'last_month': {
            const lm = m === 0 ? 11 : m - 1;
            const ly = m === 0 ? y - 1 : y;
            const lastDay = new Date(ly, lm + 1, 0).getDate();
            return {
                from: `${ly}-${String(lm + 1).padStart(2, '0')}-01`,
                to: `${ly}-${String(lm + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
            };
        }
        case 'this_year':
            return { from: `${y}-01-01`, to: today };
        case 'last_year':
            return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
        case 'all_time':
            return { from: '', to: '' };
        case 'custom':
            return { from: '', to: '' };
    }
}

export function FinancialsView({ projects, loading, onExportPdf, isExportingPdf }: FinancialsViewProps) {
    // Filter state
    const [datePreset, setDatePreset] = useState<DatePreset>('all_time');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [proposalWriters, setProposalWriters] = useState<string[]>([]);
    const [statuses, setStatuses] = useState<string[]>([]);
    const [customers, setCustomers] = useState<string[]>([]);

    // Compute effective dates
    const { dateFrom, dateTo } = useMemo(() => {
        if (datePreset === 'custom') return { dateFrom: customFrom, dateTo: customTo };
        const range = computeDateRange(datePreset);
        return { dateFrom: range.from, dateTo: range.to };
    }, [datePreset, customFrom, customTo]);

    const handlePresetChange = useCallback((preset: DatePreset) => {
        setDatePreset(preset);
        if (preset !== 'custom') {
            setCustomFrom('');
            setCustomTo('');
        }
    }, []);

    // Options from projects
    const proposalWriterOptions = useMemo(() => {
        const set = new Set<string>();
        projects.forEach(p => {
            if (p.proposalWriters) p.proposalWriters.forEach(w => { if (w) set.add(w); });
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [projects]);

    const statusOptions = useMemo(() => {
        const set = new Set<string>();
        projects.forEach(p => { if (p.status) set.add(p.status); });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [projects]);

    const customerOptions = useMemo(() => {
        const set = new Set<string>();
        projects.forEach(p => { if (p.CompanyName) set.add(p.CompanyName); });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [projects]);

    // Filter pipeline
    const filtered = useMemo(() => {
        return projects.filter(p => {
            const refDateStr = p.startDate || p.MetaData?.CreateTime;
            if (refDateStr) {
                const refDate = new Date(refDateStr);
                if (dateFrom && refDate < new Date(dateFrom + 'T00:00:00')) return false;
                if (dateTo && refDate > new Date(dateTo + 'T23:59:59')) return false;
            }
            if (proposalWriters.length > 0) {
                const pw = p.proposalWriters || [];
                if (!proposalWriters.some(w => pw.includes(w))) return false;
            }
            if (statuses.length > 0 && !statuses.includes(p.status || '')) return false;
            if (customers.length > 0 && !customers.includes(p.CompanyName || '')) return false;
            return true;
        });
    }, [projects, dateFrom, dateTo, proposalWriters, statuses, customers]);

    // Previous period for comparison
    const prevFiltered = useMemo(() => {
        if (datePreset === 'all_time' || datePreset === 'custom' || !dateFrom || !dateTo) return null;
        const fromD = new Date(dateFrom);
        const toD = new Date(dateTo);
        const diff = toD.getTime() - fromD.getTime();
        const prevTo = new Date(fromD.getTime() - 1);
        const prevFrom = new Date(prevTo.getTime() - diff);
        const pf = prevFrom.toISOString().slice(0, 10);
        const pt = prevTo.toISOString().slice(0, 10);

        return projects.filter(p => {
            const refDateStr = p.startDate || p.MetaData?.CreateTime;
            if (!refDateStr) return false;
            const refDate = new Date(refDateStr);
            if (refDate < new Date(pf + 'T00:00:00')) return false;
            if (refDate > new Date(pt + 'T23:59:59')) return false;
            if (proposalWriters.length > 0) {
                const pw = p.proposalWriters || [];
                if (!proposalWriters.some(w => pw.includes(w))) return false;
            }
            if (statuses.length > 0 && !statuses.includes(p.status || '')) return false;
            if (customers.length > 0 && !customers.includes(p.CompanyName || '')) return false;
            return true;
        });
    }, [projects, datePreset, dateFrom, dateTo, proposalWriters, statuses, customers]);

    // KPIs
    const kpis = useMemo(() => {
        const sum = (key: keyof Project) => filtered.reduce((s, p) => s + (Number(p[key]) || 0), 0);
        const income = sum('income');
        const qbCost = sum('qbCost');
        const jobTicketCost = sum('devcoCost');
        const originalContract = sum('originalContract');
        const changeOrders = sum('changeOrders');
        const totalCost = qbCost + jobTicketCost;
        const profit = income - totalCost;
        const marginPct = income > 0 ? (profit / income) * 100 : 0;
        // A/R = Income - Payments (real outstanding receivables)
        const arOutstanding = sum('ar');
        const paymentsReceived = income - arOutstanding;
        const collectedPct = income > 0 ? (paymentsReceived / income) * 100 : 0;
        const payables = sum('ap');
        // Contract Value = Original + Change Orders
        const contractValue = originalContract + changeOrders;
        // Backlog = Contract Value - Revenue Earned
        const backlog = Math.max(0, contractValue - income);
        // % Complete (weighted) = Revenue / Contract Value
        const pctComplete = contractValue > 0 ? Math.min(100, (income / contractValue) * 100) : 0;
        const pctCompleteFrac = pctComplete / 100;
        // Avg Project Size
        const projectCount = filtered.length;
        const avgProjectSize = projectCount > 0 ? contractValue / projectCount : 0;
        // EAC = totalCost / pctComplete (forecast total cost at completion)
        const eac = pctCompleteFrac > 0 ? totalCost / pctCompleteFrac : 0;
        // Over/(Under) Billing = income - contractValue × pctComplete
        const overUnderBilling = income - contractValue * pctCompleteFrac;
        // DSO = (arOutstanding / income) × periodDays
        const periodDays = (() => {
            if (!dateFrom || !dateTo) return 365;
            const d1 = new Date(dateFrom);
            const d2 = new Date(dateTo);
            return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
        })();
        const dso = income > 0 ? Math.round((arOutstanding / income) * periodDays) : 0;
        return { income, qbCost, jobTicketCost, totalCost, originalContract, changeOrders, profit, marginPct, projectCount, arOutstanding, paymentsReceived, collectedPct, payables, contractValue, backlog, pctComplete, avgProjectSize, eac, overUnderBilling, dso, periodDays };
    }, [filtered, dateFrom, dateTo]);

    // Previous period KPIs for trend
    const prevKpis = useMemo(() => {
        if (!prevFiltered) return null;
        const sum = (key: keyof Project) => prevFiltered.reduce((s, p) => s + (Number(p[key]) || 0), 0);
        const income = sum('income');
        const qbCost = sum('qbCost');
        const jobTicketCost = sum('devcoCost');
        const totalCost = qbCost + jobTicketCost;
        const profit = income - totalCost;
        const originalContract = sum('originalContract');
        const changeOrders = sum('changeOrders');
        const contractValue = originalContract + changeOrders;
        const backlog = Math.max(0, contractValue - income);
        const marginPct = income > 0 ? (profit / income) * 100 : 0;
        const arOutstanding = sum('ar');
        const paymentsReceived = income - arOutstanding;
        const payables = sum('ap');
        const projectCount = prevFiltered.length;
        const avgProjectSize = projectCount > 0 ? contractValue / projectCount : 0;
        return { income, totalCost, profit, originalContract, changeOrders, contractValue, backlog, marginPct, arOutstanding, paymentsReceived, payables, avgProjectSize };
    }, [prevFiltered]);

    const trend = (current: number, prev: number | undefined) => {
        if (prev === undefined || prev === 0) return null;
        return ((current - prev) / Math.abs(prev)) * 100;
    };

    // 3.1 — Margin Trend (monthly)
    const marginTrendData = useMemo(() => {
        const monthMap = new Map<string, { income: number; totalCost: number }>();
        filtered.forEach(p => {
            const d = p.startDate || p.MetaData?.CreateTime;
            if (!d) return;
            const dt = new Date(d);
            const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
            const entry = monthMap.get(key) || { income: 0, totalCost: 0 };
            entry.income += p.income || 0;
            entry.totalCost += (p.qbCost || 0) + (p.devcoCost || 0);
            monthMap.set(key, entry);
        });
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return Array.from(monthMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-12)
            .map(([key, v]) => {
                const [y, m] = key.split('-');
                const grossMargin = v.income > 0 ? ((v.income - v.totalCost) / v.income) * 100 : 0;
                // Operating margin approximation (gross margin - overhead estimate ~5%)
                const operatingMargin = grossMargin - 5;
                return { month: `${monthNames[parseInt(m) - 1]} ${y.slice(2)}`, grossMargin: Math.round(grossMargin * 10) / 10, operatingMargin: Math.round(operatingMargin * 10) / 10 };
            });
    }, [filtered]);

    // 3.2 — AR Aging Buckets (project-level approximation)
    const arAgingData = useMemo(() => {
        const now = new Date();
        const buckets = { '0–30': 0, '31–60': 0, '61–90': 0, '91+': 0 };
        const colors = { '0–30': '#22c55e', '31–60': '#eab308', '61–90': '#f97316', '91+': '#ef4444' };
        filtered.forEach(p => {
            const ar = p.ar || 0;
            if (ar <= 0) return;
            const d = p.startDate || p.MetaData?.CreateTime;
            if (!d) return;
            const daysOld = Math.floor((now.getTime() - new Date(d).getTime()) / 86400000);
            if (daysOld <= 30) buckets['0–30'] += ar;
            else if (daysOld <= 60) buckets['31–60'] += ar;
            else if (daysOld <= 90) buckets['61–90'] += ar;
            else buckets['91+'] += ar;
        });
        return Object.entries(buckets).map(([bucket, amount]) => ({
            bucket,
            amount,
            color: colors[bucket as keyof typeof colors],
        }));
    }, [filtered]);

    // 3.3 — Customer Concentration (top 10)
    const topCustomers = useMemo(() => {
        const map = new Map<string, number>();
        filtered.forEach(p => {
            const name = p.CompanyName || 'Unknown';
            map.set(name, (map.get(name) || 0) + (p.income || 0));
        });
        return Array.from(map.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([customer, income]) => ({ customer, income }));
    }, [filtered]);

    // 3.4 — Revenue vs Backlog Waterfall (monthly)
    const waterfallData = useMemo(() => {
        const monthMap = new Map<string, { earned: number; contractValue: number }>();
        filtered.forEach(p => {
            const d = p.startDate || p.MetaData?.CreateTime;
            if (!d) return;
            const dt = new Date(d);
            const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
            const entry = monthMap.get(key) || { earned: 0, contractValue: 0 };
            entry.earned += p.income || 0;
            entry.contractValue += (p.originalContract || 0) + (p.changeOrders || 0);
            monthMap.set(key, entry);
        });
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        let cumCV = 0;
        return Array.from(monthMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-12)
            .map(([key, v]) => {
                const [y, m] = key.split('-');
                cumCV += v.contractValue;
                const backlogBurn = Math.max(0, v.contractValue - v.earned);
                return {
                    month: `${monthNames[parseInt(m) - 1]} ${y.slice(2)}`,
                    earned: v.earned,
                    backlogBurn,
                    cumulativeContractValue: cumCV,
                };
            });
    }, [filtered]);

    // Top 10 by profit
    const top10 = useMemo(() => {
        return [...filtered]
            .map(p => {
                const inc = p.income || 0;
                const cost = (p.qbCost || 0) + (p.devcoCost || 0);
                const profit = inc - cost;
                const margin = inc > 0 ? (profit / inc) * 100 : 0;
                const arVal = p.ar || 0;
                const contractVal = (p.originalContract || 0) + (p.changeOrders || 0);
                const pctComplete = contractVal > 0 ? Math.min(100, (inc / contractVal) * 100) : 0;
                return { ...p, calcIncome: inc, calcCost: cost, calcProfit: profit, calcMargin: margin, calcAR: arVal, calcPctComplete: pctComplete };
            })
            .sort((a, b) => b.calcProfit - a.calcProfit)
            .slice(0, 10);
    }, [filtered]);

    const hasActiveFilters = datePreset !== 'all_time' || proposalWriters.length > 0 || statuses.length > 0 || customers.length > 0;

    const resetFilters = useCallback(() => {
        setDatePreset('all_time');
        setCustomFrom('');
        setCustomTo('');
        setProposalWriters([]);
        setStatuses([]);
        setCustomers([]);
    }, []);

    // Mobile sidebar state
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // Sticky context strip scroll detection
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showSticky, setShowSticky] = useState(false);
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onScroll = () => setShowSticky(el.scrollTop > 10);
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    // Fetch financial thresholds from settings
    const [thresholds, setThresholds] = useState<FinancialThresholds>(DEFAULT_THRESHOLDS);
    useEffect(() => {
        fetch('/api/settings/financial-thresholds')
            .then(r => r.json())
            .then(data => { if (data && data.targetGrossMarginPct !== undefined) setThresholds(data); })
            .catch(() => {});
    }, []);

    // Period label for print header
    const periodLabel = datePreset === 'custom'
        ? `${customFrom} — ${customTo}`
        : datePreset.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

    if (loading) {
        return (
            <div className="flex h-full">
                <div className="hidden md:block w-[280px] shrink-0 border-r border-slate-200/80 p-4 space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
                </div>
                <div className="flex-1 p-4 md:p-6"><KpiSkeleton /></div>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 animate-fade-in relative">
            {/* Mobile sidebar overlay — starts below the 48px app header */}
            {mobileSidebarOpen && (
                <div
                    className="fixed top-12 inset-x-0 bottom-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                    onClick={() => setMobileSidebarOpen(false)}
                />
            )}

            {/* Sidebar — always visible on md+, slide-in sheet on mobile (below header) */}
            <div className={`
                md:relative md:flex md:shrink-0
                fixed top-12 bottom-0 left-0 z-50 md:z-auto md:top-auto md:bottom-auto
                transform transition-transform duration-300 ease-in-out
                shadow-2xl md:shadow-none rounded-tr-2xl md:rounded-none overflow-hidden
                ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <FinancialsSidebar
                    datePreset={datePreset}
                    setDatePreset={handlePresetChange}
                    dateFrom={datePreset === 'custom' ? customFrom : dateFrom}
                    setDateFrom={setCustomFrom}
                    dateTo={datePreset === 'custom' ? customTo : dateTo}
                    setDateTo={setCustomTo}
                    proposalWriters={proposalWriters}
                    setProposalWriters={setProposalWriters}
                    statuses={statuses}
                    setStatuses={setStatuses}
                    customers={customers}
                    setCustomers={setCustomers}
                    proposalWriterOptions={proposalWriterOptions}
                    statusOptions={statusOptions}
                    customerOptions={customerOptions}
                    projectCount={kpis.projectCount}
                    income={kpis.income}
                    profit={kpis.profit}
                    avgMargin={kpis.marginPct}
                    backlog={kpis.backlog}
                    arOutstanding={kpis.arOutstanding}
                    hasActiveFilters={hasActiveFilters}
                    onReset={resetFilters}
                />
            </div>

            {/* Main dashboard */}
            <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto relative">
                {/* Sticky context strip — sits at absolute top of scroll container */}
                <div className={`sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/70 print:hidden transition-all duration-200 ${
                    showSticky ? 'shadow-sm' : 'shadow-none opacity-0 pointer-events-none'
                }`}>
                    <div className="flex items-center gap-3 md:gap-6 px-4 md:px-6 py-2 overflow-x-auto text-xs font-bold">
                        <span className="text-slate-400 uppercase tracking-wider text-[10px] shrink-0">Summary</span>
                        <span className="shrink-0" title={fmtCurrency(kpis.income)}>Income <span className="text-emerald-700 ml-1">{fmtMoney(kpis.income)}</span></span>
                        <span className="shrink-0" title={fmtCurrency(kpis.profit)}>Profit <span className={`ml-1 ${kpis.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtMoney(kpis.profit)}</span></span>
                        <span className="shrink-0">Margin <span className={`ml-1 ${kpis.marginPct >= 0 ? 'text-green-700' : 'text-red-600'}`}>{kpis.marginPct.toFixed(1)}%</span></span>
                        <span className="shrink-0" title={fmtCurrency(kpis.backlog)}>Backlog <span className="text-blue-700 ml-1">{fmtMoney(kpis.backlog)}</span></span>
                        <span className="shrink-0">Projects <span className="text-slate-800 ml-1">{kpis.projectCount}</span></span>
                    </div>
                </div>

                {/* Insights Ticker — flush below sticky header, no padding gap */}
                {(() => {
                    const allInsights = computeInsights(filtered as any, thresholds);
                    const tickerItems = allInsights.filter(i => i.severity === 'critical' || i.severity === 'warning');
                    if (!tickerItems.length) return null;
                    const SEVERITY_TICKER: Record<string, { bg: string; text: string }> = {
                        critical: { bg: 'bg-red-600',   text: 'text-white' },
                        warning:  { bg: 'bg-amber-500', text: 'text-white' },
                    };
                    const items = [...tickerItems, ...tickerItems];
                    const duration = `${tickerItems.length * 3}s`;
                    return (
                        <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 print:hidden group/ticker mx-4 md:mx-6">
                                {/* Scrolling track — full width, no LIVE badge */}
                                <div className="overflow-hidden">
                                    <div
                                        className="financials-ticker-track flex items-center whitespace-nowrap"
                                        style={{ animationDuration: duration }}
                                    >
                                        {items.map((ins, idx) => {
                                            const st = SEVERITY_TICKER[ins.severity];
                                            return (
                                                <span key={idx} className="inline-flex items-center gap-2 px-5 py-2.5 text-[11px] font-semibold text-slate-200">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${st.bg} ${st.text} text-[9px] font-black uppercase tracking-wider shrink-0`}>
                                                        {ins.severity}
                                                    </span>
                                                    <span className="font-bold text-white">{ins.title}</span>
                                                    <span className="text-slate-500">—</span>
                                                    <span className="text-slate-300">{ins.detail}</span>
                                                    {ins.metric && (
                                                        <span className="ml-1 px-2 py-0.5 rounded-full bg-white/10 text-white text-[9px] font-bold">
                                                            {ins.metric.label}: {ins.metric.value}
                                                        </span>
                                                    )}
                                                    <span className="text-slate-700 mx-3">▪︎</span>
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            <style>{`
                                .financials-ticker-track {
                                    animation: financials-ticker-anim linear infinite;
                                }
                                @keyframes financials-ticker-anim {
                                    0%   { transform: translateX(0); }
                                    100% { transform: translateX(-50%); }
                                }
                                .group\/ticker:hover .financials-ticker-track {
                                    animation-play-state: paused;
                                }
                            `}</style>
                        </div>
                    );
                })()}

                <div className="p-4 md:p-6 space-y-5 md:space-y-6">
                {/* Print-only header */}
                <div className="hidden print:block mb-4 border-b border-slate-300 pb-3">
                    <h1 className="text-lg font-black text-slate-900">DEVCO Financials — {periodLabel}</h1>
                    <p className="text-xs text-slate-500">Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                {/* Mobile top bar — filter toggle */}
                <div className="flex items-center justify-between md:hidden print:hidden">
                    <button
                        onClick={() => setMobileSidebarOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                        Filters
                        {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                    </button>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <span className="text-emerald-700">{fmtMoney(kpis.income)}</span>
                        <span>·</span>
                        <span className={kpis.marginPct >= 0 ? 'text-green-700' : 'text-red-600'}>{kpis.marginPct.toFixed(1)}%</span>
                    </div>
                </div>


                {filtered.length === 0 ? (
                    <EmptyState
                        icon={<TrendingDown className="w-8 h-8 text-slate-400" />}
                        title="No projects match these filters"
                        description="Try widening the date range or clearing some filters."
                        cta={
                            <button
                                onClick={resetFilters}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                            >
                                Reset Filters
                            </button>
                        }
                    />
                ) : (
                    <>
                        {/* ROW A — Revenue & Backlog (5 cards) */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
                            <KpiCard
                                label="Total Contract Value"
                                value={<AnimatedNumber value={kpis.contractValue} formatter={fmtMoney} />}
                                icon={<FileText className="w-4 h-4 text-emerald-600" />}
                                gradient="from-emerald-50 to-emerald-100/40"
                                subtitle={`Orig ${fmtMoney(kpis.originalContract)} + CO ${fmtMoney(kpis.changeOrders)}`}
                                trend={trend(kpis.contractValue, prevKpis?.contractValue)}
                            />
                            <KpiCard
                                label="Earned Revenue"
                                value={<AnimatedNumber value={kpis.income} formatter={fmtMoney} />}
                                icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
                                gradient="from-emerald-50 to-emerald-100/40"
                                subtitle={`from ${kpis.projectCount} projects`}
                                trend={trend(kpis.income, prevKpis?.income)}
                            />
                            <KpiCard
                                label="Backlog"
                                value={<AnimatedNumber value={kpis.backlog} formatter={fmtMoney} />}
                                icon={<ArrowDownToLine className="w-4 h-4 text-blue-600" />}
                                gradient="from-blue-50 to-blue-100/40"
                                subtitle="remaining to bill"
                                trend={trend(kpis.backlog, prevKpis?.backlog)}
                            />
                            <KpiCard
                                label="% Complete"
                                value={<><AnimatedNumber value={kpis.pctComplete} formatter={(n) => n.toFixed(1)} />%</>}
                                icon={<Target className="w-4 h-4 text-blue-600" />}
                                gradient="from-blue-50 to-blue-100/40"
                                subtitle="weighted by revenue"
                            />
                            <KpiCard
                                label="Avg Project Size"
                                value={<AnimatedNumber value={kpis.avgProjectSize} formatter={fmtMoney} />}
                                icon={<BarChart3 className="w-4 h-4 text-emerald-600" />}
                                gradient="from-emerald-50 to-emerald-100/40"
                                trend={trend(kpis.avgProjectSize, prevKpis?.avgProjectSize)}
                            />
                        </div>

                        {/* ROW B — Cost & Profitability (5 cards) */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3">
                            <KpiCard
                                label="Total Cost"
                                value={<AnimatedNumber value={kpis.totalCost} formatter={fmtMoney} />}
                                icon={<Wallet className="w-4 h-4 text-orange-600" />}
                                gradient="from-orange-50 to-amber-100/40"
                                badge={kpis.income > 0 ? `${((kpis.totalCost / kpis.income) * 100).toFixed(0)}% of Revenue` : undefined}
                                badgeColor="amber"
                            />
                            <KpiCard
                                label="Gross Profit"
                                value={<AnimatedNumber value={kpis.profit} formatter={fmtMoney} />}
                                icon={<TrendingUp className="w-4 h-4" style={{ color: kpis.profit >= 0 ? '#16a34a' : '#dc2626' }} />}
                                gradient={kpis.profit >= 0 ? 'from-green-50 to-green-100/40' : 'from-red-50 to-red-100/40'}
                                trend={trend(kpis.profit, prevKpis?.profit)}
                            />
                            <KpiCard
                                label="Gross Margin %"
                                value={<><AnimatedNumber value={kpis.marginPct} formatter={(n) => n.toFixed(1)} />%</>}
                                icon={<Percent className="w-4 h-4" style={{ color: kpis.marginPct >= 0 ? '#16a34a' : '#dc2626' }} />}
                                gradient={kpis.marginPct >= 0 ? 'from-green-50 to-green-100/40' : 'from-red-50 to-red-100/40'}
                                trend={trend(kpis.marginPct, prevKpis?.marginPct)}
                            />
                            <KpiCard
                                label="EAC (Forecast)"
                                value={<AnimatedNumber value={kpis.eac} formatter={fmtMoney} />}
                                icon={<Target className="w-4 h-4 text-blue-600" />}
                                gradient="from-blue-50 to-blue-100/40"
                                subtitle={kpis.pctComplete > 0 ? `at ${kpis.pctComplete.toFixed(0)}% complete` : 'awaiting progress'}
                            />
                            <KpiCard
                                label="Over/(Under) Billing"
                                value={<AnimatedNumber value={kpis.overUnderBilling} formatter={fmtMoney} />}
                                icon={<TrendingUp className="w-4 h-4" style={{ color: kpis.overUnderBilling >= 0 ? '#16a34a' : '#dc2626' }} />}
                                gradient={kpis.overUnderBilling >= 0 ? 'from-green-50 to-green-100/40' : 'from-red-50 to-red-100/40'}
                                subtitle={kpis.overUnderBilling >= 0 ? 'over-billed (good cash)' : 'under-billed'}
                            />
                        </div>

                        {/* ROW C — Cash (4 compact/muted cards) */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                            <KpiCard
                                compact
                                label="Payments Received"
                                value={<AnimatedNumber value={kpis.paymentsReceived} formatter={fmtMoney} />}
                                icon={<CircleDollarSign className="w-3.5 h-3.5 text-violet-600" />}
                                gradient="from-violet-50/60 to-violet-100/30"
                                badge={kpis.income > 0 ? `${kpis.collectedPct.toFixed(0)}% collected` : undefined}
                                badgeColor="violet"
                            />
                            <KpiCard
                                compact
                                label="A/R Outstanding"
                                value={<AnimatedNumber value={kpis.arOutstanding} formatter={fmtMoney} />}
                                icon={<CreditCard className="w-3.5 h-3.5 text-violet-600" />}
                                gradient="from-violet-50/60 to-violet-100/30"
                                badge={kpis.income > 0 ? `${((kpis.arOutstanding / kpis.income) * 100).toFixed(0)}% outstanding` : undefined}
                                badgeColor="violet"
                            />
                            <KpiCard
                                compact
                                label="Payables (A/P)"
                                value={<AnimatedNumber value={kpis.payables} formatter={fmtMoney} />}
                                icon={<Receipt className="w-3.5 h-3.5 text-rose-600" />}
                                gradient="from-rose-50/60 to-rose-100/30"
                                badge={kpis.income > 0 ? `${((kpis.payables / kpis.income) * 100).toFixed(0)}% of Revenue` : undefined}
                                badgeColor="red"
                            />
                            <KpiCard
                                compact
                                label="DSO"
                                value={<><AnimatedNumber value={kpis.dso} formatter={(n) => Math.round(n).toString()} /> days</>}
                                icon={<Hammer className="w-3.5 h-3.5 text-rose-600" />}
                                gradient="from-rose-50/60 to-rose-100/30"
                                subtitle={`over ${kpis.periodDays} day period`}
                            />
                        </div>

                        {/* Insights Panel — horizontal scroll */}
                        {(() => {
                            const insights = computeInsights(filtered as any, thresholds);
                            if (!insights.length) return null;
                            return (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                            Insights
                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                                                {insights.length}
                                            </span>
                                        </h3>
                                    </div>
                                    <div className="flex gap-3 overflow-x-auto pb-3 pt-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                        {insights.map(ins => (
                                            <InsightCard key={ins.id} insight={ins} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Charts — 2×2 grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* 3.1 — Margin Trend */}
                            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                                <h3 className="text-sm font-black text-slate-800 mb-4">Margin Trend (Last 12 Months)</h3>
                                <MarginTrendChart data={marginTrendData} targetMargin={thresholds.targetGrossMarginPct} />
                            </div>

                            {/* 3.2 — AR Aging */}
                            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-black text-slate-800">A/R Aging</h3>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">by project start date</span>
                                </div>
                                <ARAgingChart data={arAgingData} totalAR={kpis.arOutstanding} />
                            </div>

                            {/* 3.3 — Customer Concentration */}
                            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                                <h3 className="text-sm font-black text-slate-800 mb-3">Customer Concentration</h3>
                                <CustomerConcentrationChart data={topCustomers} totalIncome={kpis.income} />
                            </div>

                            {/* 3.4 — Revenue vs Backlog Waterfall */}
                            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                                <h3 className="text-sm font-black text-slate-800 mb-4">Revenue vs Backlog</h3>
                                <RevenueBacklogWaterfall data={waterfallData} />
                            </div>
                        </div>

                        {/* Top 10 by Profit table */}
                        {top10.length > 0 && (() => {
                            const orgAvgMargin = kpis.income > 0 ? (kpis.profit / kpis.income) * 100 : 0;
                            return (
                            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                                <h3 className="text-sm font-black text-slate-800 mb-4">Top 10 Projects by Profit</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-100">
                                                <th className="text-left py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">#</th>
                                                <th className="text-left py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Proposal</th>
                                                <th className="text-left py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Customer</th>
                                                <th className="text-left py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Project</th>
                                                <th className="text-right py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Income</th>
                                                <th className="text-right py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Cost</th>
                                                <th className="text-right py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Profit</th>
                                                <th className="text-right py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Margin</th>
                                                <th className="text-right py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">A/R</th>
                                                <th className="text-right py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">% Done</th>
                                                <th className="text-center py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {top10.map((p, i) => {
                                                // Compute anomaly badges
                                                const cv = (p.originalContract || 0) + (p.changeOrders || 0);
                                                const costRatio = cv > 0 ? p.calcCost / cv : 0;
                                                const billedPct = cv > 0 ? (p.calcIncome / cv) * 100 : 0;
                                                const badges: { emoji: string; label: string; color: string }[] = [];

                                                // 🔴 Over budget
                                                if (costRatio > 0.95 && p.calcPctComplete < 90) {
                                                    badges.push({ emoji: '🔴', label: `Over budget: ${(costRatio * 100).toFixed(0)}% cost at ${p.calcPctComplete.toFixed(0)}% complete`, color: 'bg-red-100 text-red-700' });
                                                }
                                                // 🟡 Slow billing (AR > 0 and project started 45+ days ago)
                                                const startD = p.startDate || p.MetaData?.CreateTime;
                                                const daysSinceStart = startD ? Math.floor((Date.now() - new Date(startD).getTime()) / 86400000) : 0;
                                                if (p.calcAR > 0 && daysSinceStart > 45) {
                                                    badges.push({ emoji: '🟡', label: `Slow billing: ${fmtMoney(p.calcAR)} outstanding ${daysSinceStart}d`, color: 'bg-amber-100 text-amber-700' });
                                                }
                                                // 🟠 Under-billed (% complete > billed %)
                                                if (cv > 0 && p.calcPctComplete > billedPct + 10) {
                                                    badges.push({ emoji: '🟠', label: `Under-billed: ${p.calcPctComplete.toFixed(0)}% done but ${billedPct.toFixed(0)}% billed`, color: 'bg-orange-100 text-orange-700' });
                                                }
                                                // 🟢 Outperforming
                                                if (orgAvgMargin > 0 && p.calcMargin > orgAvgMargin * 1.5) {
                                                    badges.push({ emoji: '🟢', label: `Outperforming: ${p.calcMargin.toFixed(0)}% margin vs ${orgAvgMargin.toFixed(0)}% org avg`, color: 'bg-emerald-100 text-emerald-700' });
                                                }

                                                return (
                                                <tr
                                                    key={p.Id}
                                                    className="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer transition-colors"
                                                    onClick={() => {
                                                        if (p.proposalSlug) window.open(`/estimates/${p.proposalSlug}`, '_blank');
                                                    }}
                                                >
                                                    <td className="py-2.5 px-3 font-bold text-slate-400">{i + 1}</td>
                                                    <td className="py-2.5 px-3 font-bold text-blue-600">{p.proposalNumber || '—'}</td>
                                                    <td className="py-2.5 px-3 font-medium text-slate-700 max-w-[140px] truncate">{p.CompanyName || '—'}</td>
                                                    <td className="py-2.5 px-3 font-medium text-slate-700 max-w-[160px] truncate">{p.DisplayName}</td>
                                                    <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-900">{fmtMoney(p.calcIncome)}</td>
                                                    <td className="py-2.5 px-3 text-right font-bold tabular-nums text-slate-600">{fmtMoney(p.calcCost)}</td>
                                                    <td className={`py-2.5 px-3 text-right font-black tabular-nums ${p.calcProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                                        {fmtMoney(p.calcProfit)}
                                                    </td>
                                                    <td className={`py-2.5 px-3 text-right font-bold tabular-nums ${p.calcMargin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                                        {p.calcMargin.toFixed(1)}%
                                                    </td>
                                                    <td className={`py-2.5 px-3 text-right font-bold tabular-nums ${p.calcAR > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                                        {fmtMoney(p.calcAR)}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-bold tabular-nums text-cyan-700">
                                                        {p.calcPctComplete.toFixed(0)}%
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            {badges.length === 0 && <span className="text-slate-300">—</span>}
                                                            {badges.map((b, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    title={b.label}
                                                                    className="cursor-help text-sm leading-none"
                                                                >
                                                                    {b.emoji}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            );
                        })()}
                    </>
                )}
                </div> {/* end inner padding wrapper */}
            </div>

            {/* Print stylesheet */}
            <style jsx global>{`
                @media print {
                    nav, header, .print\\:hidden, [class*="print:hidden"] { display: none !important; }
                    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .print\\:block { display: block !important; }
                    /* Hide sidebar */
                    [class*="w-\\[280px\\]"] { display: none !important; }
                    /* Page breaks before charts */
                    [class*="grid-cols-1"][class*="lg\\:grid-cols-2"] { page-break-before: always; }
                    /* Insights: convert horizontal scroll to vertical list */
                    [class*="overflow-x-auto"][class*="flex"][class*="gap-3"] {
                        flex-wrap: wrap !important;
                        overflow: visible !important;
                    }
                    [class*="flex-shrink-0"][class*="w-\\[280px\\]"] {
                        flex-shrink: 1 !important;
                        width: 100% !important;
                        page-break-inside: avoid;
                    }
                    /* Sticky strip hidden */
                    .sticky { position: static !important; }
                }
            `}</style>
        </div>
    );
}

export default FinancialsView;
