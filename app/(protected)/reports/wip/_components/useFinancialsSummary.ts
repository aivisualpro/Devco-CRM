'use client';

/**
 * useFinancialsSummary
 * ─────────────────────────────────────────────────────────────────────
 * SWR hook that fetches the server-side aggregated financial summary.
 * Uses keepPreviousData so the dashboard never flickers between filter
 * changes — the old data stays visible while the new fetch is in flight.
 */

import useSWR from 'swr';
import { DatePreset } from './FinancialsSidebar';
import { DrillKey } from '@/lib/financials/drillDown';

// ── Types (mirrors the API response shape) ────────────────────────────

export interface SummaryKpis {
    contractValue: number;
    earnedRevenue: number;
    backlog: number;
    pctComplete: number;
    avgProjectSize: number;
    totalCost: number;
    grossProfit: number;
    grossMarginPct: number;
    eac: number;
    overUnderBilling: number;
    paymentsReceived: number;
    arOutstanding: number;
    payables: number;
    dso: number;
    projectCount: number;
}

export interface SummarySparklines {
    income: number[];
    cost: number[];
    profit: number[];
    ar: number[];
    backlog: number[];
    margin: number[];
    labels: string[];
}

export interface PmLeaderboardRow {
    pm: string;
    projectCount: number;
    totalMargin: number;
    avgMarginPct: number;
}

export interface CustomerLeaderboardRow {
    customer: string;
    profit: number;
    income: number;
    marginPct: number;
}

export interface HealthHeatmapEntry {
    projectId: string;
    name: string;
    customer: string;
    proposalSlug?: string;
    score: number;
    band: 'healthy' | 'watch' | 'at-risk' | 'critical';
    components: { margin: number; schedule: number; cost: number; cash: number };
}

export interface CashFlowBucket {
    inflow: number;
    outflow: number;
    net: number;
}

export interface CashFlowForecastPoint {
    date: string;
    inflow: number;
    outflow: number;
    cumulative: number;
}

export interface WipScheduleRow {
    id: string;
    project: string;
    customer: string;
    proposalNumber?: string;
    proposalSlug?: string;
    contractValue: number;
    estimatedCost: number;
    costToDate: number;
    pctComplete: number;
    earnedRevenue: number;
    billedToDate: number;
    overUnderBilled: number;
    marginPct: number;
}

export interface FinancialsSummary {
    kpis: SummaryKpis;
    previousPeriodKpis: SummaryKpis | null;
    sparklines: SummarySparklines;
    marginTrend: any[];
    arAging: any[];
    customerConcentration: any[];
    revenueVsBacklog: any[];
    insights: any[];
    topProjects: any[];
    leaderboards: {
        pmByMargin: PmLeaderboardRow[];
        customersByProfit: CustomerLeaderboardRow[];
    };
    health: { heatmap: HealthHeatmapEntry[] };
    cashFlow: {
        next30: CashFlowBucket;
        next60: CashFlowBucket;
        next90: CashFlowBucket;
        forecast: CashFlowForecastPoint[];
    };
    distributions: {
        costBreakdown: {
            labor: number; materials: number; equipment: number;
            subs: number; other: number; qbTotal: number; devcoTotal: number; total: number;
        };
    };
    wipSchedule: WipScheduleRow[];
}

// ── Params → query string ─────────────────────────────────────────────

export interface SummaryParams {
    datePreset: DatePreset;
    dateFrom?: string;
    dateTo?: string;
    proposalWriters?: string[];
    statuses?: string[];
    customers?: string[];
}

function buildQueryString(params: SummaryParams): string {
    const q = new URLSearchParams();
    q.set('datePreset', params.datePreset);
    if (params.dateFrom) q.set('dateFrom', params.dateFrom);
    if (params.dateTo)   q.set('dateTo', params.dateTo);
    if (params.proposalWriters?.length) q.set('proposalWriters', params.proposalWriters.join(','));
    if (params.statuses?.length)        q.set('statuses', params.statuses.join(','));
    if (params.customers?.length)       q.set('customers', params.customers.join(','));
    return q.toString();
}

// ── Fetcher ───────────────────────────────────────────────────────────

const fetcher = (url: string): Promise<FinancialsSummary> =>
    fetch(url).then(r => {
        if (!r.ok) throw new Error(`Summary fetch failed: ${r.status}`);
        return r.json();
    });

// ── Hook ──────────────────────────────────────────────────────────────

export function useFinancialsSummary(params: SummaryParams) {
    const qs = buildQueryString(params);
    const key = `/api/financials/summary?${qs}`;

    const { data, isLoading, isValidating, error, mutate } = useSWR<FinancialsSummary>(
        key,
        fetcher,
        {
            keepPreviousData: true,       // no flicker on filter change
            revalidateOnFocus: false,
            dedupingInterval: 30_000,     // 30s client-side dedup
            errorRetryCount: 2,
        }
    );

    return {
        summary: data ?? null,
        isLoading: isLoading && !data,    // true only on first load, not refetch
        isRefetching: isValidating && !!data,
        error: error?.message ?? null,
        refresh: () => mutate(),
    };
}
