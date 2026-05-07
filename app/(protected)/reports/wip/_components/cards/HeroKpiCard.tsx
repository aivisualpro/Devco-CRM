'use client';

import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { Sparkline } from './Sparkline';
import { AnimatedNumber } from '../AnimatedNumber';
import { MetricInfoPopover } from '@/components/ui/MetricInfoPopover';

interface HeroKpiCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    rawValue?: number;
    rawFormatter?: (n: number) => string;
    secondary?: string;
    trend?: number | null;
    inverseSemantic?: boolean;
    sparkline?: number[];
    sparklineColor?: string;
    onClick?: () => void;
    title?: string;
    /** Metric catalog ID — powers the ⓘ popover */
    metricId?: string;
}

export function HeroKpiCard({
    icon, label, value, rawValue, rawFormatter,
    secondary, trend, inverseSemantic = false,
    sparkline, sparklineColor, onClick, title, metricId,
}: HeroKpiCardProps) {
    const hasTrend = trend != null && trend !== 0;
    const isPositiveTrend = hasTrend
        ? inverseSemantic ? trend! < 0 : trend! > 0
        : false;

    const trendBg = hasTrend
        ? isPositiveTrend
            ? 'bg-[var(--metric-positive-bg)] text-[var(--metric-positive)]'
            : 'bg-[var(--metric-negative-bg)] text-[var(--metric-negative)]'
        : '';

    const sparkColor = sparklineColor
        ?? (hasTrend
            ? isPositiveTrend ? 'var(--metric-positive)' : 'var(--metric-negative)'
            : 'var(--metric-neutral)');

    const displayValue = rawValue !== undefined && rawFormatter
        ? <AnimatedNumber value={rawValue} formatter={rawFormatter} duration={500} />
        : value;

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
            {/* Top row: icon + label + trend pill + MetricInfoPopover */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-slate-400 flex-shrink-0">{icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-500 leading-none truncate">
                        {label}
                    </span>
                </div>
                <div className="flex items-center gap-1 shrink-0 overflow-visible">
                    {hasTrend && (
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${trendBg}`}>
                            {isPositiveTrend ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                            {Math.abs(trend!).toFixed(1)}%
                        </span>
                    )}
                    {metricId && <MetricInfoPopover metricId={metricId} align="end" iconSize={13} />}
                </div>
            </div>

            {/* Big animated number */}
            <div className="text-[1.6rem] font-black tabular-nums text-slate-900 leading-none tracking-tight mt-0.5">
                {displayValue}
            </div>

            {/* Secondary text */}
            {secondary && (
                <div className="text-[11px] text-slate-400 font-medium leading-none">{secondary}</div>
            )}

            {/* Sparkline area */}
            {sparkline && sparkline.length >= 3 && (
                <div className="mt-auto pt-2 flex flex-col gap-0.5">
                    <Sparkline values={sparkline} color={sparkColor} width={100} height={24} />
                    <div className="flex justify-between text-[9px] text-slate-300 font-medium tracking-tight">
                        <span>12 mo ago</span><span>Now</span>
                    </div>
                </div>
            )}
        </div>
    );
}
