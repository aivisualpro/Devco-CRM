'use client';

import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from 'recharts';
import { fmtMoney } from '@/lib/format/money';

interface CustomerConcentrationChartProps {
    data: { customer: string; income: number }[];
    totalIncome: number;
}

export function CustomerConcentrationChart({ data, totalIncome }: CustomerConcentrationChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
                No customer data available
            </div>
        );
    }

    // Pareto callouts
    const cum1 = totalIncome > 0 ? ((data[0]?.income || 0) / totalIncome * 100).toFixed(0) : '0';
    const cum3 = totalIncome > 0 ? (data.slice(0, 3).reduce((s, d) => s + d.income, 0) / totalIncome * 100).toFixed(0) : '0';
    const cum5 = totalIncome > 0 ? (data.slice(0, 5).reduce((s, d) => s + d.income, 0) / totalIncome * 100).toFixed(0) : '0';

    return (
        <div className="w-full">
            {/* Pareto callout pills */}
            <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Concentration:</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                    Top 1 = {cum1}%
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                    Top 3 = {cum3}%
                </span>
                <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold">
                    Top 5 = {cum5}%
                </span>
            </div>
            <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                        <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => fmtMoney(v)}
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
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,.1)',
                                fontSize: '12px',
                                fontWeight: 600,
                                padding: '10px 14px',
                            }}
                            formatter={(value: number) => {
                                const pct = totalIncome > 0 ? ((value / totalIncome) * 100).toFixed(1) : '0';
                                return [`${fmtMoney(value)} (${pct}%)`, 'Revenue'];
                            }}
                        />
                        <Bar
                            dataKey="income"
                            fill="#10b981"
                            radius={[0, 6, 6, 0]}
                            barSize={16}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export default CustomerConcentrationChart;
