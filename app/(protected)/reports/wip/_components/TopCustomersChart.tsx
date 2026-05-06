'use client';

import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { fmtMoney } from '@/lib/format/money';

interface TopCustomersChartProps {
    data: { customer: string; income: number }[];
}

export function TopCustomersChart({ data }: TopCustomersChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
                No customer data available
            </div>
        );
    }

    return (
        <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
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
                        width={120}
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
                        formatter={(value: number) => [fmtMoney(value), 'Income']}
                    />
                    <Bar
                        dataKey="income"
                        fill="#10b981"
                        radius={[0, 6, 6, 0]}
                        barSize={18}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export default TopCustomersChart;
