'use client';

import React from 'react';
import {
    Hammer, TrendingDown, Clock, Users, AlertCircle,
    AlertTriangle, ShieldAlert, Award, AlertOctagon,
    FilePlus2, ArrowRight,
} from 'lucide-react';
import type { Insight } from './computeInsights';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
    Hammer,
    TrendingDown,
    Clock,
    Users,
    AlertCircle,
    AlertTriangle,
    ShieldAlert,
    Award,
    AlertOctagon,
    FilePlus2,
};

const SEVERITY_STYLES: Record<string, { border: string; iconBg: string; iconText: string; pillBg: string; pillText: string }> = {
    critical: {
        border: 'border-red-300',
        iconBg: 'bg-red-100',
        iconText: 'text-red-600',
        pillBg: 'bg-red-100',
        pillText: 'text-red-700',
    },
    warning: {
        border: 'border-amber-300',
        iconBg: 'bg-amber-100',
        iconText: 'text-amber-600',
        pillBg: 'bg-amber-100',
        pillText: 'text-amber-700',
    },
    info: {
        border: 'border-blue-300',
        iconBg: 'bg-blue-100',
        iconText: 'text-blue-600',
        pillBg: 'bg-blue-100',
        pillText: 'text-blue-700',
    },
    positive: {
        border: 'border-emerald-300',
        iconBg: 'bg-emerald-100',
        iconText: 'text-emerald-600',
        pillBg: 'bg-emerald-100',
        pillText: 'text-emerald-700',
    },
};

interface InsightCardProps {
    insight: Insight;
}

export function InsightCard({ insight }: InsightCardProps) {
    const styles = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info;
    const IconComp = ICON_MAP[insight.icon] || AlertCircle;

    return (
        <div
            className={`relative flex-shrink-0 w-[280px] rounded-xl border ${styles.border} bg-white p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group cursor-default`}
        >
            {/* Header */}
            <div className="flex items-start gap-3 mb-2">
                <div className={`w-8 h-8 rounded-lg ${styles.iconBg} flex items-center justify-center shrink-0`}>
                    <IconComp className={`w-4 h-4 ${styles.iconText}`} />
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-black text-slate-800 leading-tight">{insight.title}</h4>
                </div>
            </div>

            {/* Detail */}
            <p className="text-[11px] text-slate-600 leading-relaxed mb-2.5 line-clamp-3">
                {insight.detail}
            </p>

            {/* Footer: metric pill + action */}
            <div className="flex items-center justify-between gap-2">
                {insight.metric ? (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styles.pillBg} ${styles.pillText}`}>
                        {insight.metric.label}: {insight.metric.value}
                    </span>
                ) : (
                    <span />
                )}
                {insight.actionLabel && (
                    <button
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (insight.actionLink) {
                                window.open(insight.actionLink, '_blank');
                            }
                        }}
                    >
                        {insight.actionLabel}
                        <ArrowRight className="w-3 h-3" />
                    </button>
                )}
            </div>
        </div>
    );
}

export default InsightCard;
