'use client';

import React from 'react';

export interface DistributionSegment {
    label: string;
    value: number;
    color: string;
}

interface DistributionKpiCardProps {
    icon: React.ReactNode;
    label: string;
    segments: DistributionSegment[];
    totalLabel?: string;
    totalValue?: string;
    onClick?: () => void;
}

export function DistributionKpiCard({
    icon, label, segments, totalLabel, totalValue, onClick,
}: DistributionKpiCardProps) {
    const total = segments.reduce((s, seg) => s + seg.value, 0);
    const nonZero = segments.filter(s => s.value > 0);

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
                {totalValue && (
                    <span className="text-sm font-black tabular-nums text-slate-900">{totalValue}</span>
                )}
            </div>

            {/* Stacked bar */}
            {nonZero.length > 0 && (
                <div className="flex h-2.5 rounded-full overflow-hidden gap-px bg-slate-100">
                    {nonZero.map((seg, i) => (
                        <div
                            key={i}
                            className="h-full transition-all duration-700"
                            style={{
                                width: `${total > 0 ? (seg.value / total) * 100 : 0}%`,
                                background: seg.color,
                            }}
                            title={`${seg.label}: ${((seg.value / total) * 100).toFixed(0)}%`}
                        />
                    ))}
                </div>
            )}

            {/* Legend */}
            <div className="flex flex-col gap-1.5">
                {segments.map((seg, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                            <span
                                className="w-2 h-2 rounded-sm shrink-0"
                                style={{ background: seg.color }}
                            />
                            <span className="text-slate-600 font-medium">{seg.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold tabular-nums text-slate-800">
                                {total > 0 ? `${((seg.value / total) * 100).toFixed(0)}%` : '0%'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {totalLabel && (
                <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-400 font-medium">
                    {totalLabel}
                </div>
            )}
        </div>
    );
}
