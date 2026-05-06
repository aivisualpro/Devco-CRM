'use client';

import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { fmtMoney } from '@/lib/format/money';

interface ARAgingChartProps {
    data: { bucket: string; amount: number; color: string }[];
    totalAR: number;
}

const BUCKET_COLORS: Record<string, string> = {
    '0–30': '#22c55e',
    '31–60': '#eab308',
    '61–90': '#f97316',
    '91+': '#ef4444',
};

export function ARAgingChart({ data, totalAR }: ARAgingChartProps) {
    if (!data || data.length === 0 || totalAR <= 0) {
        return (
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
                No outstanding receivables
            </div>
        );
    }

    return (
        <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                        dataKey="bucket"
                        tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }}
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
                        formatter={(value: number) => [fmtMoney(value), 'Outstanding']}
                        labelFormatter={(label) => `${label} days`}
                    />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={36}>
                        {data.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            {/* Legend strip */}
            <div className="flex items-center justify-center gap-4 mt-1">
                {data.map((d) => (
                    <div key={d.bucket} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                        <span className="text-[10px] font-bold text-slate-600">
                            {d.bucket}d: {fmtMoney(d.amount)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ARAgingChart;
