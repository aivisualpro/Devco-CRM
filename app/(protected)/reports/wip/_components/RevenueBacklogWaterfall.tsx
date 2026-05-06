'use client';

import React from 'react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from 'recharts';
import { fmtMoney } from '@/lib/format/money';

interface RevenueBacklogWaterfallProps {
    data: {
        month: string;
        earned: number;
        backlogBurn: number;
        cumulativeContractValue: number;
    }[];
}

export function RevenueBacklogWaterfall({ data }: RevenueBacklogWaterfallProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
                No revenue / backlog data available
            </div>
        );
    }

    return (
        <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
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
                        formatter={(value: number, name: string) => {
                            const labels: Record<string, string> = {
                                earned: 'Earned Revenue',
                                backlogBurn: 'Backlog Remaining',
                                cumulativeContractValue: 'Contract Value',
                            };
                            return [fmtMoney(value), labels[name] || name];
                        }}
                        labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                    />
                    <Bar dataKey="earned" stackId="stack" fill="#10b981" radius={[0, 0, 0, 0]} barSize={28} />
                    <Bar dataKey="backlogBurn" stackId="stack" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={28} />
                    <Line
                        type="monotone"
                        dataKey="cumulativeContractValue"
                        stroke="#334155"
                        strokeWidth={2}
                        dot={{ r: 3, fill: 'white', strokeWidth: 2, stroke: '#334155' }}
                        activeDot={{ r: 5, strokeWidth: 2, fill: 'white', stroke: '#334155' }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex items-center justify-center gap-5 mt-1">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                    <span className="text-[11px] font-semibold text-slate-600">Earned Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-blue-500" />
                    <span className="text-[11px] font-semibold text-slate-600">Backlog</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 bg-slate-700 rounded-full" />
                    <span className="text-[11px] font-semibold text-slate-600">Contract Value</span>
                </div>
            </div>
        </div>
    );
}

export default RevenueBacklogWaterfall;
