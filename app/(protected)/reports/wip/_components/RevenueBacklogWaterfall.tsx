'use client';

import React from 'react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Area,
} from 'recharts';
import { fmtMoney } from '@/lib/format/money';

interface RevenueBacklogWaterfallProps {
    data: {
        month: string;
        earned: number;
        backlogBurn: number;
        cumulativeContractValue: number;
        netCashInflow?: number;
    }[];
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

const SERIES_LABELS: Record<string, string> = {
    earned: 'Earned Revenue',
    backlogBurn: 'Backlog',
    cumulativeContractValue: 'Contract Value',
    netCashInflow: 'Net Cash Inflow',
};

export function RevenueBacklogWaterfall({ data }: RevenueBacklogWaterfallProps) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[280px] text-slate-400 text-sm">
                No revenue / backlog data available
            </div>
        );
    }

    // Compute net cash inflow if not provided: earned - backlogBurn (simplified proxy)
    const enriched = data.map(d => ({
        ...d,
        netCashInflow: d.netCashInflow ?? Math.max(0, d.earned - (d.backlogBurn * 0.3)),
    }));

    const hasNet = enriched.some(d => (d.netCashInflow ?? 0) > 0);

    return (
        <div className="w-full">
            <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={enriched} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="netCashGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.25} />
                                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
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
                            width={62}
                        />
                        <Tooltip
                            contentStyle={TOOLTIP_STYLE}
                            formatter={(value: number, name: string) => [
                                fmtMoney(value),
                                SERIES_LABELS[name] ?? name,
                            ]}
                            labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                        />

                        {/* Stacked: Earned + Backlog */}
                        <Bar dataKey="earned"      stackId="stack" fill="#10b981" radius={[0, 0, 0, 0]} barSize={26} />
                        <Bar dataKey="backlogBurn" stackId="stack" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={26} />

                        {/* Net Cash Inflow — area behind the bars */}
                        {hasNet && (
                            <Area
                                type="monotone"
                                dataKey="netCashInflow"
                                fill="url(#netCashGrad)"
                                stroke="#06b6d4"
                                strokeWidth={2}
                                strokeDasharray="5 3"
                                dot={{ r: 3, fill: 'white', strokeWidth: 2, stroke: '#06b6d4' }}
                                activeDot={{ r: 5, strokeWidth: 2, fill: 'white', stroke: '#06b6d4' }}
                            />
                        )}

                        {/* Contract Value — solid slate line */}
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
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-5 mt-2 flex-wrap">
                {[
                    { color: '#10b981', label: 'Earned Revenue',   solid: true  },
                    { color: '#3b82f6', label: 'Backlog',           solid: true  },
                    { color: '#334155', label: 'Contract Value',    solid: true  },
                    { color: '#06b6d4', label: 'Net Cash Inflow',   dashed: true },
                ].map(({ color, label, solid, dashed }) => (
                    <div key={label} className="flex items-center gap-1.5">
                        {solid ? (
                            <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
                        ) : (
                            <div className="w-4 h-0.5 rounded-full" style={{
                                backgroundImage: `repeating-linear-gradient(90deg, ${color} 0, ${color} 4px, transparent 4px, transparent 7px)`
                            }} />
                        )}
                        <span className="text-[11px] font-semibold text-slate-600">{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default RevenueBacklogWaterfall;
