'use client';

import React from 'react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { fmtMoney } from '@/lib/format/money';
import { MetricInfoPopover } from '@/components/ui/MetricInfoPopover';

interface CustomerConcentrationChartProps {
    data: { customer: string; income: number }[];
    totalIncome: number;
    metricId?: string;
}

const BAR_PALETTE = [
    '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b',
    '#06b6d4', '#ec4899', '#64748b', '#f97316',
];

export function CustomerConcentrationChart({ data, totalIncome, metricId }: CustomerConcentrationChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
                No customer data available
            </div>
        );
    }

    // Build Pareto curve: cumulative % at each customer rank
    let cum = 0;
    const chartData = data.map((d, i) => {
        cum += totalIncome > 0 ? (d.income / totalIncome) * 100 : 0;
        return { ...d, cumPct: parseFloat(cum.toFixed(1)), rank: i + 1 };
    });

    const cum1 = chartData[0]?.cumPct ?? 0;
    const cum3 = chartData[2]?.cumPct ?? chartData[chartData.length - 1]?.cumPct ?? 0;
    const cum5 = chartData[4]?.cumPct ?? chartData[chartData.length - 1]?.cumPct ?? 0;

    return (
        <div className="w-full">
            {metricId && (
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer Concentration</span>
                    <MetricInfoPopover metricId={metricId} align="end" iconSize={13} />
                </div>
            )}
            {/* Pareto concentration chips */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Concentration:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                    Top 1 = {cum1.toFixed(0)}%
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                    Top 3 = {cum3.toFixed(0)}%
                </span>
                {chartData.length >= 5 && (
                    <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold">
                        Top 5 = {cum5.toFixed(0)}%
                    </span>
                )}
                {cum1 > 35 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-black animate-pulse">
                        ⚠ Concentration risk
                    </span>
                )}
            </div>

            <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 4, right: 52, left: 0, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                        <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => fmtMoney(v)}
                        />
                        {/* Second X axis for cumulative % (right) */}
                        <XAxis
                            xAxisId="pct"
                            type="number"
                            domain={[0, 100]}
                            orientation="top"
                            tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${v}%`}
                            hide
                        />
                        <YAxis
                            dataKey="customer"
                            type="category"
                            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                            width={110}
                        />
                        <Tooltip
                            contentStyle={{
                                background: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,.12)',
                                fontSize: '12px',
                                fontWeight: 600,
                                padding: '10px 14px',
                            }}
                            formatter={(value: number, name: string) => {
                                if (name === 'cumPct') return [`${value}%`, 'Cumulative share'];
                                const pct = totalIncome > 0 ? ((value / totalIncome) * 100).toFixed(1) : '0';
                                return [`${fmtMoney(value)} (${pct}%)`, 'Revenue'];
                            }}
                            labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                        />

                        {/* Revenue bars — one color per customer */}
                        <Bar dataKey="income" radius={[0, 6, 6, 0]} barSize={18}>
                            {chartData.map((_, i) => (
                                <Cell key={i} fill={BAR_PALETTE[i % BAR_PALETTE.length]} />
                            ))}
                        </Bar>

                        {/* Pareto cumulative % dot line */}
                        <Line
                            type="monotone"
                            dataKey="cumPct"
                            stroke="#334155"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            dot={{ r: 3, fill: '#334155', strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: '#334155', strokeWidth: 0 }}
                            yAxisId={0}
                            xAxisId="pct"
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 font-medium justify-end">
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 rounded-full" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #334155 0, #334155 3px, transparent 3px, transparent 6px)' }} />
                    Pareto curve (cumulative %)
                </div>
            </div>
        </div>
    );
}

export default CustomerConcentrationChart;
