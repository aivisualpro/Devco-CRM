'use client';

import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Sparkline } from './Sparkline';

interface HeroKpiCardProps {
    /** Icon element */
    icon: React.ReactNode;
    /** ALL-CAPS label */
    label: string;
    /** Pre-formatted value string, e.g. "$1.39M" */
    value: string;
    /** Secondary line, e.g. "from 53 projects" */
    secondary?: string;
    /** Period-over-period trend %, e.g. 12.4 means +12.4% */
    trend?: number | null;
    /** For metrics where down-is-good (DSO, cost, payables) */
    inverseSemantic?: boolean;
    /** 12-month sparkline values */
    sparkline?: number[];
    /** Sparkline color override */
    sparklineColor?: string;
    /** Click handler for drill-down */
    onClick?: () => void;
    /** Accessibility / tooltip */
    title?: string;
}

export function HeroKpiCard({
    icon,
    label,
    value,
    secondary,
    trend,
    inverseSemantic = false,
    sparkline,
    sparklineColor,
    onClick,
    title,
}: HeroKpiCardProps) {
    const hasTrend = trend != null && trend !== 0;
    const isPositiveTrend = hasTrend
        ? inverseSemantic
            ? trend! < 0
            : trend! > 0
        : false;

    const trendBg = hasTrend
        ? isPositiveTrend
            ? 'bg-[var(--metric-positive-bg)] text-[var(--metric-positive)]'
            : 'bg-[var(--metric-negative-bg)] text-[var(--metric-negative)]'
        : '';

    // Default sparkline stroke color follows semantic
    const sparkColor = sparklineColor
        ?? (hasTrend
            ? isPositiveTrend
                ? 'var(--metric-positive)'
                : 'var(--metric-negative)'
            : 'var(--metric-neutral)');

    return (
        <div
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            title={title}
            onClick={onClick}
            onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
            className={`
                relative bg-[var(--card-bg)] rounded-[var(--card-radius)] p-[var(--card-padding)]
                shadow-[var(--card-shadow-rest)] flex flex-col gap-1
                transition-all duration-200 ease-out
                ${onClick ? 'cursor-pointer hover:-translate-y-[1px] hover:shadow-[var(--card-shadow-hover)]' : ''}
                group
            `}
            style={{ minHeight: 120 }}
        >
            {/* Top row: icon + label + trend pill */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 flex-shrink-0">{icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500 leading-none">
                        {label}
                    </span>
                </div>
                {hasTrend && (
                    <span
                        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${trendBg} shrink-0`}
                    >
                        {isPositiveTrend
                            ? <ArrowUp className="w-2.5 h-2.5" />
                            : <ArrowDown className="w-2.5 h-2.5" />}
                        {Math.abs(trend!).toFixed(1)}%
                    </span>
                )}
            </div>

            {/* Big number */}
            <div className="text-[1.6rem] font-black tabular-nums text-slate-900 leading-none tracking-tight mt-0.5">
                {value}
            </div>

            {/* Secondary text */}
            {secondary && (
                <div className="text-[11px] text-slate-400 font-medium leading-none">
                    {secondary}
                </div>
            )}

            {/* Sparkline area */}
            {sparkline && sparkline.length >= 3 && (
                <div className="mt-auto pt-2 flex flex-col gap-0.5">
                    <Sparkline values={sparkline} color={sparkColor} width={100} height={24} />
                    <div className="flex justify-between text-[9px] text-slate-300 font-medium tracking-tight">
                        <span>12 mo ago</span>
                        <span>Now</span>
                    </div>
                </div>
            )}
        </div>
    );
}
