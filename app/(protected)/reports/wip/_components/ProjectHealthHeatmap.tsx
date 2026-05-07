'use client';

import React, { useState } from 'react';
import { computeProjectHealth, HEALTH_COLORS, HealthThresholds, HealthBand } from '@/lib/financials/projectHealth';

interface HeatmapProject {
    Id: string;
    DisplayName: string;
    CompanyName?: string;
    proposalNumber?: string;
    proposalSlug?: string;
    income?: number;
    qbCost?: number;
    devcoCost?: number;
    originalContract?: number;
    changeOrders?: number;
    ar?: number;
    startDate?: string;
    status?: string;
    proposalWriters?: string[];
    MetaData: { CreateTime: string };
}

interface ProjectHealthHeatmapProps {
    projects: HeatmapProject[];
    thresholds: HealthThresholds;
}

const BAND_ORDER: HealthBand[] = ['healthy', 'watch', 'at-risk', 'critical'];

const COMPONENT_LABELS: Record<string, string> = {
    margin:     'Margin',
    schedule:   'Schedule',
    cost:       'Cost',
    cash:       'Cash',
    compliance: 'Compliance',
    risk:       'Risk',
};

const COMPONENT_WEIGHTS: Record<string, number> = {
    margin: 30, schedule: 20, cost: 20, cash: 15, compliance: 10, risk: 5,
};

export function ProjectHealthHeatmap({ projects, thresholds }: ProjectHealthHeatmapProps) {
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    // Score every project
    const scored = projects
        .map(p => ({ project: p, health: computeProjectHealth(p, thresholds) }))
        .sort((a, b) => b.health.overall - a.health.overall);

    const bandCounts = scored.reduce<Record<HealthBand, number>>(
        (acc, { health }) => { acc[health.band]++; return acc; },
        { healthy: 0, watch: 0, 'at-risk': 0, critical: 0 },
    );

    const hovered = hoveredId ? scored.find(s => s.project.Id === hoveredId) : null;

    return (
        <div className="flex flex-col gap-4">
            {/* Band legend + summary counts */}
            <div className="flex items-center gap-4 flex-wrap">
                {BAND_ORDER.map(band => {
                    const c = HEALTH_COLORS[band];
                    return (
                        <div key={band} className="flex items-center gap-1.5">
                            <span
                                className="w-3 h-3 rounded-sm inline-block shrink-0"
                                style={{ background: c.hex }}
                            />
                            <span className="text-[11px] font-bold text-slate-600 capitalize">
                                {band === 'at-risk' ? 'At Risk' : band.charAt(0).toUpperCase() + band.slice(1)}
                            </span>
                            <span className="text-[11px] text-slate-400">
                                {bandCounts[band]}
                            </span>
                        </div>
                    );
                })}
                <span className="text-[10px] text-slate-400 ml-auto">{scored.length} projects · sorted by score</span>
            </div>

            {/* Tile grid */}
            <div className="flex flex-wrap gap-1.5">
                {scored.map(({ project: p, health }) => {
                    const c = HEALTH_COLORS[health.band];
                    const isHovered = hoveredId === p.Id;
                    return (
                        <button
                            key={p.Id}
                            type="button"
                            className={`
                                relative group flex flex-col items-center justify-center
                                w-10 h-10 rounded-lg border transition-all duration-150
                                ${c.border} ${isHovered ? 'scale-110 shadow-md z-10' : 'hover:scale-105 hover:shadow-sm'}
                            `}
                            style={{ background: c.hex + '22', borderColor: c.hex + '66' }}
                            onMouseEnter={() => setHoveredId(p.Id)}
                            onMouseLeave={() => setHoveredId(null)}
                            onClick={() => {
                                if (p.proposalSlug) window.open(`/estimates/${p.proposalSlug}`, '_blank');
                            }}
                            title={`${p.DisplayName} — ${health.overall}/100 ${health.label}`}
                        >
                            <span
                                className="text-[10px] font-black tabular-nums leading-none"
                                style={{ color: c.hex }}
                            >
                                {health.overall}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Hover detail card */}
            {hovered && (
                <div className={`
                    rounded-xl border p-4 animate-fade-in
                    ${HEALTH_COLORS[hovered.health.band].border}
                    bg-white shadow-md
                `}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 truncate leading-tight">
                                {hovered.project.DisplayName}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                                {hovered.project.CompanyName}
                                {hovered.project.proposalNumber && (
                                    <span className="ml-2 text-blue-600">#{hovered.project.proposalNumber}</span>
                                )}
                            </p>
                        </div>
                        <div
                            className="shrink-0 flex flex-col items-center px-2.5 py-1 rounded-lg"
                            style={{
                                background: HEALTH_COLORS[hovered.health.band].hex + '18',
                                border: `1px solid ${HEALTH_COLORS[hovered.health.band].hex}44`,
                            }}
                        >
                            <span
                                className="text-xl font-black tabular-nums leading-none"
                                style={{ color: HEALTH_COLORS[hovered.health.band].hex }}
                            >
                                {hovered.health.overall}
                            </span>
                            <span
                                className="text-[9px] font-bold uppercase tracking-wider"
                                style={{ color: HEALTH_COLORS[hovered.health.band].hex }}
                            >
                                {hovered.health.label}
                            </span>
                        </div>
                    </div>

                    {/* Component breakdown mini bars */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {(Object.entries(hovered.health.components) as [string, number][]).map(([key, score]) => {
                            const barColor = score >= 80 ? '#10b981'
                                : score >= 60 ? '#f59e0b'
                                : score >= 40 ? '#f97316'
                                : '#ef4444';
                            return (
                                <div key={key} className="flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            {COMPONENT_LABELS[key]}
                                            <span className="text-slate-300 ml-1">({COMPONENT_WEIGHTS[key]}%)</span>
                                        </span>
                                        <span
                                            className="text-[10px] font-black tabular-nums"
                                            style={{ color: barColor }}
                                        >
                                            {score}
                                        </span>
                                    </div>
                                    <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${score}%`, background: barColor }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
