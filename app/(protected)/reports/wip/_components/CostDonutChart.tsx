'use client';

import React from 'react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import { fmtMoney } from '@/lib/format/money';

interface CostDonutChartProps {
    qbCost: number;
    jobTicketCost: number;
}

const COLORS = ['#f97316', '#f59e0b']; // orange (QB), amber (Job Tickets)

export function CostDonutChart({ qbCost, jobTicketCost }: CostDonutChartProps) {
    const total = qbCost + jobTicketCost;
    const data = [
        { name: 'QB Cost', value: qbCost },
        { name: 'Job Ticket Cost', value: jobTicketCost },
    ].filter(d => d.value > 0);

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
                No cost data available
            </div>
        );
    }

    return (
        <div className="w-full h-[300px] relative">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((_, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                                className="drop-shadow-sm"
                            />
                        ))}
                    </Pie>
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
                        formatter={(value: number) => [fmtMoney(value)]}
                    />
                </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Cost</span>
                <span className="text-lg font-black text-slate-900 tabular-nums">{fmtMoney(total)}</span>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-center gap-5 mt-2">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <span className="text-[11px] font-semibold text-slate-600">QB Cost</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-[11px] font-semibold text-slate-600">Job Tickets</span>
                </div>
            </div>
        </div>
    );
}

export default CostDonutChart;
