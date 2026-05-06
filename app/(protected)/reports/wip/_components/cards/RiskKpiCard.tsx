'use client';

import React from 'react';

export interface RiskBucket {
    label: string;
    count: number;
    /** 'critical' | 'warning' | 'info' | 'positive' */
    severity: 'critical' | 'warning' | 'info' | 'positive';
}

interface RiskKpiCardProps {
    icon: React.ReactNode;
    label: string;
    totalCount: number;
    totalLabel?: string;
    buckets: RiskBucket[];
    note?: string;
    onClick?: () => void;
}

const SEV_STYLES: Record<string, { dot: string; pill: string }> = {
    critical: { dot: 'bg-[var(--metric-negative)]', pill: 'text-[var(--metric-negative)] bg-[var(--metric-negative-bg)]' },
    warning:  { dot: 'bg-[var(--metric-warning)]',  pill: 'text-[var(--metric-warning)] bg-[var(--metric-warning-bg)]' },
    info:     { dot: 'bg-[var(--metric-info)]',      pill: 'text-[var(--metric-info)] bg-[var(--metric-info-bg)]' },
    positive: { dot: 'bg-[var(--metric-positive)]',  pill: 'text-[var(--metric-positive)] bg-[var(--metric-positive-bg)]' },
};

export function RiskKpiCard({
    icon, label, totalCount, totalLabel = 'issues', buckets, note, onClick,
}: RiskKpiCardProps) {
    // Determine overall severity from highest-severity bucket with count > 0
    const sevOrder = ['critical', 'warning', 'info', 'positive'];
    const activeBuckets = buckets.filter(b => b.count > 0);
    const worstSeverity = activeBuckets.length > 0
        ? sevOrder.find(s => activeBuckets.some(b => b.severity === s)) || 'info'
        : 'positive';

    const totalStyle = totalCount === 0
        ? SEV_STYLES.positive
        : SEV_STYLES[worstSeverity];

    return (
        <div
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onClick={onClick}
            onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
            className={`
                bg-[var(--card-bg)] rounded-[var(--card-radius)] p-[var(--card-padding)]
                shadow-[var(--card-shadow-rest)] flex flex-col gap-3
                transition-all duration-200
                ${onClick ? 'cursor-pointer hover:-translate-y-[1px] hover:shadow-[var(--card-shadow-hover)]' : ''}
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">{icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
                        {label}
                    </span>
                </div>
                {/* Pulsing dot when there are active issues */}
                {totalCount > 0 && (
                    <span className={`w-2 h-2 rounded-full ${totalStyle.dot} animate-pulse`} />
                )}
            </div>

            {/* Big count */}
            <div className="flex items-end gap-1.5">
                <span className={`text-3xl font-black tabular-nums px-2 py-0.5 rounded-lg ${totalStyle.pill}`}>
                    {totalCount}
                </span>
                <span className="text-[11px] text-slate-400 font-medium pb-1">{totalLabel}</span>
            </div>

            {/* Severity buckets */}
            {buckets.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    {buckets.map((b, i) => {
                        const s = SEV_STYLES[b.severity];
                        return (
                            <div key={i} className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shrink-0`} />
                                    <span className="text-slate-600 font-medium">{b.label}</span>
                                </div>
                                <span className={`font-black tabular-nums px-1.5 py-0.5 rounded-full text-[10px] ${s.pill}`}>
                                    {b.count}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            {note && (
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed border-t border-slate-100 pt-2">
                    {note}
                </p>
            )}
        </div>
    );
}
