'use client';

import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
} from 'recharts';
import { fmtMoney } from '@/lib/format/money';

interface RevenueTrendChartProps {
    data: { month: string; income: number; totalCost: number; profit: number }[];
}

export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
                No data for this period
            </div>
        );
    }

    return (
        <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
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
                        tickFormatter={(v) => fmtMoney(v)}
                        width={60}
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
                            fmtMoney(value),
                            name === 'income' ? 'Income' : name === 'totalCost' ? 'Total Cost' : 'Profit',
                        ]}
                        labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                    />
                    <Area
                        type="monotone"
                        dataKey="income"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fill="url(#incomeGradient)"
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2, fill: 'white', stroke: '#10b981' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="totalCost"
                        stroke="#f97316"
                        strokeWidth={2}
                        fill="url(#costGradient)"
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2, fill: 'white', stroke: '#f97316' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="profit"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#profitGradient)"
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 2, fill: 'white', stroke: '#3b82f6' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export default RevenueTrendChart;
