'use client';

import { useMemo } from 'react';

interface ChartSlice {
    id: string;
    label: string;
    value: number;
    color: string;
}

interface CostBreakdownChartProps {
    slices: ChartSlice[];
    subTotal: number;
    grandTotal: number;
    markupPct: number;
    animate?: boolean;
}

export function CostBreakdownChart({
    slices,
    subTotal,
    grandTotal,
    markupPct,
    animate = true
}: CostBreakdownChartProps) {
    const sortedSlices = useMemo(() =>
        slices.filter(s => s.value > 0).sort((a, b) => b.value - a.value),
        [slices]
    );

    const formatMoney = (val: number) =>
        `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    return (
        <div className="flex flex-col p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-full">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block text-center">
                Cost Breakdown
            </label>

            {/* Semi-Circle Arc Chart */}
            <div className="relative w-full flex justify-center items-start" style={{ height: '130px' }}>
                <svg viewBox="0 0 200 105" className="w-full max-w-[220px]" style={{ overflow: 'visible' }}>
                    {sortedSlices.length === 0 ? (
                        <path
                            d="M 10 100 A 90 90 0 0 1 190 100"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="22"
                            strokeLinecap="round"
                        />
                    ) : (
                        (() => {
                            const centerX = 100;
                            const centerY = 100;
                            const radius = 75;
                            const strokeWidth = 24;
                            const gapAngle = 4;
                            const totalGap = gapAngle * (sortedSlices.length - 1);
                            const availableAngle = 180 - totalGap;
                            let currentAngle = 180;

                            return sortedSlices.map((slice, idx) => {
                                const percent = subTotal > 0 ? slice.value / subTotal : 0;
                                const sliceAngle = percent * availableAngle;

                                if (sliceAngle < 2) return null;

                                const startAngle = currentAngle;
                                const endAngle = currentAngle - sliceAngle;

                                const startRad = (startAngle * Math.PI) / 180;
                                const endRad = (endAngle * Math.PI) / 180;

                                const x1 = centerX + radius * Math.cos(startRad);
                                const y1 = centerY - radius * Math.sin(startRad);
                                const x2 = centerX + radius * Math.cos(endRad);
                                const y2 = centerY - radius * Math.sin(endRad);

                                const largeArc = sliceAngle > 180 ? 1 : 0;
                                const pathD = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

                                currentAngle = endAngle - gapAngle;

                                return (
                                    <path
                                        key={slice.id}
                                        d={pathD}
                                        fill="none"
                                        stroke={slice.color}
                                        strokeWidth={strokeWidth}
                                        strokeLinecap="round"
                                        className="transition-all duration-700 ease-out"
                                        style={{
                                            opacity: animate ? 1 : 0,
                                            transform: animate ? 'scale(1)' : 'scale(0.9)',
                                            transformOrigin: 'center',
                                            transitionDelay: `${idx * 120}ms`
                                        }}
                                    />
                                );
                            });
                        })()
                    )}
                </svg>

                {/* Center Total */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center">

                    <div className="text-2xl font-black text-slate-800 tracking-tight leading-none">
                        {formatMoney(grandTotal)}
                    </div>
                    <div className="text-xs font-bold text-slate-400 ">
                        {formatMoney(subTotal)}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="w-full mt-2 space-y-1 flex-1 overflow-y-auto max-h-[140px]">
                {sortedSlices.map(slice => {
                    const percent = subTotal > 0 ? ((slice.value / subTotal) * 100).toFixed(1) : '0';
                    const marginedValue = slice.value * (1 + markupPct / 100);

                    return (
                        <div
                            key={slice.id}
                            className="flex items-center justify-between py-0 px-0 hover:bg-white/50 rounded transition-colors group"
                        >
                            <div className="flex items-center gap-1 min-w-0">
                                <div
                                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                                    style={{ backgroundColor: slice.color }}
                                />
                                <span className="text-[11px] font-medium text-slate-600 truncate">
                                    {slice.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[10px] font-medium text-slate-400 w-10 text-right">
                                    {percent}%
                                </span>
                                <span className="text-[11px] font-medium text-slate-500 w-16 text-right">
                                    {formatMoney(slice.value)}
                                </span>
                                <span className="text-[11px] font-bold text-slate-800 w-16 text-right">
                                    {formatMoney(marginedValue)}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
