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
    Mail, Loader2, Activity as ActivityIcon, ChevronDown, Truck, Download,
    Reply, Forward, Trash
} from 'lucide-react';
import { toast } from 'sonner';
import { Header, Badge, Input, Modal, Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, SearchableSelect, MyDropDown, Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui';
import { UploadButton } from '@/components/ui/UploadButton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/useToast';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES } from '@/lib/permissions/types';
import { ScheduleDetailsPopup } from '@/components/ui/ScheduleDetailsPopup';
import { ScheduleCard, ScheduleItem } from '../jobs/schedules/components/ScheduleCard';
import { ScheduleFormModal } from '../jobs/schedules/components/ScheduleFormModal';
import { JHAModal } from '../jobs/schedules/components/JHAModal';
import ClientOnly from '@/components/ClientOnly';
import { DJTModal } from '../jobs/schedules/components/DJTModal';
import { TimesheetModal } from '../jobs/schedules/components/TimesheetModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { calculateTimesheetData, formatDateOnly, formatTimeOnly } from '@/lib/timeCardUtils';
import { getLocalNowISO } from '@/lib/scheduleUtils';

// Week utilities
// Returns { start, end, label, startISO, endISO } where startISO/endISO are date-only strings
const getWeekRange = (date: Date = new Date()): { start: Date; end: Date; label: string; startISO: string; endISO: string } => {
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
    
    // Format as YYYY-MM-DDT00:00:00 to preserve local date when sent to server
    const toLocalISOStart = (dt: Date) => {
        const year = dt.getFullYear();
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}T00:00:00.000Z`;
    };
    
    const toLocalISOEnd = (dt: Date) => {
        const year = dt.getFullYear();
        const month = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}T23:59:59.999Z`;
    };
    
    // Format: MM/DD-MM/DD
    return { 
        start, 
        end, 
        label: `${fmt(start)}-${fmt(end)}`,
        startISO: toLocalISOStart(start),
        endISO: toLocalISOEnd(end)
    };
};

const shiftWeek = (current: Date, direction: number): Date => {
    const newDate = new Date(current);
    newDate.setDate(newDate.getDate() + (direction * 7));
    return newDate;
};

