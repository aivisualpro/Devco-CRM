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
    Mail, Loader2, Activity as ActivityIcon, ChevronDown
} from 'lucide-react';
import { Header, Badge, Input, Modal, Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { usePermissions } from '@/hooks/usePermissions';
import { ScheduleDetailModal } from './components/ScheduleDetailModal';
import { ScheduleCard, ScheduleItem } from '../jobs/schedules/components/ScheduleCard';
import { JHAModal } from '../jobs/schedules/components/JHAModal';
import { DJTModal } from '../jobs/schedules/components/DJTModal';
import { TimesheetModal } from '../jobs/schedules/components/TimesheetModal';

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
    
    return { start, end, label: `${fmt(start)} ~ ${fmt(end)}` };
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
    title: string;
    status: 'todo' | 'in-progress' | 'done';
    priority: 'low' | 'medium' | 'high';
    dueDate?: string;
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
    onDrop 
}: { 
    title: string; 
    items: TodoItem[]; 
    status: string;
    color: string;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, status: string) => void;
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
                    className="bg-white p-3 rounded-lg border border-slate-200 cursor-grab hover:shadow-md transition-shadow"
                >
                    <div className="flex items-start gap-2">
                        <GripVertical className="w-4 h-4 text-slate-300 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-slate-800">{item.title}</p>
                            {item.dueDate && (
                                <p className="text-xs text-slate-400 mt-1">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
                            )}
                        </div>
                        <div className={`w-2 h-2 rounded-full ${
                            item.priority === 'high' ? 'bg-red-500' : 
                            item.priority === 'medium' ? 'bg-amber-500' : 'bg-green-500'
                        }`} />
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
                        <span className="font-semibold text-slate-900 ml-auto">${(d.total / 1000).toFixed(0)}k</span>
                    </div>
                ))}
            </div>
        </div>
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
        if (week) {
            const d = new Date(week);
            if (!isNaN(d.getTime())) return d;
        }
        return new Date();
    });
    const weekRange = useMemo(() => getWeekRange(currentWeekDate), [currentWeekDate]);

    // Update URL when currentWeekDate changes
    useEffect(() => {
        const dateStr = currentWeekDate.toISOString().split('T')[0];
        const currentWeekParam = searchParams.get('week');
        
        if (dateStr !== currentWeekParam) {
            const params = new URLSearchParams(searchParams.toString());
            params.set('week', dateStr);
            router.replace(`?${params.toString()}`, { scroll: false });
        }
    }, [currentWeekDate, router, searchParams]);
    
    // Data States
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [initialData, setInitialData] = useState<any>({ employees: [], clients: [], constants: [], estimates: [] });
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [timeCards, setTimeCards] = useState<TimeCard[]>([]);
    const [trainings, setTrainings] = useState<Training[]>([]);
    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [estimateStats, setEstimateStats] = useState<EstimateStats[]>([]);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]); // Keep for type safety if needed, but we use 'messages' state now

    
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
    const handleQuickTimesheet = async (schedule: Schedule, type: string) => {
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

    const handleDriveTimeToggle = async (schedule: Schedule, activeTs?: any, e?: React.MouseEvent) => {
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
            const estRes = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getEstimateStats' })
            });
            const estData = await estRes.json();
            if (estData.success && estData.result?.length > 0) {
                setEstimateStats(estData.result);
            } else {
                // Fallback mock data for demo
                setEstimateStats([
                    { status: 'pending', count: 12, total: 145000 },
                    { status: 'approved', count: 8, total: 320000 },
                    { status: 'sent', count: 15, total: 210000 },
                    { status: 'declined', count: 3, total: 45000 },
                ]);
            }
            
            // Mock other data for now
            setTrainings([
                { _id: '1', name: 'OSHA 10-Hour', completedDate: '2025-11-15', renewalDate: '2026-11-15', status: 'completed', type: 'Safety' },
                { _id: '2', name: 'Forklift Certification', completedDate: '2025-08-20', renewalDate: '2026-08-20', status: 'completed', type: 'Equipment' },
                { _id: '3', name: 'First Aid/CPR', renewalDate: '2026-02-15', status: 'upcoming', type: 'Safety' },
            ]);
            
            setTodos([
                { _id: '1', title: 'Review bid for Main St project', status: 'todo', priority: 'high', dueDate: '2026-01-27' },
                { _id: '2', title: 'Submit timesheet corrections', status: 'in-progress', priority: 'medium' },
                { _id: '3', title: 'Schedule equipment maintenance', status: 'done', priority: 'low' },
                { _id: '4', title: 'Update project photos', status: 'todo', priority: 'medium' },
            ]);
            
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
    }, [weekRange, scheduleView, userEmail, isSuperAdmin]);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    // Todo drag handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        const todoId = e.dataTransfer.getData('todoId');
        setTodos(prev => prev.map(t => 
            t._id === todoId ? { ...t, status: newStatus as TodoItem['status'] } : t
        ));
    };

    // Filtered todos by status
    const todosByStatus = useMemo(() => ({
        todo: todos.filter(t => t.status === 'todo'),
        'in-progress': todos.filter(t => t.status === 'in-progress'),
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
                rightContent={
                    <div className="flex items-center gap-4">
                        {/* Week Navigation */}
                        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 shadow-sm border border-slate-200">
                            <button 
                                onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, -1))}
                                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4 text-slate-600" />
                            </button>
                            <div className="flex items-center gap-2 px-2">
                                <Calendar className="w-4 h-4 text-blue-600" />
                                <span className="font-semibold text-sm text-slate-800">{weekRange.label}</span>
                            </div>
                            <button 
                                onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, 1))}
                                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                <ChevronRight className="w-4 h-4 text-slate-600" />
                            </button>
                            <button 
                                onClick={() => setCurrentWeekDate(new Date())}
                                className="text-xs font-medium text-blue-600 hover:text-blue-700 ml-2"
                            >
                                Today
                            </button>
                        </div>
                    </div>
                }
            />

            <div className="flex-1 overflow-auto p-4 lg:p-6">
                <div className="max-w-[1800px] mx-auto">
                    
                    {/* Main Grid */}
                    <div className="grid grid-cols-12 gap-4 lg:gap-6">
                        
                        {/* Left Column - Main Content */}
                        <div className="col-span-12 xl:col-span-9 space-y-4 lg:space-y-6">
                            
                            {/* Upcoming Schedules */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                            <Calendar className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-slate-900">Upcoming Schedules</h2>
                                            <p className="text-xs text-slate-500">{schedules.length} jobs this week</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex bg-slate-100 rounded-lg p-0.5">
                                            <button 
                                                onClick={() => setScheduleView('self')}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                                    scheduleView === 'self' 
                                                        ? 'bg-white text-blue-600 shadow-sm' 
                                                        : 'text-slate-600 hover:text-slate-800'
                                                }`}
                                            >
                                                My Jobs
                                            </button>
                                            <button 
                                                onClick={() => setScheduleView('all')}
                                                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                                    scheduleView === 'all' 
                                                        ? 'bg-white text-blue-600 shadow-sm' 
                                                        : 'text-slate-600 hover:text-slate-800'
                                                }`}
                                            >
                                                All Jobs
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4">
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
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
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
                                                    onEdit={() => router.push(`/jobs/schedules?id=${schedule._id}&edit=true`)}
                                                    onCopy={() => router.push(`/jobs/schedules?id=${schedule._id}&copy=true`)}
                                                    onDelete={() => router.push(`/jobs/schedules?id=${schedule._id}&delete=true`)}
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
                                                    onQuickTimesheet={handleQuickTimesheet}
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
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                                
                                {/* Estimate Stats Pie Chart */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                            <TrendingUp className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-slate-900">Estimates Overview</h2>
                                            <p className="text-xs text-slate-500">Grand total by status</p>
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

                            {/* To Do Kanban */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-rose-600" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-slate-900">To Do</h2>
                                            <p className="text-xs text-slate-500">Drag and drop to update status</p>
                                        </div>
                                    </div>
                                    <button className="w-8 h-8 bg-blue-500 text-white rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors">
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex gap-4 overflow-x-auto pb-2">
                                    <TodoColumn 
                                        title="To Do" 
                                        items={todosByStatus.todo} 
                                        status="todo" 
                                        color="bg-slate-400"
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                    />
                                    <TodoColumn 
                                        title="In Progress" 
                                        items={todosByStatus['in-progress']} 
                                        status="in-progress" 
                                        color="bg-blue-500"
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                    />
                                    <TodoColumn 
                                        title="Done" 
                                        items={todosByStatus.done} 
                                        status="done" 
                                        color="bg-emerald-500"
                                        onDragOver={handleDragOver}
                                        onDrop={handleDrop}
                                    />
                                </div>
                            </div>

                            {/* Time Cards - Weekly */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                                        <Clock className="w-5 h-5 text-teal-600" />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-slate-900">My Time Cards</h2>
                                        <p className="text-xs text-slate-500">This week's entries</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {[1,2,3,4,5].map(i => (
                                        <TimeCardMini 
                                            key={i}
                                            card={{
                                                _id: String(i),
                                                employee: userEmail,
                                                clockIn: new Date(Date.now() - i * 86400000).toISOString(),
                                                clockOut: i % 2 === 0 ? new Date(Date.now() - i * 86400000 + 28800000).toISOString() : undefined,
                                                type: 'Site Work',
                                                hours: i % 2 === 0 ? 8 : undefined,
                                                projectName: `Project ${i}`
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Sidebar - Chat & Activity */}
                        <div className="col-span-12 xl:col-span-3 space-y-4 lg:space-y-6">
                            
                            {/* Recent Activity */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 overflow-hidden">
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
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
                                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                                            <MessageSquare className="w-5 h-5 text-cyan-600" />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-slate-900">Chat</h2>
                                            <p className="text-xs text-slate-500">
                                                {tagFilters.length > 0 ? `Filtered by: ${tagFilters.map(t => t.label).join(', ')}` : 'Team messages'}
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
