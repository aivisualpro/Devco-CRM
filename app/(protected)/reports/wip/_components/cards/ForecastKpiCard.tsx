'use client';

import React from 'react';
import { MetricInfoPopover } from '@/components/ui/MetricInfoPopover';

interface ForecastKpiCardProps {
    icon: React.ReactNode;
    label: string;
    /** Current/actual value string */
    currentValue: string;
    currentLabel?: string;
    /** Projected/forecast value string */
    projectedValue: string;
    projectedLabel?: string;
    /** 0-100 — how far along we are (actual / projected) */
    progressPct: number;
    note?: string;
    variant?: 'positive' | 'negative' | 'neutral' | 'warning';
    onClick?: () => void;
    metricId?: string;
}

const VARIANT_STYLES = {
    positive: {
        bar: 'var(--metric-positive)',
        badge: 'text-[var(--metric-positive)] bg-[var(--metric-positive-bg)]',
    },
    negative: {
        bar: 'var(--metric-negative)',
        badge: 'text-[var(--metric-negative)] bg-[var(--metric-negative-bg)]',
    },
    warning: {
        bar: 'var(--metric-warning)',
        badge: 'text-[var(--metric-warning)] bg-[var(--metric-warning-bg)]',
    },
    neutral: {
        bar: 'var(--metric-neutral)',
        badge: 'text-[var(--metric-neutral)] bg-[var(--metric-neutral-bg)]',
    },
};

export function ForecastKpiCard({
    icon, label, currentValue, currentLabel = 'Actual',
    projectedValue, projectedLabel = 'Forecast',
    progressPct, note, variant = 'neutral', onClick, metricId,
}: ForecastKpiCardProps) {
    const styles = VARIANT_STYLES[variant];

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
            <div className="flex items-center justify-between overflow-visible">
                <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">{icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
                        {label}
                    </span>
                </div>
                {metricId && <MetricInfoPopover metricId={metricId} align="end" iconSize={13} />}
            </div>

            {/* Two-column values */}
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{currentLabel}</span>
                    <span className="text-lg font-black tabular-nums text-slate-900 leading-tight">{currentValue}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{projectedLabel}</span>
                    <span className={`text-lg font-black tabular-nums leading-tight px-1 rounded ${styles.badge}`}>
                        {projectedValue}
                    </span>
                </div>
            </div>

            {/* Segmented progress bar */}
            <div className="flex flex-col gap-1">
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                            width: `${Math.min(100, Math.max(0, progressPct))}%`,
                            background: styles.bar,
                        }}
                    />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400">
                    <span>0%</span>
                    <span className="font-bold">{Math.round(progressPct)}% complete</span>
                    <span>100%</span>
                </div>
            </div>

            {note && (
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed border-t border-slate-100 pt-2">
                    {note}
                </p>
            )}
        </div>
    );
}
