'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Calendar, Users, Clock, CheckCircle2, Activity as ActivityIcon } from 'lucide-react';
import { MODULES } from '@/lib/permissions/types';
import { calculateTimesheetData, robustNormalizeISO } from '@/lib/timeCardUtils';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface KpiCardProps {
    icon: React.ElementType;
    label: string;
    value: string | number;
    sub?: string;
    accent: string;
    iconColor: string;
    ringColor: string;
    children?: React.ReactNode;
}

function KpiCard({ icon: Icon, label, value, sub, accent, iconColor, ringColor, children }: KpiCardProps) {
    return (
        <div className={`relative overflow-hidden bg-gradient-to-br ${accent} rounded-xl p-3.5 border ${ringColor}`}>
            <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${iconColor} opacity-80`}>{label}</span>
            </div>
            <p className="text-2xl font-black text-slate-800 leading-none">{value}</p>
            {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
            {children}
            <div className="absolute -right-2 -bottom-2 w-12 h-12 rounded-full bg-current opacity-10" />
        </div>
    );
}

export function StatsCards({
    week,
    scope,
    weekRange,
}: {
    week: string;
    scope: 'all' | 'self';
    weekRange: { start: Date; end: Date; startISO: string; endISO: string; label: string };
}) {
    const { isSuperAdmin, permissions, canField } = usePermissions();
    const [snapshotView, setSnapshotView] = useState<'all' | 'self'>('self');

    const weeklySnapshotScope = useMemo(() => {
        if (isSuperAdmin) return 'all';
        if (!permissions) return 'self';
        const m = permissions.modules.find((m: any) => m.module === MODULES.DASHBOARD);
        return m?.fieldPermissions?.find((f: any) => f.field === 'widget_weekly_snapshot')?.dataScope || 'self';
    }, [permissions, isSuperAdmin]);

    // Fetch schedules slice for KPI computation
    const url = week ? `/api/dashboard?week=${encodeURIComponent(week)}&scope=${snapshotView}&section=schedules` : null;
    const { data } = useSWR(url, fetcher, { revalidateOnFocus: true, dedupingInterval: 30000, keepPreviousData: true });

    const schedules = data?.schedules || [];
    const timecardSchedules = data?.timecardSchedules || schedules;

    // Compute time-card totals for current user snapshot
    const timecardTotals = useMemo(() => {
        let drive = 0, site = 0;
        const pad2 = (n: number) => String(n).padStart(2, '0');
        const toYMD = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
        const weekStartStr = toYMD(weekRange.start);
        const weekEndStr = toYMD(weekRange.end);

        timecardSchedules.forEach((s: any) => {
            s.timesheet?.forEach((ts: any) => {
                if (ts.clockIn) {
                    const normalized = robustNormalizeISO(ts.clockIn);
                    const dateStr = normalized.split('T')[0];
                    if (dateStr < weekStartStr || dateStr > weekEndStr) return;
                }
                const { hours } = calculateTimesheetData(ts as any, s.fromDate);
                if (ts.type?.toLowerCase().includes('drive')) drive += hours || 0;
                else site += hours || 0;
            });
        });
        return { drive, site };
    }, [timecardSchedules, weekRange]);

    // Fetch tasks slice for task counts
    const tasksUrl = week ? `/api/dashboard?week=${encodeURIComponent(week)}&scope=${snapshotView}&section=tasks` : null;
    const { data: tasksData } = useSWR(tasksUrl, fetcher, { revalidateOnFocus: true, dedupingInterval: 30000, keepPreviousData: true });

    // Task counts
    const taskCounts = useMemo(() => {
        const allTodos = tasksData?.tasks || [];
        return { done: allTodos.filter((t: any) => t.status === 'done').length, total: allTodos.length };
    }, [tasksData?.tasks]);

    // Unique crew across snapshot schedules
    const uniqueCrew = useMemo(() => {
        const s = new Set<string>();
        schedules.forEach((sc: any) => sc.assignees?.forEach((a: string) => s.add(a.toLowerCase())));
        return s.size;
    }, [schedules]);

    if (!canField(MODULES.DASHBOARD, 'widget_weekly_snapshot', 'view')) return null;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                        <ActivityIcon className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="font-bold text-slate-900">Weekly Snapshot</h2>
                </div>
                {weeklySnapshotScope === 'all' && (
                    <div className="flex bg-slate-100 rounded-lg p-0.5">
                        {(['self', 'all'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => setSnapshotView(v)}
                                className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-colors capitalize ${snapshotView === v ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <KpiCard icon={Calendar} label="Jobs" value={schedules.length} sub="Scheduled this week" accent="from-blue-50 to-blue-100/50" iconColor="text-blue-500" ringColor="border-blue-100/80" />
                <KpiCard icon={Users} label="Crew" value={uniqueCrew} sub="Active personnel" accent="from-violet-50 to-violet-100/50" iconColor="text-violet-500" ringColor="border-violet-100/80" />
                <KpiCard icon={Clock} label="Hours" value={(timecardTotals.drive + timecardTotals.site).toFixed(1)} accent="from-emerald-50 to-emerald-100/50" iconColor="text-emerald-500" ringColor="border-emerald-100/80">
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold text-blue-500">{timecardTotals.drive.toFixed(1)}h drive</span>
                        <span className="text-[9px] text-slate-300">•</span>
                        <span className="text-[9px] font-bold text-emerald-500">{timecardTotals.site.toFixed(1)}h site</span>
                    </div>
                </KpiCard>
                <KpiCard icon={CheckCircle2} label="Tasks" value={`${taskCounts.done}`} accent="from-amber-50 to-amber-100/50" iconColor="text-amber-500" ringColor="border-amber-100/80">
                    <div className="w-full bg-amber-200/40 rounded-full h-1.5 mt-2">
                        <div className="bg-gradient-to-r from-amber-400 to-amber-500 h-1.5 rounded-full transition-all duration-700" style={{ width: `${Math.round((taskCounts.done / Math.max(taskCounts.total, 1)) * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Completed this week</p>
                </KpiCard>
            </div>
        </div>
    );
}
