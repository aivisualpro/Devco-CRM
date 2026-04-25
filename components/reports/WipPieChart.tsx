"use client";

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';

export default function WipPieChart({ data }: { data: any[] }) {
    return (
        <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        <Cell fill="#14B8A6" /> {/* QB Costs - Teal */}
                        <Cell fill="#F59E0B" /> {/* Devco Costs - Amber */}
                        <Cell fill="#0F4C75" /> {/* Profit - Blue */}
                    </Pie>
                    <RechartsTooltip 
                        formatter={(value: any) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        iconType="circle"
                        formatter={(value) => <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">{value}</span>}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}
