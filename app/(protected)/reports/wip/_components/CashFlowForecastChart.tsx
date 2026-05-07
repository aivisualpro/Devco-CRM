'use client';

import React from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine, Line, ComposedChart,
} from 'recharts';
import { fmtMoney } from '@/lib/format/money';

export interface CashFlowPoint {
    label: string;          // "Day 30", "Day 60", "Day 90" or a date string
    inflow: number;
    outflow: number;
    cumNet?: number;        // optional — will be computed if missing
}

interface CashFlowForecastChartProps {
    data: CashFlowPoint[];
    currentCash?: number;   // starting cash balance (optional)
}

const TOOLTIP_STYLE = {
    background: 'white',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,.12)',
    fontSize: '12px',
    fontWeight: 600,
    padding: '10px 14px',
};

export function CashFlowForecastChart({ data, currentCash = 0 }: CashFlowForecastChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[260px] text-slate-400 text-sm">
                No forecast data available
            </div>
        );
    }

    // Compute cumulative net if not supplied
    let cumNet = currentCash;
    const enriched = data.map(d => {
        cumNet += (d.inflow - d.outflow);
        return { ...d, cumNet: d.cumNet ?? cumNet };
    });

    const allPositive = enriched.every(d => d.cumNet >= 0);

    return (
        <div className="w-full">
            <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={enriched} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="#10b981" stopOpacity={0.03} />
                            </linearGradient>
                            <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="#f97316" stopOpacity={0.03} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => fmtMoney(v)}
                            width={64}
                        />
                        <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            formatter={(value: number, name: string) => {
                                const labels: Record<string, string> = {
                                    inflow:  'Expected Inflow',
                                    outflow: 'Expected Outflow',
                                    cumNet:  'Net Cash Position',
                                };
                                return [fmtMoney(value), labels[name] ?? name];
                            }}
                            labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                        />

                        {/* Zero reference */}
                        <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />

                        {/* Outflow area (orange, underneath) */}
                        <Area
                            type="monotone"
                            dataKey="outflow"
                            fill="url(#outflowGrad)"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={false}
                        />

                        {/* Inflow area (green, on top) */}
                        <Area
                            type="monotone"
                            dataKey="inflow"
                            fill="url(#inflowGrad)"
                            stroke="#10b981"
                            strokeWidth={2}
                            dot={false}
                        />

                        {/* Cumulative net cash line */}
                        <Line
                            type="monotone"
                            dataKey="cumNet"
                            stroke={allPositive ? '#3b82f6' : '#8b5cf6'}
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: 'white', strokeWidth: 2, stroke: allPositive ? '#3b82f6' : '#8b5cf6' }}
                            activeDot={{ r: 6, strokeWidth: 2, fill: 'white', stroke: allPositive ? '#3b82f6' : '#8b5cf6' }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-5 mt-2 flex-wrap">
                {[
                    { color: '#10b981', label: 'Expected Inflow',   area: true  },
                    { color: '#f97316', label: 'Expected Outflow',  area: true  },
                    { color: allPositive ? '#3b82f6' : '#8b5cf6', label: 'Net Cash Position', line: true },
                ].map(({ color, label, area, line }) => (
                    <div key={label} className="flex items-center gap-1.5">
                        {area && <div className="w-3 h-3 rounded-sm" style={{ background: color + '60', border: `1.5px solid ${color}` }} />}
                        {line && <div className="w-4 h-0.5 rounded-full" style={{ background: color }} />}
                        <span className="text-[11px] font-semibold text-slate-600">{label}</span>
                    </div>
                ))}
            </div>

            {/* 30/60/90 summary row */}
            <div className="grid grid-cols-3 gap-3 mt-3">
                {enriched.map((d, i) => {
                    const net = d.inflow - d.outflow;
                    const isPos = net >= 0;
                    return (
                        <div key={i} className={`rounded-xl p-3 border text-center ${isPos ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{d.label}</p>
                            <p className={`text-sm font-black tabular-nums mt-0.5 ${isPos ? 'text-emerald-700' : 'text-red-600'}`}>
                                {isPos ? '+' : ''}{fmtMoney(net)}
                            </p>
                            <p className="text-[9px] text-slate-400 font-medium">net</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default CashFlowForecastChart;
