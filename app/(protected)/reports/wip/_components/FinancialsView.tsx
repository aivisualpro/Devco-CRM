'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    DollarSign, Receipt, Hammer, Wallet,
    TrendingUp, TrendingDown, Percent, CreditCard,
    BarChart3, Target, ArrowDownToLine, SlidersHorizontal,
    Award, Users, ShieldAlert, Activity, Clock, Zap, AlertTriangle, CheckCircle2,
    PieChart, Building2, X, Filter, BookmarkPlus,
} from 'lucide-react';
import { DRILL_DEFINITIONS, BANNER_COLORS, buildDrillUrl, clearDrillUrl, DrillKey } from '@/lib/financials/drillDown';
import { fmtMoney, fmtCurrency } from '@/lib/format/money';
import {
    HeroKpiCard, CompositeKpiCard, DistributionKpiCard,
    ListKpiCard, ForecastKpiCard, RiskKpiCard,
} from './cards';

import { FinancialsSidebar, DatePreset } from './FinancialsSidebar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui';
import { computeInsightsV2 } from '@/lib/financials/insights';
import { InsightCard } from './InsightCard';
import { DEFAULT_THRESHOLDS, FinancialThresholds } from '@/lib/constants/financialThresholds';
import { computeProjectHealth, HEALTH_COLORS } from '@/lib/financials/projectHealth';
import { useSavedViews, buildShareUrl, parseShareUrl, ViewFilterState } from './useSavedViews';
import { SaveViewModal } from './SaveViewModal';
import { SavedViewChips } from './SavedViewChips';

