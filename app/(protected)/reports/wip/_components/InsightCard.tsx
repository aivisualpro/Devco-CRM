'use client';

import React, { useState } from 'react';
import {
    Hammer, TrendingDown, TrendingUp, Clock, Users, AlertCircle,
    AlertTriangle, ShieldAlert, Award, AlertOctagon,
    FilePlus2, ArrowRight, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { Insight } from '@/lib/financials/insights';
import { MetricInfoPopover } from '@/components/ui/MetricInfoPopover';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
    Hammer, TrendingDown, TrendingUp, Clock, Users, AlertCircle,
    AlertTriangle, ShieldAlert, Award, AlertOctagon, FilePlus2,
};

const SEVERITY_STYLES = {
    critical: {
        outerBorder: 'border-red-300',
        accent:      'bg-red-600',
        iconBg:      'bg-red-100',
        iconText:    'text-red-600',
        pillBg:      'bg-red-50',
        pillText:    'text-red-700',
        pillBorder:  'border-red-200',
        chipBg:      'bg-red-50',
        chipText:    'text-red-800',
        chipBorder:  'border-red-200',
        label:       'CRITICAL',
        labelBg:     'bg-red-600',
    },
    warning: {
        outerBorder: 'border-amber-300',
        accent:      'bg-amber-500',
        iconBg:      'bg-amber-100',
        iconText:    'text-amber-600',
        pillBg:      'bg-amber-50',
        pillText:    'text-amber-700',
        pillBorder:  'border-amber-200',
        chipBg:      'bg-amber-50',
        chipText:    'text-amber-800',
        chipBorder:  'border-amber-200',
        label:       'WARNING',
        labelBg:     'bg-amber-500',
    },
    info: {
        outerBorder: 'border-blue-200',
        accent:      'bg-blue-500',
        iconBg:      'bg-blue-100',
        iconText:    'text-blue-600',
        pillBg:      'bg-blue-50',
        pillText:    'text-blue-700',
        pillBorder:  'border-blue-200',
        chipBg:      'bg-blue-50',
        chipText:    'text-blue-800',
        chipBorder:  'border-blue-200',
        label:       'INFO',
        labelBg:     'bg-blue-500',
    },
    positive: {
        outerBorder: 'border-emerald-200',
        accent:      'bg-emerald-500',
        iconBg:      'bg-emerald-100',
        iconText:    'text-emerald-600',
        pillBg:      'bg-emerald-50',
        pillText:    'text-emerald-700',
        pillBorder:  'border-emerald-200',
        chipBg:      'bg-emerald-50',
        chipText:    'text-emerald-800',
        chipBorder:  'border-emerald-200',
        label:       'POSITIVE',
        labelBg:     'bg-emerald-500',
    },
} as const;

interface InsightCardProps {
    insight: Insight;
}

export function InsightCard({ insight }: InsightCardProps) {
    const [expanded, setExpanded] = useState(false);
    const styles = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info;
    const IconComp = ICON_MAP[insight.icon] ?? AlertCircle;
    const hasRootCause = !!insight.rootCause;
    const hasChips = !!insight.chips?.length;

    return (
        <div
            className={`
                relative flex-shrink-0 w-[300px] rounded-xl border bg-white
                ${styles.outerBorder}
                shadow-sm transition-all duration-200
                hover:shadow-md hover:-translate-y-0.5
                flex flex-col overflow-hidden
            `}
        >
            {/* Severity accent stripe */}
            <div className={`h-[3px] w-full ${styles.accent} shrink-0`} />

            <div className="flex flex-col gap-2.5 p-4 flex-1">
                {/* Header */}
                <div className="flex items-start gap-2.5">
                    <div className={`w-8 h-8 rounded-lg ${styles.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <IconComp className={`w-4 h-4 ${styles.iconText}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={`
                                text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded
                                text-white ${styles.labelBg}
                            `}>
                                {styles.label}
                            </span>
                            {insight.ruleId && (
                                <MetricInfoPopover metricId={insight.ruleId} align="start" iconSize={12} />
                            )}
                            {insight.metric && (
                                <span className={`
                                    text-[10px] font-bold px-2 py-0.5 rounded-full border
                                    ${styles.pillBg} ${styles.pillText} ${styles.pillBorder}
                                `}>
                                    {insight.metric.value}
                                </span>
                            )}
                        </div>
                        <h4 className="text-xs font-black text-slate-800 leading-snug">
                            {insight.title}
                        </h4>
                    </div>
                </div>

                {/* Finding */}
                <p className="text-[11px] text-slate-600 leading-relaxed">
                    {insight.detail}
                </p>

                {/* Worst-offender chips */}
                {hasChips && (
                    <div className="flex flex-wrap gap-1.5">
                        {insight.chips!.map((chip, i) => (
                            <span
                                key={i}
                                className={`
                                    inline-flex flex-col px-2 py-1 rounded-lg border text-[10px]
                                    ${styles.chipBg} ${styles.chipBorder}
                                `}
                            >
                                <span className={`font-black leading-tight ${styles.chipText} truncate max-w-[140px]`}>
                                    {chip.label}
                                </span>
                                <span className="text-slate-500 font-medium leading-tight">
                                    {chip.value}
                                </span>
                            </span>
                        ))}
                    </div>
                )}

                {/* Expandable root cause */}
                {hasRootCause && (
                    <div>
                        <button
                            type="button"
                            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                            onClick={() => setExpanded(e => !e)}
                        >
                            {expanded ? (
                                <><ChevronUp className="w-3 h-3" /> Hide root cause</>
                            ) : (
                                <><ChevronDown className="w-3 h-3" /> Why this happens</>
                            )}
                        </button>
                        {expanded && (
                            <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed border-l-2 border-slate-200 pl-2.5 italic">
                                {insight.rootCause}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Footer — next step + action */}
            <div className="px-4 pb-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                {insight.nextStep ? (
                    <span className="text-[10px] text-slate-400 font-medium truncate">
                        Next: <span className="text-slate-600 font-bold">{insight.nextStep}</span>
                    </span>
                ) : (
                    <span />
                )}
                {insight.actionLabel && (
                    <button
                        type="button"
                        className={`
                            shrink-0 flex items-center gap-1 text-[10px] font-black
                            ${styles.iconText} hover:underline transition-colors
                        `}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (insight.actionLink) window.open(insight.actionLink, '_blank');
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
