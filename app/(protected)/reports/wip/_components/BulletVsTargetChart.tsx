'use client';

import React from 'react';
import { ResponsiveContainer, ComposedChart, Bar, ReferenceLine, XAxis, YAxis, Tooltip, Cell } from 'recharts';

export interface BulletRow {
    label: string;       // e.g. "Organisation", "John Smith", "Cabling"
    current: number;     // e.g. 22.4 (margin %)
    target: number;      // e.g. 20.0
    max: number;         // chart domain max, e.g. 40
}

interface BulletVsTargetChartProps {
    rows: BulletRow[];
    suffix?: string;     // e.g. "%" or "/hr"
    label?: string;      // chart title
}

function getBand(current: number, target: number) {
    if (current >= target * 1.1) return { color: '#10b981', label: 'Above target' };
    if (current >= target)       return { color: '#22c55e', label: 'On target' };
    if (current >= target * 0.85) return { color: '#f59e0b', label: 'Near target' };
    return { color: '#ef4444', label: 'Below target' };
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

export function BulletVsTargetChart({ rows, suffix = '%', label = 'vs Target' }: BulletVsTargetChartProps) {
    if (!rows || rows.length === 0) {
        return (
            <div className="flex items-center justify-center h-[200px] text-slate-400 text-sm">
                No data available
            </div>
        );
    }

    return (
        <div className="w-full space-y-3">
            {rows.map((row, i) => {
                const { color, label: bandLabel } = getBand(row.current, row.target);
                const pct = row.max > 0 ? (row.current / row.max) * 100 : 0;
                const targetPct = row.max > 0 ? (row.target / row.max) * 100 : 0;
                const bandLow = Math.max(0, row.max > 0 ? ((row.target * 0.85) / row.max) * 100 : 0);
                const bandHigh = Math.min(100, row.max > 0 ? ((row.target * 1.1) / row.max) * 100 : 100);

                return (
                    <div key={i} className="group">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-black text-slate-700 truncate max-w-[140px]">
                                {row.label}
                            </span>
                            <div className="flex items-center gap-2">
                                <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: color + '20', color }}
                                >
                                    {bandLabel}
                                </span>
                                <span className="text-[11px] font-black tabular-nums text-slate-900">
                                    {row.current.toFixed(1)}{suffix}
                                </span>
                            </div>
                        </div>

                        {/* Bullet bar */}
                        <div className="relative h-5 rounded-lg overflow-hidden bg-slate-100">
                            {/* Acceptable range band */}
                            <div
                                className="absolute top-0 bottom-0 rounded"
                                style={{
                                    left: `${bandLow}%`,
                                    width: `${bandHigh - bandLow}%`,
                                    background: color + '22',
                                }}
                            />
                            {/* Actual value bar */}
                            <div
                                className="absolute top-1 bottom-1 rounded-md transition-all duration-700"
                                style={{
                                    left: 0,
                                    width: `${Math.min(100, pct)}%`,
                                    background: color,
                                }}
                            />
                            {/* Target tick */}
                            <div
                                className="absolute top-0 bottom-0 w-0.5 bg-slate-800"
                                style={{ left: `${targetPct}%` }}
                                title={`Target: ${row.target.toFixed(1)}${suffix}`}
                            />
                        </div>

                        <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[9px] text-slate-400 font-medium">0</span>
                            <span className="text-[9px] text-slate-500 font-bold">
                                Target: {row.target.toFixed(1)}{suffix}
                            </span>
                            <span className="text-[9px] text-slate-400 font-medium">{row.max}{suffix}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default BulletVsTargetChart;
