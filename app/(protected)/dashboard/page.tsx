'use client';

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    Calendar, Clock, ChevronLeft, ChevronRight, Users, 
    TrendingUp, CheckCircle2, AlertCircle, MessageSquare,
    GripVertical, Plus, MoreHorizontal, X, Search, Filter,
    MapPin, Briefcase, User, Phone, FileText, Eye, Send,
    GraduationCap, Award, CalendarCheck, Play, Pause,
    Trash2, Edit, Copy, Shield, ShieldCheck, FilePlus, FileCheck, 
    Car, StopCircle, Droplets, Warehouse, Circle, ClipboardList,
    Mail, Loader2, Activity as ActivityIcon, ChevronDown, Truck
} from 'lucide-react';
import { Header, Badge, Input, Modal, Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, SearchableSelect, MyDropDown, Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { usePermissions } from '@/hooks/usePermissions';
import { ScheduleDetailModal } from './components/ScheduleDetailModal';
import { ScheduleCard, ScheduleItem } from '../jobs/schedules/components/ScheduleCard';
import { ScheduleFormModal } from '../jobs/schedules/components/ScheduleFormModal';
import { JHAModal } from '../jobs/schedules/components/JHAModal';
import { DJTModal } from '../jobs/schedules/components/DJTModal';
import { TimesheetModal } from '../jobs/schedules/components/TimesheetModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { calculateTimesheetData, formatDateOnly, formatTimeOnly } from '@/lib/timeCardUtils';

// Week utilities
const getWeekRange = (date: Date = new Date()): { start: Date; end: Date; label: string } => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    
    const start = new Date(d);
    start.setDate(d.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    const fmt = (dt: Date) => `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
    
    // Format: MM/DD-MM/DD
    return { start, end, label: `${fmt(start)}-${fmt(end)}` };
};

const shiftWeek = (current: Date, direction: number): Date => {
    const newDate = new Date(current);
    newDate.setDate(newDate.getDate() + (direction * 7));
    return newDate;
};





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
    createdBy?: string;
    createdAt?: string;
}

interface EstimateStats {
    status: string;
    count: number;
    total: number;
}

interface ChatMessage {
    _id: string;
    sender: string;
    senderName: string;
    message: string;
    timestamp: string;
    proposalNo?: string;
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
            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
    onDelete
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
}) => (
    <div 
        className="flex-1 min-w-[200px] bg-slate-100 rounded-xl p-3"
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, status)}
    >
        <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="font-semibold text-sm text-slate-700">{title}</span>
            <Badge variant="default" className="ml-auto text-[10px]">{items.length}</Badge>
        </div>
        <div className="space-y-2">
            {items.map(item => (
                <div 
                    key={item._id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('todoId', item._id)}
                    onClick={() => onEdit(item)}
                    className="bg-white p-3 rounded-lg border border-slate-200 cursor-grab hover:shadow-md transition-shadow group"
                >
                    <div className="flex items-start gap-2">
                        <GripVertical className="w-4 h-4 text-slate-300 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800">{item.task}</p>
                            {item.dueDate && (
                                <p className="text-xs text-slate-400 mt-1">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                                <TooltipProvider>
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
                                </TooltipProvider>
                            </div>
                            {item.assignees && item.assignees.length > 0 && (
                                <div className="flex -space-x-2">
                                    {item.assignees.slice(0, 3).map((a, i) => (
                                        <div key={i} className="w-5 h-5 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[8px] font-bold">
                                            {a.charAt(0).toUpperCase()}
                                        </div>
                                    ))}
                                </div>
                            )}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// Pie Chart Component
const PieChart = ({ data }: { data: EstimateStats[] }) => {
    const total = data.reduce((sum, d) => sum + d.total, 0);
    const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    
    let startAngle = 0;
    const paths = data.map((d, i) => {
        const angle = (d.total / total) * 360;
        const endAngle = startAngle + angle;
        
        const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
        const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
        const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
        const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
        
        const largeArc = angle > 180 ? 1 : 0;
        
        const pathD = `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;
        startAngle = endAngle;
        
        return <path key={i} d={pathD} fill={colors[i % colors.length]} className="hover:opacity-80 transition-opacity" />;
    });

    return (
        <div className="flex items-center gap-4">
            <svg viewBox="0 0 100 100" className="w-32 h-32">
                {paths}
                <circle cx="50" cy="50" r="20" fill="white" />
            </svg>
            <div className="space-y-1">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: colors[i % colors.length] }} />
                        <span className="text-slate-600 capitalize">{d.status}</span>
                        <span className="font-semibold text-slate-900 ml-auto">${Math.round(d.total).toLocaleString()}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Task Form Modal