// Generate weeks for week picker (Monday-based)
const getWeekNumber = (d: Date): number => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 4 - (date.getDay() || 7));
    const yearStart = new Date(date.getFullYear(), 0, 1);
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const generateWeeksForPicker = (): { id: string; label: string; value: string; weekNum: number; startDate: Date; isCurrentWeek: boolean }[] => {
    const weeks: { id: string; label: string; value: string; weekNum: number; startDate: Date; isCurrentWeek: boolean }[] = [];
    const now = new Date();
    const currentWeekRange = getWeekRange(now);
    
    // Generate 20 weeks in past, current week, and 10 weeks in future
    for (let i = -20; i <= 10; i++) {
        const weekDate = new Date(now);
        weekDate.setDate(weekDate.getDate() + (i * 7));
        const range = getWeekRange(weekDate);
        const weekNum = getWeekNumber(range.start);
        const isCurrentWeek = range.label === currentWeekRange.label;
        
        const formatDateFull = (d: Date) => {
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const y = String(d.getFullYear()).slice(-2);
            return `${m}/${day}/${y}`;
        };
        
        weeks.push({
            id: range.label,
            label: `${formatDateFull(range.start)} to ${formatDateFull(range.end)}${isCurrentWeek ? ' (Current)' : ''}`,
            value: range.label,
            weekNum,
            startDate: range.start,
            isCurrentWeek
        });
    }
    
    // Sort by date descending (newest first)
    return weeks.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
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
    customerId?: string;
    customerName?: string;
    estimate?: string;
    jobAddress?: string;
    createdBy?: string;
    createdAt?: string;
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
    isSuperAdmin
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
                            {item.dueDate && (
                                <p className="text-xs text-slate-400 mt-1">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
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
                                <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-100 whitespace-nowrap">{item.estimate}</span>
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
    employees,
    clients,
    estimates,
    currentUserEmail,
    isSuperAdmin
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    onSave: (data: Partial<TodoItem>) => void;
    editingTask?: TodoItem | null;
    employees: any[];
    clients: any[];
    estimates: any[];
    currentUserEmail: string;
    isSuperAdmin: boolean;
}) => {
    const isEditing = !!editingTask?._id;
    const canEdit = !isEditing || (editingTask?.createdBy === currentUserEmail) || isSuperAdmin;
    const [formData, setFormData] = useState<Partial<TodoItem>>({
        task: '',
        dueDate: '',
        status: 'todo',
        assignees: [],
        customerId: '',
        customerName: '',
        estimate: '',
        jobAddress: ''
    });
    const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [estimateSearch, setEstimateSearch] = useState('');
    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const [isEstimateDropdownOpen, setIsEstimateDropdownOpen] = useState(false);

    const employeeOptions = useMemo(() => employees.map(emp => ({
        id: emp.value,
        label: emp.label,
        value: emp.value,
        profilePicture: emp.image
    })), [employees]);

    // Filter estimates based on selected customer
    const filteredEstimates = useMemo(() => {
        let filtered = estimates || [];
        if (formData.customerId) {
            filtered = filtered.filter((e: any) => String(e.customerId) === String(formData.customerId));
        }
        if (estimateSearch.trim()) {
            const q = estimateSearch.toLowerCase();
            filtered = filtered.filter((e: any) => 
                (e.value || '').toLowerCase().includes(q) ||
                (e.projectName || '').toLowerCase().includes(q) ||
                (e.customerName || '').toLowerCase().includes(q)
            );
        }
        return filtered.slice(0, 20);
    }, [estimates, formData.customerId, estimateSearch]);

    // Filter clients based on search
    const filteredClients = useMemo(() => {
        let filtered = clients || [];
        if (customerSearch.trim()) {
            const q = customerSearch.toLowerCase();
            filtered = filtered.filter((c: any) => 
                (c.name || '').toLowerCase().includes(q)
            );
        }
        return filtered.slice(0, 20);
    }, [clients, customerSearch]);

    // Handle estimate selection — auto-fill customer and jobAddress
    const handleEstimateSelect = (est: any) => {
        const customer = clients.find((c: any) => String(c._id) === String(est.customerId));
        setFormData(prev => ({
            ...prev,
            estimate: est.value || est._id,
            customerId: est.customerId || prev.customerId,
            customerName: customer?.name || est.customerName || prev.customerName,
            jobAddress: est.jobAddress || prev.jobAddress
        }));
        setIsEstimateDropdownOpen(false);
        setEstimateSearch('');
    };

    // Handle customer selection — clear estimate if customer changes
    const handleCustomerSelect = (client: any) => {
        setFormData(prev => ({
            ...prev,
            customerId: String(client._id),
            customerName: client.name,
            // Clear estimate if different customer
            ...(prev.customerId && String(prev.customerId) !== String(client._id) ? { estimate: '', jobAddress: '' } : {})
        }));
        setIsCustomerDropdownOpen(false);
        setCustomerSearch('');
    };

    useEffect(() => {
        if (editingTask) {
            setFormData({
                task: editingTask.task || '',
                dueDate: editingTask.dueDate ? (editingTask.dueDate.includes('T') ? editingTask.dueDate.slice(0, 10) : editingTask.dueDate) : '',
                status: editingTask.status || 'todo',
                assignees: editingTask.assignees || [],
                customerId: editingTask.customerId || '',
                customerName: editingTask.customerName || '',
                estimate: editingTask.estimate || '',
                jobAddress: editingTask.jobAddress || ''
            });
        } else {
            setFormData({
                task: '',
                dueDate: '',
                status: 'todo',
                assignees: [],
                customerId: '',
                customerName: '',
                estimate: '',
                jobAddress: ''
            });
        }
        setCustomerSearch('');
        setEstimateSearch('');
    }, [editingTask, isOpen]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editingTask ? 'Edit Task' : 'Add New Task'}>
            <div className="space-y-4">
                {/* Task Description */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Task Description</label>
                    <textarea 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none min-h-[100px]"
                        placeholder="What needs to be done?"
                        value={formData.task}
                        onChange={(e) => setFormData({ ...formData, task: e.target.value })}
                        disabled={!canEdit}
                    />
                </div>

                {/* Customer & Estimate - side by side */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Customer Dropdown */}
                    <div className="relative">
                        <label className="block text-sm font-bold text-slate-700 mb-1">Customer</label>
                        <div 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm cursor-pointer hover:border-blue-300 transition-all flex items-center justify-between"
                            onClick={() => { if (canEdit) { setIsCustomerDropdownOpen(!isCustomerDropdownOpen); setIsEstimateDropdownOpen(false); } }}
                        >
                            <span className={formData.customerName ? 'text-slate-800' : 'text-slate-400'}>
                                {formData.customerName || 'Select customer...'}
                            </span>
                            <ChevronDown size={14} className={`text-slate-400 transition-transform ${isCustomerDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>
                        {isCustomerDropdownOpen && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[250px] overflow-hidden">
                                <div className="p-2 border-b border-slate-100">
                                    <input 
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                        placeholder="Search customers..."
                                        value={customerSearch}
                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div className="overflow-y-auto max-h-[190px]">
                                    {formData.customerId && (
                                        <button
                                            className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 font-medium border-b border-slate-100"
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setFormData(prev => ({ ...prev, customerId: '', customerName: '', estimate: '', jobAddress: '' }));
                                                setIsCustomerDropdownOpen(false);
                                            }}
                                        >
                                            ✕ Clear selection
                                        </button>
                                    )}
                                    {filteredClients.length === 0 ? (
                                        <div className="p-3 text-xs text-slate-400 text-center">No customers found</div>
                                    ) : (
                                        filteredClients.map((client: any) => (
                                            <button
                                                key={client._id}
                                                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors flex items-center justify-between ${String(formData.customerId) === String(client._id) ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'}`}
                                                onClick={(e) => { e.stopPropagation(); handleCustomerSelect(client); }}
                                            >
                                                <span className="truncate">{client.name}</span>
                                                {String(formData.customerId) === String(client._id) && <span className="text-blue-500 text-xs">✓</span>}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Estimate Dropdown */}
                    <div className="relative">
                        <label className="block text-sm font-bold text-slate-700 mb-1">Estimate</label>
                        <div 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm cursor-pointer hover:border-blue-300 transition-all flex items-center justify-between"
                            onClick={() => { if (canEdit) { setIsEstimateDropdownOpen(!isEstimateDropdownOpen); setIsCustomerDropdownOpen(false); } }}
                        >
                            <span className={formData.estimate ? 'text-slate-800' : 'text-slate-400'}>
                                {formData.estimate || 'Select estimate...'}
                            </span>
                            <ChevronDown size={14} className={`text-slate-400 transition-transform ${isEstimateDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>
                        {isEstimateDropdownOpen && (
                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-[250px] overflow-hidden">
                                <div className="p-2 border-b border-slate-100">
                                    <input 
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                        placeholder="Search estimates..."
                                        value={estimateSearch}
                                        onChange={(e) => setEstimateSearch(e.target.value)}
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                <div className="overflow-y-auto max-h-[190px]">
                                    {formData.estimate && (
                                        <button
                                            className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 font-medium border-b border-slate-100"
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setFormData(prev => ({ ...prev, estimate: '', jobAddress: '' }));
                                                setIsEstimateDropdownOpen(false);
                                            }}
                                        >
                                            ✕ Clear selection
                                        </button>
                                    )}
                                    {filteredEstimates.length === 0 ? (
                                        <div className="p-3 text-xs text-slate-400 text-center">No estimates found</div>
                                    ) : (
                                        filteredEstimates.map((est: any) => (
                                            <button
                                                key={est.value || est._id}
                                                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors ${formData.estimate === (est.value || est._id) ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700'}`}
                                                onClick={(e) => { e.stopPropagation(); handleEstimateSelect(est); }}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="truncate">
                                                        <span className="font-medium">{est.value || est._id}</span>
                                                        {est.projectName && <span className="text-slate-400 ml-1.5">— {est.projectName}</span>}
                                                    </div>
                                                    {formData.estimate === (est.value || est._id) && <span className="text-blue-500 text-xs ml-1">✓</span>}
                                                </div>
                                                {!formData.customerId && est.customerName && (
                                                    <div className="text-[10px] text-slate-400 mt-0.5 truncate">{est.customerName}</div>
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Job Address */}
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Job Address</label>
                    <input 
                        type="text"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                        placeholder="Job location / address"
                        value={formData.jobAddress || ''}
                        onChange={(e) => setFormData({ ...formData, jobAddress: e.target.value })}
                        disabled={!canEdit}
                    />
                </div>

                {/* Due Date & Status - side by side */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Due Date</label>
                        <input 
                            type="date"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                            value={formData.dueDate}
                            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                            disabled={!canEdit}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Status</label>
                        <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                            disabled={!canEdit}
                        >
                            <option value="todo">To Do</option>
                            <option value="in progress">In Progress</option>
                            <option value="done">Done</option>
                        </select>
                    </div>
                </div>

                {/* Assign To */}
                <div className="relative">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Assign To</label>
                    <div 
                        id="assignee-trigger"
                        className={`w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm flex items-center justify-between cursor-pointer hover:border-blue-300 transition-all min-h-[50px] ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => canEdit && setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
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
                            if (!canEdit) return;
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
                        disabled={!formData.task?.trim() || !canEdit}
                        className={`bg-blue-600 hover:bg-blue-700 text-white ${!canEdit ? 'hidden' : ''}`}
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
    const { user, isSuperAdmin, canField, permissions } = usePermissions();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const userEmail = user?.email || currentUser?.email || '';
    
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

    // Update URL and localStorage when weekRange.label changes
    const [currentWeekDate, setCurrentWeekDate] = useState(() => {
        // Only use searchParams for initialization to avoid hydration mismatch
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

    // Update URL and localStorage when weekRange.label changes
    // Initialize from localStorage if no URL param exists
    useEffect(() => {
        if (!searchParams.get('week')) {
            const storedWeek = localStorage.getItem('selected_week');
            if (storedWeek && storedWeek.includes('-')) {
                try {
                    const [startPart] = storedWeek.split('-');
                    const [m, d] = startPart.split('/').map(Number);
                    const date = new Date();
                    date.setMonth(m - 1);
                    date.setDate(d);
                    if (!isNaN(date.getTime())) {
                        setCurrentWeekDate(date);
                    }
                } catch (e) {}
            }
        }
    }, []);

    // Update URL and localStorage when weekRange.label changes
    useEffect(() => {
        const newLabel = weekRange.label;
        const currentWeekParam = searchParams.get('week');
        
        // Sync with localStorage
        localStorage.setItem('selected_week', newLabel);

        if (newLabel !== currentWeekParam) {
            const params = new URLSearchParams(searchParams.toString());
            params.set('week', newLabel);
            router.replace(`?${params.toString()}`, { scroll: false });
        }
    }, [weekRange.label, router, searchParams]);
    
    // Data States
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [initialData, setInitialData] = useState<any>({ employees: [], clients: [], constants: [], estimates: [] });
    const [timeCards, setTimeCards] = useState<TimeCard[]>([]);
    const [trainings, setTrainings] = useState<Training[]>([]);
    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [estimateStats, setEstimateStats] = useState<EstimateStats[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<TodoItem | null>(null);

    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    
    // Company Docs State
    const [companyDocs, setCompanyDocs] = useState<any[]>([]);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [docForm, setDocForm] = useState({ title: '', url: '' });
    const [isSavingDoc, setIsSavingDoc] = useState(false);

    // Estimate Filter State
    const [estimateFilter, setEstimateFilter] = useState('all'); // all, this_month, last_month, ytd, last_year

    // Week Picker State
    const [isWeekPickerOpen, setIsWeekPickerOpen] = useState(false);
    const [weekPickerAnchor, setWeekPickerAnchor] = useState<'mobile' | 'desktop'>('desktop');
    const weekOptions = useMemo(() => generateWeeksForPicker(), [currentWeekDate]);

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
    
    // Debounce ref to prevent rapid re-fetches
    const fetchDebounceRef = useRef<NodeJS.Timeout | null>(null);
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

    const [snapshotView, setSnapshotView] = useState<'all' | 'self'>('self');

    // Determine Weekly Snapshot Scope
    const weeklySnapshotScope = useMemo(() => {
        if (isSuperAdmin) return 'all';
        if (!permissions) return 'self';
        
        const dashboardPerm = permissions.modules.find((m: any) => m.module === MODULES.DASHBOARD);
        const widgetPerm = dashboardPerm?.fieldPermissions?.find((f: any) => f.field === 'widget_weekly_snapshot');
        return widgetPerm?.dataScope || 'self'; 
    }, [permissions, isSuperAdmin]);

    // Initialize snapshot view based on permissions (run only once when permissions are ready)
    const snapshotViewInitialized = useRef(false);
    useEffect(() => {
        if (permissionsReady && !snapshotViewInitialized.current) {
            snapshotViewInitialized.current = true;
            if (isSuperAdmin || weeklySnapshotScope === 'all') {
                setSnapshotView('all');
            } else {
                setSnapshotView('self');
            }
        }
    }, [permissionsReady, isSuperAdmin, weeklySnapshotScope]);

    const [taskView, setTaskView] = useState<'all' | 'self'>('self');

    // Determine Tasks Scope
    const tasksScope = useMemo(() => {
        if (isSuperAdmin) return 'all';
        if (!permissions) return 'self';
        
        const dashboardPerm = permissions.modules.find((m: any) => m.module === MODULES.DASHBOARD);
        const widgetPerm = dashboardPerm?.fieldPermissions?.find((f: any) => f.field === 'widget_tasks');
        return widgetPerm?.dataScope || 'self'; 
    }, [permissions, isSuperAdmin]);

    // Initialize task view based on permissions (run only once when permissions are ready)
    const taskViewInitialized = useRef(false);
    useEffect(() => {
        if (permissionsReady && !taskViewInitialized.current) {
            taskViewInitialized.current = true;
            if (isSuperAdmin || tasksScope === 'all') {
                setTaskView('all');
            } else {
                setTaskView('self');
            }
        }
    }, [permissionsReady, isSuperAdmin, tasksScope]);
    // const [chatFilter, setChatFilter] = useState(''); // Removed, using tagFilters and local state

    const [selectedDetailSchedule, setSelectedDetailSchedule] = useState<Schedule | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [mediaModalContent, setMediaModalContent] = useState<{ type: 'image' | 'map', url: string, title: string }>({ type: 'image', url: '', title: '' });
    const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
    // Chat input is uncontrolled (ref-based) for performance — no state here
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    
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

    // Chat States
    const [messages, setMessages] = useState<any[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [referenceQuery, setReferenceQuery] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [showReferences, setShowReferences] = useState(false);
    const [cursorPosition, setCursorPosition] = useState(0); 
    const [chatFilterValue, setChatFilterValue] = useState(''); 
    const [tagFilters, setTagFilters] = useState<{type: 'user'|'estimate', value: string, label: string}[]>([]);
    const [chatAssignees, setChatAssignees] = useState<string[]>([]);
    const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
    const [chatEstimate, setChatEstimate] = useState<{value: string, label: string} | null>(null);
    const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
    const [editingMsgText, setEditingMsgText] = useState('');
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [longPressMsgId, setLongPressMsgId] = useState<string | null>(null);
    
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const dismissLongPress = () => {
        setLongPressMsgId(null);
    };
    const chatUserScrolledUp = useRef(false);
    const chatInitialLoad = useRef(true);
    const [activeEmailType, setActiveEmailType] = useState<'jha' | 'djt'>('jha');

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
        
        const unitHoursType = type === 'Dump Washout' ? 0.50 : 0.25;
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
                clockIn: now,
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
                : 'Drive Time is paid at 1.1 minute per mile (55mph). Are you eligible for Drive Time today? Location must be turned on.',
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

    // Chat Functions
    const fetchChatMessages = useCallback(async () => {
        try {
            let url = '/api/chat?limit=50';
            if (chatFilterValue) {
                url += `&filter=${encodeURIComponent(chatFilterValue)}`;
            }
            if (tagFilters.length > 0) {
                 const estTag = tagFilters.find(t => t.type === 'estimate');
                 if (estTag) {
                     url += `&estimate=${encodeURIComponent(estTag.value)}`;
                 }
            }
            
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setMessages(data.messages);
                // Only auto-scroll on initial load or if user is already at the bottom
                if (chatInitialLoad.current || !chatUserScrolledUp.current) {
                    setTimeout(() => {
                        if (chatScrollRef.current) {
                            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                        }
                    }, 100);
                }
                chatInitialLoad.current = false;
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

    const handleChatInput = (e: React.ChangeEvent<any>) => {
        const val = e.target.value;
        
        const cursor = e.target.selectionStart || 0;
        setCursorPosition(cursor);
        
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
        
        const val = chatInputRef.current.value || '';
        const textBefore = val.slice(0, cursorPosition);
        const textAfter = val.slice(cursorPosition);
        
        const lastWordStart = textBefore.lastIndexOf(type === 'mention' ? '@' : '#');
        
        if (lastWordStart >= 0) {
            const newTextBefore = textBefore.slice(0, lastWordStart) + tag + ' ';
            chatInputRef.current.value = newTextBefore + textAfter;
            setShowMentions(false);
            setShowReferences(false);
            chatInputRef.current.focus();
        }
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const currentMessage = chatInputRef.current?.value || '';
        if (!currentMessage.trim()) return;

        const estimateMatch = currentMessage.match(/#(\d+[-A-Za-z0-9]*)/);
        const extractedEstimate = estimateMatch ? estimateMatch[1] : undefined;

        const safeAssignees = chatAssignees.map(val => {
            const emailStr = typeof val === 'string' ? val : (val as any)?.email || '';
            if (!emailStr) return { email: '', name: 'Unknown' };
            const emp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === emailStr.toLowerCase());
            return {
                email: emailStr,
                name: emp?.label || emailStr
            };
        }).filter(a => a.email);

        const optimisticMsg: any = {
            _id: `temp-${Date.now()}`,
            sender: userEmail,
            message: currentMessage,
            estimate: extractedEstimate,
            assignees: safeAssignees,
            replyTo: replyingTo ? {
                _id: replyingTo._id,
                sender: replyingTo.sender,
                message: replyingTo.message
            } : undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, optimisticMsg]);
        if (chatInputRef.current) {
            chatInputRef.current.value = '';
            (chatInputRef.current as any).style.height = '42px';
        }
        setChatAssignees([]);
        setReplyingTo(null);
        
        // Reset scroll tracking - user just sent a message, scroll to bottom
        chatUserScrolledUp.current = false;
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
                    estimate: chatEstimate?.value || extractedEstimate,
                    assignees: safeAssignees,
                    replyTo: optimisticMsg.replyTo
                })
            });
            setChatEstimate(null); // Reset after send

            // Auto-create a To Do task if employees were tagged
            if (safeAssignees.length > 0) {
                try {
                    // Look up estimate details if one was tagged
                    const taggedEstimate = chatEstimate?.value || extractedEstimate;
                    let estimateFields: any = {};
                    if (taggedEstimate) {
                        const estObj = initialData.estimates?.find((e: any) => e.value === taggedEstimate);
                        if (estObj) {
                            estimateFields = {
                                estimate: estObj.value,
                                customerId: estObj.customerId || '',
                                customerName: estObj.customerName || '',
                                jobAddress: estObj.jobAddress || ''
                            };
                        } else {
                            estimateFields = { estimate: taggedEstimate };
                        }
                    }

                    const taskRes = await fetch('/api/tasks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            task: currentMessage.replace(/@\S+/g, '').replace(/#\S+/g, '').trim() || currentMessage,
                            status: 'todo',
                            assignees: safeAssignees.map((a: any) => a.email),
                            createdBy: userEmail || 'System',
                            ...estimateFields
                        })
                    });
                    if (taskRes.ok) {
                        const taskData = await taskRes.json();
                        if (taskData.task) {
                            setTodos(prev => [taskData.task, ...prev]);
                        }
                    }
                } catch (taskErr) {
                    console.error('Auto-task creation failed:', taskErr);
                }
            }

            fetchChatMessages();
        } catch (error) {
            console.error('Failed to send', error);
            showError('Failed to send message');
        }
    };

    const handleUpdateMessage = async (id: string, text: string) => {
        if (!text.trim()) return;
        try {
            const res = await fetch(`/api/chat/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();
            if (data.success) {
                setMessages(prev => prev.map(m => m._id === id ? { ...m, message: text } : m));
                setEditingMsgId(null);
                setEditingMsgText('');
            } else {
                console.error('Update failed:', data.error);
                showError(data.error || 'Failed to update');
            }
        } catch (error) {
            console.error('Update error:', error);
            showError('Operation failed');
        }
    };

    const handleDeleteMessage = async (id: string) => {
        try {
            const res = await fetch(`/api/chat/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setMessages(prev => prev.filter(m => m._id !== id));
            } else {
                console.error('Delete failed:', data.error);
                showError(data.error || 'Failed to delete');
            }
        } catch (error) {
            console.error('Failed to delete', error);
            showError('Failed to delete message');
        }
    };

    const filteredEmployees = useMemo(() => {
        if (!mentionQuery) return initialData.employees.slice(0, 5);
        return initialData.employees.filter((e: any) => 
            (e.label || e.value).toLowerCase().includes(mentionQuery.toLowerCase())
        ).slice(0, 5);
    }, [mentionQuery, initialData.employees]);

    const employeeOptions = useMemo(() => initialData.employees.map((emp: any) => ({
        id: emp.value,
        label: emp.label,
        value: emp.value,
        profilePicture: emp.image
    })), [initialData.employees]);

    const filteredEstimates = useMemo(() => {
        if (!referenceQuery) return initialData.estimates.slice(0, 5);
        return initialData.estimates.filter((e: any) => 
            (e.value || '' + e.estimate).toLowerCase().includes(referenceQuery.toLowerCase()) || 
            (e.projectTitle || '').toLowerCase().includes(referenceQuery.toLowerCase())
        ).slice(0, 5);
    }, [referenceQuery, initialData.estimates]);

    const filteredEmployeeOptions = useMemo(() => {
        const source = initialData.employees;
        const filtered = !mentionQuery 
            ? source.slice(0, 100) 
            : source.filter((e: any) => (e.label || e.value).toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 50);
            
        return filtered.map((emp: any) => ({
            id: emp.value,
            label: emp.label,
            value: emp.value,
            profilePicture: emp.image
        }));
    }, [mentionQuery, initialData.employees]);

    const estimateOptions = useMemo(() => {
        return initialData.estimates.map((est: any) => ({
            id: est._id || est.value,
            label: `${est.value || est.estimate} - ${est.projectTitle || 'Untitled'}`,
            value: est.value || est.estimate,
            badge: est.customerName
        }));
    }, [initialData.estimates]);

    const filteredEstimateOptions = useMemo(() => {
        if (!referenceQuery) return estimateOptions.slice(0, 50); // Show more by default
        return estimateOptions.filter((o: any) => 
            o.label.toLowerCase().includes(referenceQuery.toLowerCase()) || 
            (o.badge || '').toLowerCase().includes(referenceQuery.toLowerCase())
        ).slice(0, 50);
    }, [referenceQuery, estimateOptions]);


    // Ref for aborting stale fetch requests
    const fetchAbortRef = useRef<AbortController | null>(null);

    // Fetch Data - Optimized with parallel API calls
    const fetchDashboardData = useCallback(async () => {
        // Don't fetch until permissions are ready to avoid wasted requests
        if (!permissionsReady) return;
        
        // Abort any previous in-flight request
        if (fetchAbortRef.current) {
            fetchAbortRef.current.abort();
        }
        const abortController = new AbortController();
        fetchAbortRef.current = abortController;

        setLoading(true);
        try {
            // Use the pre-computed ISO strings to avoid timezone issues
            const startStr = weekRange.startISO;
            const endStr = weekRange.endISO;
            
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
                    break;
            }

            // Execute ALL API calls in parallel for maximum speed
            const [schedRes, estRes, tasksRes] = await Promise.all([
                // Schedules API
                fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'getSchedulesPage',
                        payload: { 
                            startDate: startStr,
                            endDate: endStr,
                            page: 1,
                            limit: 100,
                            skipInitialData: initialData.employees.length > 0,
                            userEmail: scheduleView === 'self' ? userEmail : undefined
                        }
                    }),
                    signal: abortController.signal
                }),
                // Estimate Stats API
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'getEstimateStats',
                        payload: { startDate: estStart, endDate: estEnd }
                    }),
                    signal: abortController.signal
                }),
                // Tasks API
                fetch('/api/tasks', { signal: abortController.signal })
            ]);

            // Check if aborted before processing
            if (abortController.signal.aborted) return;

            // Process schedules response
            if (schedRes.headers.get('content-type')?.includes('application/json')) {
                const schedData = await schedRes.json();
                if (schedData.success) {
                    const scheds = schedData.result?.schedules || [];
                    setSchedules(scheds);
                    if (schedData.result?.initialData) {
                        setInitialData(schedData.result.initialData);
                    }
                }
            }

            // Process estimate stats response
            if (estRes.headers.get('content-type')?.includes('application/json')) {
                const estData = await estRes.json();
                if (estData.success && estData.result?.length > 0) {
                    const merged = estData.result.reduce((acc: any[], curr: any) => {
                        let status = curr.status;
                        const lower = status.toLowerCase();
                        if (lower === 'pending' || lower === 'in progress') {
                            status = 'Pending';
                        } else {
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
                    setEstimateStats([
                        { status: 'Pending', count: 12, total: 87936000 },
                        { status: 'Won', count: 8, total: 6056000 },
                        { status: 'Completed', count: 15, total: 2274000 },
                        { status: 'Lost', count: 3, total: 402000 },
                    ]);
                }
            }
            
            // Process tasks response
            if (tasksRes.headers.get('content-type')?.includes('application/json')) {
                const tasksData = await tasksRes.json();
                if (tasksData.success) {
                    setTodos(tasksData.tasks);
                }
            }
            
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                return; // Silent abort - no logging needed
            }
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [weekRange, scheduleView, userEmail, estimateFilter, initialData.employees.length, permissionsReady]);

    // Debounced fetch trigger to prevent rapid re-fetches
    useEffect(() => {
        // Clear any pending debounce
        if (fetchDebounceRef.current) {
            clearTimeout(fetchDebounceRef.current);
        }
        
        // Debounce the fetch by 50ms to batch rapid state changes
        fetchDebounceRef.current = setTimeout(() => {
            fetchDashboardData();
        }, 50);
        
        return () => {
            if (fetchDebounceRef.current) {
                clearTimeout(fetchDebounceRef.current);
            }
        };
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
            t._id === todoId ? { ...t, status: newStatus as TodoItem['status'], lastUpdatedAt: new Date().toISOString() } : t
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
        setTodos(prev => prev.map(t => t._id === item._id ? { ...t, status: newStatus, lastUpdatedAt: new Date().toISOString() } : t));
        
        try {
            const res = await fetch('/api/tasks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item._id, status: newStatus, lastUpdatedBy: userEmail || 'System' })
            });

            if (!res.ok) {
                const data = await res.json();
                // Revert on error
                setTodos(prev => prev.map(t => t._id === item._id ? item : t));
                showError(data.error || 'Failed to update status');
            } else {
                success('Status updated');
            }
        } catch (err: any) {
            setTodos(prev => prev.map(t => t._id === item._id ? item : t));
            showError(err.message || 'Failed to update status');
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
        
        console.log('DEBUG: Attempting to delete task:', id);
        console.log('DEBUG: Current userEmail:', userEmail);

        if (!window.confirm('Are you sure you want to delete this task?')) return;
        
        try {
            console.log('DEBUG: Sending DELETE request for task:', id);
            const res = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            
            if (res.ok) {
                setTodos(prev => prev.filter(t => t._id !== id));
                success('Task deleted successfully');
            } else {
                console.error('DEBUG: Delete failed:', data.error);
                showError(data.error || 'Failed to delete task');
            }
        } catch (err: any) {
            console.error('DEBUG: Delete error:', err);
            showError(err.message || 'Failed to delete task');
        }
    };

    const handleSaveTask = async (taskData: Partial<TodoItem>) => {
        try {
            const isCopy = !editingTask?._id;
            const method = isCopy ? 'POST' : 'PATCH';
            
            // Clean up the data to avoid 500 errors (e.g. empty strings for Dates)
            const cleanedData = { ...taskData };
            if (!cleanedData.dueDate || cleanedData.dueDate.trim() === '') {
                delete cleanedData.dueDate;
            }
            if (!cleanedData.assignees) cleanedData.assignees = [];

            const body = !isCopy 
                ? { ...cleanedData, id: editingTask?._id, lastUpdatedBy: userEmail || 'System' } 
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

    // Company Docs Handlers
    const handleSaveDoc = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docForm.title || !docForm.url) {
            showError('Please provide both title and document');
            return;
        }

        setIsSavingDoc(true);
        try {
            const res = await fetch('/api/company-docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: docForm.title,
                    url: docForm.url,
                    uploadedBy: userEmail
                })
            });

            const data = await res.json();
            if (data.success) {
                setCompanyDocs(prev => [data.doc, ...prev]);
                success('Document added successfully');
                setIsDocModalOpen(false);
                setDocForm({ title: '', url: '' });
            } else {
                showError(data.error || 'Failed to save document');
            }
        } catch (error) {
            showError('Error saving document');
        } finally {
            setIsSavingDoc(false);
        }
    };

    const handleDeleteDoc = async (id: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return;
        
        try {
            const res = await fetch(`/api/company-docs?id=${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                setCompanyDocs(prev => prev.filter(d => d._id !== id));
                success('Document deleted');
            } else {
                showError('Failed to delete document');
            }
        } catch (error) {
            showError('Error deleting document');
        }
    };

    // Filtered todos by status
    // Filtered todos by status
    const todosByStatus = useMemo(() => {
        const lowerEmail = userEmail.toLowerCase().trim();
        const filteredTodos = todos.filter(t => {
            if (taskView === 'self') {
                const isCreator = t.createdBy?.toLowerCase().trim() === lowerEmail;
                const isAssignee = t.assignees?.some(email => email.toLowerCase().trim() === lowerEmail);
                return isCreator || isAssignee;
            }
            return true;
        });

        return {
            todo: filteredTodos.filter(t => t.status === 'todo'),
            'in progress': filteredTodos.filter(t => t.status === 'in progress' || t.status === ('in-progress' as any)),
            done: filteredTodos.filter(t => {
                if (t.status !== 'done') return false;
                if (!t.lastUpdatedAt) return true; // Show if no timestamp info
                const doneDate = new Date(t.lastUpdatedAt);
                return doneDate >= weekRange.start && doneDate <= weekRange.end;
            })
        };
    }, [todos, weekRange, taskView, userEmail]);

    // Weekly Snapshot computed data (filtered by snapshotView)
    const snapshotSchedules = useMemo(() => {
        if (snapshotView === 'all') return schedules;
        const lowerEmail = userEmail.toLowerCase().trim();
        return schedules.filter(s => 
            s.assignees?.some((a: string) => a.toLowerCase().trim() === lowerEmail) ||
            s.foremanName?.toLowerCase().trim() === lowerEmail ||
            s.projectManager?.toLowerCase().trim() === lowerEmail
        );
    }, [schedules, snapshotView, userEmail]);

    const snapshotTimeCardTotals = useMemo(() => {
        if (snapshotView === 'all') {
            // Sum ALL timesheets across all schedules
            let drive = 0;
            let site = 0;
            schedules.forEach(schedule => {
                schedule.timesheet?.forEach((ts: any) => {
                    const { hours } = calculateTimesheetData(ts, schedule.fromDate);
                    if (ts.type?.toLowerCase().includes('drive')) {
                        drive += hours;
                    } else {
                        site += hours;
                    }
                });
            });
            return { drive, site };
        }
        // 'self' - use existing dashboardTimeCards which are already filtered to current user
        return timeCardTotals;
    }, [snapshotView, schedules, timeCardTotals]);

    const snapshotTodos = useMemo(() => {
        const lowerEmail = userEmail.toLowerCase().trim();
        const filteredTodos = todos.filter(t => {
            if (snapshotView === 'self') {
                const isCreator = t.createdBy?.toLowerCase().trim() === lowerEmail;
                const isAssignee = t.assignees?.some(email => email.toLowerCase().trim() === lowerEmail);
                return isCreator || isAssignee;
            }
            return true;
        });

        const done = filteredTodos.filter(t => {
            if (t.status !== 'done') return false;
            if (!t.lastUpdatedAt) return true;
            const doneDate = new Date(t.lastUpdatedAt);
            return doneDate >= weekRange.start && doneDate <= weekRange.end;
        });
        const total = filteredTodos.length;
        return { done: done.length, total };
    }, [todos, snapshotView, userEmail, weekRange]);

    // Time Cards widget: scoped data based on timeCardsView
    const tcWidgetTimeCards = useMemo(() => {
        if (timeCardsView === 'self') return dashboardTimeCards;
        // 'all' - gather ALL timesheets from all schedules
        const allTimesheets: any[] = [];
        schedules.forEach(schedule => {
            schedule.timesheet?.forEach((ts: any) => {
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
    }, [timeCardsView, dashboardTimeCards, schedules]);

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
        <div className="flex flex-col h-full bg-slate-50">
            <Header 
                hideLogo={false}
                centerContent={
                    <div className="flex xl:hidden items-center gap-1 bg-white rounded-xl px-2 py-1.5 shadow-sm border border-slate-200 relative">
                        <button 
                            onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, -1))}
                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button 
                            id="week-picker-trigger-mobile"
                            onClick={() => {
                                setWeekPickerAnchor('mobile');
                                setIsWeekPickerOpen(!isWeekPickerOpen);
                            }}
                            className="px-2 py-0.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1"
                            title="Click to select week"
                        >
                            <span className="font-bold text-sm text-slate-800 tabular-nums">{weekRange.label}</span>
                            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isWeekPickerOpen ? 'rotate-180' : ''}`} />
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
                    <>
                        <div className="hidden xl:flex items-center gap-1 bg-white rounded-xl px-2 py-1.5 shadow-sm border border-slate-200 relative">
                            <button 
                                onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, -1))}
                                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button 
                                id="week-picker-trigger-desktop"
                                onClick={() => {
                                    setWeekPickerAnchor('desktop');
                                    setIsWeekPickerOpen(!isWeekPickerOpen);
                                }}
                                className="px-2 py-0.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1"
                                title="Click to select week"
                            >
                                <span className="font-bold text-sm text-slate-800 tabular-nums">{weekRange.label}</span>
                                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isWeekPickerOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <button 
                                onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, 1))}
                                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        <button
                            onClick={() => setCurrentWeekDate(new Date())}
                            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#0F4C75] bg-[#0F4C75]/10 hover:bg-[#0F4C75]/20 rounded-lg transition-colors"
                            title="Go to Today"
                        >
                            Go to Today
                        </button>
                    </>
                }
            />

            {/* Single Week Picker Dropdown - rendered once and positioned to the clicked trigger */}
            <MyDropDown
                isOpen={isWeekPickerOpen}
                onClose={() => setIsWeekPickerOpen(false)}
                anchorId={weekPickerAnchor === 'desktop' ? "week-picker-trigger-desktop" : "week-picker-trigger-mobile"}
                positionMode="bottom"
                options={weekOptions.map(w => ({
                    id: w.id,
                    label: w.label,
                    value: w.value,
                    badge: String(w.weekNum).padStart(2, '0'),
                    color: w.isCurrentWeek ? '#10b981' : '#0F4C75'
                }))}
                selectedValues={[weekRange.label]}
                onSelect={(value) => {
                    const selected = weekOptions.find(w => w.value === value);
                    if (selected) {
                        setCurrentWeekDate(selected.startDate);
                    }
                    setIsWeekPickerOpen(false);
                }}
                placeholder="Search weeks..."
                emptyMessage="No weeks found"
                width="w-80"
                hideSelectionIndicator={true}
            />

            <div className={`flex-1 min-h-0 ${searchParams.get('view') ? 'overflow-hidden lg:overflow-y-auto' : 'overflow-y-auto'} lg:p-4 pb-0`}>
                <div className={`max-w-[1800px] mx-auto w-full ${searchParams.get('view') === 'chat' ? 'h-full lg:h-auto' : ''}`}>
                    
                    {/* Main Grid */}
                    <div className={`grid grid-cols-12 gap-4 ${searchParams.get('view') === 'chat' ? 'h-full lg:h-auto overflow-hidden lg:overflow-visible' : ''}`}>
                        
                        {/* Left Column - Main Content */}
                        <div className={`col-span-12 xl:col-span-9 space-y-4 ${searchParams.get('view') && !['tasks', 'training'].includes(searchParams.get('view')!) ? 'hidden lg:block' : ''}`}>
                            
                            {/* Tasks Kanban */}
                            <div className={`${searchParams.get('view') === 'tasks' ? 'block' : 'hidden xl:block'} bg-white rounded-2xl border border-slate-200 shadow-sm p-3`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center">
                                            <CheckCircle2 className="w-4 h-4 text-rose-600" />
                                        </div>
                                        <h2 className="text-sm font-bold text-slate-900">Tasks</h2>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {tasksScope === 'all' && (
                                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                                <button 
                                                    onClick={() => setTaskView('self')}
                                                    className={`px-3 py-1.5 text-[10px] md:text-md font-bold md:font-medium rounded-md transition-colors ${
                                                        taskView === 'self' 
                                                            ? 'bg-white text-blue-600 shadow-sm' 
                                                            : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                                >
                                                    Self
                                                </button>
                                                <button 
                                                    onClick={() => setTaskView('all')}
                                                    className={`px-3 py-1.5 text-[10px] md:text-md font-bold md:font-medium rounded-md transition-colors ${
                                                        taskView === 'all' 
                                                            ? 'bg-white text-blue-600 shadow-sm' 
                                                            : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                                >
                                                    All
                                                </button>
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => handleOpenTaskModal()}
                                            className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-95"
                                            title="New Task"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="hidden lg:flex gap-4 overflow-x-auto">
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
                                        employees={initialData.employees}
                                        currentUserEmail={userEmail}
                                        isSuperAdmin={isSuperAdmin}
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
                                        employees={initialData.employees}
                                        currentUserEmail={userEmail}
                                        isSuperAdmin={isSuperAdmin}
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
                                        employees={initialData.employees}
                                        currentUserEmail={userEmail}
                                        isSuperAdmin={isSuperAdmin}
                                    />
                                </div>
                                
                                {/* Mobile Accordion View */}
                                <div className="lg:hidden mt-2">
                                    <ClientOnly>
                                        <Accordion type="multiple" className="space-y-4">
                                        <AccordionItem value="todo" className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                                            <AccordionTrigger className="hover:no-underline py-4 px-4 bg-slate-50/50">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-400 shadow-sm" />
                                                    <span className="font-bold text-slate-800">To Do</span>
                                                    <Badge variant="default" className="ml-2 text-[11px] font-black">{todosByStatus.todo.length}</Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-2 px-2 pb-3 bg-white">
                                                <div className="space-y-2">
                                                    {todosByStatus.todo.length > 0 ? (
                                                        todosByStatus.todo.map(item => (
                                                            <div key={item._id} onClick={() => handleOpenTaskModal(item)} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                                                                <div className="flex justify-between items-start gap-3">
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-bold text-slate-800 leading-tight">{item.task}</p>
                                                                            {item.dueDate && (
                                                                                <div className="flex items-center gap-1.5 mt-2">
                                                                                    <Clock size={10} className="text-slate-400" />
                                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Due {new Date(item.dueDate).toLocaleDateString()}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-3 shrink-0">
                                                                            <div className="flex -space-x-1.5">
                                                                                {item.assignees?.map((email, idx) => {
                                                                                    const emp = initialData.employees.find((e: any) => e.value === email);
                                                                                    const name = emp?.label || email;
                                                                                    const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
                                                                                    return (
                                                                                        <Avatar key={idx} className="w-6 h-6 border-2 border-white ring-1 ring-slate-100">
                                                                                            <AvatarImage src={emp?.image} />
                                                                                            <AvatarFallback className="text-[8px] bg-slate-50 font-bold">{initials}</AvatarFallback>
                                                                                        </Avatar>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); handleStatusChange(item, 'in progress'); }}
                                                                                className="p-2 bg-white border border-slate-200 rounded-xl text-blue-500 shadow-sm active:scale-90 transition-transform"
                                                                            >
                                                                                <ActivityIcon size={14} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-center py-6 text-xs text-slate-400 font-medium italic">No pending tasks</p>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>

                                        <AccordionItem value="in-progress" className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                                            <AccordionTrigger className="hover:no-underline py-4 px-4 bg-blue-50/30">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
                                                    <span className="font-bold text-slate-800">In Progress</span>
                                                    <Badge variant="default" className="ml-2 text-[11px] font-black">{todosByStatus['in progress'].length}</Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-2 px-2 pb-3 bg-white">
                                                <div className="space-y-2">
                                                    {todosByStatus['in progress'].length > 0 ? (
                                                        todosByStatus['in progress'].map(item => (
                                                            <div key={item._id} onClick={() => handleOpenTaskModal(item)} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors">
                                                                <div className="flex justify-between items-start gap-3">
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-bold text-slate-800 leading-tight">{item.task}</p>
                                                                            {item.dueDate && (
                                                                                <div className="flex items-center gap-1.5 mt-2">
                                                                                    <Clock size={10} className="text-slate-400" />
                                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Due {new Date(item.dueDate).toLocaleDateString()}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-3 shrink-0">
                                                                            <div className="flex -space-x-1.5">
                                                                                {item.assignees?.map((email, idx) => {
                                                                                    const emp = initialData.employees.find((e: any) => e.value === email);
                                                                                    const name = emp?.label || email;
                                                                                    const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
                                                                                    return (
                                                                                        <Avatar key={idx} className="w-6 h-6 border-2 border-white ring-1 ring-slate-100">
                                                                                            <AvatarImage src={emp?.image} />
                                                                                            <AvatarFallback className="text-[8px] bg-slate-50 font-bold">{initials}</AvatarFallback>
                                                                                        </Avatar>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); handleStatusChange(item, 'done'); }}
                                                                                className="p-2 bg-white border border-slate-200 rounded-xl text-emerald-500 shadow-sm active:scale-90 transition-transform"
                                                                            >
                                                                                <ActivityIcon size={14} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-center py-6 text-xs text-slate-400 font-medium italic">Nothing in progress</p>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>

                                        <AccordionItem value="done" className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                                            <AccordionTrigger className="hover:no-underline py-4 px-4 bg-emerald-50/30">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                                                    <span className="font-bold text-slate-800">Done</span>
                                                    <Badge variant="default" className="ml-2 text-[11px] font-black">{todosByStatus.done.length}</Badge>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-2 px-2 pb-3 bg-white">
                                                <div className="space-y-2">
                                                    {todosByStatus.done.length > 0 ? (
                                                        todosByStatus.done.map(item => (
                                                            <div key={item._id} onClick={() => handleOpenTaskModal(item)} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 hover:border-emerald-200 transition-colors">
                                                                <div className="flex justify-between items-start gap-3">
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-bold text-slate-800 leading-tight line-through decoration-slate-300 decoration-2">{item.task}</p>
                                                                            {item.dueDate && (
                                                                                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter mt-2">Completed</p>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-3 shrink-0">
                                                                            <div className="flex -space-x-1.5">
                                                                                {item.assignees?.map((email, idx) => {
                                                                                    const emp = initialData.employees.find((e: any) => e.value === email);
                                                                                    const name = emp?.label || email;
                                                                                    const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
                                                                                    return (
                                                                                        <Avatar key={idx} className="w-6 h-6 border-2 border-white ring-1 ring-slate-100">
                                                                                            <AvatarImage src={emp?.image} alt={name} />
                                                                                            <AvatarFallback className="text-[8px] bg-slate-50 font-bold">{initials}</AvatarFallback>
                                                                                        </Avatar>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                            <button 
                                                                                onClick={(e) => { e.stopPropagation(); handleStatusChange(item, 'todo'); }}
                                                                                className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 shadow-sm active:scale-90 transition-transform"
                                                                            >
                                                                                <ActivityIcon size={14} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-center py-6 text-xs text-slate-400 font-medium italic">No items completed this week</p>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                    </ClientOnly>
                                </div>
                            </div>

                            {/* Upcoming Schedules */}
                            <div className={`${searchParams.get('view') ? 'hidden lg:block' : 'block'} bg-transparent lg:bg-white lg:rounded-2xl lg:border lg:border-slate-200 lg:shadow-sm overflow-hidden`}>
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
                                            <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                            <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-cols-3 gap-4 pb-20 lg:pb-0">
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
                                                        onEdit={canField(MODULES.DASHBOARD, 'widget_upcoming_schedules', 'update') ? () => {
                                                            setEditingSchedule(schedule);
                                                            setEditScheduleOpen(true);
                                                        } : undefined}
                                                        onCopy={canField(MODULES.DASHBOARD, 'widget_upcoming_schedules', 'create') ? () => {
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
                                                    } : undefined}
                                                    onDelete={canField(MODULES.DASHBOARD, 'widget_upcoming_schedules', 'delete') ? () => {
                                                        setDeleteScheduleId(schedule._id);
                                                        setIsDeleteConfirmOpen(true);
                                                    } : undefined}
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
                                                            jhaTime: new Date().toLocaleTimeString('en-US', { hour12: false }),
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
                                                                // Ensure we pass the schedule_id if it's missing in djt object (for safety)
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
                            <div className={`${searchParams.get('view') === 'training' ? 'grid' : 'hidden md:grid'} grid-cols-1 lg:grid-cols-2 gap-4`}>
                                
                                {/* Estimate Stats Pie Chart */}
                                {canField(MODULES.DASHBOARD, 'widget_estimates_overview', 'view') && (
                                <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 ${searchParams.get('view') === 'training' ? 'hidden lg:block' : ''}`}>
                                    <div className="flex items-center gap-3 mb-4 justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                                <TrendingUp className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <h2 className="font-bold text-slate-900">Estimates Overview</h2>

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
                                )}

                                {/* Weekly Snapshot KPIs */}
                                {canField(MODULES.DASHBOARD, 'widget_weekly_snapshot', 'view') && (
                                <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 ${searchParams.get('view') === 'training' ? 'hidden lg:block' : ''}`}>
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                                                <ActivityIcon className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h2 className="font-bold text-slate-900">Weekly Snapshot</h2>
                                            </div>
                                        </div>
                                        {weeklySnapshotScope === 'all' && (
                                            <div className="flex bg-slate-200/50 md:bg-slate-100 rounded-lg p-0.5">
                                                <button 
                                                    onClick={() => setSnapshotView('self')}
                                                    className={`px-3 py-1.5 text-[10px] md:text-xs font-bold md:font-medium rounded-md transition-colors ${
                                                        snapshotView === 'self' 
                                                            ? 'bg-white text-blue-600 shadow-sm' 
                                                            : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                                >
                                                    Self
                                                </button>
                                                <button 
                                                    onClick={() => setSnapshotView('all')}
                                                    className={`px-3 py-1.5 text-[10px] md:text-xs font-bold md:font-medium rounded-md transition-colors ${
                                                        snapshotView === 'all' 
                                                            ? 'bg-white text-blue-600 shadow-sm' 
                                                            : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                                >
                                                    All
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Total Jobs */}
                                        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-3.5 border border-blue-100/80">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500/80">Jobs</span>
                                            </div>
                                            <p className="text-2xl font-black text-slate-800 leading-none">{snapshotSchedules.length}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">Scheduled this week</p>
                                            <div className="absolute -right-2 -bottom-2 w-12 h-12 rounded-full bg-blue-200/30" />
                                        </div>

                                        {/* Active Crew */}
                                        <div className="relative overflow-hidden bg-gradient-to-br from-violet-50 to-violet-100/50 rounded-xl p-3.5 border border-violet-100/80">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Users className="w-3.5 h-3.5 text-violet-500" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-500/80">Crew</span>
                                            </div>
                                            <p className="text-2xl font-black text-slate-800 leading-none">
                                                {(() => {
                                                    const uniqueCrew = new Set<string>();
                                                    snapshotSchedules.forEach(s => {
                                                        s.assignees?.forEach((a: string) => uniqueCrew.add(a.toLowerCase()));
                                                    });
                                                    return uniqueCrew.size;
                                                })()}
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-1">Active personnel</p>
                                            <div className="absolute -right-2 -bottom-2 w-12 h-12 rounded-full bg-violet-200/30" />
                                        </div>

                                        {/* Total Hours */}
                                        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl p-3.5 border border-emerald-100/80">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500/80">Hours</span>
                                            </div>
                                            <p className="text-2xl font-black text-slate-800 leading-none">{(snapshotTimeCardTotals.drive + snapshotTimeCardTotals.site).toFixed(1)}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[9px] font-bold text-blue-500">{snapshotTimeCardTotals.drive.toFixed(1)}h drive</span>
                                                <span className="text-[9px] text-slate-300">•</span>
                                                <span className="text-[9px] font-bold text-emerald-500">{snapshotTimeCardTotals.site.toFixed(1)}h site</span>
                                            </div>
                                            <div className="absolute -right-2 -bottom-2 w-12 h-12 rounded-full bg-emerald-200/30" />
                                        </div>

                                        {/* Task Completion */}
                                        <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-xl p-3.5 border border-amber-100/80">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80">Tasks</span>
                                            </div>
                                            <p className="text-2xl font-black text-slate-800 leading-none">
                                                {snapshotTodos.done}
                                                <span className="text-sm font-bold text-slate-400 ml-0.5">/{snapshotTodos.total}</span>
                                            </p>
                                            <div className="w-full bg-amber-200/40 rounded-full h-1.5 mt-2">
                                                <div 
                                                    className="bg-gradient-to-r from-amber-400 to-amber-500 h-1.5 rounded-full transition-all duration-700"
                                                    style={{ 
                                                        width: `${Math.round((snapshotTodos.done / Math.max(snapshotTodos.total, 1)) * 100)}%` 
                                                    }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-1">Completed this week</p>
                                            <div className="absolute -right-2 -bottom-2 w-12 h-12 rounded-full bg-amber-200/30" />
                                        </div>
                                    </div>
                                </div>
                                )}


                            </div>


                            <TaskFormModal 
                                isOpen={isTaskModalOpen}
                                onClose={() => setIsTaskModalOpen(false)}
                                onSave={handleSaveTask}
                                editingTask={editingTask}
                                employees={initialData.employees}
                                clients={initialData.clients || []}
                                estimates={initialData.estimates || []}
                                currentUserEmail={userEmail}
                                isSuperAdmin={isSuperAdmin}
                            />

                            {/* Time Cards - Weekly (Renamed & Table View) */}
                            {canField(MODULES.DASHBOARD, 'widget_time_cards', 'view') && (
                            <div className={`${searchParams.get('view') === 'time-cards' ? 'block' : 'hidden lg:block'} bg-white rounded-2xl border border-slate-200 shadow-sm p-3 lg:p-4 overflow-hidden`}>
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                                            <Clock className="w-5 h-5 text-teal-600" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-slate-900">Time Cards</h2>
                                        </div>
                                        {timeCardsWidgetScope === 'all' && (
                                            <div className="flex bg-slate-200/50 lg:bg-slate-100 rounded-lg p-0.5">
                                                <button 
                                                    onClick={() => setTimeCardsView('self')}
                                                    className={`px-3 py-1.5 text-[10px] lg:text-xs font-bold lg:font-medium rounded-md transition-colors ${
                                                        timeCardsView === 'self' 
                                                            ? 'bg-white text-blue-600 shadow-sm' 
                                                            : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                                >
                                                    Self
                                                </button>
                                                <button 
                                                    onClick={() => setTimeCardsView('all')}
                                                    className={`px-3 py-1.5 text-[10px] lg:text-xs font-bold lg:font-medium rounded-md transition-colors ${
                                                        timeCardsView === 'all' 
                                                            ? 'bg-white text-blue-600 shadow-sm' 
                                                            : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                                >
                                                    All
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 lg:gap-4 ml-1 lg:ml-0">
                                        <div className="flex flex-col lg:items-end">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Drive Time</span>
                                            <span className="text-sm font-black text-blue-600">{tcWidgetTotals.drive.toFixed(2)} hrs</span>
                                        </div>
                                        <div className="w-px h-8 bg-slate-100 hidden lg:block" />
                                        <div className="flex flex-col lg:items-end">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Site Time</span>
                                            <span className="text-sm font-black text-emerald-600">{tcWidgetTotals.site.toFixed(2)} hrs</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    {/* Drive Time Section */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 px-1">
                                            <Truck size={14} className="text-blue-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Drive Time</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <Table containerClassName="h-auto min-h-0 !border-none !shadow-none !bg-transparent" className="table-fixed w-full">
                                                <TableHead>
                                                    <TableRow className="hover:bg-transparent border-slate-100">
                                                        {timeCardsView === 'all' && <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-left align-middle" style={{width:'18%'}}>Employee</TableHeader>}
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '13%' : '18%'}}>Date</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '13%' : '18%'}}>Estimate</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '12%' : '16%'}}>Washout</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '12%' : '16%'}}>Shop</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '12%' : '16%'}}>Dist</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '8%' : '16%'}}>Hrs</TableHeader>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {tcWidgetTimeCards.filter(ts => ts.type?.toLowerCase().includes('drive')).length > 0 ? 
                                                        tcWidgetTimeCards.filter(ts => ts.type?.toLowerCase().includes('drive')).slice(0, 10).map((ts, idx) => (
                                                        <TableRow key={idx} className="hover:bg-slate-50">
                                                            {timeCardsView === 'all' && (
                                                                <TableCell className="text-left align-middle text-[11px] font-semibold text-slate-700 truncate max-w-[100px]">
                                                                    {(() => { const emp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === ts.employee?.toLowerCase()); return emp?.label || ts.employee?.split('@')[0] || '-'; })()}
                                                                </TableCell>
                                                            )}
                                                            <TableCell className="text-center align-middle text-[11px] font-medium text-slate-600">
                                                                {formatDateOnly(ts.clockIn)}
                                                            </TableCell>
                                                            <TableCell className="text-center align-middle">
                                                                <span className="text-[10px] font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 uppercase tracking-tighter">
                                                                    {ts.estimate ? ts.estimate.replace(/-[vV]\d+$/, '') : '-'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-center align-middle">
                                                                {ts.dumpWashout ? (
                                                                    <span className="text-[9px] font-black uppercase bg-orange-500 text-white px-2 py-0.5 rounded shadow-sm inline-flex items-center gap-1 justify-center">
                                                                        <span>Washout</span>
                                                                    </span>
                                                                ) : <span className="text-slate-300">-</span>}
                                                            </TableCell>
                                                            <TableCell className="text-center align-middle">
                                                                {ts.shopTime ? (
                                                                    <span className="text-[9px] font-black uppercase bg-blue-500 text-white px-2 py-0.5 rounded shadow-sm inline-flex items-center gap-1 justify-center">
                                                                        <span>Shop</span>
                                                                    </span>
                                                                ) : <span className="text-slate-300">-</span>}
                                                            </TableCell>
                                                            <TableCell className="text-center align-middle text-[11px] font-medium text-slate-600">
                                                                {(ts.distanceVal || 0) > 0 ? (ts.distanceVal).toFixed(1) : '-'}
                                                            </TableCell>
                                                            <TableCell className="text-center align-middle text-[11px] font-black text-slate-800">
                                                                {(ts.hoursVal || 0).toFixed(2)}
                                                            </TableCell>
                                                        </TableRow>
                                                    )) : (
                                                        <TableRow>
                                                            <TableCell colSpan={timeCardsView === 'all' ? 7 : 6} className="text-center py-4 text-xs text-slate-300 italic">No drive records</TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>

                                    {/* Site Time Section */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2 px-1">
                                            <MapPin size={14} className="text-emerald-500" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Site Time</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <Table containerClassName="h-auto min-h-0 !border-none !shadow-none !bg-transparent" className="table-fixed w-full">
                                                <TableHead>
                                                    <TableRow className="hover:bg-transparent border-slate-100">
                                                        {timeCardsView === 'all' && <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-left align-middle" style={{width:'18%'}}>Employee</TableHeader>}
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '13%' : '20%'}}>Date</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '13%' : '20%'}}>Estimate</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '18%' : '20%'}}>In</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '18%' : '20%'}}>Out</TableHeader>
                                                        <TableHeader className="text-[10px] uppercase font-bold text-slate-400 text-center align-middle" style={{width: timeCardsView === 'all' ? '8%' : '20%'}}>Hrs</TableHeader>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {tcWidgetTimeCards.filter(ts => !ts.type?.toLowerCase().includes('drive')).length > 0 ? 
                                                        tcWidgetTimeCards.filter(ts => !ts.type?.toLowerCase().includes('drive')).slice(0, 10).map((ts, idx) => (
                                                        <TableRow key={idx} className="hover:bg-slate-50">
                                                            {timeCardsView === 'all' && (
                                                                <TableCell className="text-left align-middle text-[11px] font-semibold text-slate-700 truncate max-w-[100px]">
                                                                    {(() => { const emp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === ts.employee?.toLowerCase()); return emp?.label || ts.employee?.split('@')[0] || '-'; })()}
                                                                </TableCell>
                                                            )}
                                                            <TableCell className="text-center align-middle text-[11px] font-medium text-slate-600">
                                                                {formatDateOnly(ts.clockIn)}
                                                            </TableCell>
                                                            <TableCell className="text-center align-middle">
                                                                <span className="text-[10px] font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 uppercase tracking-tighter">
                                                                    {ts.estimate ? ts.estimate.replace(/-[vV]\d+$/, '') : '-'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-center align-middle text-[11px] font-medium text-slate-600">
                                                                {formatTimeOnly(ts.clockIn)}
                                                            </TableCell>
                                                            <TableCell className="text-center align-middle text-[11px] font-medium text-slate-600">
                                                                {formatTimeOnly(ts.clockOut)}
                                                            </TableCell>
                                                            <TableCell className="text-center align-middle text-[11px] font-black text-slate-800">
                                                                {(ts.hoursVal || 0).toFixed(2)}
                                                            </TableCell>
                                                        </TableRow>
                                                    )) : (
                                                        <TableRow>
                                                            <TableCell colSpan={timeCardsView === 'all' ? 6 : 5} className="text-center py-4 text-xs text-slate-300 italic">No site records</TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            )}
                        </div>

                        {/* Right Sidebar - Chat & Activity */}
                        <div className={`col-span-12 xl:col-span-3 space-y-4 ${searchParams.get('view') === 'chat' ? 'block h-full lg:h-auto min-h-0 overflow-hidden lg:overflow-visible' : 'hidden lg:block'}`}>
                            


                            {/* Chat */}
                            <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col sticky top-0 z-10 ${searchParams.get('view') === 'chat' ? 'h-full lg:h-[650px]' : 'h-[650px]'}`}>
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white/95 backdrop-blur-sm z-20">
                                    <div className="hidden lg:flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4 text-[#0F4C75]" />
                                        <h2 className="font-bold text-slate-900 text-sm">Chat</h2>
                                    </div>
                                    <div className="flex items-center gap-2 flex-1 lg:flex-initial lg:max-w-[200px] justify-center lg:justify-end">
                                        <div className="relative w-full">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                            <input 
                                                type="text" 
                                                placeholder="Search chat..." 
                                                value={chatFilterValue}
                                                onChange={(e) => setChatFilterValue(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-[#0F4C75]/10 focus:border-[#0F4C75] transition-all"
                                            />
                                            {chatFilterValue && (
                                                <button 
                                                    onClick={() => setChatFilterValue('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    <X size={10} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div 
                                    className="flex-1 p-4 overflow-y-auto overscroll-contain space-y-4 scrollbar-thin bg-slate-50/50 select-none lg:select-auto"
                                    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
                                    ref={chatScrollRef}
                                    onScroll={() => {
                                        if (chatScrollRef.current) {
                                            const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
                                            // Consider "near bottom" if within 80px of the bottom
                                            chatUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > 80;
                                        }
                                    }}
                                >
                                    {(chatFilterValue ? messages.filter(msg => {
                                        const query = chatFilterValue.toLowerCase().trim();
                                        if (!query) return true;

                                        const senderEmp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === msg.sender?.toLowerCase());
                                        const senderName = senderEmp?.label || msg.sender || '';
                                        
                                        // Check assignees
                                        const hasMatchingAssignee = Array.isArray(msg.assignees) && msg.assignees.some((assignee: string | { email: string, name: string }) => {
                                             if (typeof assignee === 'string') {
                                                const emp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === assignee.toLowerCase());
                                                const name = emp?.label || assignee;
                                                return name.toLowerCase().includes(query);
                                             } else {
                                                const name = assignee.name || '';
                                                const email = assignee.email || '';
                                                return name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
                                             }
                                        });

                                        return (
                                            msg.message?.toLowerCase().includes(query) ||
                                            senderName.toLowerCase().includes(query) ||
                                            msg.estimate?.toLowerCase().includes(query) ||
                                            hasMatchingAssignee
                                        );
                                    }) : messages).length === 0 ? (
                                        <div className="text-center py-12">
                                            <p className="text-sm text-slate-400">
                                                {chatFilterValue ? 'No matching messages found' : 'No messages yet. Start the conversation!'}
                                            </p>
                                        </div>
                                    ) : (
                                        (chatFilterValue ? messages.filter(msg => {
                                            const query = chatFilterValue.toLowerCase().trim();
                                            if (!query) return true;

                                            const senderEmp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === msg.sender?.toLowerCase());
                                            const senderName = senderEmp?.label || msg.sender || '';
                                            
                                            // Check assignees
                                            const hasMatchingAssignee = Array.isArray(msg.assignees) && msg.assignees.some((assignee: string | { email: string, name: string }) => {
                                                 if (typeof assignee === 'string') {
                                                    const emp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === assignee.toLowerCase());
                                                    const name = emp?.label || assignee;
                                                    return name.toLowerCase().includes(query);
                                                 } else {
                                                    const name = assignee.name || '';
                                                    const email = assignee.email || '';
                                                    return name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
                                                 }
                                            });

                                            return (
                                                msg.message?.toLowerCase().includes(query) ||
                                                senderName.toLowerCase().includes(query) ||
                                                msg.estimate?.toLowerCase().includes(query) ||
                                                hasMatchingAssignee
                                            );
                                        }) : messages).map((msg, idx) => {
                                            const isMe = msg.sender?.toLowerCase() === userEmail?.toLowerCase() && !!userEmail;
                                            const isEditing = editingMsgId === msg._id;
                                            const senderEmp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === msg.sender?.toLowerCase());
                                            const senderInitials = (senderEmp?.label || msg.sender || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase();

                                            const renderMessage = (text: string) => {
                                                const parts = text.split(/(@[\w.@]+|#\d+[-A-Za-z0-9]*)/g);
                                                return parts.map((part, i) => {
                                                    if (part.startsWith('@')) {
                                                        const label = part.slice(1);
                                                        // Check if this person is already an assignee (hide them from text if they are)
                                                        const isAssignee = msg.assignees?.some((assignee: string | { email: string, name: string }) => {
                                                            const email = typeof assignee === 'string' ? assignee : assignee.email;
                                                            const emp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === email?.toLowerCase());
                                                            return emp?.label === label || email === label;
                                                        });
                                                        
                                                        if (isAssignee) return null;
                                                        return <span key={i} className={`font-bold ${isMe ? 'text-white/90 underline decoration-white/40' : 'text-[#0F4C75] underline decoration-[#0F4C75]/30'}`}>{part}</span>;
                                                    }
                                                    if (part.startsWith('#')) return <span key={i} className={`font-bold cursor-pointer hover:underline ${isMe ? 'text-white/90' : 'text-[#0F4C75]'}`} onClick={() => {
                                                        const estVal = part.slice(1);
                                                        setTagFilters([{ type: 'estimate', value: estVal, label: part }]);
                                                    }}>{part}</span>;

                                                    if (!chatFilterValue) return part;

                                                    // Escape special regex characters in filter value
                                                    const escapedFilter = chatFilterValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                                    const regex = new RegExp(`(${escapedFilter})`, 'gi');
                                                    const subParts = part.split(regex);
                                                    
                                                    return subParts.map((subPart, j) => 
                                                        subPart.toLowerCase() === chatFilterValue.toLowerCase() ? 
                                                            <span key={`${i}-${j}`} className="bg-yellow-200 text-slate-900 rounded-[2px] px-0.5 font-bold shadow-sm">{subPart}</span> : 
                                                            subPart
                                                    );
                                                });
                                            };

                                            const HeaderContent = () => {
                                                const AssigneesAvatars = (
                                                    <div className="flex -space-x-1.5 overflow-hidden">
                                                        {msg.assignees && msg.assignees.length > 0 ? (
                                                            msg.assignees.map((assignee: string | { email: string, name: string }, aIdx: number) => {
                                                                const email = typeof assignee === 'string' ? assignee : assignee.email;
                                                                const assEmp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === email?.toLowerCase());
                                                                const displayName = typeof assignee === 'string' ? (assEmp?.label || email) : (assignee.name || assEmp?.label || assignee.email);
                                                                
                                                                return (
                                                                    <Tooltip key={aIdx}>
                                                                        <TooltipTrigger asChild>
                                                                            <Avatar className="w-6 h-6 border-2 border-white shrink-0">
                                                                                {assEmp?.image && <AvatarImage src={assEmp.image} />}
                                                                                <AvatarFallback className="text-[9px] bg-transparent font-extrabold text-white border border-white/40">
                                                                                    {(() => { const parts = (displayName || 'U').split(' ').filter((p: string) => p.length > 0); return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (displayName || 'U')[0].toUpperCase(); })()}
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p className="text-[10px] font-bold">{displayName}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                );
                                                            })
                                                        ) : null}
                                                    </div>
                                                );

                                                const SenderAvatar = (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Avatar className={`w-7 h-7 border-2 shrink-0 ${isMe ? 'border-[#0F4C75]/30' : 'border-white'}`}>
                                                                <AvatarImage src={senderEmp?.image} />
                                                                <AvatarFallback className={`text-[10px] font-black ${isMe ? 'bg-[#0F4C75] text-white' : 'bg-[#0F4C75]/10 text-[#0F4C75]'}`}>
                                                                    {isMe ? 'ME' : senderInitials}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="text-[10px] font-bold">{isMe ? 'You' : (senderEmp?.label || msg.sender)}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                );

                                                if (isMe) {
                                                    return (
                                                        <div className="flex items-center justify-between mb-2">
                                                            {AssigneesAvatars}
                                                            {SenderAvatar}
                                                        </div>
                                                    );
                                                } else {
                                                    return (
                                                        <div className="flex items-center justify-between mb-2 flex-row-reverse">
                                                            {AssigneesAvatars}
                                                            {SenderAvatar}
                                                        </div>
                                                    );
                                                }
                                            };

                                            return (
                                                <div id={msg._id} key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end group mb-0.5`}>
                                                    
                                                    <div 
                                                        className={`rounded-2xl p-1 min-w-[160px] max-w-[85%] relative transition-all duration-300 ${
                                                            highlightedMsgId === msg._id ? 'ring-2 ring-[#0F4C75]/40 scale-[1.02]' : ''
                                                        } ${
                                                            isMe 
                                                                ? 'bg-[#0F4C75] text-white rounded-br-none' 
                                                                : 'bg-white text-slate-800 rounded-bl-none border border-slate-200'
                                                        }`}
                                                        style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
                                                        onTouchStart={(e) => {
                                                            longPressTimer.current = setTimeout(() => {
                                                                setLongPressMsgId(msg._id);
                                                            }, 500);
                                                        }}
                                                        onTouchEnd={() => {
                                                            if (longPressTimer.current) {
                                                                clearTimeout(longPressTimer.current);
                                                                longPressTimer.current = null;
                                                            }
                                                        }}
                                                        onTouchMove={() => {
                                                            if (longPressTimer.current) {
                                                                clearTimeout(longPressTimer.current);
                                                                longPressTimer.current = null;
                                                            }
                                                        }}
                                                    >
                                                        {/* Desktop hover actions for own messages */}
                                                        {isMe && !isEditing && (
                                                            <div className="hidden lg:flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity absolute right-full top-1/2 -translate-y-1/2 mr-1 z-10">
                                                                <button 
                                                                    onClick={() => {
                                                                        setReplyingTo(msg);
                                                                        setHighlightedMsgId(msg._id);
                                                                        setTimeout(() => setHighlightedMsgId(null), 2000);
                                                                        chatInputRef.current?.focus();
                                                                    }} 
                                                                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-green-600 transition-colors"
                                                                    title="Reply"
                                                                >
                                                                    <Reply size={12} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => {
                                                                        if (msg.assignees?.length) {
                                                                            const emails = msg.assignees.map((a: any) => typeof a === 'string' ? a : a.email);
                                                                            setChatAssignees((prev: string[]) => Array.from(new Set([...prev, ...emails])));
                                                                        }
                                                                        const cleanText = msg.message.replace(/(@[\w.@]+)/g, '').trim();
                                                                        if (chatInputRef.current) chatInputRef.current.value = `Fwd: ${cleanText}\n` + (chatInputRef.current.value || '');
                                                                        chatInputRef.current?.focus();
                                                                    }} 
                                                                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
                                                                    title="Forward"
                                                                >
                                                                    <Forward size={12} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => { setEditingMsgId(msg._id); setEditingMsgText(msg.message); }}
                                                                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
                                                                >
                                                                    <Edit size={12} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteMessage(msg._id)}
                                                                    className="p-1 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                        <HeaderContent />

                                                        {/* Reply Citation */}
                                                        {msg.replyTo && (
                                                            <div 
                                                                onClick={() => {
                                                                    const el = document.getElementById(msg.replyTo._id);
                                                                    if (el) {
                                                                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                        setHighlightedMsgId(msg.replyTo._id);
                                                                        setTimeout(() => setHighlightedMsgId(null), 2000);
                                                                    }
                                                                }}
                                                                className={`mb-1 mx-1 p-1.5 rounded-lg text-[10px] cursor-pointer hover:opacity-80 transition-opacity ${
                                                                    isMe 
                                                                        ? 'bg-white/10 border-l-2 border-white/30 text-white/80' 
                                                                        : 'bg-slate-50 border-l-2 border-[#0F4C75]/30 text-slate-500'
                                                                }`}
                                                            >
                                                                <p className="font-bold opacity-75 mb-0.5">{msg.replyTo.sender?.split('@')[0]}</p>
                                                                <p className="truncate line-clamp-1 italic opacity-90">{msg.replyTo.message}</p>
                                                            </div>
                                                        )}

                                                        {/* Message Content */}
                                                        <div className="px-1">
                                                            {isEditing ? (
                                                                <div className="space-y-2">
                                                                    <textarea 
                                                                        autoFocus
                                                                        className="w-full bg-white/15 border border-white/20 rounded-lg p-2 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-white/40"
                                                                        value={editingMsgText}
                                                                        onChange={(e) => setEditingMsgText(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                                e.preventDefault();
                                                                                handleUpdateMessage(msg._id, editingMsgText);
                                                                            } else if (e.key === 'Escape') {
                                                                                setEditingMsgId(null);
                                                                            }
                                                                        }}
                                                                    />
                                                                    <div className="flex justify-end gap-2">
                                                                        <button onClick={() => setEditingMsgId(null)} className="text-[10px] font-bold uppercase hover:underline">Cancel</button>
                                                                        <button onClick={() => handleUpdateMessage(msg._id, editingMsgText)} className="text-[10px] font-bold uppercase hover:underline">Save</button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm cursor-text selection:bg-white/30 whitespace-pre-wrap leading-relaxed">
                                                                    {renderMessage(msg.message)}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Footer: Timestamp & Actions */}
                                                        {!isEditing && (
                                                            <div className={`flex items-center justify-end mt-1 px-1`}>
                                                                
                                                            <div className="flex items-center gap-2">
                                                                {msg.estimate && (
                                                                    <span className={`text-[8px] font-bold px-1.5 py-px rounded uppercase tracking-tight leading-none ${isMe ? 'bg-white/20 text-white border border-white/20' : 'bg-[#0F4C75]/10 text-[#0F4C75] border border-[#0F4C75]/15'}`}>
                                                                        #{msg.estimate.value || msg.estimate}
                                                                    </span>
                                                                )}
                                                                <span className={`text-[8px] uppercase tracking-widest font-medium opacity-60 shrink-0 ${isMe ? 'text-white' : 'text-slate-400'}`}>
                                                                    {(() => { const d = new Date(msg.createdAt); const mm = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0'); let h = d.getHours(); const ampm = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; const min = String(d.getMinutes()).padStart(2, '0'); return `${mm}/${dd}, ${h}:${min} ${ampm}`; })()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        )}
                                                        {/* Mobile Long-Press Action Popup */}
                                                        {longPressMsgId === msg._id && (
                                                            <>
                                                                <div className="fixed inset-0 z-[200] lg:hidden" style={{ touchAction: 'none' }} onClick={() => dismissLongPress()} />
                                                                <div className={`absolute z-[201] lg:hidden animate-in fade-in zoom-in-95 duration-150 ${
                                                                    isMe ? 'right-0 top-full mt-1' : 'left-0 top-full mt-1'
                                                                }`}>
                                                                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden min-w-[140px]">
                                                                        <button
                                                                            onClick={() => {
                                                                                setReplyingTo(msg);
                                                                                setHighlightedMsgId(msg._id);
                                                                                setTimeout(() => setHighlightedMsgId(null), 2000);
                                                                                chatInputRef.current?.focus();
                                                                                dismissLongPress();
                                                                            }}
                                                                            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                                                                        >
                                                                            <Reply size={14} className="text-[#0F4C75]" />
                                                                            Reply
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                if (msg.assignees?.length) {
                                                                                    const emails = msg.assignees.map((a: any) => typeof a === 'string' ? a : a.email);
                                                                                    setChatAssignees((prev: string[]) => Array.from(new Set([...prev, ...emails])));
                                                                                }
                                                                                const cleanText = msg.message.replace(/(@[\w.@]+)/g, '').trim();
                                                                                                                                                    if (chatInputRef.current) chatInputRef.current.value = `Fwd: ${cleanText}\n` + (chatInputRef.current.value || '');
                                                                                chatInputRef.current?.focus();
                                                                                dismissLongPress();
                                                                            }}
                                                                            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors border-t border-slate-100"
                                                                        >
                                                                            <Forward size={14} className="text-[#0F4C75]" />
                                                                            Forward
                                                                        </button>
                                                                        {isMe && (
                                                                            <>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setEditingMsgId(msg._id);
                                                                                        setEditingMsgText(msg.message);
                                                                                        dismissLongPress();
                                                                                    }}
                                                                                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors border-t border-slate-100"
                                                                                >
                                                                                    <Edit size={14} className="text-[#0F4C75]" />
                                                                                    Edit
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        handleDeleteMessage(msg._id);
                                                                                        dismissLongPress();
                                                                                    }}
                                                                                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors border-t border-slate-100"
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                    Delete
                                                                                </button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </>
                                                        )}
                                                        {/* Desktop hover actions for other's messages */}
                                                        {!isMe && (
                                                            <div className="hidden lg:flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity absolute left-full top-1/2 -translate-y-1/2 ml-1 z-10">
                                                                <button 
                                                                    onClick={() => {
                                                                        setReplyingTo(msg);
                                                                        chatInputRef.current?.focus();
                                                                    }} 
                                                                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-green-600 transition-colors"
                                                                    title="Reply"
                                                                >
                                                                    <Reply size={12} />
                                                                </button>
                                                                <button 
                                                                    onClick={() => {
                                                                        if (msg.assignees?.length) {
                                                                            const emails = msg.assignees.map((a: any) => typeof a === 'string' ? a : a.email);
                                                                            setChatAssignees((prev: string[]) => Array.from(new Set([...prev, ...emails])));
                                                                        }
                                                                        const cleanText = msg.message.replace(/(@[\w.@]+)/g, '').trim();
                                                                        if (chatInputRef.current) chatInputRef.current.value = `Fwd: ${cleanText}\n` + (chatInputRef.current.value || '');
                                                                        chatInputRef.current?.focus();
                                                                    }} 
                                                                    className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
                                                                    title="Forward"
                                                                >
                                                                    <Forward size={12} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    

                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="p-3 border-t border-slate-100 relative">
                                    <MyDropDown
                                        isOpen={showMentions}
                                        onClose={() => setShowMentions(false)}
                                        options={filteredEmployeeOptions}
                                        selectedValues={chatAssignees}
                                        onSelect={(val) => {
                                            if (!chatAssignees.includes(val)) {
                                                setChatAssignees(prev => [...prev, val]);
                                            } else {
                                                setChatAssignees(prev => prev.filter(v => v !== val));
                                            }
                                            
                                            // Remove trigger text
                                            const text = chatInputRef.current?.value || '';
                                            const before = text.slice(0, cursorPosition);
                                            const lastAt = before.lastIndexOf('@');
                                            if (lastAt >= 0) {
                                                const newText = before.slice(0, lastAt) + text.slice(cursorPosition);
                                                if (chatInputRef.current) chatInputRef.current.value = newText;
                                                
                                                setTimeout(() => {
                                                    if (chatInputRef.current) {
                                                        chatInputRef.current.focus();
                                                        const newPos = lastAt;
                                                        chatInputRef.current.setSelectionRange(newPos, newPos);
                                                        setCursorPosition(newPos);
                                                    }
                                                }, 0);
                                            }
                                        }}
                                        multiSelect={true}
                                        anchorId="chat-input-container"
                                        width="w-64"
                                        showSearch={false}
                                    />

                                    <MyDropDown
                                        isOpen={showReferences}
                                        onClose={() => setShowReferences(false)}
                                        options={estimateOptions}
                                        selectedValues={chatEstimate ? [chatEstimate.value] : []}
                                        onSelect={(val) => {
                                            const selected = estimateOptions.find((o: any) => o.value === val);
                                            if (selected) {
                                                setChatEstimate({ value: selected.value, label: selected.label });
                                            }
                                            
                                            // Remove trigger text
                                            const text = chatInputRef.current?.value || '';
                                            const before = text.slice(0, cursorPosition);
                                            const lastHash = before.lastIndexOf('#');
                                            if (lastHash >= 0) {
                                                const newText = before.slice(0, lastHash) + text.slice(cursorPosition);
                                                if (chatInputRef.current) chatInputRef.current.value = newText;
                                                setShowReferences(false);
                                                setTimeout(() => {
                                                    if (chatInputRef.current) {
                                                        chatInputRef.current.focus();
                                                        const newPos = lastHash;
                                                        chatInputRef.current.setSelectionRange(newPos, newPos);
                                                        setCursorPosition(newPos);
                                                    }
                                                }, 0);
                                            }
                                        }}
                                        multiSelect={false}
                                        anchorId="chat-input-container"
                                        width="w-80"
                                        showSearch={true}
                                    />

                                    <form 
                                        onSubmit={handleSendMessage} 
                                        className="flex flex-col gap-2"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                    >
                                        {chatAssignees.length > 0 && (
                                            <div className="flex items-center gap-2 mb-1 px-1">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Assigning:</span>
                                                <div className="flex -space-x-1.5 overflow-hidden">
                                                    {chatAssignees.map((val: string, i: number) => {
                                                        const emailVal = typeof val === 'string' ? val : (val as any).email;
                                                        const emp = initialData.employees?.find((e: any) => e.value?.toLowerCase() === emailVal?.toLowerCase());
                                                        return (
                                                            <div 
                                                                key={i} 
                                                                className="cursor-pointer hover:scale-110 transition-transform"
                                                                onClick={() => setChatAssignees(prev => prev.filter(v => v !== val))}
                                                            >
                                                                <Avatar className="w-5 h-5 border border-white shrink-0 shadow-sm">
                                                                    <AvatarImage src={emp?.image} />
                                                                    <AvatarFallback className="text-[8px] bg-slate-200">
                                                                        {(emp?.label || emailVal || 'U')[0].toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => setChatAssignees([])}
                                                    className="text-[9px] text-red-500 font-bold hover:underline ml-1"
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                        )}
                                        {chatEstimate && (
                                             <div className="flex items-center gap-2 mb-1 px-1">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Linking:</span>
                                                <div className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <span className="text-[10px] font-bold">{chatEstimate.label}</span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setChatEstimate(null)}
                                                        className="hover:text-purple-900"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        
                                        {/* Replying Banner */}
                                        {replyingTo && (
                                            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-t-xl border-b border-slate-100 text-xs">
                                                 <div className="flex items-center gap-2 overflow-hidden">
                                                    <Reply size={12} className="text-slate-400 shrink-0" />
                                                    <div className="flex flex-col truncate">
                                                        <span className="font-bold text-slate-700">Replying to {replyingTo.sender}</span>
                                                        <span className="text-slate-500 truncate">{replyingTo.message}</span>
                                                    </div>
                                                 </div>
                                                 <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-slate-200 rounded-full">
                                                    <X size={12} />
                                                 </button>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1" id="chat-input-container">
                                                <textarea 
                                                    ref={chatInputRef as any}
                                                    placeholder="Type @ for team or # for jobs..."
                                                    className="w-full px-4 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all placeholder:text-slate-400 resize-none h-10 leading-10 max-h-32 overflow-y-auto"
                                                    rows={1}
                                                    defaultValue=""
                                                    onInput={(e: any) => {
                                                        const target = e.target;
                                                        target.style.height = '40px';
                                                        target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                                                    }}
                                                    onChange={handleChatInput}
                                                />
                                            </div>
                                            <button 
                                                type="submit"
                                                className="w-10 h-10 bg-[#0F4C75] text-white rounded-xl flex items-center justify-center hover:opacity-90 transition-all shadow-sm hover:shadow-md shrink-0"
                                            >
                                                <Send className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>



                        </div>
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

            {/* Document Upload Modal */}
            <Modal
                isOpen={isDocModalOpen}
                onClose={() => setIsDocModalOpen(false)}
                title="Upload Company Document"
                maxWidth="md"
            >
                <form onSubmit={handleSaveDoc} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block font-sans">Document Title</label>
                        <Input 
                            value={docForm.title}
                            onChange={(e) => setDocForm(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g. Employee Handbook 2024"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block font-sans">Upload Query</label>
                        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                            {docForm.url ? (
                                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                    <FileCheck className="text-blue-500" size={20} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-slate-900 truncate">Document Uploaded</p>
                                        <p className="text-xs text-blue-500 truncate">{docForm.url}</p>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => setDocForm(prev => ({ ...prev, url: '' }))}
                                        className="text-slate-400 hover:text-red-500"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-6">
                                    <UploadButton 
                                        onUpload={(url) => setDocForm(prev => ({ ...prev, url }))} 
                                        folder="docs"
                                        label="Click to Upload"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <Button type="button" variant="outline" onClick={() => setIsDocModalOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSavingDoc}>
                            {isSavingDoc ? 'Saving...' : 'Save Document'}
                        </Button>
                    </div>
                </form>
            </Modal>


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
    );
}



export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /></div>}>
            <DashboardContent />
        </Suspense>
    );
}