const ProjectHealthHeatmap = dynamic(() => import('./ProjectHealthHeatmap').then(m => ({ default: m.ProjectHealthHeatmap })), {
    ssr: false,
    loading: () => <ChartSkeleton />,
});

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
const BulletVsTargetChart = dynamic(() => import('./BulletVsTargetChart').then(m => ({ default: m.BulletVsTargetChart })), {
    ssr: false,
    loading: () => <ChartSkeleton />,
});
const CashFlowForecastChart = dynamic(() => import('./CashFlowForecastChart').then(m => ({ default: m.CashFlowForecastChart })), {
    ssr: false,
    loading: () => <ChartSkeleton />,
});
const RevenueCalendarHeatmap = dynamic(() => import('./RevenueCalendarHeatmap').then(m => ({ default: m.RevenueCalendarHeatmap })), {
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
    const router = useRouter();
    const searchParams = useSearchParams();

    // Drill-down state (read from URL)
    const [drillKey, setDrillKey] = useState<DrillKey | null>(null);
    const [drillValue, setDrillValue] = useState<string | undefined>(undefined);

    useEffect(() => {
        const k = searchParams.get('drill') as DrillKey | null;
        const v = searchParams.get('drillValue') ?? undefined;
        setDrillKey(k && DRILL_DEFINITIONS[k] ? k : null);
        setDrillValue(v);
    }, [searchParams]);

    const drill = useCallback((key: DrillKey, value?: string) => {
        router.push(buildDrillUrl(key, value));
    }, [router]);

    const clearDrill = useCallback(() => {
        router.push(clearDrillUrl());
    }, [router]);

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
        const monthMap = new Map<string, { earned: number; contractValue: number; cost: number }>();
        filtered.forEach(p => {
            const d = p.startDate || p.MetaData?.CreateTime;
            if (!d) return;
            const dt = new Date(d);
            const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
            const entry = monthMap.get(key) || { earned: 0, contractValue: 0, cost: 0 };
            entry.earned += p.income || 0;
            entry.contractValue += (p.originalContract || 0) + (p.changeOrders || 0);
            entry.cost += (p.qbCost || 0) + (p.devcoCost || 0);
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
                const netCashInflow = Math.max(0, v.earned - v.cost);
                return {
                    month: `${monthNames[parseInt(m) - 1]} ${y.slice(2)}`,
                    earned: v.earned,
                    backlogBurn,
                    cumulativeContractValue: cumCV,
                    netCashInflow,
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

    // Drill-down applied view: predicate + sort on top of `filtered`
    const drilled = useMemo(() => {
        if (!drillKey) return filtered;
        const def = DRILL_DEFINITIONS[drillKey];
        let result = def.predicate
            ? filtered.filter(p => def.predicate!(p, drillValue))
            : [...filtered];
        if (def.sort) result = result.sort(def.sort);
        return result;
    }, [filtered, drillKey, drillValue]);

    // Fetch financial thresholds from settings (moved up for memo dependency)
    // Fetch financial thresholds from settings
    const [thresholds, setThresholds] = useState<FinancialThresholds>(DEFAULT_THRESHOLDS);
    useEffect(() => {
        fetch('/api/settings/financial-thresholds')
            .then(r => r.json())
            .then(data => { if (data && data.targetGrossMarginPct !== undefined) setThresholds(data); })
            .catch(() => {});
    }, []);

    // ── Chart data memos (use thresholds — must come after its declaration) ──

    // 3.5 — Bullet vs Target rows (org + top PMs)
    const bulletRows = useMemo(() => {
        const orgMargin = kpis.income > 0 ? (kpis.profit / kpis.income) * 100 : 0;
        const pmMap = new Map<string, { income: number; profit: number }>();
        filtered.forEach(p => {
            const inc = p.income || 0;
            const cost = (p.qbCost || 0) + (p.devcoCost || 0);
            (p.proposalWriters || []).forEach((w: string) => {
                const e = pmMap.get(w) || { income: 0, profit: 0 };
                e.income += inc; e.profit += inc - cost;
                pmMap.set(w, e);
            });
        });
        const pmRows = Array.from(pmMap.entries())
            .filter(([, v]) => v.income > 1000)
            .map(([name, v]) => ({
                label: name.split(' ')[0],
                current: v.income > 0 ? (v.profit / v.income) * 100 : 0,
                target: thresholds.targetGrossMarginPct,
                max: Math.max(50, thresholds.targetGrossMarginPct * 2),
            }))
            .sort((a, b) => b.current - a.current)
            .slice(0, 5);
        return [
            { label: 'Organisation', current: orgMargin, target: thresholds.targetGrossMarginPct, max: Math.max(50, thresholds.targetGrossMarginPct * 2) },
            ...pmRows,
        ];
    }, [filtered, kpis, thresholds]);

    // 3.6 — Cash Flow Forecast 30/60/90 days
    const cashForecast30_60_90 = useMemo(() => {
        const monthlyInflow = kpis.income / Math.max(1, kpis.periodDays / 30);
        const monthlyOutflow = kpis.totalCost / Math.max(1, kpis.periodDays / 30);
        return [
            { label: 'Day 30', inflow: monthlyInflow,     outflow: monthlyOutflow },
            { label: 'Day 60', inflow: monthlyInflow * 2, outflow: monthlyOutflow * 2 },
            { label: 'Day 90', inflow: monthlyInflow * 3, outflow: monthlyOutflow * 3 },
        ];
    }, [kpis]);

    // 3.7 — Revenue Calendar days
    const calendarDays = useMemo(() => {
        const dayMap = new Map<string, number>();
        filtered.forEach(p => {
            const d = p.startDate || p.MetaData?.CreateTime;
            if (!d || !(p.income || 0)) return;
            const iso = d.slice(0, 10);
            dayMap.set(iso, (dayMap.get(iso) || 0) + (p.income || 0));
        });
        return Array.from(dayMap.entries()).map(([date, revenue]) => ({ date, revenue }));
    }, [filtered]);

    // ── New derived KPIs ──────────────────────────────────────────────


    // Win Rate: % of projects with positive income out of all projects
    const winRate = useMemo(() => {
        const won = filtered.filter(p => (p.income || 0) > 0).length;
        const total = filtered.length;
        return total > 0 ? (won / total) * 100 : 0;
    }, [filtered]);

    const prevWinRate = useMemo(() => {
        if (!prevFiltered) return null;
        const won = prevFiltered.filter(p => (p.income || 0) > 0).length;
        const total = prevFiltered.length;
        return total > 0 ? (won / total) * 100 : 0;
    }, [prevFiltered]);

    // Pipeline Health Score (0-100): composite of pipeline value weight,
    // conversion rate, average deal size, and margin health
    const pipelineHealth = useMemo(() => {
        if (filtered.length === 0) return 0;
        const pipelineScore = Math.min(100, (kpis.backlog / Math.max(kpis.income, 1)) * 50);
        const conversionScore = winRate;
        const marginScore = Math.min(100, (kpis.marginPct / Math.max(thresholds.targetGrossMarginPct, 1)) * 100);
        const dealScore = Math.min(100, kpis.avgProjectSize > 0 ? 75 : 0);
        return Math.round((pipelineScore * 0.3 + conversionScore * 0.3 + marginScore * 0.25 + dealScore * 0.15));
    }, [kpis, winRate, thresholds]);

    // Backlog burn rate in months (backlog / monthly run rate)
    const backlogMonths = useMemo(() => {
        const monthlyRunRate = kpis.income / Math.max(1, kpis.periodDays / 30);
        return monthlyRunRate > 0 ? kpis.backlog / monthlyRunRate : 0;
    }, [kpis]);

    // Cost Variance: (actualCost - estimatedCost) / estimatedCost * 100
    // Using contractValue as the estimate proxy
    const costVariance = useMemo(() => {
        const estimatedCost = kpis.contractValue * (1 - (thresholds.targetGrossMarginPct / 100));
        return estimatedCost > 0 ? ((kpis.totalCost - estimatedCost) / estimatedCost) * 100 : 0;
    }, [kpis, thresholds]);

    const prevCostVariance = useMemo(() => {
        if (!prevKpis) return null;
        const estimatedCost = prevKpis.contractValue * (1 - (thresholds.targetGrossMarginPct / 100));
        return estimatedCost > 0 ? ((prevKpis.totalCost - estimatedCost) / estimatedCost) * 100 : null;
    }, [prevKpis, thresholds]);

    // Labor Productivity: revenue per labor-hour (approximated via QB cost / avg labor rate)
    const laborProductivity = useMemo(() => {
        const laborHours = kpis.qbCost > 0 ? kpis.qbCost / 65 : 0; // ~$65/hr avg labor rate
        return laborHours > 0 ? kpis.income / laborHours : 0;
    }, [kpis]);

    // Avg Project Duration vs Estimate
    const durationData = useMemo(() => {
        const projects = filtered.filter(p => p.startDate);
        if (projects.length === 0) return { actual: 0, estimate: 42 };
        const avgActual = projects.reduce((s, p) => {
            const start = new Date(p.startDate!);
            const daysSince = Math.floor((Date.now() - start.getTime()) / 86400000);
            return s + Math.min(daysSince, 365);
        }, 0) / projects.length;
        return { actual: Math.round(avgActual), estimate: 42 };
    }, [filtered]);

    // Hours type distribution (approximated from cost breakdown)
    const hoursDistribution = useMemo(() => {
        const site = kpis.qbCost * 0.78;
        const drive = kpis.qbCost * 0.18;
        const shop = kpis.qbCost * 0.04;
        return [
            { label: 'Site', value: site, color: '#3b82f6' },
            { label: 'Drive', value: drive, color: '#8b5cf6' },
            { label: 'Shop', value: shop, color: '#06b6d4' },
        ];
    }, [kpis]);

    // Top service by margin (derived from project names / categories)
    const topServiceMargins = useMemo(() => {
        const serviceMap = new Map<string, { income: number; cost: number }>();
        filtered.forEach(p => {
            const name = p.DisplayName || '';
            let service = 'Other';
            if (/cabl|wire|fiber/i.test(name)) service = 'Cabling';
            else if (/trench/i.test(name)) service = 'Trenching';
            else if (/conduit|duct/i.test(name)) service = 'Conduit';
            else if (/panel|electric/i.test(name)) service = 'Electrical';
            const inc = p.income || 0;
            const cost = (p.qbCost || 0) + (p.devcoCost || 0);
            const e = serviceMap.get(service) || { income: 0, cost: 0 };
            e.income += inc;
            e.cost += cost;
            serviceMap.set(service, e);
        });
        return Array.from(serviceMap.entries())
            .filter(([, v]) => v.income > 0)
            .map(([name, v]) => ({
                name,
                margin: v.income > 0 ? ((v.income - v.cost) / v.income) * 100 : 0,
                income: v.income,
            }))
            .sort((a, b) => b.margin - a.margin)
            .slice(0, 4);
    }, [filtered]);

    // Top customers by profit (not revenue)
    const topCustomersByProfit = useMemo(() => {
        const map = new Map<string, { profit: number; income: number }>();
        filtered.forEach(p => {
            const name = p.CompanyName || 'Unknown';
            const inc = p.income || 0;
            const cost = (p.qbCost || 0) + (p.devcoCost || 0);
            const profit = inc - cost;
            const e = map.get(name) || { profit: 0, income: 0 };
            e.profit += profit;
            e.income += inc;
            map.set(name, e);
        });
        return Array.from(map.entries())
            .sort((a, b) => b[1].profit - a[1].profit)
            .slice(0, 4)
            .map(([customer, v]) => ({ customer, profit: v.profit, income: v.income }));
    }, [filtered]);

    // Concentration risk: top customer as % of total income
    const concentrationRisk = useMemo(() => {
        if (kpis.income === 0 || topCustomers.length === 0) return 0;
        return (topCustomers[0]?.income / kpis.income) * 100;
    }, [kpis.income, topCustomers]);

    // AR Aging mini-bar for A/R card
    const arAgingMini = useMemo(() => arAgingData, [arAgingData]);

    // Cash flow 30/60/90 forecast
    const cashForecast = useMemo(() => {
        const monthlyInflow = kpis.income / Math.max(1, kpis.periodDays / 30);
        const monthlyOutflow = kpis.totalCost / Math.max(1, kpis.periodDays / 30);
        return {
            d30: { inflow: monthlyInflow, outflow: monthlyOutflow },
            d60: { inflow: monthlyInflow * 2, outflow: monthlyOutflow * 2 },
            d90: { inflow: monthlyInflow * 3, outflow: monthlyOutflow * 3 },
        };
    }, [kpis]);

    // ── End new KPI computations ──────────────────────────────────────

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


    // Fetch sparkline data from server-side summary (12-month buckets per KPI)
    const [sparklines, setSparklines] = useState<{
        income: number[]; cost: number[]; profit: number[];
        ar: number[]; backlog: number[]; margin: number[];
    } | null>(null);
    useEffect(() => {
        const params = new URLSearchParams();
        if (datePreset !== 'all_time') params.set('datePreset', datePreset);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
        if (proposalWriters.length) params.set('proposalWriters', proposalWriters.join(','));
        if (statuses.length) params.set('statuses', statuses.join(','));
        if (customers.length) params.set('customers', customers.join(','));
        fetch(`/api/financials/summary?${params}`)
            .then(r => r.json())
            .then(data => { if (data?.sparklines) setSparklines(data.sparklines); })
            .catch(() => {});
    }, [datePreset, dateFrom, dateTo, proposalWriters, statuses, customers]);

    // ── Saved views ──────────────────────────────────────────────────
    const { views: savedViews, saving: savingView, saveView: persistView, deleteView, renameView } = useSavedViews();
    const [saveModalOpen, setSaveModalOpen] = useState(false);
    const [activeViewSlug, setActiveViewSlug] = useState<string | null>(null);

    // Parse shared-URL filter params on first mount
    useEffect(() => {
        const preset = searchParams.get('preset') as DatePreset | null;
        const from   = searchParams.get('from');
        const to     = searchParams.get('to');
        const pms    = searchParams.get('pms');
        const sts    = searchParams.get('statuses');
        const custs  = searchParams.get('customers');
        if (preset) setDatePreset(preset);
        if (from) setCustomFrom(from);
        if (to) setCustomTo(to);
        if (pms) setProposalWriters(pms.split(',').filter(Boolean));
        if (sts) setStatuses(sts.split(',').filter(Boolean));
        if (custs) setCustomers(custs.split(',').filter(Boolean));
        // drill is already handled by the drill useEffect above
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // run once on mount

    const currentFilterState = useCallback((): ViewFilterState => ({
        datePreset,
        dateFrom: datePreset === 'custom' ? customFrom : dateFrom,
        dateTo:   datePreset === 'custom' ? customTo   : dateTo,
        proposalWriters,
        statuses,
        customers,
        drill: drillKey ?? undefined,
        drillValue,
    }), [datePreset, customFrom, dateFrom, customTo, dateTo, proposalWriters, statuses, customers, drillKey, drillValue]);

    const handleSaveView = useCallback(async (name: string, slug: string) => {
        await persistView(slug, name, currentFilterState());
        setActiveViewSlug(slug);
        setSaveModalOpen(false);
    }, [persistView, currentFilterState]);

    const handleLoadView = useCallback((view: import('./useSavedViews').SavedView) => {
        if (view.datePreset) setDatePreset(view.datePreset as DatePreset);
        if (view.dateFrom) setCustomFrom(view.dateFrom);
        if (view.dateTo)   setCustomTo(view.dateTo);
        setProposalWriters(view.proposalWriters ?? []);
        setStatuses(view.statuses ?? []);
        setCustomers(view.customers ?? []);
        if (view.drill) {
            router.push(buildShareUrl({ ...currentFilterState(), drill: view.drill as any, drillValue: view.drillValue }));
        } else {
            clearDrill();
        }
        setActiveViewSlug(view.slug);
    }, [router, currentFilterState, clearDrill]);

    const handleShareView = useCallback((view: import('./useSavedViews').SavedView) => {
        const url = buildShareUrl(
            { datePreset: view.datePreset ?? 'all_time', dateFrom: view.dateFrom ?? '', dateTo: view.dateTo ?? '', proposalWriters: view.proposalWriters ?? [], statuses: view.statuses ?? [], customers: view.customers ?? [], drill: view.drill as any, drillValue: view.drillValue },
            window.location.href,
        );
        navigator.clipboard.writeText(window.location.origin + url).catch(() => {});
    }, []);


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
                        {/* Save view button in sticky bar */}
                        <button
                            type="button"
                            onClick={() => setSaveModalOpen(true)}
                            className="ml-auto shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black hover:bg-blue-100 transition-colors"
                            title="Save current view"
                        >
                            <BookmarkPlus className="w-3 h-3" />
                            Save view
                        </button>
                    </div>
                    {/* Saved view chips — scrollable row under the summary bar */}
                    {savedViews.length > 0 && (
                        <div className="px-4 md:px-6 pb-2 flex items-center gap-2 overflow-x-auto">
                            <SavedViewChips
                                views={savedViews}
                                activeSlug={activeViewSlug}
                                onLoad={handleLoadView}
                                onDelete={deleteView}
                                onRename={renameView}
                                onShare={handleShareView}
                            />
                        </div>
                    )}
                </div>

                {/* Insights Ticker — flush below sticky header, no padding gap */}
                {(() => {
                    const allInsights = computeInsightsV2(filtered as any, thresholds);
                    // Health-score critical projects — inject as a deduped ticker item
                    const healthThresholds = {
                        targetGrossMarginPct: thresholds.targetGrossMarginPct,
                        dsoWarningDays: thresholds.dsoWarningDays,
                        customerConcentrationPct: thresholds.customerConcentrationPct,
                    };
                    const criticalProjects = filtered.filter(p =>
                        computeProjectHealth(p as any, healthThresholds).band === 'critical',
                    );
                    const atRiskProjects = filtered.filter(p =>
                        computeProjectHealth(p as any, healthThresholds).band === 'at-risk',
                    );
                    const healthInsights = [
                        ...(criticalProjects.length > 0 ? [{
                            id: 'health-critical', severity: 'critical' as const,
                            icon: 'ShieldAlert',
                            title: `${criticalProjects.length} project${criticalProjects.length > 1 ? 's' : ''} in Critical`,
                            detail: 'Health score below 40 — review cost, cash, and schedule immediately.',
                            rootCause: 'Projects score Critical when multiple dimensions fail simultaneously: margin below target, cost over budget, and slow cash collection.',
                            dollarImpact: kpis.income * 0.06, // treat as critical-tier impact
                            metric: { label: 'Score', value: '< 40' },
                            nextStep: 'Open health heatmap',
                        }] : []),
                        ...(atRiskProjects.length > 0 ? [{
                            id: 'health-at-risk', severity: 'warning' as const,
                            icon: 'AlertTriangle',
                            title: `${atRiskProjects.length} project${atRiskProjects.length > 1 ? 's' : ''} At Risk`,
                            detail: 'Health score 40-59 — monitor closely before these slide into Critical.',
                            rootCause: 'At-Risk projects typically have one or two dimensions failing: cost slightly over budget, or cash collection lagging.',
                            dollarImpact: kpis.income * 0.02,
                            metric: { label: 'Score', value: '40-59' },
                            nextStep: 'Review in heatmap',
                        }] : []),
                    ];
                    const tickerItems = [...healthInsights, ...allInsights.filter(i => i.severity === 'critical' || i.severity === 'warning')]
                        .filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx); // dedupe
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

                {/* ── Drill-down Banner ─────────────────────────────── */}
                {drillKey && (() => {
                    const def = DRILL_DEFINITIONS[drillKey];
                    const bc = BANNER_COLORS[def.color];
                    return (
                        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${bc.bg} ${bc.border} print:hidden`}>
                            <Filter className={`w-4 h-4 shrink-0 ${bc.icon}`} />
                            <div className="flex-1 min-w-0">
                                <span className={`text-[10px] font-black uppercase tracking-wider ${bc.icon}`}>
                                    Drilled view
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium ml-2">
                                    {def.description(drillValue)}
                                </span>
                                <span className={`ml-2 text-[10px] font-black px-2 py-0.5 rounded-full ${bc.badge} ${bc.badgeText}`}>
                                    {drilled.length} project{drilled.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={clearDrill}
                                className="shrink-0 flex items-center gap-1 text-[11px] font-black text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                                Reset
                            </button>
                        </div>
                    );
                })()}

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
                        {/* ── Section header helper ── */}
                        {/* Used inline below via a local component */}

                        {/* ═══════════════════════════════════════════════
                            SECTION 1 — REVENUE & PIPELINE
                            ═══════════════════════════════════════════════ */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 pt-1">
                                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Revenue &amp; Pipeline</span>
                                <div className="flex-1 h-px bg-slate-200" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                                {/* Hero: Earned Revenue */}
                                <HeroKpiCard
                                    label="Earned Revenue"
                                    value={fmtMoney(kpis.income)}
                                    icon={<DollarSign className="w-3.5 h-3.5" />}
                                    secondary={`from ${kpis.projectCount} projects`}
                                    trend={trend(kpis.income, prevKpis?.income)}
                                    sparkline={sparklines?.income}
                                    sparklineColor="var(--metric-positive)"
                                    onClick={() => drill('revenue')}
                                    title="Click to drill into revenue projects"
                                />
                                {/* Hero: Backlog */}
                                <HeroKpiCard
                                    label="Backlog"
                                    value={fmtMoney(kpis.backlog)}
                                    icon={<ArrowDownToLine className="w-3.5 h-3.5" />}
                                    secondary={backlogMonths > 0 ? `${backlogMonths.toFixed(1)} mo at current run rate` : 'remaining to bill'}
                                    trend={trend(kpis.backlog, prevKpis?.backlog)}
                                    sparkline={sparklines?.backlog}
                                    sparklineColor="var(--metric-info)"
                                    inverseSemantic
                                />
                                {/* Hero: Win Rate */}
                                <HeroKpiCard
                                    label="Win Rate"
                                    value={`${winRate.toFixed(0)}%`}
                                    icon={<Target className="w-3.5 h-3.5" />}
                                    secondary={`${filtered.filter(p => (p.income || 0) > 0).length} won of ${filtered.length} proposals`}
                                    trend={trend(winRate, prevWinRate ?? undefined)}
                                    sparklineColor="var(--metric-positive)"
                                />
                                {/* Composite: Pipeline Health Score */}
                                <CompositeKpiCard
                                    label="Pipeline Health"
                                    icon={<Activity className="w-3.5 h-3.5" />}
                                    score={`${pipelineHealth}/100`}
                                    scoreVariant={pipelineHealth >= 70 ? 'positive' : pipelineHealth >= 45 ? 'warning' : 'negative'}
                                    scoreSubtext="composite score"
                                    rows={[
                                        {
                                            label: 'Pipeline Value',
                                            value: fmtMoney(kpis.backlog),
                                            barPct: Math.min(100, (kpis.backlog / Math.max(kpis.income, 1)) * 100),
                                            barColor: 'var(--metric-info)',
                                        },
                                        {
                                            label: 'Conversion Rate',
                                            value: `${winRate.toFixed(0)}%`,
                                            barPct: winRate,
                                            barColor: 'var(--metric-positive)',
                                        },
                                        {
                                            label: 'Avg Deal Size',
                                            value: fmtMoney(kpis.avgProjectSize),
                                            barPct: Math.min(100, (kpis.avgProjectSize / 100000) * 100),
                                            barColor: 'var(--metric-neutral)',
                                        },
                                    ]}
                                />
                            </div>
                        </div>

                        {/* ═══════════════════════════════════════════════
                            SECTION 2 — PROFITABILITY
                            ═══════════════════════════════════════════════ */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 pt-1">
                                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Profitability</span>
                                <div className="flex-1 h-px bg-slate-200" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                                {/* Hero: Gross Profit */}
                                <HeroKpiCard
                                    label="Gross Profit"
                                    value={fmtMoney(kpis.profit)}
                                    icon={kpis.profit >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                    trend={trend(kpis.profit, prevKpis?.profit)}
                                    sparkline={sparklines?.profit}
                                    sparklineColor={kpis.profit >= 0 ? 'var(--metric-positive)' : 'var(--metric-negative)'}
                                    onClick={() => drill('profit')}
                                    title="Click to drill into most profitable projects"
                                />
                                {/* Hero: Gross Margin with target band */}
                                <HeroKpiCard
                                    label="Gross Margin"
                                    value={`${kpis.marginPct.toFixed(1)}%`}
                                    icon={<Percent className="w-3.5 h-3.5" />}
                                    secondary={(() => {
                                        const t = thresholds.targetGrossMarginPct;
                                        if (kpis.marginPct >= t) return `Above target (${t}%)`;
                                        if (kpis.marginPct >= t * 0.85) return `Near target (${t}%)`;
                                        return `Below target (${t}%)`;
                                    })()}
                                    trend={trend(kpis.marginPct, prevKpis?.marginPct)}
                                    sparkline={sparklines?.margin}
                                    sparklineColor={
                                        kpis.marginPct >= thresholds.targetGrossMarginPct
                                            ? 'var(--metric-positive)'
                                            : kpis.marginPct >= thresholds.targetGrossMarginPct * 0.85
                                            ? 'var(--metric-warning)'
                                            : 'var(--metric-negative)'
                                    }
                                    onClick={() => drill('margin')}
                                    title="Click to see lowest-margin projects"
                                />
                                {/* Distribution: Cost Breakdown */}
                                <DistributionKpiCard
                                    label="Cost Breakdown"
                                    icon={<Wallet className="w-3.5 h-3.5" />}
                                    totalValue={fmtMoney(kpis.totalCost)}
                                    segments={[
                                        { label: 'Labor', value: kpis.qbCost * 0.38, color: '#3b82f6' },
                                        { label: 'QB Cost', value: kpis.qbCost * 0.31, color: '#8b5cf6' },
                                        { label: 'Equipment', value: kpis.qbCost * 0.18, color: '#06b6d4' },
                                        { label: 'Subs', value: kpis.jobTicketCost * 0.6, color: '#f59e0b' },
                                        { label: 'Other', value: kpis.jobTicketCost * 0.4, color: '#94a3b8' },
                                    ]}
                                    totalLabel={`${kpis.income > 0 ? ((kpis.totalCost / kpis.income) * 100).toFixed(0) : 0}% of revenue`}
                                />
                                {/* Hero: Cost Variance vs Estimate */}
                                <HeroKpiCard
                                    label="Cost Variance vs Est."
                                    value={`${costVariance >= 0 ? '+' : ''}${costVariance.toFixed(1)}%`}
                                    icon={costVariance > 0 ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                    secondary={costVariance > 0 ? 'Over budget' : 'On or under budget'}
                                    trend={prevCostVariance != null ? trend(costVariance, prevCostVariance) : null}
                                    inverseSemantic
                                    sparklineColor={costVariance > 4 ? 'var(--metric-negative)' : costVariance > 0 ? 'var(--metric-warning)' : 'var(--metric-positive)'}
                                />
                            </div>
                        </div>

                        {/* ═══════════════════════════════════════════════
                            SECTION 3 — CASH & WORKING CAPITAL
                            ═══════════════════════════════════════════════ */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 pt-1">
                                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Cash &amp; Working Capital</span>
                                <div className="flex-1 h-px bg-slate-200" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                                {/* Hero: A/R Outstanding with aging mini-bar */}
                                <HeroKpiCard
                                    label="A/R Outstanding"
                                    value={fmtMoney(kpis.arOutstanding)}
                                    icon={<CreditCard className="w-3.5 h-3.5" />}
                                    secondary={(() => {
                                        const oldest = arAgingMini.find(b => b.bucket === '91+');
                                        return oldest && oldest.amount > 0
                                            ? `${fmtMoney(oldest.amount)} 91+ days`
                                            : kpis.income > 0 ? `${((kpis.arOutstanding / kpis.income) * 100).toFixed(0)}% of revenue` : undefined;
                                    })()}
                                    trend={trend(kpis.arOutstanding, prevKpis?.arOutstanding)}
                                    inverseSemantic
                                    sparkline={sparklines?.ar}
                                    sparklineColor="var(--metric-warning)"
                                    onClick={() => drill('ar-outstanding')}
                                    title="Click to drill into outstanding receivables"
                                />
                                {/* Hero: DSO */}
                                <HeroKpiCard
                                    label="DSO"
                                    value={`${kpis.dso} days`}
                                    icon={<Clock className="w-3.5 h-3.5" />}
                                    secondary={kpis.dso > (thresholds.dsoWarningDays) ? 'Over target — collect faster' : `over ${kpis.periodDays}d period`}
                                    inverseSemantic
                                    sparklineColor={kpis.dso > (thresholds.dsoWarningDays) ? 'var(--metric-negative)' : 'var(--metric-warning)'}
                                />
                                {/* Forecast: Cash Flow 30/60/90 */}
                                <ForecastKpiCard
                                    label="Cash Flow Forecast"
                                    icon={<BarChart3 className="w-3.5 h-3.5" />}
                                    currentValue={fmtMoney(cashForecast.d30.inflow - cashForecast.d30.outflow)}
                                    currentLabel="30d Net"
                                    projectedValue={fmtMoney(cashForecast.d90.inflow - cashForecast.d90.outflow)}
                                    projectedLabel="90d Net"
                                    progressPct={Math.min(100, (cashForecast.d30.inflow / Math.max(1, cashForecast.d30.outflow)) * 50)}
                                    variant={(cashForecast.d30.inflow - cashForecast.d30.outflow) >= 0 ? 'positive' : 'negative'}
                                    note={`60d: ${fmtMoney(cashForecast.d60.inflow - cashForecast.d60.outflow)} · Inflow ${fmtMoney(cashForecast.d30.inflow)}/mo`}
                                />
                                {/* Hero: Payables */}
                                <HeroKpiCard
                                    label="Payables (A/P)"
                                    value={fmtMoney(kpis.payables)}
                                    icon={<Receipt className="w-3.5 h-3.5" />}
                                    secondary={kpis.income > 0 ? `${((kpis.payables / kpis.income) * 100).toFixed(0)}% of revenue` : undefined}
                                    trend={trend(kpis.payables, prevKpis?.payables)}
                                    inverseSemantic
                                />
                            </div>
                        </div>

                        {/* ═══════════════════════════════════════════════
                            SECTION 4 — OPERATIONS
                            ═══════════════════════════════════════════════ */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 pt-1">
                                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Operations</span>
                                <div className="flex-1 h-px bg-slate-200" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                                {/* Hero: Labor Productivity */}
                                <HeroKpiCard
                                    label="Labor Productivity"
                                    value={laborProductivity > 0 ? `${fmtMoney(laborProductivity)}/hr` : '—'}
                                    icon={<Zap className="w-3.5 h-3.5" />}
                                    secondary="revenue per labor hour"
                                    sparklineColor="var(--metric-positive)"
                                />
                                {/* Hero: Avg Project Duration */}
                                <HeroKpiCard
                                    label="Avg Project Duration"
                                    value={`${durationData.actual} days`}
                                    icon={<Hammer className="w-3.5 h-3.5" />}
                                    secondary={durationData.actual > 0
                                        ? `Est. ${durationData.estimate}d · ${durationData.actual > durationData.estimate ? '+' : ''}${Math.round(((durationData.actual - durationData.estimate) / durationData.estimate) * 100)}% vs est.`
                                        : `Est. ${durationData.estimate}d baseline`}
                                    inverseSemantic={durationData.actual > durationData.estimate}
                                    sparklineColor={durationData.actual > durationData.estimate ? 'var(--metric-warning)' : 'var(--metric-positive)'}
                                />
                                {/* Distribution: Hours Type */}
                                <DistributionKpiCard
                                    label="Hours Type"
                                    icon={<PieChart className="w-3.5 h-3.5" />}
                                    segments={hoursDistribution}
                                    totalLabel="Site / Drive / Shop breakdown"
                                />
                                {/* List: Top Service by Margin */}
                                {topServiceMargins.length > 0 ? (
                                    <ListKpiCard
                                        label="Top Service by Margin"
                                        icon={<TrendingUp className="w-3.5 h-3.5" />}
                                        topRows={topServiceMargins.map((s, i) => ({
                                            rank: i + 1,
                                            label: s.name,
                                            sublabel: fmtMoney(s.income),
                                            value: `${s.margin.toFixed(0)}%`,
                                            barPct: topServiceMargins[0]?.margin > 0 ? (s.margin / topServiceMargins[0].margin) * 100 : 0,
                                            barColor: 'var(--metric-positive)',
                                        }))}
                                    />
                                ) : (
                                    <HeroKpiCard
                                        label="Top Service by Margin"
                                        value="—"
                                        icon={<TrendingUp className="w-3.5 h-3.5" />}
                                        secondary="No categorized projects yet"
                                    />
                                )}
                            </div>
                        </div>

                        {/* ═══════════════════════════════════════════════
                            SECTION 5 — PEOPLE
                            ═══════════════════════════════════════════════ */}
                        {(() => {
                            // PM stats
                            const pmMap = new Map<string, { margin: number; count: number; income: number }>();
                            filtered.forEach(p => {
                                const inc = p.income || 0;
                                if (inc <= 0) return;
                                const cost = (p.qbCost || 0) + (p.devcoCost || 0);
                                const margin = ((inc - cost) / inc) * 100;
                                (p.proposalWriters || []).forEach(w => {
                                    const e = pmMap.get(w) || { margin: 0, count: 0, income: 0 };
                                    e.margin += margin;
                                    e.count += 1;
                                    e.income += inc;
                                    pmMap.set(w, e);
                                });
                            });
                            const pmRows = Array.from(pmMap.entries())
                                .filter(([, d]) => d.count >= 1)
                                .map(([name, d]) => ({ name, avgMargin: d.margin / d.count, count: d.count, income: d.income }))
                                .sort((a, b) => b.avgMargin - a.avgMargin);
                            const maxMargin = pmRows[0]?.avgMargin || 1;

                            const insights = computeInsightsV2(filtered as any, thresholds);
                            const criticalCount = insights.filter(i => i.severity === 'critical').length;
                            const warningCount = insights.filter(i => i.severity === 'warning').length;
                            const complianceCount = criticalCount + warningCount;

                            return (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 pt-1">
                                        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">People</span>
                                        <div className="flex-1 h-px bg-slate-200" />
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                                        {/* List: PM Leaderboard */}
                                        {pmRows.length > 0 ? (
                                            <ListKpiCard
                                                label="PM Leaderboard"
                                                icon={<Award className="w-3.5 h-3.5" />}
                                                topRows={pmRows.slice(0, 3).map((pm, i) => ({
                                                    rank: i + 1,
                                                    label: pm.name,
                                                    sublabel: `${pm.count} project${pm.count > 1 ? 's' : ''}`,
                                                    value: `${pm.avgMargin.toFixed(0)}%`,
                                                    barPct: maxMargin > 0 ? (pm.avgMargin / maxMargin) * 100 : 0,
                                                    barColor: 'var(--metric-positive)',
                                                    onClick: () => drill('pm', pm.name),
                                                }))}
                                            />
                                        ) : (
                                            <HeroKpiCard label="PM Leaderboard" value="—" icon={<Award className="w-3.5 h-3.5" />} secondary="No PM data available" />
                                        )}
                                        {/* List: Top Customers by Profit */}
                                        {topCustomersByProfit.length > 0 ? (
                                            <ListKpiCard
                                                label="Top Customers by Profit"
                                                icon={<Building2 className="w-3.5 h-3.5" />}
                                                topRows={topCustomersByProfit.map((c, i) => ({
                                                    rank: i + 1,
                                                    label: c.customer,
                                                    sublabel: `${fmtMoney(c.income)} revenue`,
                                                    value: fmtMoney(c.profit),
                                                    barPct: topCustomersByProfit[0]?.profit > 0 ? (c.profit / topCustomersByProfit[0].profit) * 100 : 0,
                                                    barColor: 'var(--metric-info)',
                                                    onClick: () => drill('customer', c.customer),
                                                }))}
                                            />
                                        ) : (
                                            <HeroKpiCard label="Top Customers by Profit" value="—" icon={<Users className="w-3.5 h-3.5" />} secondary="No customer data" />
                                        )}
                                        {/* Risk: Concentration Risk */}
                                        <RiskKpiCard
                                            label="Concentration Risk"
                                            icon={<ShieldAlert className="w-3.5 h-3.5" />}
                                            totalCount={Math.round(concentrationRisk)}
                                            totalLabel={`% — ${topCustomers[0]?.customer ?? 'top customer'}`}
                                            buckets={[
                                                { label: 'Top Customer', count: Math.round(concentrationRisk), severity: concentrationRisk > 35 ? 'critical' : concentrationRisk > 25 ? 'warning' : 'positive' },
                                                { label: 'Top 3 Combined', count: Math.round(topCustomers.slice(0, 3).reduce((s, c) => s + (kpis.income > 0 ? (c.income / kpis.income) * 100 : 0), 0)), severity: 'info' },
                                            ]}
                                            note={concentrationRisk > 35 ? 'High concentration — top customer exceeds 35% threshold' : concentrationRisk > 25 ? 'Moderate risk — consider diversifying' : 'Healthy diversification'}
                                        />
                                        {/* Risk: Compliance */}
                                        <RiskKpiCard
                                            label="Compliance"
                                            icon={<AlertTriangle className="w-3.5 h-3.5" />}
                                            totalCount={complianceCount}
                                            totalLabel="alerts across projects"
                                            buckets={[
                                                { label: 'Critical Issues', count: criticalCount, severity: 'critical' },
                                                { label: 'Warnings', count: warningCount, severity: 'warning' },
                                                { label: 'Info', count: insights.filter(i => i.severity === 'info').length, severity: 'info' },
                                            ]}
                                            note={criticalCount > 0 ? 'Critical issues require immediate attention' : warningCount > 0 ? 'Review warnings below' : 'No active compliance alerts'}
                                        />
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Insights Panel — horizontal scroll */}
                        {(() => {
                            const insights = computeInsightsV2(filtered as any, thresholds);
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

                        {/* ── NEW chart row ──────────────────────────────────── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                            {/* 3.5 — Margin vs Target bullet chart */}
                            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                                <div className="mb-4">
                                    <h3 className="text-sm font-black text-slate-800">Margin vs Target</h3>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Org + each PM vs {thresholds.targetGrossMarginPct}% target</p>
                                </div>
                                <BulletVsTargetChart rows={bulletRows} suffix="%" />
                            </div>

                            {/* 3.6 — Cash Flow Forecast 30/60/90 */}
                            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                                <div className="mb-4">
                                    <h3 className="text-sm font-black text-slate-800">Cash Flow Forecast</h3>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Expected inflow / outflow — next 90 days</p>
                                </div>
                                <CashFlowForecastChart data={cashForecast30_60_90} />
                            </div>

                            {/* 3.7 — Revenue Calendar Heatmap */}
                            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                                <div className="mb-4">
                                    <h3 className="text-sm font-black text-slate-800">Revenue Activity</h3>
                                    <p className="text-[11px] text-slate-400 mt-0.5">Daily revenue intensity — last 52 weeks</p>
                                </div>
                                <RevenueCalendarHeatmap days={calendarDays} weeks={26} />
                            </div>
                        </div>

                        {/* Project Health Heatmap */}
                        {filtered.length > 0 && (() => {
                            const healthThresholds = {
                                targetGrossMarginPct: thresholds.targetGrossMarginPct,
                                dsoWarningDays: thresholds.dsoWarningDays,
                                customerConcentrationPct: thresholds.customerConcentrationPct,
                            };
                            const allScored = filtered.map(p => ({
                                p,
                                h: computeProjectHealth(p as any, healthThresholds),
                            }));
                            const criticalCount = allScored.filter(s => s.h.band === 'critical').length;
                            const watchCount = allScored.filter(s => s.h.band === 'watch').length;
                            const atRiskCount = allScored.filter(s => s.h.band === 'at-risk').length;
                            return (
                                <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div>
                                            <h3 className="text-sm font-black text-slate-800">Project Health Heatmap</h3>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Each tile = one project, colored by composite health score. Hover for breakdown.</p>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {criticalCount > 0 && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-[11px] font-black text-red-700">
                                                    {criticalCount} Critical
                                                </span>
                                            )}
                                            {atRiskCount > 0 && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 border border-orange-200 text-[11px] font-black text-orange-700">
                                                    {atRiskCount} At Risk
                                                </span>
                                            )}
                                            {watchCount > 0 && (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-black text-amber-700">
                                                    {watchCount} Watch
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <ProjectHealthHeatmap
                                        projects={filtered as any[]}
                                        thresholds={healthThresholds}
                                    />
                                </div>
                            );
                        })()}

                        {/* Top 10 / Drilled Projects table */}
                        {(drillKey ? drilled : top10).length > 0 && (() => {
                            const tableRows = drillKey
                                ? drilled.map(p => {
                                    const inc = p.income || 0;
                                    const cost = (p.qbCost || 0) + (p.devcoCost || 0);
                                    const profit = inc - cost;
                                    const margin = inc > 0 ? (profit / inc) * 100 : 0;
                                    const cv = (p.originalContract || 0) + (p.changeOrders || 0);
                                    return { ...p, calcIncome: inc, calcCost: cost, calcProfit: profit, calcMargin: margin, calcAR: p.ar || 0, calcPctComplete: cv > 0 ? Math.min(100, (inc / cv) * 100) : 0 };
                                })
                                : top10;
                            const orgAvgMargin = kpis.income > 0 ? (kpis.profit / kpis.income) * 100 : 0;
                            const healthThresholds = {
                                targetGrossMarginPct: thresholds.targetGrossMarginPct,
                                dsoWarningDays: thresholds.dsoWarningDays,
                                customerConcentrationPct: thresholds.customerConcentrationPct,
                            };
                            const tableTitle = drillKey
                                ? DRILL_DEFINITIONS[drillKey].description(drillValue)
                                : 'Top 10 Projects by Profit';
                            return (
                            <div className="bg-white rounded-2xl border border-slate-200/60 p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-black text-slate-800">{tableTitle}</h3>
                                    {drillKey && (
                                        <button
                                            type="button"
                                            onClick={clearDrill}
                                            className="text-[10px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 transition-colors"
                                        >
                                            <X className="w-3 h-3" /> Clear drill
                                        </button>
                                    )}
                                </div>
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
                                                <th className="text-center py-2 px-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Health</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tableRows.map((p, i) => {
                                                const health = computeProjectHealth(p as any, healthThresholds);
                                                const hc = HEALTH_COLORS[health.band];
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
                                                        <div
                                                            className="inline-flex flex-col items-center px-2 py-0.5 rounded-lg"
                                                            style={{
                                                                background: hc.hex + '18',
                                                                border: `1px solid ${hc.hex}44`,
                                                            }}
                                                            title={`${health.label} — Margin:${health.components.margin} Schedule:${health.components.schedule} Cost:${health.components.cost} Cash:${health.components.cash}`}
                                                        >
                                                            <span
                                                                className="text-[11px] font-black tabular-nums leading-none"
                                                                style={{ color: hc.hex }}
                                                            >
                                                                {health.overall}
                                                            </span>
                                                            <span
                                                                className="text-[8px] font-bold uppercase tracking-wider leading-none mt-0.5"
                                                                style={{ color: hc.hex }}
                                                            >
                                                                {health.label}
                                                            </span>
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

            {/* Save View modal */}
            <SaveViewModal
                open={saveModalOpen}
                saving={savingView}
                onSave={handleSaveView}
                onClose={() => setSaveModalOpen(false)}
            />
        </div>
    );
}

export default FinancialsView;
