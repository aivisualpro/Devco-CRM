'use client';

import React, { ReactNode } from 'react';

interface KpiCardProps {
    label: string;
    value: ReactNode;
    icon: ReactNode;
    gradient: string;
    subtitle?: string;
    /** Period-over-period trend percentage (e.g. ↑12% vs last period) */
    trend?: number | null;
    /** Static badge string — e.g. "42% of Income" or "3 overdue" */
    badge?: string;
    /** Badge color variant */
    badgeColor?: 'green' | 'red' | 'amber' | 'blue' | 'slate' | 'violet';
    /** Compact / muted variant for secondary KPI rows */
    compact?: boolean;
}

const BADGE_STYLES: Record<string, string> = {
    green: 'text-emerald-700 bg-emerald-100/70',
    red: 'text-red-700 bg-red-100/70',
    amber: 'text-amber-700 bg-amber-100/70',
    blue: 'text-blue-700 bg-blue-100/70',
    slate: 'text-slate-600 bg-slate-100/70',
    violet: 'text-violet-700 bg-violet-100/70',
};

export function KpiCard({ label, value, icon, gradient, subtitle, trend, badge, badgeColor = 'slate', compact }: KpiCardProps) {
    return (
        <div
            className={`relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br ${gradient} ${compact ? 'p-3.5' : 'p-5'} transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300/60 group`}
        >
            {/* Decorative glow */}
            <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-white/10 blur-2xl group-hover:scale-150 transition-transform duration-500" />

            <div className={`flex items-center justify-between ${compact ? 'mb-1' : 'mb-2'} relative z-10`}>
                <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-black uppercase tracking-[0.15em] text-slate-600`}>
                    {label}
                </span>
                <div className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded-lg bg-white/60 backdrop-blur-sm flex items-center justify-center shadow-sm`}>
                    {icon}
                </div>
            </div>

            <div className={`${compact ? 'text-lg' : 'text-2xl'} font-black tabular-nums text-slate-900 relative z-10 leading-none`}>
                {value}
            </div>

            {subtitle && (
                <div className={`${compact ? 'text-[10px] mt-1' : 'text-[11px] mt-1.5'} text-slate-500 font-medium relative z-10`}>
                    {subtitle}
                </div>
            )}

            {/* Period-over-period trend pill (absolute positioned) */}
            {trend != null && trend !== 0 && (
                <div
                    className={`absolute ${compact ? 'top-2 right-10' : 'top-3 right-14'} text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        trend >= 0
                            ? 'text-emerald-700 bg-emerald-100/60'
                            : 'text-red-700 bg-red-100/60'
                    }`}
                >
                    {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
                </div>
            )}

            {/* Static badge (e.g. "42% of Income") — shown below value when no trend */}
            {badge && !trend && (
                <div className={`${compact ? 'mt-1' : 'mt-1.5'} relative z-10`}>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${BADGE_STYLES[badgeColor]}`}>
                        {badge}
                    </span>
                </div>
            )}
        </div>
    );
}

export default KpiCard;