const TaskFormModal = ({ 
    isOpen, 
    onClose, 
    onSave, 
    editingTask,
    employees
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onSave: (data: Partial<TodoItem>) => void;
    editingTask?: TodoItem | null;
    employees: any[];
}) => {
    const [formData, setFormData] = useState<Partial<TodoItem>>({
        task: '',
        dueDate: '',
        status: 'todo',
        assignees: []
    });
    const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);

    const employeeOptions = useMemo(() => employees.map(emp => ({
        id: emp.value,
        label: emp.label,
        value: emp.value,
        profilePicture: emp.image
    })), [employees]);

    useEffect(() => {
        if (editingTask) {
            setFormData({
                task: editingTask.task || '',
                dueDate: editingTask.dueDate ? (editingTask.dueDate.includes('T') ? editingTask.dueDate.slice(0, 10) : editingTask.dueDate) : '',
                status: editingTask.status || 'todo',
                assignees: editingTask.assignees || []
            });
        } else {
            setFormData({
                task: '',
                dueDate: '',
                status: 'todo',
                assignees: []
            });
        }
    }, [editingTask, isOpen]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingTask ? 'Edit Task' : 'Add New Task'}>
            <div className="space-y-4 p-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Task Description</label>
                    <textarea 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none min-h-[100px]"
                        placeholder="What needs to be done?"
                        value={formData.task}
                        onChange={(e) => setFormData({ ...formData, task: e.target.value })}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Due Date</label>
                        <input 
                            type="date"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                            value={formData.dueDate}
                            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                        <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        >
                            <option value="todo">To Do</option>
                            <option value="in progress">In Progress</option>
                            <option value="done">Done</option>
                        </select>
                    </div>
                </div>
                <div className="relative">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Assign To</label>
                    <div 
                        id="assignee-trigger"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm flex items-center justify-between cursor-pointer hover:border-blue-300 transition-all min-h-[50px]"
                        onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                    >
                        <div className="flex -space-x-2 overflow-hidden py-0.5">
                            {(formData.assignees || []).length > 0 ? (
                                formData.assignees?.map(email => {
                                    const emp = employees.find(e => e.value === email);
                                    return (
                                        <div 
                                            key={email} 
                                            className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 overflow-hidden shadow-sm ring-1 ring-slate-100"
                                            title={emp?.label || email}
                                        >
                                            {emp?.image ? (
                                                <img src={emp.image} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                (emp?.label || email)?.[0].toUpperCase()
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <span className="text-slate-400 ml-1">Select team members...</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                             {(formData.assignees || []).length > 0 && (
                                 <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                     {(formData.assignees || []).length}
                                 </span>
                             )}
                            <ChevronDown size={14} className={`text-slate-400 transition-transform ${isAssigneeDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                    
                    <MyDropDown
                        isOpen={isAssigneeDropdownOpen}
                        onClose={() => setIsAssigneeDropdownOpen(false)}
                        anchorId="assignee-trigger"
                        options={employeeOptions}
                        selectedValues={formData.assignees || []}
                        multiSelect={true}
                        onSelect={(val) => {
                            const current = formData.assignees || [];
                            const next = current.includes(val) 
                                ? current.filter(v => v !== val)
                                : [...current, val];
                            setFormData({ ...formData, assignees: next });
                        }}
                    />
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button 
                        onClick={() => onSave(formData)}
                        disabled={!formData.task?.trim()}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {editingTask ? 'Update Task' : 'Create Task'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// Main Dashboard Component
function DashboardContent() {
    const router = useRouter();
    const { success, error: showError } = useToast();
    const { user, isSuperAdmin } = usePermissions();
    const userEmail = user?.email || '';
    
    const searchParams = useSearchParams();
    
    // Week Navigation
    const [currentWeekDate, setCurrentWeekDate] = useState(() => {
        const week = searchParams.get('week');
        if (week && week.includes('-')) {
            try {
                const [startPart] = week.split('-');
                const [m, d] = startPart.split('/').map(Number);
                const date = new Date();
                date.setMonth(m - 1);
                date.setDate(d);
                if (!isNaN(date.getTime())) return date;
            } catch (e) {}
        }
        return new Date();
    });
    const weekRange = useMemo(() => getWeekRange(currentWeekDate), [currentWeekDate]);

    // Update URL when currentWeekDate changes
    useEffect(() => {
        const newLabel = weekRange.label;
        const currentWeekParam = searchParams.get('week');
        
        if (newLabel !== currentWeekParam) {
            const params = new URLSearchParams(searchParams.toString());
            params.set('week', newLabel);
            router.replace(`?${params.toString()}`, { scroll: false });
        }
    }, [weekRange.label, router, searchParams]);
    
    // Data States
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [initialData, setInitialData] = useState<any>({ employees: [], clients: [], constants: [], estimates: [] });
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [timeCards, setTimeCards] = useState<TimeCard[]>([]);
    const [trainings, setTrainings] = useState<Training[]>([]);
    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [estimateStats, setEstimateStats] = useState<EstimateStats[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<TodoItem | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]); // Keep for type safety if needed, but we use 'messages' state now

    // Estimate Filter State
    const [estimateFilter, setEstimateFilter] = useState('all'); // all, this_month, last_month, ytd, last_year

    // Computed Time Cards for Dashboard Table
    const dashboardTimeCards = useMemo(() => {
        if (!currentUser || !schedules.length) return [];

        const userLowerEmail = currentUser.email.toLowerCase();
        const allUserTimesheets: any[] = [];

        schedules.forEach(schedule => {
            if (schedule.timesheet) {
                schedule.timesheet.forEach(ts => {
                    if (ts.employee?.toLowerCase() === userLowerEmail) {
                        const { hours, distance, calculatedDistance } = calculateTimesheetData(ts as any, schedule.fromDate);
                        allUserTimesheets.push({
                            ...ts,
                            estimate: schedule.estimate,
                            scheduleId: schedule._id,
                            hoursVal: hours,
                            distanceVal: distance,
                            rawDistanceVal: calculatedDistance
                        });
                    }
                });
            }
        });

        // Sort by clockIn date descending
        return allUserTimesheets.sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
    }, [schedules, currentUser]);

    // Computed Totals for Dashboard Widget
    const timeCardTotals = useMemo(() => {
        let drive = 0;
        let site = 0;
        dashboardTimeCards.forEach(ts => {
            if (ts.type?.toLowerCase().includes('drive')) {
                drive += (ts.hoursVal || 0);
            } else {
                site += (ts.hoursVal || 0);
            }
        });
        return { drive, site };
    }, [dashboardTimeCards]);
    
    // UI States
    const [loading, setLoading] = useState(true);
    const [scheduleView, setScheduleView] = useState<'all' | 'self'>('self');

    // Default to 'all' if super admin
    useEffect(() => {
        if (isSuperAdmin) {
            setScheduleView('all');
        }
    }, [isSuperAdmin]);
    // const [chatFilter, setChatFilter] = useState(''); // Removed, using tagFilters and local state

    const [newMessage, setNewMessage] = useState('');
    const [selectedDetailSchedule, setSelectedDetailSchedule] = useState<Schedule | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [mediaModalContent, setMediaModalContent] = useState<{ type: 'image' | 'map', url: string, title: string }>({ type: 'image', url: '', title: '' });
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    
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

    // Action Confirmation State (for Drive Time, Dump Washout, Shop Time)
    const [actionConfirm, setActionConfirm] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText: string;
        variant: 'danger' | 'primary' | 'dark';
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        variant: 'primary',
        onConfirm: () => {}
    });

    // Chat States
    const [messages, setMessages] = useState<any[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [referenceQuery, setReferenceQuery] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [showReferences, setShowReferences] = useState(false);
    const [cursorPosition, setCursorPosition] = useState(0); // for tracking where to insert
    const [chatFilterValue, setChatFilterValue] = useState(''); // For the UI filter input
    const [tagFilters, setTagFilters] = useState<{type: 'user'|'estimate', value: string, label: string}[]>([]);
    
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);

    // Load User
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedUser = localStorage.getItem('devco_user');
            if (storedUser) {
                try {
                    setCurrentUser(JSON.parse(storedUser));
                } catch (e) {
                    console.error('Failed to parse user', e);
                }
            } else if (user) {
                setCurrentUser(user);
            }
        }
    }, [user]);

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
        
        const unitHours = type === 'Dump Washout' ? 0.50 : 0.25;
        const now = new Date();
        const clockOut = now.toISOString();

        // Optimistic update
        setSchedules(prev => prev.map(s => {
            if (s._id !== schedule._id) return s;
            
            const timesheets = s.timesheet || [];
            const userEmail = currentUser.email.toLowerCase();
            const existingIndex = timesheets.findIndex(ts => 
                ts.employee.toLowerCase() === userEmail && 
                ((type === 'Dump Washout' && (String(ts.dumpWashout).toLowerCase() === 'true')) ||
                 (type === 'Shop Time' && (String(ts.shopTime).toLowerCase() === 'true')))
            );

            if (existingIndex > -1) {
                const updatedTimesheets = [...timesheets];
                const existingTs = updatedTimesheets[existingIndex];
                updatedTimesheets[existingIndex] = {
                    ...existingTs,
                    qty: (existingTs.qty || 1) + 1,
                    hours: parseFloat(((existingTs.hours || 0) + unitHours).toFixed(2))
                };
                return { ...s, timesheet: updatedTimesheets };
            } else {
                const clockIn = new Date(now.getTime() - (unitHours * 60 * 60 * 1000)).toISOString();
                const newTs = {
                    _id: `ts-${Date.now()}`,
                    scheduleId: s._id,
                    employee: currentUser.email,
                    clockIn: clockIn,
                    clockOut: clockOut,
                    type: 'Drive Time',
                    hours: unitHours,
                    qty: 1,
                    dumpWashout: type === 'Dump Washout' ? 'true' : undefined,
                    shopTime: type === 'Shop Time' ? 'true' : undefined,
                    status: 'Pending',
                    createdAt: now.toISOString()
                };
                return { ...s, timesheet: [...timesheets, newTs] };
            }
        }));

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
                        date: clockOut
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
            }
        } catch (error) {
            showError('Error saving signature');
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
                date: selectedJHA.date ? new Date(selectedJHA.date).toLocaleDateString() : '',
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
            const estimate = initialData.estimates.find((e: any) => (e.estimate || e.estimateNum) === schedule?.estimate);
            const client = initialData.clients.find((c: any) => c._id === schedule?.customerId || c.name === schedule?.customerName);
            
            const variables: Record<string, any> = {
                ...selectedJHA,
                customerId: client?.name || schedule?.customerName || '',
                contactName: estimate?.contactName || estimate?.contact || '',
                contactPhone: estimate?.contactPhone || estimate?.phone || '',
                jobAddress: estimate?.jobAddress || schedule?.jobLocation || '',
                customerName: schedule?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                estimateNum: schedule?.estimate || '',
                foremanName: schedule?.foremanName || '',
                date: selectedJHA.date ? new Date(selectedJHA.date).toLocaleDateString() : '',
            };

            const booleanFields = ['operatingMiniEx', 'operatingAVacuumTruck', 'excavatingTrenching', 'acConcWork', 'operatingBackhoe', 'workingInATrench', 'trafficControl', 'roadWork', 'operatingHdd', 'confinedSpace', 'settingUgBoxes', 'otherDailyWork', 'sidewalks', 'heatAwareness', 'ladderWork', 'overheadLifting', 'materialHandling', 'roadHazards', 'heavyLifting', 'highNoise', 'pinchPoints', 'sharpObjects', 'trippingHazards', 'otherJobsiteHazards', 'stagingAreaDiscussed', 'rescueProceduresDiscussed', 'evacuationRoutesDiscussed', 'emergencyContactNumberWillBe911', 'firstAidAndCPREquipmentOnsite', 'closestHospitalDiscussed'];
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
                });
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
                date: new Date().toISOString()
            };
            const res = await fetch('/api/djt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveDJTSignature', payload })
            });
            const data = await res.json();
            if (data.success) {
                success('Signature Saved');
                setSelectedDJT((prev: any) => ({ ...prev, signatures: [...(prev.signatures || []), data.result] }));
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

    const executeDriveTimeToggle = async (schedule: Schedule, activeTs?: any, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!currentUser) return;

        const now = new Date().toISOString();
        const employeeEmail = currentUser.email;

        // Optimistic UI Update
        if (activeTs) {
            // STOP DRIVE TIME
            setSchedules(prev => prev.map(s => {
                if (s._id !== schedule._id) return s;
                return {
                    ...s,
                    timesheet: (s.timesheet || []).map((ts: any) => 
                        ts._id === activeTs._id ? { ...ts, clockOut: now } : ts
                    )
                };
            }));
        } else {
            // START DRIVE TIME
            const tempId = `temp-${Date.now()}`;
            const newTs = {
                _id: tempId,
                scheduleId: schedule._id,
                employee: employeeEmail,
                clockIn: now,
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
                        date: now
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                success(activeTs ? 'Drive time stopped' : 'Drive time started');
                // No fetch needed, keep optimistic state
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
            message: `Are you sure you want to ${isStopping ? 'STOP' : 'START'} Drive Time?`,
            confirmText: isStopping ? 'Stop' : 'Start',
            variant: isStopping ? 'danger' : 'primary',
            onConfirm: () => executeDriveTimeToggle(schedule, activeTs, e)
        });
    };

    const handleQuickTimesheet = (schedule: Schedule, type: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        
        const isIncrement = (schedule.timesheet || []).some((ts: any) => 
            ts.employee?.toLowerCase() === (currentUser?.email?.toLowerCase() || '') &&
            ((type === 'Dump Washout' && (String(ts.dumpWashout).toLowerCase() === 'true' || ts.dumpWashout === true)) ||
             (type === 'Shop Time' && (String(ts.shopTime).toLowerCase() === 'true' || ts.shopTime === true)))
        );
        
        const actionWord = isIncrement ? 'INCREMENT' : 'REGISTER';

        setActionConfirm({
            isOpen: true,
            title: `${type}`,
            message: `Are you sure you want to ${actionWord} ${type}?`,
            confirmText: 'Confirm',
            variant: 'primary',
            onConfirm: () => executeQuickTimesheet(schedule, type)
        });
    };

    // Chat Functions
    const fetchChatMessages = useCallback(async () => {
        try {
            let url = '/api/chat?limit=50';
            if (chatFilterValue) {
                url += `&filter=${encodeURIComponent(chatFilterValue)}`;
            }
            if (tagFilters.length > 0) {
                 // Prioritize estimate tags for filtering if available
                 const estTag = tagFilters.find(t => t.type === 'estimate');
                 if (estTag) {
                     url += `&estimate=${encodeURIComponent(estTag.value)}`;
                 }
            }
            
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setMessages(data.messages);
                // Scroll to bottom on initial load
                setTimeout(() => {
                    if (chatScrollRef.current) {
                        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Failed to fetch chat', error);
        }
    }, [chatFilterValue, tagFilters]);

    // Poll for messages
    useEffect(() => {
        fetchChatMessages();
        const interval = setInterval(fetchChatMessages, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [fetchChatMessages]);

    const handleChatInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setNewMessage(val);
        
        const cursor = e.target.selectionStart || 0;
        setCursorPosition(cursor);
        
        // Check for trigger at cursor
        const textBefore = val.slice(0, cursor);
        const words = textBefore.split(/\s+/);
        const lastWord = words[words.length - 1];

        if (lastWord.startsWith('@')) {
            setMentionQuery(lastWord.slice(1));
            setShowMentions(true);
            setShowReferences(false);
        } else if (lastWord.startsWith('#')) {
            setReferenceQuery(lastWord.slice(1));
            setShowReferences(true);
            setShowMentions(false);
        } else {
            setShowMentions(false);
            setShowReferences(false);
        }
    };

    const insertTag = (tag: string, type: 'mention' | 'reference') => {
        if (!chatInputRef.current) return;
        
        const val = newMessage;
        const textBefore = val.slice(0, cursorPosition);
        const textAfter = val.slice(cursorPosition);
        
        const lastWordStart = textBefore.lastIndexOf(type === 'mention' ? '@' : '#');
        
        if (lastWordStart >= 0) {
            const newTextBefore = textBefore.slice(0, lastWordStart) + tag + ' ';
            setNewMessage(newTextBefore + textAfter);
            
            // Close popups
            setShowMentions(false);
            setShowReferences(false);
            
            // Restore focus
            chatInputRef.current.focus();
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim()) return;

        // Parse mentions and references explicitly from final text to ensure sync
        const extractedMentions = (newMessage.match(/@([\w.@]+)/g) || []).map(s => s.slice(1)); // Simple email/name extraction
        const extractedReferences = (newMessage.match(/#(\d+[-A-Za-z0-9]*)/g) || []).map(s => s.slice(1));

        // Optimistic UI
        const optimisticMsg: any = {
            _id: `temp-${Date.now()}`,
            sender: userEmail,
            senderName: currentUser?.firstName || userEmail,
            message: newMessage,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            mentions: extractedMentions,
            references: extractedReferences
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setNewMessage('');
        
        // Scroll
        setTimeout(() => {
            if (chatScrollRef.current) {
                chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
            }
        }, 50);

        try {
            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: optimisticMsg.message,
                    mentions: extractedMentions,
                    references: extractedReferences,
                    senderName: optimisticMsg.senderName
                })
            });
            fetchChatMessages(); // Sync real ID
        } catch (error) {
            console.error('Failed to send', error);
            showError('Failed to send message');
        }
    };

    // Filter Helpers
    const filteredEmployees = useMemo(() => {
        if (!mentionQuery) return initialData.employees.slice(0, 5);
        return initialData.employees.filter((e: any) => 
            (e.label || e.value).toLowerCase().includes(mentionQuery.toLowerCase())
        ).slice(0, 5);
    }, [mentionQuery, initialData.employees]);

    const filteredEstimates = useMemo(() => {
        if (!referenceQuery) return initialData.estimates.slice(0, 5);
        return initialData.estimates.filter((e: any) => 
            (e.value || '' + e.estimate).toLowerCase().includes(referenceQuery.toLowerCase()) || 
            (e.projectTitle || '').toLowerCase().includes(referenceQuery.toLowerCase())
        ).slice(0, 5);
    }, [referenceQuery, initialData.estimates]);


    // Fetch Data
    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        try {
            const startStr = weekRange.start.toISOString();
            const endStr = weekRange.end.toISOString();
            
            // Fetch schedules for the week using the schedules API
            const schedRes = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'getSchedulesPage',
                    payload: { 
                        startDate: startStr,
                        endDate: endStr,
                        page: 1,
                        limit: 100,
                        skipInitialData: initialData.employees.length > 0, // Fetch once if empty
                        userEmail: scheduleView === 'self' ? userEmail : undefined
                    }
                })
            });
            const schedData = await schedRes.json();
            if (schedData.success) {
                const scheds = schedData.result?.schedules || [];
                setSchedules(scheds);
                if (schedData.result?.initialData) {
                    setInitialData(schedData.result.initialData);
                }
            }
            
            // Fetch estimate stats using aggregate
            // Fetch estimate stats using aggregate
            // Calculate date range for estimate stats
            let estStart = null;
            let estEnd = null;
            const now = new Date();
            
            switch (estimateFilter) {
                case 'this_month':
                    estStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    estEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                    break;
                case 'last_month':
                    estStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    estEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                    break;
                case 'ytd':
                    estStart = new Date(now.getFullYear(), 0, 1);
                    estEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
                    break;
                case 'last_year':
                    estStart = new Date(now.getFullYear() - 1, 0, 1);
                    estEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
                    break;
                default:
                    // 'all' - no filter
                    break;
            }

            const estRes = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'getEstimateStats',
                    payload: { startDate: estStart, endDate: estEnd } // Pass filter to backend
                })
            });
            const estData = await estRes.json();
            if (estData.success && estData.result?.length > 0) {
                // Merge statuses
                const merged = estData.result.reduce((acc: any[], curr: any) => {
                     let status = curr.status;
                     // Normalize statuses - check loosely 
                     const lower = status.toLowerCase();
                     if (lower === 'pending' || lower === 'in progress') {
                         status = 'Pending';
                     } else {
                        // Capitalize others
                        status = status.charAt(0).toUpperCase() + status.slice(1);
                     }
                     
                     const existing = acc.find((i: any) => i.status === status);
                     if (existing) {
                         existing.count += curr.count;
                         existing.total += curr.total;
                     } else {
                         acc.push({ status, count: curr.count, total: curr.total });
                     }
                     return acc;
                }, []);
                setEstimateStats(merged);
            } else {
                // Fallback mock data for demo
                setEstimateStats([
                    { status: 'Pending', count: 12, total: 87936000 },
                    { status: 'Won', count: 8, total: 6056000 },
                    { status: 'Completed', count: 15, total: 2274000 },
                    { status: 'Lost', count: 3, total: 402000 },
                ]);
            }
            
            // Fetch tasks from API
            const tasksRes = await fetch('/api/tasks');
            const tasksData = await tasksRes.json();
            if (tasksData.success) {
                setTodos(tasksData.tasks);
            }

            
            // Fetch activities from API
            const activityRes = await fetch('/api/activity?days=7');
            const activityData = await activityRes.json();
            if (activityData.success) {
                let filtered = activityData.activities || [];
                if (!isSuperAdmin) {
                    filtered = filtered.filter((a: any) => a.user === userEmail);
                }
                setActivities(filtered);
            }
            
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [weekRange, scheduleView, userEmail, isSuperAdmin, estimateFilter, initialData.employees.length]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    // Todo drag handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        const todoId = e.dataTransfer.getData('todoId');
        
        // Optimistic update
        setTodos(prev => prev.map(t => 
            t._id === todoId ? { ...t, status: newStatus as TodoItem['status'] } : t
        ));

        try {
            await fetch('/api/tasks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    id: todoId, 
                    status: newStatus,
                    lastUpdatedBy: userEmail 
                })
            });
        } catch (err) {
            console.error('Error updating task status:', err);
        }
    };

    const handleStatusChange = async (item: TodoItem, newStatus: TodoItem['status']) => {
        // Optimistic update
        setTodos(prev => prev.map(t => t._id === item._id ? { ...t, status: newStatus } : t));
        
        try {
            const res = await fetch('/api/tasks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item._id, status: newStatus, lastUpdatedBy: userEmail || 'System' })
            });

            if (!res.ok) {
                // Revert on error
                setTodos(prev => prev.map(t => t._id === item._id ? item : t));
                showError('Failed to update status');
            } else {
                success('Status updated');
            }
        } catch (err) {
            setTodos(prev => prev.map(t => t._id === item._id ? item : t));
            showError('Failed to update status');
        }
    };

    const handleOpenTaskModal = (task?: TodoItem) => {
        setEditingTask(task || null);
        setIsTaskModalOpen(true);
    };

    const handleCopyTask = (task: TodoItem, e: React.MouseEvent) => {
        e.stopPropagation();
        const { _id, createdAt, ...rest } = task;
        setEditingTask(rest as any);
        setIsTaskModalOpen(true);
    };

    const handleDeleteTask = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this task?')) return;
        
        try {
            const res = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setTodos(prev => prev.filter(t => t._id !== id));
                success('Task deleted successfully');
            }
        } catch (err) {
            showError('Failed to delete task');
        }
    };

    const handleSaveTask = async (taskData: Partial<TodoItem>) => {
        try {
            const method = editingTask ? 'PATCH' : 'POST';
            
            // Clean up the data to avoid 500 errors (e.g. empty strings for Dates)
            const cleanedData = { ...taskData };
            if (!cleanedData.dueDate || cleanedData.dueDate.trim() === '') {
                delete cleanedData.dueDate;
            }
            if (!cleanedData.assignees) cleanedData.assignees = [];

            const body = editingTask 
                ? { ...cleanedData, id: editingTask._id, lastUpdatedBy: userEmail || 'System' } 
                : { ...cleanedData, createdBy: userEmail || 'System' };
            
            const res = await fetch('/api/tasks', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            if (res.ok) {
                const data = await res.json();
                if (editingTask) {
                    setTodos(prev => prev.map(t => t._id === editingTask._id ? data.task : t));
                    success('Task updated');
                } else {
                    setTodos(prev => [data.task, ...prev]);
                    success('Task created');
                }
                setIsTaskModalOpen(false);
            }
        } catch (err) {
            showError('Failed to save task');
        }
    };

    // Filtered todos by status
    const todosByStatus = useMemo(() => ({
        todo: todos.filter(t => t.status === 'todo'),
        'in progress': todos.filter(t => t.status === 'in progress' || t.status === ('in-progress' as any)),
        done: todos.filter(t => t.status === 'done'),
    }), [todos]);

    // Group activities by user (sorted by most recent)
    const groupedActivities = useMemo(() => {
        const groups: { user: string; items: ActivityItem[] }[] = [];
        activities.forEach(item => {
            const existingGroup = groups.find(g => g.user === item.user);
            if (existingGroup) {
                existingGroup.items.push(item);
            } else {
                groups.push({ user: item.user, items: [item] });
            }
        });
        
        return groups.sort((a, b) => {
            const aTime = new Date(a.items[0]?.createdAt || 0).getTime();
            const bTime = new Date(b.items[0]?.createdAt || 0).getTime();
            return bTime - aTime;
        });
    }, [activities]);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header 
                hideLogo={false}
                centerContent={
                    <div className="flex xl:hidden items-center gap-1 bg-white rounded-xl px-2 py-1.5 shadow-sm border border-slate-200">
                        <button 
                            onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, -1))}
                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setCurrentWeekDate(new Date())}
                            className="px-2 py-0.5 rounded-lg hover:bg-slate-50 transition-colors"
                            title="Go to Today"
                        >
                            <span className="font-bold text-sm text-slate-800 tabular-nums">{weekRange.label}</span>
                        </button>
                        <button 
                            onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, 1))}
                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                }
                rightContent={
                    <div className="hidden xl:flex items-center gap-1 bg-white rounded-xl px-2 py-1.5 shadow-sm border border-slate-200">
                        <button 
                            onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, -1))}
                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setCurrentWeekDate(new Date())}
                            className="px-2 py-0.5 rounded-lg hover:bg-slate-50 transition-colors"
                            title="Go to Today"
                        >
                            <span className="font-bold text-sm text-slate-800 tabular-nums">{weekRange.label}</span>
                        </button>
                        <button 
                            onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, 1))}
                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                }
            />

            <div className="flex-1 overflow-y-auto md:p-4 lg:p-6 pb-0">
                <div className="max-w-[1800px] mx-auto w-full">
                    
                    {/* Main Grid */}
                    <div className="grid grid-cols-12 gap-4 lg:gap-6">
                        
                        {/* Left Column - Main Content */}
                        <div className={`col-span-12 xl:col-span-9 space-y-4 lg:space-y-6 ${searchParams.get('view') && searchParams.get('view') !== 'tasks' ? 'hidden md:block' : ''}`}>
                            
                            {/* Upcoming Schedules */}
                            <div className={`${searchParams.get('view') ? 'hidden md:block' : 'block'} bg-transparent md:bg-white md:rounded-2xl md:border md:border-slate-200 md:shadow-sm overflow-hidden`}>
                                <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md flex items-center justify-between px-4 py-2 border-b border-slate-200 md:static md:bg-white md:px-4 md:py-3 md:border-slate-100 shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="hidden md:flex w-8 h-8 rounded-lg bg-blue-100 items-center justify-center">
                                            <Calendar className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <h2 className="font-bold text-slate-900 flex items-center gap-2">
                                                <span className="md:hidden text-sm font-black uppercase tracking-widest text-slate-700">Schedules ({schedules.length})</span>
                                                <span className="hidden md:inline text-sm">Upcoming Schedules</span>
                                            </h2>
                                            <span className="hidden md:inline text-xs text-slate-400">•</span>
                                            <p className="hidden md:block text-xs text-slate-500">{schedules.length} jobs this week</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex bg-slate-200/50 md:bg-slate-100 rounded-lg p-0.5">
                                            <button 
                                                onClick={() => setScheduleView('self')}
                                                className={`px-3 py-1.5 text-[10px] md:text-xs font-bold md:font-medium rounded-md transition-colors ${
                                                    scheduleView === 'self' 
                                                        ? 'bg-white text-blue-600 shadow-sm' 
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                Self
                                            </button>
                                            <button 
                                                onClick={() => setScheduleView('all')}
                                                className={`px-3 py-1.5 text-[10px] md:text-xs font-bold md:font-medium rounded-md transition-colors ${
                                                    scheduleView === 'all' 
                                                        ? 'bg-white text-blue-600 shadow-sm' 
                                                        : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                            >
                                                All
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                    {/* Scrollable Card Area - max 2 rows visible before scroll */}
                                    <div className="overflow-y-auto p-2 md:p-3 bg-slate-50 md:bg-white max-h-none md:max-h-[400px]">
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
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20 md:pb-0">
                                                {schedules.map(schedule => (
                                                    <ScheduleCard
                                                        key={schedule._id}
                                                        item={schedule as any}
                                                        initialData={initialData}
                                                        currentUser={currentUser}
                                                        onClick={() => {
                                                            setSelectedDetailSchedule(schedule);
                                                            setIsDetailModalOpen(true);
                                                        }}
                                                        onEdit={() => {
                                                            setEditingSchedule(schedule);
                                                            setEditScheduleOpen(true);
                                                        }}
                                                        onCopy={() => {
                                                            // Deep clone and shift dates
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
                                                        // Reset ID and signatures
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
                                                        cloned.syncedToAppSheet = false;

                                                        setEditingSchedule(cloned);
                                                        setEditScheduleOpen(true);
                                                    }}
                                                    onDelete={() => {
                                                        setDeleteScheduleId(schedule._id);
                                                        setIsDeleteConfirmOpen(true);
                                                    }}
                                                    onViewJHA={(item) => {
                                                        const jhaWithSigs = { 
                                                            ...item.jha, 
                                                            signatures: item.JHASignatures || [] 
                                                        };
                                                        setSelectedJHA(jhaWithSigs);
                                                        setIsJhaEditMode(false);
                                                        setJhaModalOpen(true);
                                                    }}
                                                    onCreateJHA={(item) => {
                                                        setSelectedJHA({
                                                            schedule_id: item._id,
                                                            date: new Date(),
                                                            jhaTime: new Date().toLocaleTimeString('en-US', { hour12: false }),
                                                            emailCounter: 0,
                                                            signatures: [],
                                                            scheduleRef: item
                                                        });
                                                        setIsJhaEditMode(true);
                                                        setJhaModalOpen(true);
                                                    }}
                                                    onViewDJT={(item) => {
                                                        const djtWithSigs = { 
                                                            ...item.djt, 
                                                            schedule_id: item._id,
                                                            signatures: item.DJTSignatures || [] 
                                                        };
                                                        setSelectedDJT(djtWithSigs);
                                                        setIsDjtEditMode(false);
                                                        setDjtModalOpen(true);
                                                    }}
                                                    onCreateDJT={(item) => {
                                                        setSelectedDJT({
                                                            schedule_id: item._id,
                                                            dailyJobDescription: '',
                                                            customerPrintName: '',
                                                            customerSignature: '',
                                                            createdBy: '', 
                                                            clientEmail: '',
                                                            emailCounter: 0
                                                        });
                                                        setIsDjtEditMode(true);
                                                        setDjtModalOpen(true);
                                                    }}
                                                    onToggleDriveTime={(item, activeTs, e) => handleDriveTimeToggle(item, activeTs, e)}
                                                    onQuickTimesheet={(item, type, e) => handleQuickTimesheet(item, type, e)}
                                                    onViewTimesheet={(item, ts, e) => {
                                                        if (e) e.stopPropagation();
                                                        setSelectedTimesheet(ts);
                                                        setIsTimesheetEditMode(false);
                                                        setTimesheetModalOpen(true);
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Middle Row - Stats & Charts */}
                            <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                                
                                {/* Estimate Stats Pie Chart */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                                    <div className="flex items-center gap-3 mb-4 justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                                <TrendingUp className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <h2 className="font-bold text-slate-900">Estimates Overview</h2>
                                                <p className="text-xs text-slate-500">Grand total by status</p>
                                            </div>
                                        </div>
                                        
                                        {/* Filter Dropdown */}
                                        <div className="relative">
                                            <select 
                                                value={estimateFilter}
                                                onChange={(e) => setEstimateFilter(e.target.value)}
                                                className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-purple-100 cursor-pointer"
                                            >
                                                <option value="all">All Time</option>
                                                <option value="this_month">This Month</option>
                                                <option value="last_month">Last Month</option>
                                                <option value="ytd">Year to Date</option>
                                                <option value="last_year">Last Year</option>
                                            </select>
                                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                    {estimateStats.length > 0 ? (
                                        <PieChart data={estimateStats} />
                                    ) : (
                                        <div className="h-32 flex items-center justify-center">
                                            <p className="text-slate-400">No data available</p>
                                        </div>
                                    )}
                                </div>

                                {/* Training Card */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                            <GraduationCap className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-slate-900">Training & Certifications</h2>
                                            <p className="text-xs text-slate-500">Your compliance status</p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {trainings.map(t => (
                                            <div 
                                                key={t._id}
                                                className={`flex items-center gap-3 p-3 rounded-xl border ${
                                                    t.status === 'completed' ? 'bg-emerald-50 border-emerald-200' :
                                                    t.status === 'upcoming' ? 'bg-amber-50 border-amber-200' :
                                                    'bg-red-50 border-red-200'
                                                }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                                    t.status === 'completed' ? 'bg-emerald-500' :
                                                    t.status === 'upcoming' ? 'bg-amber-500' :
                                                    'bg-red-500'
                                                } text-white`}>
                                                    {t.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> :
                                                     t.status === 'upcoming' ? <CalendarCheck className="w-4 h-4" /> :
                                                     <AlertCircle className="w-4 h-4" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm text-slate-800 truncate">{t.name}</p>
                                                    <p className="text-xs text-slate-500">
                                                        {t.status === 'completed' ? `Completed: ${t.completedDate}` :
                                                         t.status === 'upcoming' ? `Renewal: ${t.renewalDate}` :
                                                         `Expired: ${t.renewalDate}`}
                                                    </p>
                                                </div>
                                                <Badge 
                                                    variant={t.status === 'completed' ? 'success' : t.status === 'upcoming' ? 'warning' : 'danger'}
                                                    className="text-[10px]"
                                                >
                                                    {t.type}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Tasks Kanban */}
                            <div className={`${searchParams.get('view') === 'tasks' ? 'block' : 'hidden md:block'} bg-white rounded-2xl border border-slate-200 shadow-sm p-4`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-rose-600" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-slate-900">Tasks</h2>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleOpenTaskModal()}
                                        className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="hidden md:flex gap-4 overflow-x-auto pb-2">
                                    <TodoColumn 
                                        title="To Do" 
                                        items={todosByStatus.todo} 
                                        status="todo" 
                                        color="bg-slate-400"
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                        onEdit={handleOpenTaskModal}
                                        onCopy={handleCopyTask}
                                        onStatusChange={handleStatusChange}
                                        onDelete={handleDeleteTask}
                                    />
                                    <TodoColumn 
                                        title="In Progress" 
                                        items={todosByStatus['in progress']} 
                                        status="in progress" 
                                        color="bg-blue-500"
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                        onEdit={handleOpenTaskModal}
                                        onCopy={handleCopyTask}
                                        onStatusChange={handleStatusChange}
                                        onDelete={handleDeleteTask}
                                    />
                                    <TodoColumn 
                                        title="Done" 
                                        items={todosByStatus.done} 
                                        status="done" 
                                        color="bg-emerald-500"
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                        onEdit={handleOpenTaskModal}
                                        onCopy={handleCopyTask}
                                        onStatusChange={handleStatusChange}
                                        onDelete={handleDeleteTask}
                                    />
                                </div>
                                
                                {/* Mobile Accordion View */}
                                <div className="md:hidden mt-2">
                                    <Accordion type="multiple" className="space-y-3">
                                        <AccordionItem value="todo" className="border border-slate-200 rounded-xl overflow-hidden px-1">
                                            <AccordionTrigger className="hover:no-underline py-3 px-3 bg-slate-50/50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                                                    <span className="font-bold text-slate-700">To Do</span>
                                                    <Badge variant="default" className="ml-2 text-[10px]">{todosByStatus.todo.length}</Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-2 px-1 pb-2 bg-white">
                                                <div className="space-y-2">
                                                    {todosByStatus.todo.length > 0 ? (
                                                        todosByStatus.todo.map(item => (
                                                            <div key={item._id} onClick={() => handleOpenTaskModal(item)} className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium text-slate-800">{item.task}</p>
                                                                        {item.dueDate && (
                                                                            <p className="text-[10px] text-slate-400 mt-1">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
                                                                        )}
                                                                    </div>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); handleStatusChange(item, 'in progress'); }}
                                                                        className="p-1.5 bg-white border border-slate-200 rounded-lg text-blue-500 shadow-sm"
                                                                    >
                                                                        <ActivityIcon size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-center py-4 text-xs text-slate-400 italic">No tasks in this list</p>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>

                                        <AccordionItem value="in-progress" className="border border-slate-200 rounded-xl overflow-hidden px-1">
                                            <AccordionTrigger className="hover:no-underline py-3 px-3 bg-blue-50/30">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                    <span className="font-bold text-slate-700">In Progress</span>
                                                    <Badge variant="default" className="ml-2 text-[10px]">{todosByStatus['in progress'].length}</Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-2 px-1 pb-2 bg-white">
                                                <div className="space-y-2">
                                                    {todosByStatus['in progress'].length > 0 ? (
                                                        todosByStatus['in progress'].map(item => (
                                                            <div key={item._id} onClick={() => handleOpenTaskModal(item)} className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium text-slate-800">{item.task}</p>
                                                                        {item.dueDate && (
                                                                            <p className="text-[10px] text-slate-400 mt-1">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
                                                                        )}
                                                                    </div>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); handleStatusChange(item, 'done'); }}
                                                                        className="p-1.5 bg-white border border-slate-200 rounded-lg text-emerald-500 shadow-sm"
                                                                    >
                                                                        <ActivityIcon size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-center py-4 text-xs text-slate-400 italic">No tasks in progress</p>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>

                                        <AccordionItem value="done" className="border border-slate-200 rounded-xl overflow-hidden px-1">
                                            <AccordionTrigger className="hover:no-underline py-3 px-3 bg-emerald-50/30">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                    <span className="font-bold text-slate-700">Done</span>
                                                    <Badge variant="default" className="ml-2 text-[10px]">{todosByStatus.done.length}</Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-2 px-1 pb-2 bg-white">
                                                <div className="space-y-2">
                                                    {todosByStatus.done.length > 0 ? (
                                                        todosByStatus.done.map(item => (
                                                            <div key={item._id} onClick={() => handleOpenTaskModal(item)} className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-medium text-slate-800">{item.task}</p>
                                                                        {item.dueDate && (
                                                                            <p className="text-[10px] text-slate-400 mt-1">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
                                                                        )}
                                                                    </div>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); handleStatusChange(item, 'todo'); }}
                                                                        className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-400 shadow-sm"
                                                                    >
                                                                        <ActivityIcon size={12} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-center py-4 text-xs text-slate-400 italic">No completed tasks</p>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </div>
                            </div>

                            <TaskFormModal 
                                isOpen={isTaskModalOpen}
                                onClose={() => setIsTaskModalOpen(false)}
                                onSave={handleSaveTask}
                                editingTask={editingTask}
                                employees={initialData.employees}
                            />

                            {/* Time Cards - Weekly (Renamed & Table View) */}
                            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm p-3 md:p-4 overflow-hidden">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                                            <Clock className="w-5 h-5 text-teal-600" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-slate-900">Time Cards</h2>
                                            <p className="md:hidden text-xs text-slate-500">Your recent activity</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 md:gap-4 ml-1 md:ml-0">
                                        <div className="flex flex-col md:items-end">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Drive Time</span>
                                            <span className="text-sm font-black text-blue-600">{timeCardTotals.drive.toFixed(2)} hrs</span>
                                        </div>
                                        <div className="w-px h-8 bg-slate-100 hidden md:block" />
                                        <div className="flex flex-col md:items-end">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Site Time</span>
                                            <span className="text-sm font-black text-emerald-600">{timeCardTotals.site.toFixed(2)} hrs</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="overflow-x-auto">
                                    <Table containerClassName="h-auto min-h-0 !border-none !shadow-none !bg-transparent">
                                        <TableHead>
                                            <TableRow className="hover:bg-transparent border-slate-100">
                                                <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center w-[100px]">Date</TableHeader>
                                                <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center w-[60px]">Type</TableHeader>
                                                <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center w-[110px]">Estimate #</TableHeader>
                                                <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center w-[100px]">In</TableHeader>
                                                <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center w-[100px]">Out</TableHeader>
                                                <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-right w-[80px]">Dist (Mi)</TableHeader>
                                                <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-right w-[70px]">Hrs</TableHeader>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {dashboardTimeCards.length > 0 ? dashboardTimeCards.slice(0, 10).map((ts, idx) => (
                                                <TableRow key={idx} className="hover:bg-slate-50">
                                                    <TableCell className="text-center text-[11px] font-medium text-slate-600">
                                                        {formatDateOnly(ts.clockIn)}
                                                    </TableCell>
                                                     <TableCell className="text-center">
                                                         <div className="flex justify-center">
                                                             {ts.type?.toLowerCase().includes('drive') ? (
                                                                 <div className="p-1.5 text-blue-600 bg-blue-50 rounded-lg">
                                                                     <Truck size={14} />
                                                                 </div>
                                                             ) : (
                                                                 <div className="p-1.5 text-emerald-600 bg-emerald-50 rounded-lg">
                                                                     <MapPin size={14} />
                                                                 </div>
                                                             )}
                                                         </div>
                                                     </TableCell>
                                                     <TableCell className="text-center">
                                                         <span className="text-[10px] font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 uppercase tracking-tighter">
                                                             {ts.estimate ? ts.estimate.replace(/-[vV]\d+$/, '') : '-'}
                                                         </span>
                                                     </TableCell>
                                                     <TableCell className="text-center text-xs text-slate-500">
                                                         {ts.type?.toLowerCase().includes('drive') ? (
                                                             ts.dumpWashout ? (
                                                                 <span className="text-[10px] font-black uppercase bg-orange-500 text-white px-2 py-1 rounded shadow-sm inline-flex items-center gap-1 min-w-[70px] justify-center">
                                                                     <span>Washout</span>
                                                                     {String(ts.dumpWashout).includes('qty') && <CheckCircle2 size={10} />}
                                                                 </span>
                                                             ) : <span className="text-slate-300">-</span>
                                                         ) : (
                                                             <span className="text-[11px] font-medium text-slate-600 tracking-tight">
                                                                 {formatTimeOnly(ts.clockIn)}
                                                             </span>
                                                         )}
                                                     </TableCell>
                                                     <TableCell className="text-center text-xs text-slate-500">
                                                         {ts.type?.toLowerCase().includes('drive') ? (
                                                             ts.shopTime ? (
                                                                 <span className="text-[10px] font-black uppercase bg-blue-500 text-white px-2 py-1 rounded shadow-sm inline-flex items-center gap-1 min-w-[70px] justify-center">
                                                                     <span>Shop</span>
                                                                     {String(ts.shopTime).includes('qty') && <CheckCircle2 size={10} />}
                                                                 </span>
                                                             ) : <span className="text-slate-300">-</span>
                                                         ) : (
                                                             <span className="text-[11px] font-medium text-slate-600 tracking-tight">
                                                                 {formatTimeOnly(ts.clockOut)}
                                                             </span>
                                                         )}
                                                     </TableCell>
                                                    <TableCell className="text-right text-[11px] font-medium text-slate-600">
                                                        {(ts.distanceVal || 0) > 0 ? (ts.distanceVal).toFixed(1) : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right text-[11px] font-black text-slate-800">
                                                        {(ts.hoursVal || 0).toFixed(2)}
                                                    </TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-8 text-xs text-slate-400">
                                                        No time cards found
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>

                        {/* Right Sidebar - Chat & Activity */}
                        <div className={`col-span-12 xl:col-span-3 space-y-4 lg:space-y-6 ${searchParams.get('view') === 'chat' ? 'block' : 'hidden md:block'}`}>
                            
                            {/* Recent Activity */}
                            <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-hidden ${searchParams.get('view') === 'chat' ? 'hidden md:block' : ''}`}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSuperAdmin ? 'bg-indigo-100' : 'bg-emerald-100'}`}>
                                        {isSuperAdmin ? <Users className="w-5 h-5 text-indigo-600" /> : <ActivityIcon className="w-5 h-5 text-emerald-600" />}
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-slate-900">{isSuperAdmin ? 'Team Activity' : 'My Activity'}</h2>
                                        <p className="text-xs text-slate-500">{isSuperAdmin ? 'Recent updates from the team' : 'Your recent updates'}</p>
                                    </div>
                                </div>
                                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                                    {groupedActivities.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-sm text-slate-400">No recent activity</p>
                                        </div>
                                    ) : (
                                        groupedActivities.map((group, groupIdx) => {
                                            const isExpanded = expandedGroups.includes(group.user);
                                            const employeeName = isSuperAdmin ? (initialData.employees?.find((e: any) => e.value === group.user)?.label || group.user) : 'You';
                                            
                                            return (
                                                <div key={groupIdx} className="space-y-3 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                                                    {/* User Header - Clickable */}
                                                    <div 
                                                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity select-none group/header"
                                                        onClick={() => setExpandedGroups(prev => 
                                                            prev.includes(group.user) 
                                                                ? prev.filter(u => u !== group.user) 
                                                                : [...prev, group.user]
                                                        )}
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-[#0F4C75] text-white flex items-center justify-center text-xs font-bold shadow-sm">
                                                            {group.user?.[0]?.toUpperCase() || 'S'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-slate-900 truncate">{employeeName}</p>
                                                            <p className="text-[10px] text-slate-400">
                                                                {group.items.length} recent {group.items.length === 1 ? 'activity' : 'activities'}
                                                            </p>
                                                        </div>
                                                        <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                                            <ChevronDown size={14} className="text-slate-400 group-hover/header:text-[#0F4C75]" />
                                                        </div>
                                                    </div>

                                                    {/* Activity Items (Accordion Content) */}
                                                    {isExpanded && (
                                                        <div className="ml-4 pl-4 border-l-2 border-slate-50 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                            {group.items.map((a, i) => (
                                                                <div key={i} className="relative group">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                                                            {(() => {
                                                                                const diff = Math.floor((new Date().getTime() - new Date(a.createdAt).getTime()) / 60000);
                                                                                if (diff < 1) return 'Just now';
                                                                                if (diff < 60) return `${diff}m ago`;
                                                                                if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
                                                                                return `${Math.floor(diff/1440)}d ago`;
                                                                            })()}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-slate-600 leading-snug mt-0.5">{a.title}</p>
                                                                    <div className="mt-1 flex items-center gap-1.5">
                                                                        <Badge variant="default" className="text-[8px] py-0 px-1 border-slate-200 text-slate-400 uppercase tracking-tighter">
                                                                            {a.type}
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Chat */}
                            <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col ${searchParams.get('view') === 'chat' ? 'h-[calc(100vh-160px)] md:h-[500px]' : 'h-[500px]'}`}>
                                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                                            <MessageSquare className="w-5 h-5 text-cyan-600" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-slate-900">Chat</h2>
                                            <p className="text-xs text-slate-500">
                                                {tagFilters.length > 0 ? `Filtered by: ${tagFilters.map(t => t.label).join(', ')}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {tagFilters.length > 0 && (
                                            <button 
                                                onClick={() => { setTagFilters([]); setChatFilterValue(''); }}
                                                className="text-xs text-slate-400 hover:text-slate-600 px-2"
                                            >
                                                Clear
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => setChatFilterValue(prev => prev ? '' : ' ')} // Minimal toggle to trigger re-fetch or show input
                                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors relative"
                                        >
                                            <Filter className={`w-4 h-4 ${tagFilters.length > 0 ? 'text-blue-500' : 'text-slate-500'}`} />
                                            {tagFilters.length > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />}
                                        </button>
                                    </div>
                                </div>
                                
                                <div 
                                    className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin"
                                    ref={chatScrollRef}
                                >
                                    {messages.length === 0 ? (
                                        <div className="text-center py-12">
                                            <p className="text-sm text-slate-400">No messages yet. Start the conversation!</p>
                                        </div>
                                    ) : (
                                        messages.map((msg, idx) => {
                                            const isMe = msg.sender === userEmail;
                                            // Handle mentions highlighting
                                            const renderMessage = (text: string) => {
                                                const parts = text.split(/(@[\w.@]+|#\d+[-A-Za-z0-9]*)/g);
                                                return parts.map((part, i) => {
                                                    if (part.startsWith('@')) return <span key={i} className="text-blue-600 font-bold">{part}</span>;
                                                    if (part.startsWith('#')) return <span key={i} className="text-purple-600 font-bold cursor-pointer hover:underline" onClick={() => {
                                                        const estVal = part.slice(1);
                                                        setTagFilters([{ type: 'estimate', value: estVal, label: part }]);
                                                    }}>{part}</span>;
                                                    return part;
                                                });
                                            };

                                            return (
                                                <div key={idx} className={`flex gap-2 ${isMe ? 'justify-end' : ''}`}>
                                                    {!isMe && (
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                                                            {msg.senderName?.[0] || 'U'}
                                                        </div>
                                                    )}
                                                    <div className={`rounded-2xl px-3 py-2 max-w-[85%] ${
                                                        isMe 
                                                            ? 'bg-blue-600 text-white rounded-tr-none' 
                                                            : 'bg-slate-100 text-slate-800 rounded-tl-none'
                                                    }`}>
                                                        <p className="text-sm cursor-text selection:bg-white/30">
                                                            {renderMessage(msg.message)}
                                                        </p>
                                                        <p className={`text-[10px] mt-1 ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                                            {!isMe && <span className="font-bold mr-1">{msg.senderName}</span>}
                                                            {new Date(msg.createdAt || msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </p>
                                                    </div>
                                                    {isMe && (
                                                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                            ME
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="p-3 border-t border-slate-100 relative">
                                    {/* Mention Popup */}
                                    {showMentions && (
                                        <div className="absolute bottom-full left-4 mb-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-20 animate-in slide-in-from-bottom-2">
                                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 text-xs font-bold text-slate-500">
                                                Mention Teammate
                                            </div>
                                            <div className="max-h-48 overflow-y-auto">
                                                {filteredEmployees.map((emp: any) => (
                                                    <div 
                                                        key={emp.value}
                                                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center gap-2"
                                                        onClick={() => insertTag(`@${emp.label || emp.value}`, 'mention')}
                                                    >
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs">
                                                            {(emp.label || emp.value)[0]}
                                                        </div>
                                                        <span className="text-sm text-slate-700">{emp.label || emp.value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Reference Popup */}
                                    {showReferences && (
                                        <div className="absolute bottom-full left-4 mb-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-20 animate-in slide-in-from-bottom-2">
                                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 text-xs font-bold text-slate-500">
                                                Reference Estimate
                                            </div>
                                            <div className="max-h-48 overflow-y-auto">
                                                {filteredEstimates.map((est: any) => (
                                                    <div 
                                                        key={est.value}
                                                        className="px-3 py-2 hover:bg-purple-50 cursor-pointer"
                                                        onClick={() => insertTag(`#${est.value || est.estimate}`, 'reference')}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-bold text-sm text-[#0F4C75]">{est.value || est.estimate}</span>
                                                            <span className="text-[10px] text-slate-400">{est.customerName || 'Client'}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-600 truncate">{est.projectTitle || 'Untitled Project'}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <form onSubmit={handleSendMessage} className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input 
                                                ref={chatInputRef}
                                                type="text"
                                                placeholder="Type @ for team or # for jobs..."
                                                className="w-full px-4 py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
                                                value={newMessage}
                                                onChange={handleChatInput}
                                            />
                                        </div>
                                        <button 
                                            type="submit"
                                            disabled={!newMessage.trim()}
                                            className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                </div>
            </div>

            {/* Schedule Detail Modal */}
            <ScheduleDetailModal 
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                schedule={selectedDetailSchedule}
                initialData={initialData}
                onOpenMedia={(type, url, title) => {
                    setMediaModalContent({ type, url, title });
                    setIsMediaModalOpen(true);
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
                        <img 
                            src={mediaModalContent.url} 
                            alt={mediaModalContent.title}
                            className="max-w-full max-h-[80vh] rounded-2xl shadow-2xl"
                        />
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
                setEmailModalOpen={setEmailModalOpen}
                initialData={initialData}
                schedules={schedules}
                activeSignatureEmployee={activeSignatureEmployee}
                setActiveSignatureEmployee={setActiveSignatureEmployee}
            />

            {/* DJT Modal */}
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
            <ConfirmModal
                isOpen={actionConfirm.isOpen}
                onClose={() => setActionConfirm(prev => ({ ...prev, isOpen: false }))}
                onConfirm={actionConfirm.onConfirm}
                title={actionConfirm.title}
                message={actionConfirm.message}
                confirmText={actionConfirm.confirmText}
                cancelText="Cancel"
                variant={actionConfirm.variant}
            />

            {/* Email Modal */}
            <Modal
                isOpen={emailModalOpen}
                onClose={() => !isSendingEmail && setEmailModalOpen(false)}
                title="Email JHA Document"
                maxWidth="md"
            >
                <form onSubmit={handleEmailJhaPdf} className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                        <div className="bg-blue-100 p-2 rounded-full text-[#0F4C75]">
                            <Mail size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-[#0F4C75]">Send PDF via Email</p>
                            <p className="text-xs text-blue-800/70 mt-1">The JHA document will be attached as a PDF and sent to the recipient below.</p>
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
    );
}



export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /></div>}>
            <DashboardContent />
        </Suspense>
    );
}
