'use client';

import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Calendar, Users, Clock, CheckCircle2, Activity as ActivityIcon, TrendingUp } from 'lucide-react';
import { MODULES } from '@/lib/permissions/types';
import { calculateTimesheetData, robustNormalizeISO } from '@/lib/timeCardUtils';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface KpiCardProps {
    icon: React.ElementType;
    label: string;
    value: React.ReactNode;
    sub?: string;
    accent: string;
    iconColor: string;
    ringColor: string;
    children?: React.ReactNode;
    className?: string;
}

function KpiCard({ icon: Icon, label, value, sub, accent, iconColor, ringColor, children, className = '' }: KpiCardProps) {
    return (
        <div className={`group relative overflow-hidden bg-gradient-to-br ${accent} rounded-3xl p-5 border ${ringColor} shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${className} flex flex-col`}>
            <div className="flex items-center gap-2.5 mb-3 z-10">
                <div className={`p-1.5 rounded-xl bg-white shadow-sm border border-white/50 backdrop-blur-sm ${iconColor}`}>
                    <Icon className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <span className={`text-xs font-black uppercase tracking-[0.2em] ${iconColor} opacity-90`}>{label}</span>
            </div>
            <div className="z-10 mt-auto">
                <div className="text-5xl font-black text-slate-800 tracking-[-0.04em] leading-none mb-2">{value}</div>
                {sub && <p className="text-sm font-semibold text-slate-500">{sub}</p>}
            </div>
            <div className="z-10 mt-4">
                {children}
            </div>
            
            {/* Decorative background shapes */}
            <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white opacity-40 blur-2xl group-hover:opacity-60 transition-opacity" />
            <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-slate-800 opacity-[0.03]" />
        </div>
    );
}

