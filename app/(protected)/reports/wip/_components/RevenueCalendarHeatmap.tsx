'use client';

import React, { useMemo, useState } from 'react';
import { fmtMoney } from '@/lib/format/money';

export interface RevenueDay {
    date: string;   // ISO yyyy-mm-dd
    revenue: number;
}

interface RevenueCalendarHeatmapProps {
    days: RevenueDay[];
    /** Number of weeks to show. Defaults to last 52. */
    weeks?: number;
}

const COLORS = [
    '#f1f5f9', // 0 — slate-100 (no revenue)
    '#bbf7d0', // 1 — very low
    '#4ade80', // 2 — low
    '#16a34a', // 3 — medium
    '#166534', // 4 — high
] as const;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getColorIndex(value: number, max: number): number {
    if (value <= 0 || max <= 0) return 0;
    const ratio = value / max;
    if (ratio < 0.1) return 1;
    if (ratio < 0.35) return 2;
    if (ratio < 0.7) return 3;
    return 4;
}

function isoToDate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function RevenueCalendarHeatmap({ days, weeks = 52 }: RevenueCalendarHeatmapProps) {
    const [hovered, setHovered] = useState<{ date: string; revenue: number; x: number; y: number } | null>(null);

    const { grid, monthLabels, maxRevenue, totalRevenue, activeDays } = useMemo(() => {
        const dayMap = new Map<string, number>();
        days.forEach(d => dayMap.set(d.date, (dayMap.get(d.date) || 0) + d.revenue));

        // Build a grid: weeks columns × 7 rows (Sun–Sat)
        // Start from `weeks` weeks ago, aligned to Sunday
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find the most recent Sunday
        const endSunday = new Date(today);
        endSunday.setDate(today.getDate() - today.getDay()); // rewind to Sunday

        const startDate = new Date(endSunday);
        startDate.setDate(endSunday.getDate() - (weeks - 1) * 7);

        const totalDays = weeks * 7;
        const allDays: { date: string; revenue: number; dateObj: Date }[] = [];
        for (let i = 0; i < totalDays; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const iso = d.toISOString().slice(0, 10);
            allDays.push({ date: iso, revenue: dayMap.get(iso) || 0, dateObj: d });
        }

        const max = Math.max(...allDays.map(d => d.revenue), 1);
        const total = allDays.reduce((s, d) => s + d.revenue, 0);
        const active = allDays.filter(d => d.revenue > 0).length;

        // Build grid[week][dayOfWeek]
        const grid: typeof allDays[0][][] = [];
        for (let w = 0; w < weeks; w++) {
            grid.push(allDays.slice(w * 7, w * 7 + 7));
        }

        // Month labels: find which week each month starts
        const monthLabels: { label: string; weekIdx: number }[] = [];
        let lastMonth = -1;
        grid.forEach((week, wi) => {
            const firstDay = week[0];
            if (firstDay) {
                const m = firstDay.dateObj.getMonth();
                if (m !== lastMonth) {
                    monthLabels.push({ label: MONTHS[m], weekIdx: wi });
                    lastMonth = m;
                }
            }
        });

        return { grid, monthLabels, maxRevenue: max, totalRevenue: total, activeDays: active };
    }, [days, weeks]);

    const CELL_SIZE = 13;
    const CELL_GAP = 2;
    const STRIDE = CELL_SIZE + CELL_GAP;
    const LEFT_LABEL_W = 28;
    const TOP_LABEL_H = 18;
    const svgW = LEFT_LABEL_W + weeks * STRIDE;
    const svgH = TOP_LABEL_H + 7 * STRIDE;

    return (
        <div className="w-full space-y-3">
            {/* Summary stats */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {weeks}wk Revenue
                    </span>
                    <span className="text-base font-black text-slate-900">{fmtMoney(totalRevenue)}</span>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active Days</span>
                    <span className="text-base font-black text-slate-900">{activeDays}</span>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Peak Day</span>
                    <span className="text-base font-black text-emerald-700">{fmtMoney(maxRevenue)}</span>
                </div>
            </div>

            {/* SVG grid */}
            <div className="overflow-x-auto">
                <svg
                    width={svgW}
                    height={svgH}
                    style={{ display: 'block' }}
                    onMouseLeave={() => setHovered(null)}
                >
                    {/* Day-of-week labels */}
                    {[1, 3, 5].map(dow => (
                        <text
                            key={dow}
                            x={LEFT_LABEL_W - 4}
                            y={TOP_LABEL_H + dow * STRIDE + CELL_SIZE * 0.75}
                            textAnchor="end"
                            fontSize={9}
                            fontWeight={700}
                            fill="#94a3b8"
                        >
                            {DAY_LABELS[dow]}
                        </text>
                    ))}

                    {/* Month labels */}
                    {monthLabels.map(({ label, weekIdx }) => (
                        <text
                            key={`${label}-${weekIdx}`}
                            x={LEFT_LABEL_W + weekIdx * STRIDE}
                            y={TOP_LABEL_H - 5}
                            fontSize={9}
                            fontWeight={700}
                            fill="#64748b"
                        >
                            {label}
                        </text>
                    ))}

                    {/* Cells */}
                    {grid.map((week, wi) =>
                        week.map((cell, di) => {
                            const cx = LEFT_LABEL_W + wi * STRIDE;
                            const cy = TOP_LABEL_H + di * STRIDE;
                            const colorIdx = getColorIndex(cell.revenue, maxRevenue);
                            const color = COLORS[colorIdx];
                            const isHov = hovered?.date === cell.date;

                            return (
                                <rect
                                    key={cell.date}
                                    x={cx}
                                    y={cy}
                                    width={CELL_SIZE}
                                    height={CELL_SIZE}
                                    rx={3}
                                    ry={3}
                                    fill={color}
                                    stroke={isHov ? '#1e293b' : 'transparent'}
                                    strokeWidth={isHov ? 1.5 : 0}
                                    style={{ cursor: cell.revenue > 0 ? 'pointer' : 'default', transition: 'fill 0.1s' }}
                                    onMouseEnter={(e) => {
                                        if (cell.revenue > 0) {
                                            setHovered({
                                                date: cell.date,
                                                revenue: cell.revenue,
                                                x: cx,
                                                y: cy,
                                            });
                                        }
                                    }}
                                />
                            );
                        })
                    )}

                    {/* Hover tooltip (SVG foreignObject) */}
                    {hovered && (
                        <foreignObject
                            x={Math.min(hovered.x - 10, svgW - 160)}
                            y={Math.max(0, hovered.y - 48)}
                            width={155}
                            height={40}
                        >
                            <div
                                className="rounded-lg px-2.5 py-1.5 shadow-lg text-[11px] font-bold text-white whitespace-nowrap"
                                style={{ background: '#1e293b' }}
                            >
                                <div className="text-slate-300">{hovered.date}</div>
                                <div className="text-white">{fmtMoney(hovered.revenue)}</div>
                            </div>
                        </foreignObject>
                    )}
                </svg>
            </div>

            {/* Color legend */}
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold">
                <span>Less</span>
                {COLORS.map((c, i) => (
                    <div key={i} className="w-3 h-3 rounded-sm" style={{ background: c, border: '1px solid rgba(0,0,0,0.06)' }} />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}

export default RevenueCalendarHeatmap;
