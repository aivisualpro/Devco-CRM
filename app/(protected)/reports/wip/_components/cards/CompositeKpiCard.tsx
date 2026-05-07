'use client';

import React from 'react';
import { MetricInfoPopover } from '@/components/ui/MetricInfoPopover';

export interface CompositeRow {
    label: string;
    value: string;
    /** 0-100 for the mini-bar fill */
    barPct?: number;
    barColor?: string;
    note?: string;
}

interface CompositeKpiCardProps {
    icon: React.ReactNode;
    label: string;
    score: string;
    scoreVariant?: 'positive' | 'negative' | 'warning' | 'neutral' | 'info';
    scoreSubtext?: string;
    rows: CompositeRow[];
    onClick?: () => void;
    metricId?: string;
}

const SCORE_STYLES: Record<string, string> = {
    positive: 'text-[var(--metric-positive)] bg-[var(--metric-positive-bg)]',
    negative: 'text-[var(--metric-negative)] bg-[var(--metric-negative-bg)]',
    warning:  'text-[var(--metric-warning)]  bg-[var(--metric-warning-bg)]',
    neutral:  'text-[var(--metric-neutral)]  bg-[var(--metric-neutral-bg)]',
    info:     'text-[var(--metric-info)]     bg-[var(--metric-info-bg)]',
};

const BAR_DEFAULTS: Record<string, string> = {
    positive: 'var(--metric-positive)',
    negative: 'var(--metric-negative)',
    warning:  'var(--metric-warning)',
    neutral:  'var(--metric-neutral)',
    info:     'var(--metric-info)',
};

export function CompositeKpiCard({
    icon, label, score, scoreVariant = 'neutral', scoreSubtext, rows, onClick, metricId,
}: CompositeKpiCardProps) {
    const scoreStyle = SCORE_STYLES[scoreVariant];
    const defaultBarColor = BAR_DEFAULTS[scoreVariant];

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
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">{icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">
                        {label}
                    </span>
                </div>
                <div className="flex flex-col items-end gap-1 overflow-visible">
                    <div className="flex items-center gap-1 overflow-visible">
                        {metricId && <MetricInfoPopover metricId={metricId} align="end" iconSize={13} />}
                        <span className={`text-xl font-black tabular-nums px-2 py-0.5 rounded-lg ${scoreStyle}`}>
                            {score}
                        </span>
                    </div>
                    {scoreSubtext && (
                        <span className="text-[9px] text-slate-400 font-medium">{scoreSubtext}</span>
                    )}
                </div>
            </div>

            {/* Rows */}
            <div className="flex flex-col gap-2">
                {rows.map((row, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-600 font-medium">{row.label}</span>
                            <div className="flex items-center gap-1.5">
                                {row.note && (
                                    <span className="text-[9px] text-slate-400">{row.note}</span>
                                )}
                                <span className="text-[11px] font-bold tabular-nums text-slate-800">{row.value}</span>
                            </div>
                        </div>
                        {row.barPct !== undefined && (
                            <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{
                                        width: `${Math.min(100, Math.max(0, row.barPct))}%`,
                                        background: row.barColor || defaultBarColor,
                                    }}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
