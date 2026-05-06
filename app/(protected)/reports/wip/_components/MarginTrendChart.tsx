'use client';

import React from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface MarginTrendChartProps {
    data: { month: string; grossMargin: number; operatingMargin: number }[];
    targetMargin?: number;
}

export function MarginTrendChart({ data, targetMargin = 25 }: MarginTrendChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
                No margin data for this period
            </div>
        );
    }

    return (
        <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
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
                        width={48}
                        domain={['auto', 'auto']}
                    />
                    <Tooltip
                        contentStyle={{
                            background: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px -5px rgba(0,0,0,.1)',
                            fontSize: '12px',
                            fontWeight: 600,
                            padding: '10px 14px',
                        }}
                        formatter={(value: number, name: string) => [
                            `${value.toFixed(1)}%`,
                            name === 'grossMargin' ? 'Gross Margin' : 'Operating Margin',
                        ]}
                        labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                    />
                    {/* Target margin reference */}
                    <ReferenceLine
                        y={targetMargin}
                        stroke="#94a3b8"
                        strokeDasharray="6 4"
                        strokeWidth={1.5}
                        label={{
                            value: `Target ${targetMargin}%`,
                            position: 'insideTopRight',
                            fill: '#94a3b8',
                            fontSize: 10,
                            fontWeight: 700,
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="grossMargin"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: 'white', strokeWidth: 2, stroke: '#10b981' }}
                        activeDot={{ r: 5, strokeWidth: 2, fill: 'white', stroke: '#10b981' }}
                    />
                    <Line
                        type="monotone"
                        dataKey="operatingMargin"
                        stroke="#6366f1"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={{ r: 3, fill: 'white', strokeWidth: 2, stroke: '#6366f1' }}
                        activeDot={{ r: 5, strokeWidth: 2, fill: 'white', stroke: '#6366f1' }}
                    />
                </LineChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex items-center justify-center gap-5 mt-1">
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 bg-emerald-500 rounded-full" />
                    <span className="text-[11px] font-semibold text-slate-600">Gross Margin</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 bg-indigo-500 rounded-full" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #6366f1 0, #6366f1 4px, transparent 4px, transparent 7px)' }} />
                    <span className="text-[11px] font-semibold text-slate-600">Operating Margin</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 bg-slate-400 rounded-full" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #94a3b8 0, #94a3b8 4px, transparent 4px, transparent 7px)' }} />
                    <span className="text-[11px] font-semibold text-slate-500">Target</span>
                </div>
            </div>
        </div>
    );
}

export default MarginTrendChart;
