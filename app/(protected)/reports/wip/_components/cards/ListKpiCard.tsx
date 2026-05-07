'use client';

import React from 'react';
import { MetricInfoPopover } from '@/components/ui/MetricInfoPopover';

export interface ListKpiRow {
    rank: number;
    label: string;
    sublabel?: string;
    value: string;
    /** 0-100 mini-bar fill */
    barPct: number;
    barColor?: string;
    isBottom?: boolean;
    /** Per-row click handler for drill-down */
    onClick?: () => void;
}

interface ListKpiCardProps {
    icon: React.ReactNode;
    label: string;
    topRows: ListKpiRow[];
    bottomRows?: ListKpiRow[];
    dividerLabel?: string;
    onClick?: () => void;
    metricId?: string;
}

export function ListKpiCard({
    icon, label, topRows, bottomRows, dividerLabel, onClick, metricId,
}: ListKpiCardProps) {
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

            {/* Top rows */}
            <div className="flex flex-col gap-2">
                {topRows.map((row) => (
                    <ListRow key={row.rank} row={row} />
                ))}
            </div>

            {/* Divider + bottom rows */}
            {bottomRows && bottomRows.length > 0 && (
                <>
                    <div className="border-t border-dashed border-slate-200 pt-2">
                        {dividerLabel && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-300 mb-1.5 block">
                                {dividerLabel}
                            </span>
                        )}
                        <div className="flex flex-col gap-2">
                            {bottomRows.map((row) => (
                                <ListRow key={row.rank} row={row} isBottom />
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function ListRow({ row, isBottom = false }: { row: ListKpiRow; isBottom?: boolean }) {
    const barColor = row.barColor
        ?? (isBottom ? 'var(--metric-negative)' : 'var(--metric-positive)');

    return (
        <div
            className={`flex flex-col gap-0.5 rounded-lg transition-colors ${row.onClick ? 'cursor-pointer hover:bg-slate-50 px-1 -mx-1' : ''}`}
            onClick={row.onClick}
            role={row.onClick ? 'button' : undefined}
            tabIndex={row.onClick ? 0 : undefined}
            onKeyDown={row.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') row.onClick!(); } : undefined}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span
                        className={`text-[9px] font-black w-4 text-center shrink-0 rounded ${
                            isBottom
                                ? 'text-[var(--metric-negative)] bg-[var(--metric-negative-bg)]'
                                : 'text-[var(--metric-positive)] bg-[var(--metric-positive-bg)]'
                        }`}
                    >
                        {row.rank}
                    </span>
                    <div className="min-w-0 flex flex-col">
                        <span className="text-[11px] font-bold text-slate-800 truncate leading-tight">
                            {row.label}
                        </span>
                        {row.sublabel && (
                            <span className="text-[9px] text-slate-400 leading-tight truncate">{row.sublabel}</span>
                        )}
                    </div>
                </div>
                <span className="text-[11px] font-black tabular-nums text-slate-900 shrink-0">{row.value}</span>
            </div>
            <div className="h-1 rounded-full bg-slate-100 overflow-hidden ml-5">
                <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                        width: `${Math.min(100, Math.max(0, row.barPct))}%`,
                        background: barColor,
                    }}
                />
            </div>
        </div>
    );
}