export function StatsCards({
    week,
    scope,
    weekRange,
    dashboardSchedules,
    dashboardTasks,
}: {
    week: string;
    scope: 'all' | 'self';
    weekRange: { start: Date; end: Date; startISO: string; endISO: string; label: string };
    dashboardSchedules?: any[];
    dashboardTasks?: any[];
}) {
    const { isSuperAdmin, permissions, canField } = usePermissions();
    const [snapshotView, setSnapshotView] = useState<'all' | 'self'>('all');

    const weeklySnapshotScope = useMemo(() => {
        if (isSuperAdmin) return 'all';
        if (!permissions) return 'self';
        const m = permissions.modules.find((m: any) => m.module === MODULES.DASHBOARD);
        return m?.fieldPermissions?.find((f: any) => f.field === 'widget_weekly_snapshot')?.dataScope || 'self';
    }, [permissions, isSuperAdmin]);

    // Fetch schedules slice for KPI computation
    const url = (week && snapshotView !== scope) ? `/api/dashboard?week=${encodeURIComponent(week)}&scope=${snapshotView}&section=schedules` : null;
    const { data } = useSWR(url, fetcher, { revalidateOnFocus: true, dedupingInterval: 30000, keepPreviousData: true });

    const schedules = (snapshotView === scope && dashboardSchedules) ? dashboardSchedules : (data?.schedules || []);
    const timecardSchedules = (snapshotView === scope && dashboardSchedules) ? dashboardSchedules : (data?.timecardSchedules || schedules);

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
    const tasksUrl = (week && snapshotView !== scope) ? `/api/dashboard?week=${encodeURIComponent(week)}&scope=${snapshotView}&section=tasks` : null;
    const { data: tasksData } = useSWR(tasksUrl, fetcher, { revalidateOnFocus: true, dedupingInterval: 30000, keepPreviousData: true });

    // Task counts
    const taskCounts = useMemo(() => {
        const allTodos = (snapshotView === scope && dashboardTasks) ? dashboardTasks : (tasksData?.tasks || []);
        const done = allTodos.filter((t: any) => t.status === 'done').length;
        return { done, total: allTodos.length };
    }, [tasksData?.tasks, dashboardTasks, snapshotView, scope]);

    // Fetch this week's won estimates
    const { data: estData } = useSWR(
        week ? `/api/dashboard?week=${encodeURIComponent(week)}&section=stats&estimateFilter=this_week` : null, 
        fetcher, 
        { revalidateOnFocus: true, dedupingInterval: 60000, keepPreviousData: true }
    );

    const wonEstimates = useMemo(() => {
        if (!estData?.estimateStats) return { count: 0, total: 0 };
        const won = estData.estimateStats.filter((e: any) => e.status === 'won' || e.status === 'confirmed');
        return {
            count: won.reduce((acc: number, e: any) => acc + e.count, 0),
            total: won.reduce((acc: number, e: any) => acc + e.total, 0)
        };
    }, [estData?.estimateStats]);

    // Split schedules into jobs and time-offs
    const { jobs, timeOffs } = useMemo(() => {
        const j: any[] = [];
        const t: any[] = [];
        schedules.forEach((s: any) => {
            if (s.item?.toLowerCase() === 'day off' || s.title?.toLowerCase() === 'day off' || s.item?.toLowerCase() === 'time off' || s.title?.toLowerCase() === 'time off') {
                t.push(s);
            } else {
                j.push(s);
            }
        });
        return { jobs: j, timeOffs: t };
    }, [schedules]);

    // Unique crew across snapshot schedules (ONLY on JOBS)
    const uniqueCrew = useMemo(() => {
        const s = new Set<string>();
        jobs.forEach((sc: any) => sc.assignees?.forEach((a: string) => s.add(a.toLowerCase())));
        return s.size;
    }, [jobs]);

    // JHA and DJT counts for jobs
    const { jhaCount, djtCount } = useMemo(() => {
        let jCount = 0, dCount = 0;
        jobs.forEach((sc: any) => {
            if (sc.hasJHA || sc.jha || (sc.JHASignatures && sc.JHASignatures.length > 0)) jCount++;
            if (sc.hasDJT || sc.djt || (sc.DJTSignatures && sc.DJTSignatures.length > 0)) dCount++;
        });
        return { jhaCount: jCount, djtCount: dCount };
    }, [jobs]);

    if (!canField(MODULES.DASHBOARD, 'widget_weekly_snapshot', 'view')) return null;

    return (
        <div className="bg-white rounded-[2rem] border border-slate-200/80 shadow-sm p-6 md:p-8 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[1.25rem] bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/20">
                        <ActivityIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="font-black text-slate-900 text-2xl tracking-tight">Weekly Snapshot</h2>
                    </div>
                </div>
                {weeklySnapshotScope === 'all' && (
                    <div className="flex bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/50 shadow-inner">
                        {(['self', 'all'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => setSnapshotView(v)}
                                className={`px-5 py-2 text-sm font-bold rounded-xl transition-all duration-200 capitalize ${snapshotView === v ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5">
                <KpiCard 
                    icon={Calendar} 
                    label="Jobs & Crew" 
                    value={
                        <div className="flex items-center gap-3">
                            <div>
                                <span>{jobs.length}</span>
                                <span className="text-lg text-slate-400 font-bold ml-1 uppercase tracking-wider">Jobs</span>
                            </div>
                            <div className="w-px h-8 bg-slate-300" />
                            <div>
                                <span>{uniqueCrew}</span>
                                <span className="text-lg text-slate-400 font-bold ml-1 uppercase tracking-wider">Crew</span>
                            </div>
                        </div>
                    } 
                    sub={`${timeOffs.length} off this week`} 
                    accent="from-[#f0f7ff] to-[#e0efff]" 
                    iconColor="text-[#3b82f6]" 
                    ringColor="border-blue-100"
                    className="lg:col-span-3 min-h-[180px]"
                >
                    <div className="flex items-center gap-2 mt-auto bg-white px-3 py-1.5 rounded-xl w-max shadow-sm border border-white/60">
                        <span className={`text-[11px] font-black tracking-wider ${jhaCount < jobs.length ? 'text-[#ef4444]' : 'text-slate-700'}`}>{jhaCount} JHA</span>
                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className={`text-[11px] font-black tracking-wider ${djtCount < jobs.length ? 'text-[#ef4444]' : 'text-slate-700'}`}>{djtCount} DJT</span>
                    </div>
                </KpiCard>
                
                <KpiCard 
                    icon={TrendingUp} 
                    label="Won Estimates" 
                    value={`$${wonEstimates.total >= 1000000 ? (wonEstimates.total / 1000000).toFixed(1) + 'M' : wonEstimates.total >= 1000 ? (wonEstimates.total / 1000).toFixed(1) + 'k' : wonEstimates.total}`}
                    sub={`${wonEstimates.count} won this week`} 
                    accent="from-[#fdf2f8] to-[#fce7f3]" 
                    iconColor="text-[#db2777]" 
                    ringColor="border-pink-100"
                    className="lg:col-span-2"
                />
                
                <KpiCard 
                    icon={Clock} 
                    label="Hours" 
                    value={(timecardTotals.drive + timecardTotals.site).toFixed(1)} 
                    accent="from-[#ecfdf5] to-[#d1fae5]" 
                    iconColor="text-[#059669]" 
                    ringColor="border-emerald-100"
                    className="lg:col-span-3"
                >
                    <div className="flex items-center gap-2 mt-2 bg-white/40 px-2 py-1.5 rounded-lg w-max backdrop-blur-sm border border-white/50">
                        <span className="text-[10px] font-extrabold text-blue-600">{timecardTotals.drive.toFixed(1)}h drive</span>
                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-[10px] font-extrabold text-emerald-600">{timecardTotals.site.toFixed(1)}h site</span>
                    </div>
                </KpiCard>
                
                <KpiCard 
                    icon={CheckCircle2} 
                    label="Tasks" 
                    value={Math.max(0, taskCounts.total - taskCounts.done)} 
                    accent="from-[#fffbeb] to-[#fef3c7]" 
                    iconColor="text-[#d97706]" 
                    ringColor="border-amber-100"
                    className="lg:col-span-2"
                >
                    <div className="w-full bg-amber-200/50 rounded-full h-2 mt-3 overflow-hidden backdrop-blur-sm">
                        <div className="bg-gradient-to-r from-amber-400 to-amber-500 h-2 rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${Math.round((taskCounts.done / Math.max(taskCounts.total, 1)) * 100)}%` }}>
                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-amber-700/70 mt-1.5">{taskCounts.done} done this week</p>
                </KpiCard>
            </div>
        </div>
    );
}

