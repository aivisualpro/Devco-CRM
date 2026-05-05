'use client';

import React from 'react';
import { Calendar, CalendarOff, Plus } from 'lucide-react';
import { ScheduleCard } from '@/app/(protected)/jobs/schedules/components/ScheduleCard';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES } from '@/lib/permissions/types';
import toast from 'react-hot-toast';

interface SchedulesGridProps {
    schedules: any[];
    loading: boolean;
    refreshing?: boolean;
    initialData: any;
    currentUser: any;
    userEmail: string;
    searchParamsView: string | null;
    upcomingSchedulesScope: string;
    scheduleView: 'all' | 'self';
    setScheduleView: (v: 'all' | 'self') => void;

    // Handlers
    onEdit: (schedule: any) => void;
    onCopy: (schedule: any) => void;
    onDelete: (id: string) => void;
    onViewJHA: (schedule: any) => void;
    onCreateJHA: (schedule: any) => void;
    onViewDJT: (schedule: any) => void;
    onCreateDJT: (schedule: any) => void;
    onViewDetails: (schedule: any) => void;
    onToggleDriveTime: (item: any, activeTs: any, e: any) => void;
    onQuickTimesheet: (item: any, type: string, e: any) => void;
    onViewTimesheet: (item: any, ts: any, e: any) => void;
    onChangeOfScope: (item: any) => void;
    onRequestTimeOff: () => void;
    onNewSchedule: () => void;
}

export default function SchedulesGrid({
    schedules, loading, initialData, currentUser, userEmail, searchParamsView,
    upcomingSchedulesScope, scheduleView, setScheduleView,
    onEdit, onCopy, onDelete, onViewJHA, onCreateJHA, onViewDJT, onCreateDJT,
    onViewDetails, onToggleDriveTime, onQuickTimesheet, onViewTimesheet,
    onChangeOfScope, onRequestTimeOff, onNewSchedule
}: SchedulesGridProps) {
    const { canField } = usePermissions();

    // Sort schedules: primary by fromDate ascending, secondary by updatedAt/createdAt ascending
    const sortedSchedules = [...schedules].sort((a, b) => {
        const dateA = new Date(a.fromDate || a.date || 0).getTime();
        const dateB = new Date(b.fromDate || b.date || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeA - timeB;
    });

    return (
        <div className={`${searchParamsView ? 'hidden lg:block' : 'block'} bg-transparent lg:bg-white lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm overflow-hidden`}>
            <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md flex items-center justify-between px-4 py-2 border-b border-slate-200 lg:static lg:bg-white lg:px-4 lg:py-3 lg:border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="hidden lg:flex w-8 h-8 rounded-lg bg-blue-100 items-center justify-center">
                        <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex items-center gap-2">
                        <h2 className="font-bold text-slate-900 flex items-center gap-2">
                            <span className="lg:hidden text-sm font-black uppercase tracking-widest text-slate-700">Schedules ({schedules.length})</span>
                            <span className="hidden lg:inline text-sm">Upcoming Schedules</span>
                        </h2>
                        <span className="hidden lg:inline text-xs text-slate-400">•</span>
                        <p className="hidden lg:block text-xs text-slate-500">{schedules.length} jobs this week</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onRequestTimeOff}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] lg:text-xs font-bold rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                    >
                        <CalendarOff size={14} />
                        <span className="hidden sm:inline">Request Time Off</span>
                        <span className="sm:hidden">Time Off</span>
                    </button>
                    <button
                        onClick={onNewSchedule}
                        className="flex items-center justify-center w-7 h-7 lg:w-auto lg:px-3 lg:h-auto py-1.5 text-[10px] lg:text-xs font-bold rounded-lg bg-[#0F4C75] text-white hover:bg-[#0b3d61] shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                    >
                        <Plus size={16} className="lg:w-3.5 lg:h-3.5" />
                        <span className="hidden lg:inline ml-1.5">New</span>
                    </button>
                    {upcomingSchedulesScope === 'all' && (
                        <div className="flex bg-slate-200/50 lg:bg-slate-100 rounded-lg p-0.5">
                            <button 
                                onClick={() => setScheduleView('self')}
                                className={`px-3 py-1.5 text-[10px] lg:text-xs font-bold lg:font-medium rounded-md transition-colors ${
                                    scheduleView === 'self' 
                                        ? 'bg-white text-blue-600 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Self
                            </button>
                            <button 
                                onClick={() => setScheduleView('all')}
                                className={`px-3 py-1.5 text-[10px] lg:text-xs font-bold lg:font-medium rounded-md transition-colors ${
                                    scheduleView === 'all' 
                                        ? 'bg-white text-blue-600 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                All
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Scrollable Card Area - max 2 rows visible before scroll */}
            <div className="overflow-y-auto p-2 lg:p-3 bg-slate-50 lg:bg-white max-h-none lg:max-h-[400px]">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1,2,3].map(i => (
                            <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : schedules.length === 0 ? (
                    <div className="text-center py-12">
                        <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No schedules this week</p>
                        <p className="text-sm text-slate-400 mt-1">Check back later or adjust the week filter</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20 lg:pb-0">
                        {sortedSchedules.map((schedule: any) => (
                            <ScheduleCard
                                key={schedule._id}
                                item={schedule}
                                initialData={initialData}
                                currentUser={currentUser}
                                onClick={() => onViewDetails(schedule)}
                                onEdit={canField(MODULES.DASHBOARD, 'widget_upcoming_schedules', 'update') ? () => onEdit(schedule) : undefined}
                                onCopy={canField(MODULES.DASHBOARD, 'widget_upcoming_schedules', 'create') ? () => onCopy(schedule) : undefined}
                                onDelete={canField(MODULES.DASHBOARD, 'widget_upcoming_schedules', 'delete') ? () => onDelete(schedule._id) : undefined}
                                onViewJHA={() => onViewJHA(schedule)}
                                onCreateJHA={() => onCreateJHA(schedule)}
                                onViewDJT={() => onViewDJT(schedule)}
                                onCreateDJT={() => onCreateDJT(schedule)}
                                onToggleDriveTime={(item: any, activeTs: any, e: any) => onToggleDriveTime(item, activeTs, e)}
                                onQuickTimesheet={(item: any, type: string, e: any) => onQuickTimesheet(item, type, e)}
                                onViewTimesheet={(item: any, ts: any, e: any) => onViewTimesheet(item, ts, e)}
                                onChangeOfScope={(item: any) => onChangeOfScope(item)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
