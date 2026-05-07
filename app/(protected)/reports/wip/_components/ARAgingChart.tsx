'use client';

import React, { useState } from 'react';
import { fmtMoney } from '@/lib/format/money';
import { MetricInfoPopover } from '@/components/ui/MetricInfoPopover';

interface ARAgingChartProps {
    data: { bucket: string; amount: number; color: string }[];
    totalAR: number;
    metricId?: string;
}

const BUCKET_META: Record<string, { color: string; label: string; risk: string }> = {
    '0–30':  { color: '#22c55e', label: '0-30d',  risk: 'Current' },
    '31–60': { color: '#eab308', label: '31-60d', risk: 'Watch' },
    '61–90': { color: '#f97316', label: '61-90d', risk: 'At Risk' },
    '91+':   { color: '#ef4444', label: '91d+',   risk: 'Critical' },
};

export function ARAgingChart({ data, totalAR, metricId }: ARAgingChartProps) {
    const [hovered, setHovered] = useState<string | null>(null);

    if (!data || data.length === 0 || totalAR <= 0) {
        return (
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
                No outstanding receivables
            </div>
        );
    }

    // Stacked waterfall bar: buckets rendered as horizontal proportion segments
    const nonZero = data.filter(d => d.amount > 0);
    const totalNonZero = nonZero.reduce((s, d) => s + d.amount, 0);

    // Overdue = 31+ days
    const overdue = data.filter(d => !d.bucket.startsWith('0')).reduce((s, d) => s + d.amount, 0);
    const overdueRisk = data.find(d => d.bucket === '91+');

    return (
        <div className="w-full space-y-4">
            {metricId && (
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">A/R Aging</span>
                    <MetricInfoPopover metricId={metricId} align="end" iconSize={13} />
                </div>
            )}
            {/* Summary chips */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total A/R</span>
                    <span className="text-base font-black text-slate-900">{fmtMoney(totalAR)}</span>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                {overdue > 0 && (
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-wider">Overdue</span>
                        <span className="text-base font-black text-orange-600">{fmtMoney(overdue)}</span>
                    </div>
                )}
                {overdueRisk && overdueRisk.amount > 0 && (
                    <>
                        <div className="w-px h-8 bg-slate-200" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-wider">91+ days</span>
                            <span className="text-base font-black text-red-600">{fmtMoney(overdueRisk.amount)}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Horizontal stacked proportion bar */}
            <div className="relative">
                <div className="flex h-10 rounded-xl overflow-hidden shadow-inner border border-slate-100">
                    {nonZero.map((d, i) => {
                        const meta = BUCKET_META[d.bucket] ?? { color: '#94a3b8', label: d.bucket, risk: '' };
                        const pct = totalNonZero > 0 ? (d.amount / totalNonZero) * 100 : 0;
                        const isHov = hovered === d.bucket;
                        return (
                            <div
                                key={d.bucket}
                                style={{
                                    width: `${pct}%`,
                                    background: meta.color,
                                    opacity: hovered && !isHov ? 0.55 : 1,
                                    transition: 'opacity 0.15s, transform 0.15s',
                                    transform: isHov ? 'scaleY(1.08)' : 'scaleY(1)',
                                    transformOrigin: 'center',
                                }}
                                className="relative cursor-pointer flex items-center justify-center"
                                onMouseEnter={() => setHovered(d.bucket)}
                                onMouseLeave={() => setHovered(null)}
                                title={`${d.bucket} days: ${fmtMoney(d.amount)} (${pct.toFixed(0)}%)`}
                            >
                                {pct > 8 && (
                                    <span className="text-[10px] font-black text-white drop-shadow-sm tabular-nums">
                                        {pct.toFixed(0)}%
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Hover tooltip */}
                {hovered && (() => {
                    const d = data.find(x => x.bucket === hovered);
                    if (!d) return null;
                    const meta = BUCKET_META[d.bucket] ?? { color: '#94a3b8', label: d.bucket, risk: '' };
                    const pct = totalNonZero > 0 ? (d.amount / totalNonZero) * 100 : 0;
                    return (
                        <div
                            className="absolute -top-12 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-lg shadow-lg text-xs font-bold text-white whitespace-nowrap"
                            style={{ background: meta.color }}
                        >
                            {d.bucket}d · {fmtMoney(d.amount)} · {pct.toFixed(0)}%
                        </div>
                    );
                })()}
            </div>

            {/* Per-bucket detail rows */}
            <div className="space-y-2">
                {data.map(d => {
                    const meta = BUCKET_META[d.bucket] ?? { color: '#94a3b8', label: d.bucket, risk: '' };
                    const pct = totalNonZero > 0 ? (d.amount / totalNonZero) * 100 : 0;
                    const isHov = hovered === d.bucket;
                    return (
                        <div
                            key={d.bucket}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors cursor-default ${isHov ? 'bg-slate-50' : ''}`}
                            onMouseEnter={() => setHovered(d.bucket)}
                            onMouseLeave={() => setHovered(null)}
                        >
                            <div
                                className="w-2.5 h-2.5 rounded-sm shrink-0"
                                style={{ background: meta.color }}
                            />
                            <span className="text-[11px] font-bold text-slate-700 w-16 shrink-0">{meta.label}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%`, background: meta.color }}
                                />
                            </div>
                            <span className="text-[11px] font-black tabular-nums text-slate-900 w-20 text-right shrink-0">
                                {fmtMoney(d.amount)}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 w-8 text-right shrink-0">
                                {pct.toFixed(0)}%
                            </span>
                            <span
                                className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                                style={{ background: meta.color + '20', color: meta.color }}
                            >
                                {meta.risk}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ARAgingChart;
