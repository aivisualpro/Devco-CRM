'use client';

import React from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Legend,
} from 'recharts';

interface MarginTrendChartProps {
    data: { month: string; grossMargin: number; operatingMargin: number; prevGrossMargin?: number }[];
    targetMargin?: number;
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

export function MarginTrendChart({ data, targetMargin = 25 }: MarginTrendChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
                No margin data for this period
            </div>
        );
    }

    const hasPrev = data.some(d => d.prevGrossMargin != null);
    // Target band: targetMargin ± 5 points
    const bandHigh = targetMargin + 5;
    const bandLow  = Math.max(0, targetMargin - 5);

    return (
        <div className="w-full">
            <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="targetBandGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity={0.12} />
                                <stop offset="100%" stopColor="#10b981" stopOpacity={0.04} />
                            </linearGradient>
                        </defs>

                        {/* Target band shading */}
                        <ReferenceArea
                            y1={bandLow}
                            y2={bandHigh}
                            fill="url(#targetBandGrad)"
                            stroke="#10b981"
                            strokeOpacity={0.25}
                            strokeDasharray="4 3"
                        />

                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${v}%`}
                            width={44}
                            domain={['auto', 'auto']}
                        />
                        <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            formatter={(value: number, name: string) => {
                                const labels: Record<string, string> = {
                                    grossMargin: 'Gross Margin',
                                    operatingMargin: 'Operating Margin',
                                    prevGrossMargin: 'Prior Year Gross',
                                };
                                return [`${(value as number).toFixed(1)}%`, labels[name] ?? name];
                            }}
                            labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                        />

                        {/* Target reference line */}
                        <ReferenceLine
                            y={targetMargin}
                            stroke="#10b981"
                            strokeDasharray="6 4"
                            strokeWidth={1.5}
                            label={{
                                value: `Target ${targetMargin}%`,
                                position: 'insideTopRight',
                                fill: '#10b981',
                                fontSize: 10,
                                fontWeight: 700,
                            }}
                        />

                        {/* YoY comparison (dashed slate) */}
                        {hasPrev && (
                            <Line
                                type="monotone"
                                dataKey="prevGrossMargin"
                                stroke="#94a3b8"
                                strokeWidth={1.5}
                                strokeDasharray="4 3"
                                dot={false}
                                connectNulls
                            />
                        )}

                        {/* Operating margin (indigo dashed) */}
                        <Line
                            type="monotone"
                            dataKey="operatingMargin"
                            stroke="#6366f1"
                            strokeWidth={2}
                            strokeDasharray="5 3"
                            dot={{ r: 3, fill: 'white', strokeWidth: 2, stroke: '#6366f1' }}
                            activeDot={{ r: 5, strokeWidth: 2, fill: 'white', stroke: '#6366f1' }}
                        />

                        {/* Gross margin (primary, solid emerald) */}
                        <Line
                            type="monotone"
                            dataKey="grossMargin"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: 'white', strokeWidth: 2, stroke: '#10b981' }}
                            activeDot={{ r: 6, strokeWidth: 2, fill: 'white', stroke: '#10b981' }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-5 mt-2 flex-wrap">
                <LegendItem color="#10b981" label="Gross Margin" solid />
                <LegendItem color="#6366f1" label="Operating Margin" dashed />
                {hasPrev && <LegendItem color="#94a3b8" label="Prior Year" dashed />}
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ background: 'rgba(16,185,129,0.15)', border: '1px dashed #10b981' }} />
                    <span className="text-[11px] font-semibold text-slate-500">Target band ±5%</span>
                </div>
            </div>
        </div>
    );
}

function LegendItem({ color, label, solid, dashed }: { color: string; label: string; solid?: boolean; dashed?: boolean }) {
    return (
        <div className="flex items-center gap-1.5">
            <div
                className="w-4 h-0.5 rounded-full"
                style={{
                    background: solid ? color : 'transparent',
                    backgroundImage: dashed
                        ? `repeating-linear-gradient(90deg, ${color} 0, ${color} 4px, transparent 4px, transparent 7px)`
                        : undefined,
                    backgroundColor: solid ? color : undefined,
                }}
            />
            <span className="text-[11px] font-semibold text-slate-600">{label}</span>
        </div>
    );
}

export default MarginTrendChart;
