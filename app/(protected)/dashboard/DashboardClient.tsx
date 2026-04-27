'use client';

import Image from 'next/image';
import { useEffect, useState, useMemo, useRef, Suspense, useCallback } from 'react';
import useSWR, { mutate } from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    Clock, ChevronRight, 
    
    GripVertical, 
    MapPin, 
    
    Trash2, Edit, Copy, 
    
    Mail, Loader2, Activity as ActivityIcon
    } from 'lucide-react';
import { toast } from 'sonner';
import { Header, Badge, Input, Modal, Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/useToast';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentUser } from '@/lib/context/AppContext';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import dynamic from 'next/dynamic';
const ScheduleDetailsPopup = dynamic(() => import('@/components/ui/ScheduleDetailsPopup').then(mod => mod.ScheduleDetailsPopup), { ssr: false });
import { ScheduleItem } from '../jobs/schedules/components/ScheduleCard';

const ScheduleFormModal = dynamic(() => import('../jobs/schedules/components/ScheduleFormModal').then(mod => mod.ScheduleFormModal), { ssr: false });
const JHAModal = dynamic(() => import('../jobs/schedules/components/JHAModal').then(mod => mod.JHAModal), { ssr: false });
const DJTModal = dynamic(() => import('../jobs/schedules/components/DJTModal').then(mod => mod.DJTModal), { ssr: false });
const ChangeOfScopeModal = dynamic(() => import('../jobs/schedules/components/ChangeOfScopeModal').then(mod => mod.ChangeOfScopeModal), { ssr: false });
const TimesheetModal = dynamic(() => import('../jobs/schedules/components/TimesheetModal').then(mod => mod.TimesheetModal), { ssr: false });

import { useAllEmployees } from '@/lib/hooks/api';

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { calculateTimesheetData, robustNormalizeISO } from '@/lib/timeCardUtils';
import { getLocalNowISO } from '@/lib/scheduleUtils';

import { EstimateStatsWidget } from './widgets/EstimateStatsWidget';
import { TaskList } from './_components/TaskList';
import { StatsCards } from './_components/StatsCards';
import { ChatWidget } from './_components/ChatWidget';
import { formatWallDate } from '@/lib/format/date';
import { WeekPickerProvider, WeekPickerMobile, WeekPickerDesktop, WeekPickerDropDown } from './_components/WeekPicker';
import SchedulesGrid from './_components/SchedulesGrid';
import { TimeCardsWidget } from './_components/TimeCardsWidget';

import { DashboardProvider, useDashboardContext } from './_components/DashboardContext';


// Types
interface Objective {
    text: string;
    completed: boolean;
    completedBy?: string;
    completedAt?: string;
}

type Schedule = ScheduleItem;

interface TimeCard {
    _id: string;
    employee: string;
    clockIn: string;
    clockOut?: string;
    type?: string;
    hours?: number;
    projectName?: string;
}

interface Training {
    _id: string;
    name: string;
    completedDate?: string;
    renewalDate?: string;
    status: 'completed' | 'upcoming' | 'expired';
    type: string;
}

interface TodoItem {
    _id: string;
    task: string;
    dueDate?: string;
    assignees?: string[];
    status: 'todo' | 'in progress' | 'done';
    customerId?: string;
    customerName?: string;
    estimate?: string;
    jobAddress?: string;
    createdBy?: string;
    createdAt?: string;
    lastUpdatedBy?: string;
    lastUpdatedAt?: string;
}

interface EstimateStats {
    status: string;
    count: number;
    total: number;
}

interface ChatMessage {
    _id: string;
    sender: string;
    message: string;
    estimate?: string;
    assignee?: string;
    replyTo?: {
        _id: string;
        sender: string;
        message: string;
    };
    createdAt: string;
}

interface ActivityItem {
    user: string;
    title: string;
    type: string;
    createdAt: string;
    action: string;
}


// ScheduleCard moved to reusable component

// TimeCard mini component
const TimeCardMini = ({ card }: { card: TimeCard }) => {
    const formatTime = (dateStr?: string) => {
        if (!dateStr) return '--:--';
        try {
            const d = new Date(dateStr);
            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
        } catch { return '--:--'; }
    };

    return (
        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-blue-50 transition-colors">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
                <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-slate-900">{formatTime(card.clockIn)}</span>
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                    <span className={`font-medium text-sm ${card.clockOut ? 'text-slate-900' : 'text-amber-600'}`}>
                        {card.clockOut ? formatTime(card.clockOut) : 'Active'}
                    </span>
                </div>
                <p className="text-xs text-slate-500 truncate">{card.projectName || card.type || 'General'}</p>
            </div>
            <div className="text-right">
                <span className="font-bold text-sm text-slate-900">{card.hours?.toFixed(1) || '--'}h</span>
            </div>
        </div>
    );
};

interface DashboardEmployee {
    value: string;
    label: string;
    image?: string;
}

// Todo Kanban Column
const TodoColumn = ({ 
    title, 
    items, 
    status, 
    color,
    onDragOver,
    onDrop,
    onEdit,
    onCopy,
    onStatusChange,
    onDelete,
    employees,
    currentUserEmail,
    isSuperAdmin,
    canViewEstimates
}: { 
    title: string; 
    items: TodoItem[]; 
    status: string;
    color: string;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, status: string) => void;
    onEdit: (item: TodoItem) => void;
    onCopy: (item: TodoItem, e: React.MouseEvent) => void;
    onStatusChange: (item: TodoItem, newStatus: TodoItem['status']) => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
    employees: DashboardEmployee[];
    currentUserEmail: string;
    isSuperAdmin: boolean;
    canViewEstimates?: boolean;
}) => (
    <div 
        className="flex-1 min-w-[200px] bg-slate-100 rounded-xl p-3"
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, status)}
    >
        <div className="flex items-center gap-2 mb-3 px-1">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="font-bold text-xs uppercase tracking-wider text-slate-600">{title}</span>
            <Badge variant="default" className="ml-auto text-[10px] font-bold">{items.length}</Badge>
        </div>
        <div className="space-y-2 overflow-y-auto pr-1 max-h-[350px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {items.map(item => (
                <div
                    key={item._id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('todoId', item._id)}
                    onClick={() => onEdit(item)}
                    className="bg-white p-3 rounded-lg border border-slate-200 cursor-grab hover:shadow-md transition-shadow group flex flex-col gap-3"
                >
                    <div className="flex items-start gap-2">
                        <GripVertical className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium whitespace-pre-wrap break-words ${item.status === 'done' ? 'text-slate-400 line-through decoration-slate-300 decoration-2' : 'text-slate-800'}`}>
                                {item.task}
                            </p>
                            {(item.createdAt || item.dueDate || (item.status === 'done' && item.lastUpdatedAt)) && (
                                <div className="text-xs mt-1 flex items-center justify-between gap-2 flex-wrap">
                                    <p className="text-slate-400">
                                        {item.createdAt && <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>}
                                        {item.createdAt && item.dueDate && <span className="mx-1">|</span>}
                                        {item.dueDate && <span>Due: {formatWallDate(item.dueDate)}</span>}
                                    </p>
                                    {item.status === 'done' && item.lastUpdatedAt && (
                                        <div className="flex items-center gap-1.5 text-emerald-500 font-medium whitespace-nowrap ml-auto">
                                            <span>Completed: {formatWallDate(item.lastUpdatedAt)}</span>
                                            {item.lastUpdatedBy && (() => {
                                                const emp = employees?.find((e: any) => e.value === item.lastUpdatedBy);
                                                const name = emp?.label || item.lastUpdatedBy.split('@')[0] || 'System';
                                                const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                                                return (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Avatar className="w-5 h-5 border border-emerald-200 cursor-default">
                                                                    <AvatarImage src={emp?.image} />
                                                                    <AvatarFallback className="text-[8px] bg-emerald-50 font-bold text-emerald-600">{initials}</AvatarFallback>
                                                                </Avatar>
                                                            </TooltipTrigger>
                                                            <TooltipContent><p className="text-[10px]">Completed by {name}</p></TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-1 border-t border-slate-50 mt-1">
                        {/* Assignee Stack - Bottom Left */}
                        <div className="flex -space-x-1.5 overflow-hidden items-center">
                            {item.assignees?.map((email, idx) => {
                                const emp = employees.find(e => e.value === email);
                                const name = emp?.label || email;
                                const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
                                return (
                                    <TooltipProvider key={idx}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Avatar className="w-6 h-6 border-2 border-white ring-1 ring-slate-100 cursor-default">
                                                    <AvatarImage src={emp?.image} />
                                                    <AvatarFallback className="text-[9px] bg-slate-50 font-black text-slate-600 italic">{initials}</AvatarFallback>
                                                </Avatar>
                                            </TooltipTrigger>
                                            <TooltipContent><p className="text-[10px]">{name}</p></TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                );
                            })}
                            {item.estimate && (
                                 <span 
                                    className={`ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200 whitespace-nowrap transition-colors ${canViewEstimates ? 'cursor-pointer hover:bg-blue-100 hover:text-blue-700' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (canViewEstimates) {
                                            window.open(`/estimates/${encodeURIComponent(item.estimate!)}`, '_self');
                                        }
                                    }}
                                >
                                    {item.estimate}
                                </span>
                            )}
                        </div>

                        {/* Actions - Bottom Right (Inline) */}
                        <div className="flex items-center gap-1">
                            {(() => {
                                const isOwner = item.createdBy?.toLowerCase().trim() === currentUserEmail?.toLowerCase().trim();
                                const canManage = isOwner || isSuperAdmin;

                                return (
                                    <TooltipProvider>
                                            {/* Status Change - Available to everyone */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const statusMap: Record<string, TodoItem['status']> = {
                                                                'todo': 'in progress',
                                                                'in progress': 'done',
                                                                'done': 'todo'
                                                            };
                                                            onStatusChange(item, statusMap[item.status] || 'todo');
                                                        }}
                                                        className={`p-1.5 rounded-lg transition-colors border ${
                                                            item.status === 'todo' ? 'hover:bg-blue-50 text-slate-400 hover:text-blue-600' :
                                                            item.status === 'in progress' ? 'hover:bg-emerald-50 text-blue-500 hover:text-emerald-600' :
                                                            'hover:bg-slate-50 text-emerald-500 hover:text-slate-600'
                                                        }`}
                                                    >
                                                        <ActivityIcon size={12} />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent><p className="text-[10px]">Change Status</p></TooltipContent>
                                            </Tooltip>

                                        {/* Edit, Copy, Delete - Only for owner or Super Admin */}
                                        {canManage && (
                                            <>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                                                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                                                        >
                                                            <Edit size={12} />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p className="text-[10px]">Edit Task</p></TooltipContent>
                                                </Tooltip>

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button 
                                                            onClick={(e) => onCopy(item, e)}
                                                            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p className="text-[10px]">Copy Task</p></TooltipContent>
                                                </Tooltip>

                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button 
                                                            onClick={(e) => onDelete(item._id, e)}
                                                            className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent><p className="text-[10px]">Delete Task</p></TooltipContent>
                                                </Tooltip>
                                            </>
                                        )}
                                    </TooltipProvider>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);





// Main Dashboard Component
function DashboardContent({ initialWeek, initialScope, initialSchedulesData }: { initialWeek?: string, initialScope?: string, initialSchedulesData?: any }) {
    const router = useRouter();
    const { success, error: showError } = useToast();
    const { user, isSuperAdmin, canField, permissions, can } = usePermissions();
    const canViewEstimates = can(MODULES.ESTIMATES, ACTIONS.VIEW);
    const currentUser = useCurrentUser();
    const userEmail = currentUser?.email || '';
    
    const searchParams = useSearchParams();
    

    
    // Track if permissions have loaded (stabilizes initial fetch)
    const [permissionsReady, setPermissionsReady] = useState(false);
    const permissionsLoadedRef = useRef(false);
    
    useEffect(() => {
        // Only set to ready once we have user info (permissions loaded)
        if (user?.email && !permissionsLoadedRef.current) {
            permissionsLoadedRef.current = true;
            setPermissionsReady(true);
        }
    }, [user?.email]);

    const { weekRange } = useDashboardContext();
    
    // Data States
    const { employees: allEmployees } = useAllEmployees();
    const employees = allEmployees || [];
    
    const { data: clientsData } = useSWR('/api/clients?limit=5000&lite=true', { 
        revalidateOnFocus: false,
        revalidateOnReconnect: false
    });
    const clients = clientsData?.items || [];
    
    const { data: estimatesData } = useSWR('/api/estimates?limit=5000&lite=true', { 
        revalidateOnFocus: false,
        revalidateOnReconnect: false
    });
    
    const { data: constantsData } = useSWR('/api/constants', { 
        revalidateOnFocus: false,
        revalidateOnReconnect: false
    });

    const { data: catalogueData } = useSWR('/api/catalogue/all', { 
        revalidateOnFocus: false,
        revalidateOnReconnect: false
    });

    const initialData = useMemo(() => {
        // Pre-compute: which estimate IDs have at least one Won version
        const wonEstimateIds = new Set<string>();
        (estimatesData?.result || []).forEach((e: any) => {
            if (e.estimate != null && e.estimate !== '' && e.status?.toLowerCase() === 'won') {
                wonEstimateIds.add(String(e.estimate).trim());
            }
        });

        const uniqueEstimatesMap = new Map();
        (estimatesData?.result || []).forEach((e: any) => {
            if (e.estimate != null && e.estimate !== '') {
                const estId = String(e.estimate).trim();
                if (!uniqueEstimatesMap.has(estId)) {
                    uniqueEstimatesMap.set(estId, { 
                        ...e, 
                        estimate: estId,
                        value: estId,
                        label: `${estId}${e.projectName || e.projectTitle ? ` - ${e.projectName || e.projectTitle}` : ''}`,
                        // If ANY version is Won, mark the whole estimate as Won
                        status: wonEstimateIds.has(estId) ? 'Won' : (e.status || '')
                    });
                }
            }
        });

        const mappedEmployees = employees.map((emp: any) => ({
            ...emp,
            label: emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email,
            value: emp.email || emp._id,
            image: emp.profilePicture || ''
        }));

        const equipmentItems = (catalogueData?.result?.equipment || []).map((e: any) => ({
            value: e._id.toString(),
            label: e.equipmentMachine,
            dailyCost: e.dailyCost,
            uom: e.uom
        }));

        return {
            employees: mappedEmployees,
            clients: clientsData?.result || clientsData?.items || [],
            constants: constantsData?.result || [],
            estimates: Array.from(uniqueEstimatesMap.values()),
            equipmentItems: equipmentItems
        };
    }, [employees, clientsData, estimatesData, constantsData, catalogueData]);

    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [timecardSchedules, setTimecardSchedules] = useState<Schedule[]>([]);
    

    const estimateFilter = 'all'; // all, this_month, last_month, ytd, last_year

    // Computed Time Cards for Dashboard Table
    const dashboardTimeCards = useMemo(() => {
        if (!currentUser || !timecardSchedules.length) return [];

        const userLowerEmail = currentUser.email.toLowerCase();
        const allUserTimesheets: any[] = [];

        // Build week range strings for filtering (same approach as /jobs/time-cards)
        const pad2 = (n: number) => String(n).padStart(2, '0');
        const toYMD = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
        const weekStartStr = toYMD(weekRange.start);
        const weekEndStr = toYMD(weekRange.end);

        timecardSchedules.forEach(schedule => {
            if (schedule.timesheet) {
                schedule.timesheet.forEach(ts => {
                    if (ts.employee?.toLowerCase() !== userLowerEmail) return;

                    // Filter: Only include timesheets with clockIn within the selected week
                    if (ts.clockIn) {
                        const normalized = robustNormalizeISO(ts.clockIn);
                        const clockInDateStr = normalized.split('T')[0];
                        if (clockInDateStr < weekStartStr || clockInDateStr > weekEndStr) return;
                    }

                    const { hours, distance, calculatedDistance } = calculateTimesheetData(ts as any, schedule.fromDate);
                    allUserTimesheets.push({
                        ...ts,
                        estimate: schedule.estimate,
                        scheduleId: schedule._id,
                        hoursVal: hours,
                        distanceVal: distance,
                        rawDistanceVal: calculatedDistance
                    });
                });
            }
        });

        // Sort by clockIn date descending
        return allUserTimesheets.sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
    }, [timecardSchedules, currentUser, weekRange]);


    
    // UI States
    // Removed loading state
    
    // Debounce ref to prevent rapid re-fetches

    const [scheduleView, setScheduleView] = useState<'all' | 'self'>('self');

    // Determine Upcoming Schedules Scope
    const upcomingSchedulesScope = useMemo(() => {
        if (isSuperAdmin) return 'all';
        if (!permissions) return 'self';
        
        const dashboardPerm = permissions.modules.find(m => m.module === MODULES.DASHBOARD);
        const widgetPerm = dashboardPerm?.fieldPermissions?.find(f => f.field === 'widget_upcoming_schedules');
        return widgetPerm?.dataScope || 'self'; 
    }, [permissions, isSuperAdmin]);

    // Initialize schedule view based on permissions (run only once when permissions are ready)
    const scheduleViewInitialized = useRef(false);
    useEffect(() => {
        if (permissionsReady && !scheduleViewInitialized.current) {
            scheduleViewInitialized.current = true;
            if (isSuperAdmin || upcomingSchedulesScope === 'all') {
                setScheduleView('all');
            } else {
                setScheduleView('self');
            }
        }
    }, [permissionsReady, isSuperAdmin, upcomingSchedulesScope]);

    const [timeCardsView, setTimeCardsView] = useState<'all' | 'self'>('self');

    // Determine Time Cards Widget Scope
    const timeCardsWidgetScope = useMemo(() => {
        if (isSuperAdmin) return 'all';
        if (!permissions) return 'self';
        
        const dashboardPerm = permissions.modules.find((m: any) => m.module === MODULES.DASHBOARD);
        const widgetPerm = dashboardPerm?.fieldPermissions?.find((f: any) => f.field === 'widget_time_cards');
        return widgetPerm?.dataScope || 'self'; 
    }, [permissions, isSuperAdmin]);

    // Initialize time cards view based on permissions (run only once when permissions are ready)
    const timeCardsViewInitialized = useRef(false);
    useEffect(() => {
        if (permissionsReady && !timeCardsViewInitialized.current) {
            timeCardsViewInitialized.current = true;
            if (isSuperAdmin || timeCardsWidgetScope === 'all') {
                setTimeCardsView('all');
            } else {
                setTimeCardsView('self');
            }
        }
    }, [permissionsReady, isSuperAdmin, timeCardsWidgetScope]);

    // Determine Tasks Scope
    const tasksScope = useMemo(() => {
        if (isSuperAdmin) return 'all';
        if (!permissions) return 'self';
        
        const dashboardPerm = permissions.modules.find((m: any) => m.module === MODULES.DASHBOARD);
        const widgetPerm = dashboardPerm?.fieldPermissions?.find((f: any) => f.field === 'widget_tasks');
        return widgetPerm?.dataScope || 'self'; 
    }, [permissions, isSuperAdmin]);


    // const [chatFilter, setChatFilter] = useState(''); // Removed, using tagFilters and local state

    const weekParam = weekRange.label;
    
    const { data: schedulesData, isValidating: schedulesLoading } = useSWR(
        permissionsReady ? `/api/dashboard?week=${encodeURIComponent(weekParam)}&scope=${scheduleView}&section=schedules` : null,
        { fallbackData: initialSchedulesData, keepPreviousData: true }
    );
    
    useEffect(() => {
        if (schedulesData?.schedules) {
            setSchedules(schedulesData.schedules);
        }
    }, [schedulesData]);

    const timeCardsActive = searchParams.get('view') === 'time-cards' || !searchParams.get('view');
    const { data: timecardsData } = useSWR(
        permissionsReady && timeCardsActive ? `/api/dashboard?week=${encodeURIComponent(weekParam)}&scope=${scheduleView}&section=timecards` : null,
        { keepPreviousData: true }
    );
    
    useEffect(() => {
        if (timecardsData?.timecardSchedules) {
            setTimecardSchedules(timecardsData.timecardSchedules);
        }
    }, [timecardsData]);

    const tasksUrl = permissionsReady ? `/api/dashboard?week=${encodeURIComponent(weekParam)}&section=tasks` : null;
    const { data: tasksData, mutate: mutateDashboardTasks } = useSWR(tasksUrl, {
        fallbackData: { tasks: [] },
        keepPreviousData: true,
        dedupingInterval: 5000,
    });
    const dashboardTasks = tasksData?.tasks || [];

    const [selectedDetailSchedule, setSelectedDetailSchedule] = useState<Schedule | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [mediaModalContent] = useState<{ type: 'image' | 'map', url: string, title: string }>({ type: 'image', url: '', title: '' });
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    // Chat input is uncontrolled (ref-based) for performance — no state here
    
    // Fetch full data for ScheduleDetailsPopup
    const [fetchedEstimate, setFetchedEstimate] = useState<any>(null);
    useEffect(() => {
        if (selectedDetailSchedule?._id) {
            const fetchDetails = async () => {
                try {
                    // Fetch full schedule to get all flags/fields
                    const sRes = await fetch(`/api/schedules/${selectedDetailSchedule._id}`);
                    if (sRes.ok && sRes.headers.get('content-type')?.includes('application/json')) {
                        const sData = await sRes.json();
                        if (sData.success && sData.schedule) {
                             setSelectedDetailSchedule(prev => prev ? ({ ...prev, ...sData.schedule }) : sData.schedule);
                             
                             // If the API provided the estimate details (populates), use them
                             if (sData.estimate) {
                                 setFetchedEstimate(sData.estimate);
                             } else {
                                 // Just in case we didn't get it, default to null (or keep previous if any)
                                 // setFetchedEstimate(null); 
                             }
                        }
                    }
                } catch (e) { console.error('Error fetching detail data', e); }
            };
            fetchDetails();
        } else {
            setFetchedEstimate(null);
        }
    }, [selectedDetailSchedule?._id]);

    const fetchDashboardData = useCallback(() => {
        if (!permissionsReady) return;
        const weekParam = weekRange.label;
        mutate(`/api/dashboard?week=${encodeURIComponent(weekParam)}&scope=${scheduleView}&section=schedules`);
        mutate(`/api/dashboard?week=${encodeURIComponent(weekParam)}&section=tasks`);
        mutate(`/api/dashboard?week=${encodeURIComponent(weekParam)}&section=stats&estimateFilter=${estimateFilter}`);
        mutate(`/api/dashboard?week=${encodeURIComponent(weekParam)}&section=activities`);
        if (searchParams.get('view') === 'time-cards') {
            mutate(`/api/dashboard?week=${encodeURIComponent(weekParam)}&scope=${scheduleView}&section=timecards`);
        }
    }, [permissionsReady, weekRange.label, scheduleView, estimateFilter, searchParams]);
    
    // JHA States
    const [jhaModalOpen, setJhaModalOpen] = useState(false);
    const [selectedJHA, setSelectedJHA] = useState<any>(null);
    const [isJhaEditMode, setIsJhaEditMode] = useState(false);
    const [isGeneratingJHAPDF, setIsGeneratingJHAPDF] = useState(false);
    const [activeSignatureEmployee, setActiveSignatureEmployee] = useState<string | null>(null);

    // DJT States
    const [djtModalOpen, setDjtModalOpen] = useState(false);
    const [selectedDJT, setSelectedDJT] = useState<any>(null);
    const [isDjtEditMode, setIsDjtEditMode] = useState(false);

    // Change of Scope State
    const [changeOfScopeModalOpen, setChangeOfScopeModalOpen] = useState(false);
    const [selectedScopeSchedule, setSelectedScopeSchedule] = useState<ScheduleItem | null>(null);
    const [isGeneratingDJTPDF, setIsGeneratingDJTPDF] = useState(false);
    const [isSavingSignature, setIsSavingSignature] = useState(false);

    // Email States
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    // Timesheet States
    const [timesheetModalOpen, setTimesheetModalOpen] = useState(false);
    const [selectedTimesheet, setSelectedTimesheet] = useState<any>(null);
    const [isTimesheetEditMode, setIsTimesheetEditMode] = useState(false);

    // Schedule Edit/Delete States
    const [editScheduleOpen, setEditScheduleOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
    const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isDayOffMode, setIsDayOffMode] = useState(false);

    // Action Confirmation State (for Drive Time, Dump Washout, Shop Time)
    const [inputValue, setInputValue] = useState('');

    // Action Confirmation State (for Drive Time, Dump Washout, Shop Time)
    const [actionConfirm, setActionConfirm] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        confirmText: string;
        variant: 'danger' | 'primary' | 'dark';
        onConfirm: () => void;
        showInput?: boolean;
        mode?: 'default' | 'quickTimesheet';
        data?: any;
    }>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        variant: 'primary',
        onConfirm: () => {}
    });


    const [activeEmailType, setActiveEmailType] = useState<'jha' | 'djt'>('jha');

    // Load User
    // Helper functions for timesheet actions
    const handleDeleteSchedule = async () => {
        if (!deleteScheduleId) return;
        
        try {
            const res = await fetch(`/api/schedules?id=${deleteScheduleId}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            
            if (data.success) {
                setSchedules(prev => prev.filter(s => s._id !== deleteScheduleId));
                success('Schedule deleted successfully');
                setIsDeleteConfirmOpen(false);
                setDeleteScheduleId(null);
            } else {
                showError(data.error || 'Failed to delete schedule');
            }
        } catch (err) {
            console.error('Error deleting schedule:', err);
            showError('Failed to delete schedule');
        }
    };


    const executeQuickTimesheet = async (schedule: Schedule, type: string) => {
        if (!currentUser) return;
        
        const val = parseFloat(inputValue);
        const quantity = !isNaN(val) && val >= 0 ? val : 1;
        
        const now = new Date();
        const clockOut = now.toISOString();

        // Calculate changes based on current schedule state
        const timesheets = schedule.timesheet || [];
        const userEmail = currentUser.email.toLowerCase();
        
        // Find existing record
        const existingIndex = timesheets.findIndex(ts => {
            if (ts.employee.toLowerCase() !== userEmail) return false;
            const dwVal = String(ts.dumpWashout || '').toLowerCase();
            const stVal = String(ts.shopTime || '').toLowerCase();
            return dwVal === 'true' || dwVal === 'yes' || dwVal.includes('hrs') ||
                   stVal === 'true' || stVal === 'yes' || stVal.includes('hrs');
        });

        let newDumpQty = 0;
        let newShopQty = 0;
        let totalHours = 0;
        let clockIn = '';

        if (existingIndex > -1) {
            const existingTs = timesheets[existingIndex];
            const currentDumpQty = (existingTs.dumpQty !== undefined) ? existingTs.dumpQty : 
                                  (existingTs.dumpWashout ? 1 : 0);
            const currentShopQty = (existingTs.shopQty !== undefined) ? existingTs.shopQty : 
                                  (existingTs.shopTime ? 1 : 0);
            
            newDumpQty = currentDumpQty;
            newShopQty = currentShopQty;

            if (type === 'Dump Washout') newDumpQty = quantity;
            if (type === 'Shop Time') newShopQty = quantity;

            totalHours = (newDumpQty * 0.50) + (newShopQty * 0.25);
            // Update clockIn based on new duration (ending at NOW)
            clockIn = new Date(now.getTime() - (totalHours * 60 * 60 * 1000)).toISOString();
        } else {
            const isDump = type === 'Dump Washout';
            newDumpQty = isDump ? quantity : 0;
            newShopQty = !isDump ? quantity : 0;
            totalHours = (newDumpQty * 0.50) + (newShopQty * 0.25);
            clockIn = new Date(now.getTime() - (totalHours * 60 * 60 * 1000)).toISOString();
        }

        // Optimistic Update
        setSchedules(prev => prev.map(s => {
            if (s._id !== schedule._id) return s;
            
            const currentTimesheets = [...(s.timesheet || [])];
            
            if (existingIndex > -1) {
                const existingTs = currentTimesheets[existingIndex];
                const dwStr = newDumpQty > 0 ? `${(newDumpQty * 0.5).toFixed(2)} hrs (${newDumpQty} qty)` : undefined;
                const stStr = newShopQty > 0 ? `${(newShopQty * 0.25).toFixed(2)} hrs (${newShopQty} qty)` : undefined;

                currentTimesheets[existingIndex] = {
                    ...existingTs,
                    dumpWashout: dwStr,
                    shopTime: stStr,
                    dumpQty: newDumpQty,
                    shopQty: newShopQty,
                    qty: newDumpQty + newShopQty,
                    hours: parseFloat(totalHours.toFixed(2)),
                    clockOut: clockOut,
                    clockIn: clockIn
                };
            } else {
                const dwStr = newDumpQty > 0 ? `${(newDumpQty * 0.5).toFixed(2)} hrs (${newDumpQty} qty)` : undefined;
                const stStr = newShopQty > 0 ? `${(newShopQty * 0.25).toFixed(2)} hrs (${newShopQty} qty)` : undefined;
                
                const newTs = {
                    _id: `ts-${Date.now()}`,
                    scheduleId: s._id,
                    employee: currentUser.email,
                    clockIn: clockIn,
                    clockOut: clockOut,
                    type: 'Drive Time',
                    hours: parseFloat(totalHours.toFixed(2)),
                    qty: newDumpQty + newShopQty,
                    dumpWashout: dwStr,
                    shopTime: stStr,
                    dumpQty: newDumpQty,
                    shopQty: newShopQty,
                    status: 'Pending',
                    createdAt: now.toISOString()
                };
                currentTimesheets.push(newTs);
            }
            return { ...s, timesheet: currentTimesheets };
        }));

        // API Call
        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'quickTimesheet',
                    payload: {
                        scheduleId: schedule._id,
                        employee: currentUser.email,
                        type,
                        date: clockOut,
                        dumpQty: newDumpQty,
                        shopQty: newShopQty
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                success(`${type} updated`);
            } else {
                showError(data.message || 'Failed to update');
                fetchDashboardData();
            }
        } catch (err) {
            showError('Network error');
            fetchDashboardData();
        }
    };

    // JHA Handlers
    const handleSaveJHAForm = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                ...selectedJHA,
                schedule_id: selectedJHA.schedule_id || selectedJHA._id
            };

            const res = await fetch('/api/jha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveJHA', payload })
            });
            const data = await res.json();
            if (data.success) {
                success('JHA Saved Successfully');
                if (data.result) {
                    setSelectedJHA((prev: any) => ({ ...prev, ...data.result }));
                    setSchedules((prevSchedules) => prevSchedules.map(s => {
                        if (s._id === (selectedJHA.schedule_id || selectedJHA._id)) {
                            return { ...s, hasJHA: true, jha: data.result };
                        }
                        return s;
                    }));
                }
                fetchDashboardData();
                setIsJhaEditMode(false);
            } else {
                showError(data.error || 'Failed to save JHA');
            }
        } catch (error) {
            showError('Error saving JHA');
        }
    };

    const handleSaveJHASignature = async (dataUrl: string) => {
        if (!activeSignatureEmployee || !selectedJHA) return;
        
        let location = 'Unknown';
        if (navigator.geolocation) {
             try {
                 const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                     navigator.geolocation.getCurrentPosition(resolve, reject);
                 });
                 location = `${pos.coords.latitude},${pos.coords.longitude}`;
             } catch (e) {}
        }

        if (selectedJHA.signatures?.some((s: any) => s.employee === activeSignatureEmployee)) {
            showError('Already signed');
            setActiveSignatureEmployee(null);
            return;
        }
        try {
            const payload = {
                schedule_id: selectedJHA.schedule_id,
                employee: activeSignatureEmployee,
                signature: dataUrl,
                createdBy: currentUser?.email,
                location
            };
            const res = await fetch('/api/jha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveJHASignature', payload })
            });
            const data = await res.json();
            if (data.success) {
                success('Signature Saved');
                const newSig = data.result;
                setSelectedJHA((prev: any) => ({ ...prev, signatures: [...(prev.signatures || []), newSig] }));
                setActiveSignatureEmployee(null);
                fetchDashboardData();
            } else {
                showError(data.error || 'Failed to save signature');
                throw new Error(data.error || 'Failed to save signature');
            }
        } catch (error) {
            showError('Error saving signature');
            throw error;
        }
    };

    const handleDownloadJhaPdf = async () => {
        if (!selectedJHA) return;
        setIsGeneratingJHAPDF(true);
        try {
            const templateId = '164zwSdl2631kZ4mRUVtzWhg5oewL0wy6RVCgPQig258';
            const schedule = schedules.find(s => s._id === selectedJHA.schedule_id) || selectedJHA.scheduleRef;
            const estimate = initialData.estimates.find((e: any) => {
                const estNum = e.value || e.estimate || e.estimateNum;
                return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
            });
            const client = initialData.clients.find((c: any) => c._id === schedule?.customerId || c.name === schedule?.customerName);
            
            const variables: Record<string, any> = {
                ...selectedJHA,
                customerId: client?.name || schedule?.customerName || '',
                contactName: estimate?.contactName || estimate?.contact || '',
                contactPhone: estimate?.contactPhone || estimate?.phone || '',
                jobAddress: estimate?.jobAddress || schedule?.jobLocation || '',
                estimate: schedule?.estimate || '',
                estimateNum: schedule?.estimate || '',
                customerName: schedule?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                foremanName: schedule?.foremanName || '',
                projectName: estimate?.projectTitle || estimate?.projectName || '',
                date: selectedJHA.date ? formatWallDate(selectedJHA.date) : '',
                day: new Date(selectedJHA.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
            };

            const booleanFields = [
                 'operatingMiniEx', 'operatingAVacuumTruck', 'excavatingTrenching', 'acConcWork',
                 'operatingBackhoe', 'workingInATrench', 'trafficControl', 'roadWork', 'operatingHdd',
                 'confinedSpace', 'settingUgBoxes', 'otherDailyWork', 'sidewalks', 'heatAwareness',
                 'ladderWork', 'overheadLifting', 'materialHandling', 'roadHazards', 'heavyLifting',
                 'highNoise', 'pinchPoints', 'sharpObjects', 'trippingHazards', 'otherJobsiteHazards',
                 'stagingAreaDiscussed', 'rescueProceduresDiscussed', 'evacuationRoutesDiscussed',
                 'emergencyContactNumberWillBe911', 'firstAidAndCPREquipmentOnsite', 'closestHospitalDiscussed'
            ];
            booleanFields.forEach(f => {
                variables[f] = (variables[f] === true || variables[f] === 'TRUE' || variables[f] === 'Yes' || variables[f] === '1') ? '✔️' : '';
            });

            for (let i = 1; i <= 15; i++) {
                variables[`sig_name_${i}`] = variables[`sig_img_${i}`] = variables[`Print Name_${i}`] = variables[`_ComputedName_${i}`] = '';
            }

            if (variables.signatures?.length > 0) {
                variables.hasSignatures = true;
                variables.signatures.forEach((sig: any, index: number) => {
                    const empName = initialData.employees.find((e: any) => e.value === sig.employee)?.label || sig.employee;
                    const idx = index + 1;
                    variables[`sig_name_${idx}`] = empName;
                    variables[`sig_img_${idx}`] = sig.signature;
                    variables[`Print Name_${idx}`] = empName;
                    variables[`_ComputedName_${idx}`] = empName;
                    if (idx === 1) variables[`_ComputedName`] = empName; 
                });
            } else {
                variables.hasSignatures = false;
            }

            const response = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!response.ok) throw new Error('Failed to generate PDF');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `JHA_${schedule?.customerName || 'Report'}.pdf`;
            a.click();
            success('JHA PDF downloaded!');
        } catch (error: any) {
            showError(error.message || 'Download failed');
        } finally {
            setIsGeneratingJHAPDF(false);
        }
    };

    const handleEmailJhaPdf = async (e: any) => {
        e.preventDefault();
        if (!selectedJHA || !emailTo) return;
        setIsSendingEmail(true);
        try {
            const templateId = '164zwSdl2631kZ4mRUVtzWhg5oewL0wy6RVCgPQig258';
            const schedule = schedules.find(s => s._id === selectedJHA.schedule_id) || selectedJHA.scheduleRef;
            const estimate = initialData.estimates.find((e: any) => {
                const estNum = e.value || e.estimate || e.estimateNum;
                return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
            });
            const client = initialData.clients.find((c: any) => c._id === schedule?.customerId || c.name === schedule?.customerName);
            
            const variables: Record<string, any> = {
                ...selectedJHA,
                customerId: client?.name || schedule?.customerName || '',
                contactName: estimate?.contactName || estimate?.contact || '',
                contactPhone: estimate?.contactPhone || estimate?.phone || '',
                jobAddress: estimate?.jobAddress || schedule?.jobLocation || '',
                estimate: schedule?.estimate || '',
                estimateNum: schedule?.estimate || '',
                customerName: schedule?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                foremanName: schedule?.foremanName || '',
                projectName: estimate?.projectTitle || estimate?.projectName || '',
                date: selectedJHA.date ? formatWallDate(selectedJHA.date) : '',
                day: new Date(selectedJHA.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
            };

            const booleanFields = [
                 'operatingMiniEx', 'operatingAVacuumTruck', 'excavatingTrenching', 'acConcWork',
                 'operatingBackhoe', 'workingInATrench', 'trafficControl', 'roadWork', 'operatingHdd',
                 'confinedSpace', 'settingUgBoxes', 'otherDailyWork', 'sidewalks', 'heatAwareness',
                 'ladderWork', 'overheadLifting', 'materialHandling', 'roadHazards', 'heavyLifting',
                 'highNoise', 'pinchPoints', 'sharpObjects', 'trippingHazards', 'otherJobsiteHazards',
                 'stagingAreaDiscussed', 'rescueProceduresDiscussed', 'evacuationRoutesDiscussed',
                 'emergencyContactNumberWillBe911', 'firstAidAndCPREquipmentOnsite', 'closestHospitalDiscussed'
            ];
            booleanFields.forEach(f => {
                variables[f] = (variables[f] === true || variables[f] === 'TRUE' || variables[f] === 'Yes' || variables[f] === '1') ? '✔️' : '';
            });

            for (let i = 1; i <= 15; i++) {
                variables[`sig_name_${i}`] = variables[`sig_img_${i}`] = variables[`Print Name_${i}`] = variables[`_ComputedName_${i}`] = '';
            }

            if (variables.signatures?.length > 0) {
                variables.hasSignatures = true;
                variables.signatures.forEach((sig: any, index: number) => {
                    const empName = initialData.employees.find((e: any) => e.value === sig.employee)?.label || sig.employee;
                    const idx = index + 1;
                    variables[`sig_name_${idx}`] = empName;
                    variables[`sig_img_${idx}`] = sig.signature;
                    variables[`Print Name_${idx}`] = empName;
                    variables[`_ComputedName_${idx}`] = empName;
                    if (idx === 1) variables[`_ComputedName`] = empName; 
                });
            } else {
                variables.hasSignatures = false;
            }

            const pdfRes = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!pdfRes.ok) throw new Error('PDF generation failed');
            const blob = await pdfRes.blob();
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string; 
                const emailRes = await fetch('/api/email-jha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        emailTo,
                        subject: 'JHA Document',
                        emailBody: 'Please find attached JHA document',
                        attachment: base64data,
                        jhaId: selectedJHA._id,
                        scheduleId: selectedJHA.schedule_id || selectedJHA.scheduleRef?._id
                    })
                });
                const emailData = await emailRes.json();
                if (emailData.success) {
                    success('Email sent!');
                    setEmailModalOpen(false);
                    fetchDashboardData();
                } else {
                    showError(emailData.error || 'Failed to send');
                }
                setIsSendingEmail(false);
            };
        } catch (error: any) {
            showError(error.message);
            setIsSendingEmail(false);
        }
    };

    const prepareDjtVariables = () => {
        if (!selectedDJT) return {};
        const schedule = schedules.find(s => s._id === (selectedDJT.schedule_id || selectedDJT._id)) || selectedDJT.scheduleRef;
        const estimate = initialData.estimates.find((e: any) => {
             const estNum = e.value || e.estimate || e.estimateNum;
             return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
        });
        const client = initialData.clients.find((c: any) => c._id === schedule?.customerId || c.name === schedule?.customerName);

        // DJT Template Variables: {{customerId}}, {{projectName}}, {{date}}, {{day}}, {{estimate}}, {{jobAddress}}, {{dailyJobDescription}}, {{customerPrintName}}, {{customerSignature}}
        const variables: Record<string, any> = {
            // Core DJT fields
            dailyJobDescription: selectedDJT.dailyJobDescription || '',
            customerPrintName: selectedDJT.customerPrintName || '',
            customerSignature: selectedDJT.customerSignature || '',
            
            // Customer/Client info
            customerId: client?.name || estimate?.customerName || schedule?.customerName || '',
            
            // Estimate/Project info
            estimate: schedule?.estimate || '',
            projectName: estimate?.projectName || estimate?.projectTitle || schedule?.projectName || '',
            jobAddress: estimate?.jobAddress || schedule?.jobLocation || '',
            
            // Date info
            date: selectedDJT.createdAt ? new Date(selectedDJT.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
            day: new Date(selectedDJT.createdAt || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
            
            // Additional fields (not in template but may be useful)
            contactName: estimate?.contactName || estimate?.contact || '',
            contactPhone: estimate?.contactPhone || estimate?.phone || '',
            customerName: schedule?.customerName || '',
            jobLocation: schedule?.jobLocation || '',
            foremanName: schedule?.foremanName || '',
        };

        // Equipment
        if (selectedDJT.equipmentUsed?.length > 0) {
            selectedDJT.equipmentUsed.forEach((item: any, index: number) => {
                const idx = index + 1;
                const eqItem = initialData.equipmentItems?.find((e: any) => e.value === item.equipment);
                variables[`eq_name_${idx}`] = eqItem?.label || item.equipment;
                variables[`eq_type_${idx}`] = item.type;
                variables[`eq_qty_${idx}`] = item.qty;
            });
             variables.hasEquipment = true;
        }

        // Crew Signatures
        if (selectedDJT.signatures?.length > 0) {
            variables.hasSignatures = true;
            selectedDJT.signatures.forEach((sig: any, index: number) => {
                const empName = initialData.employees.find((e: any) => e.value === sig.employee)?.label || sig.employee;
                const idx = index + 1;
                variables[`sig_name_${idx}`] = empName;
                variables[`sig_img_${idx}`] = sig.signature;
            });
        }
        
        // Photos
        if (selectedDJT.djtimages?.length > 0) {
             variables.hasPhotos = true;
             selectedDJT.djtimages.forEach((url: string, index: number) => {
                 variables[`photo_${index + 1}`] = url;
             });
        }

        return variables;
    };

    const handleDownloadDjtPdf = async () => {
        if (!selectedDJT) return;
        setIsGeneratingDJTPDF(true);
        try {
            // DJT Template ID
            const templateId = '1cN4CpzsvuKLYXtmSANeyqTTlL3HPc7XEyFsjfNwzo-8';
            const variables = prepareDjtVariables();

            const response = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!response.ok) throw new Error('Failed to generate PDF');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `DJT_${selectedDJT.customerPrintName || 'Report'}.pdf`;
            a.click();
            success('DJT PDF downloaded!');
        } catch (error: any) {
            showError(error.message || 'Download failed');
        } finally {
            setIsGeneratingDJTPDF(false);
        }
    };

    const handleEmailDjtPdf = async (e: any) => {
        e.preventDefault();
        if (!selectedDJT || !emailTo) return;
        setIsSendingEmail(true);
        try {
            // DJT Template ID
            const templateId = '1cN4CpzsvuKLYXtmSANeyqTTlL3HPc7XEyFsjfNwzo-8';
            const variables = prepareDjtVariables();

            const pdfRes = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!pdfRes.ok) throw new Error('PDF generation failed');
            const blob = await pdfRes.blob();
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string; 
                const emailRes = await fetch('/api/email-djt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        emailTo,
                        subject: 'Daily Job Ticket Document',
                        emailBody: 'Please find attached Daily Job Ticket document',
                        attachment: base64data,
                        djtId: selectedDJT._id,
                        scheduleId: selectedDJT.schedule_id || selectedDJT.scheduleRef?._id
                    })
                });
                const emailData = await emailRes.json();
                if (emailData.success) {
                    success('Email sent!');
                    setEmailModalOpen(false);
                    // Update local state to reflect email count increment
                    setSelectedDJT((prev: any) => ({
                        ...prev,
                        emailCounter: (prev.emailCounter || 0) + 1,
                        djtEmails: [...(prev.djtEmails || []), { emailto: emailTo, createdAt: new Date() }]
                    }));
                } else {
                    showError(emailData.error || 'Failed to send email');
                }
            };
        } catch (error: any) {
            console.error('Error sending DJT email:', error);
            showError(error.message || 'Failed to send DJT email');
        } finally {
            setIsSendingEmail(false);
        }
    };

    // DJT Handlers
    const handleSaveDJTForm = async (e: any) => {
        e.preventDefault();
        try {
            const payload = {
                ...selectedDJT,
                schedule_id: selectedDJT.schedule_id || selectedDJT._id
            };
            const res = await fetch('/api/djt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveDJT', payload })
            });
            const data = await res.json();
            if (data.success) {
                success('DJT Saved');
                if (data.result) {
                    setSelectedDJT((prev: any) => ({ ...prev, ...data.result }));
                    setSchedules((prevSchedules) => prevSchedules.map(s => {
                        if (s._id === (selectedDJT.schedule_id || selectedDJT._id)) {
                            return { ...s, hasDJT: true, jobTicket: data.result };
                        }
                        return s;
                    }));
                }
                fetchDashboardData();
                setIsDjtEditMode(false);
            } else {
                showError(data.error);
            }
        } catch (error) {
            showError('Error saving DJT');
        }
    };

    const handleSaveDJTSignature = async (dataInput: string | any) => {
        if (!activeSignatureEmployee || !selectedDJT) return;
        const dataUrl = typeof dataInput === 'string' ? dataInput : dataInput.signature;
        setIsSavingSignature(true);
        try {
            const payload = {
                schedule_id: selectedDJT.schedule_id || selectedDJT._id,
                employee: activeSignatureEmployee,
                signature: dataUrl,
                createdBy: currentUser?.email,
                lunchStart: typeof dataInput === 'object' ? dataInput.lunchStart : null,
                lunchEnd: typeof dataInput === 'object' ? dataInput.lunchEnd : null,
                clientNow: getLocalNowISO()
            };
            const res = await fetch('/api/djt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveDJTSignature', payload })
            });
            const data = await res.json();
            if (data.success) {
                success('Signature Saved');
                const updatedDJT = data.result;
                // Merge with existing state to preserve scheduleRef and other properties
                setSelectedDJT((prev: any) => ({
                    ...prev,
                    ...updatedDJT,
                    signatures: updatedDJT.signatures || []
                }));
                setActiveSignatureEmployee(null);
                fetchDashboardData();
            } else {
                showError(data.error);
            }
        } catch (error) {
            showError('Error saving signature');
        } finally {
            setIsSavingSignature(false);
        }
    };

    const handleSaveTimesheetEdit = async (e: any) => {
        e.preventDefault();
        if (!selectedTimesheet) return;
        try {
            // Find schedule
            const schedule = schedules.find(s => s.timesheet?.some(t => t._id === (selectedTimesheet._id || selectedTimesheet.recordId)));
            if (!schedule) return;

            const updatedTimesheets = (schedule.timesheet || []).map((t: any) => 
                (t._id || t.recordId) === (selectedTimesheet._id || selectedTimesheet.recordId) ? selectedTimesheet : t
            );

            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'updateSchedule', 
                    payload: { id: schedule._id, timesheet: updatedTimesheets }
                })
            });
            const data = await res.json();
            if (data.success) {
                success('Timesheet updated');
                fetchDashboardData();
                setTimesheetModalOpen(false);
            } else {
                showError(data.error);
            }
        } catch (error) {
            showError('Error updating timesheet');
        }
    };

    const getLocation = (): Promise<string | null> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        });
    };

    const executeDriveTimeToggle = async (schedule: Schedule, activeTs?: any, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!currentUser) return;

        const now = getLocalNowISO();
        const employeeEmail = currentUser.email;

        // Fetch location
        let location: string | null = null;
        try {
            location = await getLocation();
        } catch (err) {
            console.error('Failed to get location', err);
        }

        let optimisticId: string | undefined;

        // Optimistic UI Update
        if (activeTs) {
            // STOP DRIVE TIME
            setSchedules(prev => prev.map(s => {
                if (s._id !== schedule._id) return s;
                return {
                    ...s,
                    timesheet: (s.timesheet || []).map((ts: any) => 
                        ts._id === activeTs._id ? { ...ts, clockOut: now, locationOut: location } : ts
                    )
                };
            }));
        } else {
            // START DRIVE TIME
            optimisticId = `temp-${Date.now()}`;
            const newTs = {
                _id: optimisticId,
                scheduleId: schedule._id,
                employee: employeeEmail,
                clockIn: schedule.fromDate || now,
                locationIn: location,
                type: 'Drive Time',
                status: 'Pending',
                createdAt: now
            };
            setSchedules(prev => prev.map(s => {
                if (s._id !== schedule._id) return s;
                return {
                    ...s,
                    timesheet: [...(s.timesheet || []), newTs]
                };
            }));
        }

        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'toggleDriveTime',
                    payload: {
                        scheduleId: schedule._id,
                        employee: employeeEmail,
                        timesheetId: activeTs?._id,
                        date: now,
                        location: location // Add location to payload
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                // Update with real data from server (CRITICAL for Start action to get real _id)
                if (data.result) {
                    setSchedules(prev => prev.map(s => {
                        if (s._id !== schedule._id) return s;
                        return {
                            ...s,
                            timesheet: (s.timesheet || []).map((ts: any) => {
                                // Match by optimistic ID if starting, or original ID if stopping
                                const targetId = activeTs ? activeTs._id : optimisticId;
                                return ts._id === targetId ? data.result : ts;
                            })
                        };
                    }));
                }
                success(activeTs ? 'Drive time stopped' : 'Drive time started');
            } else {
                showError(data.message || 'Action failed');
                fetchDashboardData(); // Revert on failure
            }
        } catch (err) {
            showError('Network error');
            fetchDashboardData(); // Revert on failure
        }
    };

    // Wrapper functions with confirmation dialogs
    const handleDriveTimeToggle = (schedule: Schedule, activeTs?: any, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const isStopping = !!activeTs;
        setActionConfirm({
            isOpen: true,
            title: isStopping ? 'Stop Drive Time' : 'Start Drive Time',
            message: isStopping 
                ? 'Are you sure you want to STOP Drive Time?'
                : 'Drive Time is paid at 1.1 minute per mile (55mph). Are you eligible for Drive Time today? Location must be turned on. Only after 85 miles from HQ, will passengers log drive time from miles 85.1 to location. Out of town travel starts drive time from HQ.',
            confirmText: isStopping ? 'Stop' : 'Start',
            variant: isStopping ? 'danger' : 'primary',
            onConfirm: () => executeDriveTimeToggle(schedule, activeTs, e)
        });
    };

    const handleQuickTimesheet = (schedule: Schedule, type: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        
        const existingTs = (schedule.timesheet || []).find((ts: any) => {
            if (ts.employee?.toLowerCase() !== (currentUser?.email?.toLowerCase() || '')) return false;
            const dwVal = String(ts.dumpWashout || '').toLowerCase();
            const stVal = String(ts.shopTime || '').toLowerCase();
            return dwVal === 'true' || dwVal === 'yes' || dwVal.includes('hrs') ||
                   stVal === 'true' || stVal === 'yes' || stVal.includes('hrs');
        });
        
        const isDumpWashout = type === 'Dump Washout';
        const isShopTime = type === 'Shop Time';

        let currentQty = '';
        if (existingTs) {
            // Check specific quantity fields first
            if (isDumpWashout) {
                currentQty = existingTs.dumpQty !== undefined ? String(existingTs.dumpQty) : (existingTs.dumpWashout ? '1' : '');
            } else if (isShopTime) {
                currentQty = existingTs.shopQty !== undefined ? String(existingTs.shopQty) : (existingTs.shopTime ? '1' : '');
            }
        }
        
        const actionWord = (currentQty && currentQty !== '0') ? 'UPDATE' : 'REGISTER';
        
        // Pre-fill existing quantity if available
        setInputValue(currentQty);

        setActionConfirm({
            isOpen: true,
            title: `${type}`,
            message: isDumpWashout 
                ? 'Did you Dump / Washout today after Site Time Today? If yes, How Many? "Washout time is 30 minute increments and only used AFTER site time has been clocked out."'
                : isShopTime 
                    ? 'Did you have shop time BEFORE and/or AFTER site time today, and how many? "Shop Time is 15 minute increments."'
                    : `Are you sure you want to ${actionWord} ${type}?`,
            confirmText: 'Confirm',
            variant: 'primary',
            showInput: isDumpWashout || isShopTime,
            mode: 'quickTimesheet',
            data: { schedule, type },
            onConfirm: () => {} // Placeholder, handled by mode
        });
    };





    // Removed fetchDashboardData since we are using SWR now

    // Todo drag handlers


    // Time Cards widget: scoped data based on timeCardsView
    const tcWidgetTimeCards = useMemo(() => {
        // Build week range strings for filtering
        const pad2 = (n: number) => String(n).padStart(2, '0');
        const toYMD = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
        const weekStartStr = toYMD(weekRange.start);
        const weekEndStr = toYMD(weekRange.end);

        if (timeCardsView === 'self') return dashboardTimeCards;
        // 'all' - gather ALL timesheets from all timecard schedules, filtered by week
        const allTimesheets: any[] = [];
        timecardSchedules.forEach(schedule => {
            schedule.timesheet?.forEach((ts: any) => {
                // Filter by clockIn within the selected week
                if (ts.clockIn) {
                    const normalized = robustNormalizeISO(ts.clockIn);
                    const clockInDateStr = normalized.split('T')[0];
                    if (clockInDateStr < weekStartStr || clockInDateStr > weekEndStr) return;
                }

                const { hours, distance, calculatedDistance } = calculateTimesheetData(ts, schedule.fromDate);
                allTimesheets.push({
                    ...ts,
                    estimate: schedule.estimate,
                    scheduleId: schedule._id,
                    hoursVal: hours,
                    distanceVal: distance,
                    rawDistanceVal: calculatedDistance
                });
            });
        });
        return allTimesheets.sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
    }, [timeCardsView, dashboardTimeCards, timecardSchedules, weekRange]);

    const tcWidgetTotals = useMemo(() => {
        let drive = 0;
        let site = 0;
        tcWidgetTimeCards.forEach(ts => {
            if (ts.type?.toLowerCase().includes('drive')) {
                drive += (ts.hoursVal || 0);
            } else {
                site += (ts.hoursVal || 0);
            }
        });
        return { drive, site };
    }, [tcWidgetTimeCards]);


    return (
        <WeekPickerProvider>
        <div className="flex flex-col h-full bg-slate-50">
            <Header 
                hideLogo={false}
                centerContent={<WeekPickerMobile />}
                rightContent={<WeekPickerDesktop />}
            />

            <WeekPickerDropDown />

            <div className={`flex-1 min-h-0 ${searchParams.get('view') ? 'overflow-hidden lg:overflow-y-auto' : 'overflow-y-auto'} lg:p-4 pb-0`}>
                <div className={`max-w-[1800px] mx-auto w-full ${searchParams.get('view') === 'chat' ? 'h-full lg:h-auto' : ''}`}>
                    
                    {/* Main Grid */}
                    <div className={`grid grid-cols-12 gap-4 ${searchParams.get('view') === 'chat' ? 'h-full lg:h-auto overflow-hidden lg:overflow-visible' : ''}`}>
                        
                        {/* Left Column - Main Content */}
                        <div className={`col-span-12 xl:col-span-9 space-y-4 ${searchParams.get('view') && !['tasks', 'training'].includes(searchParams.get('view')!) ? 'hidden lg:block' : ''}`}>

                            {/* Tasks Kanban — extracted component with own SWR */}
                            <TaskList
                                week={weekRange.label}
                                scope={tasksScope as 'all' | 'self'}
                                initialData={initialData}
                                className={searchParams.get('view') === 'tasks' ? 'block' : 'hidden xl:block'}
                                onTaskMutate={mutateDashboardTasks}
                            />

                            {/* Upcoming Schedules */}
                            <SchedulesGrid
                                schedules={schedules}
                                loading={!schedulesData && !initialSchedulesData}
                                refreshing={schedulesLoading}
                                initialData={initialData}
                                currentUser={currentUser}
                                userEmail={userEmail}
                                searchParamsView={searchParams.get('view')}
                                upcomingSchedulesScope={upcomingSchedulesScope}
                                scheduleView={scheduleView}
                                setScheduleView={setScheduleView}
                                onEdit={(schedule) => {
                                    setEditingSchedule(schedule);
                                    setEditScheduleOpen(true);
                                }}
                                onCopy={(schedule) => {
                                    const addOneDay = (dateStr: string) => {
                                        if (!dateStr) return '';
                                        try {
                                            const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
                                            if (!match) return dateStr;
                                            const [, year, month, day, hours, minutes] = match;
                                            const utcDate = new Date(Date.UTC(
                                                parseInt(year),
                                                parseInt(month) - 1,
                                                parseInt(day) + 1
                                            ));
                                            const newYear = utcDate.getUTCFullYear();
                                            const newMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
                                            const newDay = String(utcDate.getUTCDate()).padStart(2, '0');
                                            return `${newYear}-${newMonth}-${newDay}T${hours}:${minutes}`;
                                        } catch { return dateStr; }
                                    };

                                    const cloned = { ...schedule };
                                    (cloned as any)._id = undefined;
                                    cloned.fromDate = addOneDay(cloned.fromDate);
                                    cloned.toDate = addOneDay(cloned.toDate);
                                    cloned.timesheet = [];
                                    cloned.hasJHA = false;
                                    (cloned as any).jha = undefined;
                                    (cloned as any).JHASignatures = [];
                                    cloned.hasDJT = false;
                                    (cloned as any).djt = undefined;
                                    (cloned as any).DJTSignatures = [];

                                    setEditingSchedule(cloned);
                                    setEditScheduleOpen(true);
                                }}
                                onDelete={(id) => {
                                    setDeleteScheduleId(id);
                                    setIsDeleteConfirmOpen(true);
                                }}
                                onViewJHA={(item) => {
                                    const loadingId = toast.loading('Loading JHA details...');
                                    fetch('/api/schedules', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ action: 'getScheduleById', payload: { id: item._id } })
                                    })
                                    .then(r => r.json())
                                    .then(data => {
                                        toast.dismiss(loadingId);
                                        if (data.success && data.result) {
                                            const fullSchedule = data.result;
                                            const jhaWithSigs = { 
                                                ...fullSchedule.jha, 
                                                signatures: fullSchedule.JHASignatures || fullSchedule.jha?.signatures || [] 
                                            };
                                            if (!jhaWithSigs.schedule_id) jhaWithSigs.schedule_id = fullSchedule._id;
                                            
                                            setSelectedJHA(jhaWithSigs);
                                            setIsJhaEditMode(false);
                                            setJhaModalOpen(true);
                                        } else {
                                            toast.error('Failed to load JHA details');
                                        }
                                    })
                                    .catch(e => {
                                        console.error(e);
                                        toast.dismiss(loadingId);
                                        toast.error('Error loading JHA details');
                                    });
                                }}
                                onCreateJHA={(item) => {
                                    setSelectedJHA({
                                        schedule_id: item._id,
                                        date: new Date(),
                                        jhaTime: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
                                        emailCounter: 0,
                                        signatures: [],
                                        scheduleRef: item,
                                        createdBy: userEmail
                                    });
                                    setIsJhaEditMode(true);
                                    setJhaModalOpen(true);
                                }}
                                onViewDJT={(item) => {
                                    const loadingId = toast.loading('Loading DJT details...');
                                    fetch('/api/schedules', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ action: 'getScheduleById', payload: { id: item._id } })
                                    })
                                    .then(r => r.json())
                                    .then(data => {
                                        toast.dismiss(loadingId);
                                        if (data.success && data.result) {
                                            const fullSchedule = data.result;
                                            const djtWithSigs = { 
                                                ...fullSchedule.djt, 
                                                signatures: fullSchedule.DJTSignatures || fullSchedule.djt?.signatures || [] 
                                            };
                                            if (!djtWithSigs.schedule_id) djtWithSigs.schedule_id = fullSchedule._id;
                                            
                                            setSelectedDJT(djtWithSigs);
                                            setIsDjtEditMode(false);
                                            setDjtModalOpen(true);
                                        } else {
                                            toast.error('Failed to load DJT details');
                                        }
                                    })
                                    .catch(e => {
                                        console.error(e);
                                        toast.dismiss(loadingId);
                                        toast.error('Error loading DJT details');
                                    });
                                }}
                                onCreateDJT={(item) => {
                                    setSelectedDJT({
                                        schedule_id: item._id,
                                        dailyJobDescription: '',
                                        customerPrintName: '',
                                        customerSignature: '',
                                        createdBy: currentUser?.email || '', 
                                        clientEmail: '',
                                        emailCounter: 0
                                    });
                                    setIsDjtEditMode(true);
                                    setDjtModalOpen(true);
                                }}
                                onViewDetails={(schedule) => {
                                    setSelectedDetailSchedule(schedule);
                                    setIsDetailModalOpen(true);
                                }}
                                onToggleDriveTime={handleDriveTimeToggle}
                                onQuickTimesheet={handleQuickTimesheet}
                                onViewTimesheet={(item, ts, e) => {
                                    if (e) e.stopPropagation();
                                    setSelectedTimesheet(ts);
                                    setIsTimesheetEditMode(false);
                                    setTimesheetModalOpen(true);
                                }}
                                onChangeOfScope={(item) => {
                                    setSelectedScopeSchedule(item);
                                    setChangeOfScopeModalOpen(true);
                                }}
                                onRequestTimeOff={() => {
                                    const today = new Date();
                                    const y = today.getFullYear();
                                    const m = String(today.getMonth() + 1).padStart(2, '0');
                                    const d = String(today.getDate()).padStart(2, '0');
                                    const fromDate = `${y}-${m}-${d}T09:00:00.000Z`;
                                    const toDate = `${y}-${m}-${d}T17:00:00.000Z`;
                                    const dayOffSchedule: any = {
                                        item: 'Day Off',
                                        title: 'Day Off',
                                        fromDate,
                                        toDate,
                                        assignees: [userEmail],
                                        description: '',
                                        isDayOffApproved: false,
                                        customerId: '',
                                        customerName: '',
                                        estimate: '',
                                        jobLocation: '',
                                        projectManager: '',
                                        foremanName: '',
                                        service: '',
                                        fringe: '',
                                        certifiedPayroll: false,
                                        notifyAssignees: false,
                                        perDiem: false,
                                        createdBy: userEmail,
                                    };
                                    setEditingSchedule(dayOffSchedule);
                                    setIsDayOffMode(true);
                                    setEditScheduleOpen(true);
                                }}
                                onNewSchedule={() => {
                                    const today = new Date();
                                    const year = today.getFullYear();
                                    const month = String(today.getMonth() + 1).padStart(2, '0');
                                    const day = String(today.getDate()).padStart(2, '0');
                                    const fromDate = `${year}-${month}-${day}T07:00`;
                                    const toDate = `${year}-${month}-${day}T15:30`;
                                    setEditingSchedule({
                                        fromDate: fromDate,
                                        toDate: toDate,
                                        assignees: [],
                                        notifyAssignees: 'No',
                                        perDiem: 'No',
                                        title: '',
                                    } as any);
                                    setIsDayOffMode(false);
                                    setEditScheduleOpen(true);
                                }}
                            />

                            {/* Middle Row - Stats & Charts */}
                            <div className={`${searchParams.get('view') === 'training' ? 'grid' : 'hidden md:grid'} grid-cols-1 lg:grid-cols-2 gap-4`}>
                                
                                {/* Estimate Stats Pie Chart */}
                                <EstimateStatsWidget 
                                    week={weekRange.label} 
                                    scope={scheduleView as 'all' | 'self'} 
                                    initialData={null} 
                                    isHidden={!canField(MODULES.DASHBOARD, 'widget_estimates_overview', 'view') || searchParams.get('view') === 'training'} 
                                />

                                {/* Weekly Snapshot KPIs — extracted component with own SWR */}
                                <StatsCards
                                    week={weekRange.label}
                                    scope={scheduleView as 'all' | 'self'}
                                    weekRange={weekRange}
                                    dashboardSchedules={schedules}
                                    dashboardTasks={dashboardTasks}
                                />


                            </div>


                            {/* Time Cards - Weekly (Renamed & Table View) */}
                            {canField(MODULES.DASHBOARD, 'widget_time_cards', 'view') && (
                                <div className={`${searchParams.get('view') === 'time-cards' ? 'block' : 'hidden lg:block'}`}>
                                    <TimeCardsWidget
                                        tcWidgetTimeCards={tcWidgetTimeCards}
                                        tcWidgetTotals={tcWidgetTotals}
                                        timeCardsView={timeCardsView}
                                        setTimeCardsView={setTimeCardsView}
                                        timeCardsWidgetScope={timeCardsWidgetScope as string}
                                        initialData={initialData}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Right Sidebar - Chat & Activity */}
                        <ChatWidget 
                            initialData={initialData}
                            userEmail={userEmail}
                            canViewEstimates={canViewEstimates}
                            searchParamsView={searchParams.get('view')}
                        />
                </div>
            </div>

            {/* Schedule Details Popup */}
            <ScheduleDetailsPopup 
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                schedule={selectedDetailSchedule ? {
                    _id: selectedDetailSchedule._id,
                    title: selectedDetailSchedule.title, // Ensure title is passed
                    estimate: selectedDetailSchedule.estimate,
                    fromDate: selectedDetailSchedule.fromDate,
                    toDate: selectedDetailSchedule.toDate, // Ensure toDate is passed
                    customerName: selectedDetailSchedule.customerName || initialData.clients?.find((c: any) => String(c._id) === String(selectedDetailSchedule.customerId))?.name,
                    customerId: selectedDetailSchedule.customerId,
                    jobLocation: selectedDetailSchedule.jobLocation || initialData.estimates?.find((e: any) => e.value === selectedDetailSchedule.estimate)?.jobAddress,
                    projectName: fetchedEstimate?.projectName || initialData.estimates?.find((e: any) => e.value === selectedDetailSchedule.estimate)?.projectName,
                    projectManager: selectedDetailSchedule.projectManager,
                    foremanName: selectedDetailSchedule.foremanName,
                    assignees: selectedDetailSchedule.assignees,
                    description: selectedDetailSchedule.description,
                    service: selectedDetailSchedule.service,
                    item: selectedDetailSchedule.item,
                    notifyAssignees: selectedDetailSchedule.notifyAssignees,
                    perDiem: selectedDetailSchedule.perDiem,
                    certifiedPayroll: selectedDetailSchedule.certifiedPayroll,
                    fringe: selectedDetailSchedule.fringe,
                    hasJHA: selectedDetailSchedule.hasJHA,
                    hasDJT: selectedDetailSchedule.hasDJT,
                    todayObjectives: selectedDetailSchedule.todayObjectives,
                    timesheet: selectedDetailSchedule.timesheet,
                    aerialImage: selectedDetailSchedule.aerialImage || initialData.estimates?.find((e: any) => e.value === selectedDetailSchedule.estimate)?.aerialImage,
                    siteLayout: selectedDetailSchedule.siteLayout || initialData.estimates?.find((e: any) => e.value === selectedDetailSchedule.estimate)?.siteLayout,
                    jobPlanningDocs: fetchedEstimate?.jobPlanningDocs || initialData.estimates?.find((e: any) => e.value === selectedDetailSchedule.estimate)?.jobPlanningDocs
                } : null}
                employees={initialData.employees}
                constants={initialData.constants}
                currentUserEmail={userEmail}
                onToggleObjective={async (scheduleId, index, currentStatus) => {
                    const newStatus = !currentStatus;
                    const timestamp = newStatus ? new Date().toISOString() : undefined;
                    const completedBy = newStatus ? userEmail : undefined;

                    // Optimistic update
                    const updatedSchedules = schedules.map(s => {
                        if (s._id === scheduleId) {
                            const newObjs = [...(s.todayObjectives || [])];
                            if (newObjs[index]) {
                                newObjs[index] = { 
                                    ...newObjs[index], 
                                    completed: newStatus,
                                    completedAt: timestamp,
                                    completedBy: completedBy
                                };
                            }
                            return { ...s, todayObjectives: newObjs };
                        }
                        return s;
                    });
                    setSchedules(updatedSchedules);
                    
                    if (selectedDetailSchedule?._id === scheduleId) {
                        const newObjs = [...(selectedDetailSchedule.todayObjectives || [])];
                        if (newObjs[index]) {
                            newObjs[index] = { 
                                ...newObjs[index], 
                                completed: newStatus,
                                completedAt: timestamp,
                                completedBy: completedBy
                            };
                        }
                        setSelectedDetailSchedule({ ...selectedDetailSchedule, todayObjectives: newObjs });
                    }

                    // API Call
                    try {
                        const schedule = schedules.find(s => s._id === scheduleId);
                        if (!schedule) return;
                        // Use the updated objects from the optimistic state logic (replicated here to be safe)
                        const newObjs = [...(schedule.todayObjectives || [])];
                        if (newObjs[index]) {
                             newObjs[index] = { 
                                ...newObjs[index], 
                                completed: newStatus,
                                completedAt: timestamp,
                                completedBy: completedBy
                            };
                        }
                        
                        // Pass the full updated array to the API
                        await fetch(`/api/schedules/${scheduleId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ todayObjectives: newObjs })
                        });
                    } catch (error) {
                        console.error('Failed to update objective', error);
                        // Revert logic could be added here
                    }
                }}
            />

            {/* Media Overlay Modal (for images/maps) */}
            <Modal
                isOpen={isMediaModalOpen}
                onClose={() => setIsMediaModalOpen(false)}
                title={mediaModalContent.title}
                maxWidth="5xl"
            >
                <div className="flex flex-col items-center justify-center p-4">
                    {mediaModalContent.type === 'image' ? (
                        <div className="relative max-w-full max-h-[80vh] rounded-2xl overflow-hidden"><Image fill sizes="(max-width: 768px) 100vw, 33vw" 
                            src={mediaModalContent.url} 
                            alt={mediaModalContent.title}
                            className="rounded-2xl shadow-2xl w-full h-full"
                        /></div>
                    ) : (
                        <div className="w-full h-[70vh] rounded-2xl overflow-hidden shadow-2xl">
                             {mediaModalContent.url.includes('google.com/maps') ? (
                                <iframe
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    src={mediaModalContent.url}
                                    allowFullScreen
                                />
                             ) : (
                                <div className="flex flex-col items-center justify-center h-full bg-slate-50 gap-4">
                                    <MapPin size={48} className="text-[#0F4C75]" />
                                    <p className="font-bold text-slate-800">External Site View</p>
                                    <Button onClick={() => window.open(mediaModalContent.url, '_blank')}>
                                        Open in New Tab
                                    </Button>
                                </div>
                             )}
                        </div>
                    )}
                </div>
            </Modal>

            {/* JHA Modal */}
            <JHAModal
                isOpen={jhaModalOpen}
                onClose={() => setJhaModalOpen(false)}
                selectedJHA={selectedJHA}
                setSelectedJHA={setSelectedJHA}
                isEditMode={isJhaEditMode}
                setIsEditMode={setIsJhaEditMode}
                handleSave={handleSaveJHAForm}
                handleSaveSignature={handleSaveJHASignature}
                isGeneratingPDF={isGeneratingJHAPDF}
                handleDownloadPDF={handleDownloadJhaPdf}
                setEmailModalOpen={(open) => {
                    setActiveEmailType('jha');
                    if (open && selectedJHA) {
                        // Find the schedule for this JHA
                        const schedule = schedules.find(s => s._id === (selectedJHA.schedule_id || selectedJHA._id)) || selectedJHA.scheduleRef;
                        // Find the estimate to get contactEmail
                        const estimate = initialData.estimates.find((e: any) => {
                            const estNum = e.value || e.estimate || e.estimateNum;
                            return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
                        });
                        // Pre-fill email with contactEmail from estimate
                        if (estimate?.contactEmail) {
                            setEmailTo(estimate.contactEmail);
                        } else {
                            setEmailTo('');
                        }
                    }
                    setEmailModalOpen(open);
                }}
                initialData={initialData}
                schedules={schedules}
                activeSignatureEmployee={activeSignatureEmployee}
                setActiveSignatureEmployee={setActiveSignatureEmployee}
            />

            {/* DJT Modal */}
            <ChangeOfScopeModal
                isOpen={changeOfScopeModalOpen}
                onClose={() => {
                    setChangeOfScopeModalOpen(false);
                    setSelectedScopeSchedule(null);
                }}
                schedule={selectedScopeSchedule}
                setSchedules={setSchedules as any}
            />

            <DJTModal
                isOpen={djtModalOpen}
                onClose={() => setDjtModalOpen(false)}
                selectedDJT={selectedDJT}
                setSelectedDJT={setSelectedDJT}
                isEditMode={isDjtEditMode}
                setIsEditMode={setIsDjtEditMode}
                handleSave={handleSaveDJTForm}
                handleSaveSignature={handleSaveDJTSignature}
                initialData={initialData}
                schedules={schedules}
                activeSignatureEmployee={activeSignatureEmployee}
                setActiveSignatureEmployee={setActiveSignatureEmployee}
                isGeneratingPDF={isGeneratingDJTPDF}
                handleDownloadPDF={handleDownloadDjtPdf}
                setEmailModalOpen={(open) => {
                    setActiveEmailType('djt');
                    if (open && selectedDJT) {
                        // Find the schedule for this DJT
                        const schedule = schedules.find(s => s._id === (selectedDJT.schedule_id || selectedDJT._id)) || selectedDJT.scheduleRef;
                        // Find the estimate to get contactEmail
                        const estimate = initialData.estimates.find((e: any) => {
                            const estNum = e.value || e.estimate || e.estimateNum;
                            return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
                        });
                        // Pre-fill email with contactEmail from estimate
                        if (estimate?.contactEmail) {
                            setEmailTo(estimate.contactEmail);
                        } else {
                            setEmailTo('');
                        }
                    }
                    setEmailModalOpen(open);
                }}
            />

            {/* Timesheet Modal */}
            <TimesheetModal
                isOpen={timesheetModalOpen}
                onClose={() => setTimesheetModalOpen(false)}
                selectedTimesheet={selectedTimesheet}
                setSelectedTimesheet={setSelectedTimesheet}
                isEditMode={isTimesheetEditMode}
                setIsEditMode={setIsTimesheetEditMode}
                handleSave={handleSaveTimesheetEdit}
            />

            {/* Schedule Edit/Create Form Modal */}
            <ScheduleFormModal
                isOpen={editScheduleOpen}
                onClose={() => {
                    setEditScheduleOpen(false);
                    setEditingSchedule(null);
                    setIsDayOffMode(false);
                }}
                schedule={editingSchedule}
                initialData={initialData}
                onSave={(savedSchedule, isNew) => {
                    if (isNew) {
                        setSchedules(prev => [...prev, savedSchedule]);
                    } else {
                        setSchedules(prev => prev.map(s => s._id === savedSchedule._id ? savedSchedule : s));
                    }
                }}
                isDayOffRequest={isDayOffMode}
                canApprove={isSuperAdmin || user?.role === 'Admin'}
            />

            {/* Confirm Delete Schedule */}
            <ConfirmModal
                isOpen={isDeleteConfirmOpen}
                onClose={() => setIsDeleteConfirmOpen(false)}
                onConfirm={handleDeleteSchedule}
                title="Delete Schedule"
                message="Are you sure you want to delete this schedule? This action cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />

            {/* Action Confirmation Modal (Drive Time, Dump Washout, Shop Time) */}
            {/* Action Confirmation Modal (Drive Time, Dump Washout, Shop Time) */}
            <ConfirmModal
                isOpen={actionConfirm.isOpen}
                onClose={() => setActionConfirm(prev => ({ ...prev, isOpen: false }))}
                onConfirm={() => {
                    if (actionConfirm.mode === 'quickTimesheet' && actionConfirm.data) {
                        executeQuickTimesheet(actionConfirm.data.schedule, actionConfirm.data.type);
                    } else if (actionConfirm.onConfirm) {
                        actionConfirm.onConfirm();
                    }
                }}
                title={actionConfirm.title}
                message={actionConfirm.message}
                confirmText={actionConfirm.confirmText}
                cancelText="Cancel"
                variant={actionConfirm.variant}
            >
                {actionConfirm.showInput && (
                    <Input
                        type="number"
                        min="0"
                        placeholder="Enter quantity"
                        value={inputValue}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputValue(e.target.value)}
                        className="w-full text-center text-lg mt-2"
                        autoFocus
                    />
                )}
            </ConfirmModal>




            {/* Email Modal */}
            <Modal
                isOpen={emailModalOpen}
                onClose={() => !isSendingEmail && setEmailModalOpen(false)}
                title={activeEmailType === 'jha' ? "Email JHA Document" : "Email Daily Job Ticket"}
                maxWidth="md"
            >
                <form onSubmit={activeEmailType === 'jha' ? handleEmailJhaPdf : handleEmailDjtPdf} className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                        <div className="bg-blue-100 p-2 rounded-full text-[#0F4C75]">
                            <Mail size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-[#0F4C75]">{activeEmailType === 'jha' ? 'Send JHA via Email' : 'Send DJT via Email'}</p>
                            <p className="text-xs text-blue-800/70 mt-1">The document will be attached as a PDF and sent to the recipient below.</p>
                        </div>
                    </div>
                    
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block font-sans">Recipient Email</label>
                        <input 
                            type="email"
                            required
                            className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                            placeholder="Enter email address"
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                        <button
                            type="button"
                            onClick={() => setEmailModalOpen(false)}
                            disabled={isSendingEmail}
                            className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSendingEmail}
                            className="px-6 py-2 bg-[#0F4C75] text-white text-sm font-bold rounded-lg hover:bg-[#0b3d61] transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                        >
                            {isSendingEmail ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                            Send Email
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    </div>
        </WeekPickerProvider>
    );
}



if (typeof window !== 'undefined' && !(window as any).dashboardMountStarted) {
    console.time('dashboard-mount');
    (window as any).dashboardMountStarted = true;
}

export default function DashboardClient({ initialWeek, initialScope, initialSchedulesData }: any) {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /></div>}>
            <DashboardProvider initialWeek={initialWeek}>
                <DashboardContent initialWeek={initialWeek} initialScope={initialScope} initialSchedulesData={initialSchedulesData} />
            </DashboardProvider>
        </Suspense>
    );
}
