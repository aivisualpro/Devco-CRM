'use client';

import React from 'react';
import { Skeleton } from '@/components/ui';

/**
 * FinancialsSkeleton
 * ──────────────────────────────────────────────────────────────────
 * Mirrors the exact layout of the financials dashboard so there's
 * zero layout shift on first load. Matches:
 *   • Drill banner placeholder
 *   • Section 1 — 4 hero + 1 composite (5 cards)
 *   • Section 2 — 4 cards
 *   • Section 3 — 4 cards
 *   • Section 4 — 4 cards
 *   • Section 5 — 2 leaderboard cards
 *   • 2×2 chart grid
 *   • 2nd 2×2 chart grid
 */
function CardSkel({ tall = false }: { tall?: boolean }) {
    return (
        <div className={`rounded-2xl border border-slate-100 p-5 space-y-3 ${tall ? 'row-span-2' : ''}`}>
            <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-6 w-6 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-32 rounded-md" />
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-6 w-full rounded-lg mt-auto" />
        </div>
    );
}

function ChartSkel({ label }: { label: string }) {
    return (
        <div className="rounded-2xl border border-slate-100 p-5 space-y-3">
            <Skeleton className="h-3.5 w-36 rounded" />
            <Skeleton className="h-[220px] w-full rounded-xl" />
        </div>
    );
}

function SectionHeader({ width = 'w-40' }: { width?: string }) {
    return (
        <div className="flex items-center gap-3 py-2">
            <Skeleton className={`h-3 ${width} rounded`} />
            <div className="flex-1 h-px bg-slate-100" />
        </div>
    );
}

export function FinancialsSkeleton() {
    return (
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-8 animate-pulse">

            {/* Drill banner placeholder */}
            <Skeleton className="h-10 w-full rounded-xl" />

            {/* Section 1 — Revenue & Pipeline (hero row) */}
            <div className="space-y-3">
                <SectionHeader width="w-52" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <CardSkel />
                    <CardSkel />
                    <CardSkel />
                    <CardSkel />
                </div>
            </div>

            {/* Section 2 — Profitability */}
            <div className="space-y-3">
                <SectionHeader width="w-40" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <CardSkel />
                    <CardSkel />
                    <CardSkel />
                    <CardSkel />
                </div>
            </div>

            {/* Section 3 — Cash */}
            <div className="space-y-3">
                <SectionHeader width="w-56" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <CardSkel />
                    <CardSkel />
                    <CardSkel />
                    <CardSkel />
                </div>
            </div>

            {/* Chart grid 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartSkel label="Margin Trend" />
                <ChartSkel label="A/R Aging" />
                <ChartSkel label="Customer Concentration" />
                <ChartSkel label="Revenue vs Backlog" />
            </div>

            {/* Section 5 — People */}
            <div className="space-y-3">
                <SectionHeader width="w-32" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <CardSkel />
                    <CardSkel />
                </div>
            </div>

            {/* Chart grid 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartSkel label="PM Performance" />
                <ChartSkel label="Cash Flow Forecast" />
                <ChartSkel label="Health Heatmap" />
                <ChartSkel label="Revenue Calendar" />
            </div>
        </div>
    );
}

export default FinancialsSkeleton;
