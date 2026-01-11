'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Package, FileText, Calculator, TrendingUp, Activity,
    CheckCircle, Users, Layers, Zap, ArrowRight, ArrowUpRight,
    Clock, MoreHorizontal, Briefcase, FileSpreadsheet,
    Calendar, DollarSign, ClipboardCheck, AlertTriangle,
    Settings, BarChart3, FileCheck, Shield, Plus, Sparkles,
    ChevronRight, ChevronLeft, Truck, Tag, MapPin, X, Edit, Trash2, Phone, FilePlus, ClipboardList, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Header, Modal, Badge, EmptyState } from '@/components/ui';
import SignaturePad from '../jobs/schedules/SignaturePad';
import { useToast } from '@/hooks/useToast';

interface Stats {
    catalogueItems: number;
    laborItems: number;
    materialItems: number;
    equipmentItems: number;
    estimates: number;
    activeEstimates: number;
    completedEstimates: number;
    totalValue: number;
}

export default function DashboardPage() {
    const router = useRouter();
    const { success, error: toastError } = useToast();
    const [stats, setStats] = useState<Stats>({
        catalogueItems: 0,
        laborItems: 0,
        materialItems: 0,
        equipmentItems: 0,
        estimates: 0,
        activeEstimates: 0,
        completedEstimates: 0,
        totalValue: 0
    });
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'reports'>('overview');
    const [dashboardTab, setDashboardTab] = useState<'activity' | 'schedule'>('activity');
    
    // JHA State
    const [jhaModalOpen, setJhaModalOpen] = useState(false);
    const [selectedJHA, setSelectedJHA] = useState<any>(null);
    const [isJhaEditMode, setIsJhaEditMode] = useState(false);
    const [activeSignatureEmployee, setActiveSignatureEmployee] = useState<string | null>(null);

    // Schedule Logic
    const [scheduleDate, setScheduleDate] = useState(new Date());
    const [dailySchedules, setDailySchedules] = useState<any[]>([]);
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const dateInputRef = useRef<HTMLInputElement>(null);
    const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
    const [constants, setConstants] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [estimates, setEstimates] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);

    // Media Modal State
    const [mediaModal, setMediaModal] = useState<{ isOpen: boolean; type: 'image' | 'map'; url: string; title: string }>({
        isOpen: false,
        type: 'image',
        url: '',
        title: ''
    });

    const formatLocalDate = (dateInput: string | Date) => {
        const date = new Date(dateInput);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleSaveJHAForm = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Improve createdBy handling: default to current user if missing
            const currentUser = typeof window !== 'undefined' 
                ? JSON.parse(localStorage.getItem('devco_user') || '{}')?.email
                : null;
            
            const payload = { 
                ...selectedJHA, 
                createdBy: selectedJHA.createdBy || currentUser, 
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
                fetchDailySchedules(scheduleDate);
                setIsJhaEditMode(false);
            } else {
                toastError(data.error || 'Failed to save JHA');
            }
        } catch (error) {
            console.error(error);
            toastError('Error saving JHA');
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
             } catch (e) {
                 console.log('Location access denied or failed');
             }
        }
        try {
            const payload = {
                schedule_id: selectedJHA.schedule_id,
                employee: activeSignatureEmployee,
                signature: dataUrl,
                createdBy: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('devco_user') || '{}')?.email : null,
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
            } else {
                toastError(data.error || 'Failed to save signature');
            }
        } catch (error) {
            console.error(error);
            toastError('Error saving signature');
        }
    };

    const handleActivityClick = async (activity: any) => {
        if (activity.type === 'estimate') {
            router.push(`/estimates/${activity.entityId}`); // Assumes entityId is estimate ID (slug) or number? Previous logic used entityId.
        } else if (activity.type === 'jha' || activity.type === 'jha_signature') {
             try {
                 const res = await fetch('/api/jha', {
                     method: 'POST',
                     headers: {'Content-Type': 'application/json'},
                     body: JSON.stringify({ action: 'getJHA', payload: { id: activity.entityId } })
                 });
                 const data = await res.json();
                 if (data.success && data.jha) {
                     setSelectedJHA(data.jha);
                     setJhaModalOpen(true);
                 } else {
                     router.push('/jobs/schedules');
                 }
             } catch(e) { console.error(e); }
        } else {
             router.push('/jobs/schedules');
        }
    };

    const getCustomerName = (item: any) => {
        if (item.customerName && item.customerName !== 'Client') return item.customerName;
        // Try to resolve via estimate -> customerId -> client list
        if (item.estimate) {
             const est = estimates.find(e => e.value === item.estimate);
             if (est && est.customerId) {
                 const client = clients.find(c => c._id === est.customerId);
                 if (client) return client.name;
             }
        }
        // Fallback to customerId direct lookup
        if (item.customerId) {
            const client = clients.find(c => c._id === item.customerId);
            if (client) return client.name;
        }
        return 'Client';
    };

    // Fetch Daily Schedules
    const fetchDailySchedules = async (date: Date) => {
        setScheduleLoading(true);
        const start = new Date(date);
        start.setHours(0,0,0,0);
        const end = new Date(date);
        end.setHours(23,59,59,999);

        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'getSchedulesPage',
                    payload: { startDate: start.toISOString(), endDate: end.toISOString() }
                })
            });
            const data = await res.json();
            if (data.success) {
                setDailySchedules(data.result.schedules || []);
                if (data.result.initialData) {
                    setConstants(data.result.initialData.constants || []);
                    setEmployees(data.result.initialData.employees || []);
                    setEstimates(data.result.initialData.estimates || []);
                    setClients(data.result.initialData.clients || []);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setScheduleLoading(false);
        }
    };

    useEffect(() => {
        fetchDailySchedules(scheduleDate);
    }, [scheduleDate]);

    useEffect(() => {
        setMounted(true);
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const [estimatesRes, equipmentRes, laborRes, materialRes] = await Promise.all([
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getEstimates' })
                }),
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getCatalogueItems', payload: { type: 'equipment' } })
                }),
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getCatalogueItems', payload: { type: 'labor' } })
                }),
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getCatalogueItems', payload: { type: 'material' } })
                })
            ]);

            const [estimatesData, equipmentData, laborData, materialData] = await Promise.all([
                estimatesRes.json(),
                equipmentRes.json(),
                laborRes.json(),
                materialRes.json()
            ]);

            const estimates = estimatesData.success && estimatesData.result ? estimatesData.result : [];
            const equipment = equipmentData.success && equipmentData.result ? equipmentData.result.length : 0;
            const labor = laborData.success && laborData.result ? laborData.result.length : 0;
            const material = materialData.success && materialData.result ? materialData.result.length : 0;

            const totalValue = estimates.reduce((sum: number, est: { grandTotal?: number }) => {
                return sum + (est.grandTotal || 0);
            }, 0);

            setStats({
                estimates: estimates.length,
                activeEstimates: estimates.filter((e: { status: string }) => e.status !== 'Completed' && e.status !== 'Rejected').length,
                completedEstimates: estimates.filter((e: { status: string }) => e.status === 'Completed').length,
                catalogueItems: equipment + labor + material,
                equipmentItems: equipment,
                laborItems: labor,
                materialItems: material,
                totalValue
            });

            // Fetch Activities
            const activityRes = await fetch('/api/activity?days=7');
            const activityData = await activityRes.json();
            if (activityData.success) {
                setActivities(activityData.activities || []);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
        setLoading(false);
    };

    // Activity State
    const [activities, setActivities] = useState<any[]>([]);

    // Compute weekly stats from real activities
    const getWeekDays = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = new Date();
        const result = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            result.push({
                label: days[d.getDay()],
                date: d.toDateString(),
                fullDate: d
            });
        }
        return result;
    };

    const weekDays = getWeekDays();
    
    const weeklyStats = weekDays.map(day => {
        const count = activities.filter(a => {
            const actDate = new Date(a.createdAt).toDateString();
            return actDate === day.date;
        }).length;
        return { label: day.label, value: count, date: day.date, fullDate: day.fullDate };
    });

    const maxActivityCount = Math.max(...weeklyStats.map(d => d.value), 1);

    return (
        <div className="flex flex-col h-full">
            <div className="hidden md:block flex-none">
                <Header showDashboardActions={true} />
            </div>
            <div className="flex-1 overflow-y-auto bg-[#f8fafc] overflow-x-hidden">
                <div className="max-w-[1600px] mx-auto p-4">
                    <div className="flex items-center gap-2 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
                        <button 
                            onClick={() => setDashboardTab('activity')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${dashboardTab === 'activity' ? 'bg-white text-[#0F4C75] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Daily Activity
                        </button>
                        <button 
                            onClick={() => setDashboardTab('schedule')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${dashboardTab === 'schedule' ? 'bg-white text-[#0F4C75] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Job Schedule
                        </button>
                    </div>

                    <div className={`${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
                        {dashboardTab === 'activity' ? (
                            <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm min-h-[500px]">
                                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                    <Activity className="text-violet-500" />
                                    Recent Activity
                                </h3>
                                
                                {activities.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                            <Sparkles className="text-slate-300" size={32} />
                                        </div>
                                        <p className="text-slate-500 font-medium">No recent activity found</p>
                                    </div>
                                ) : (
                                    <div className="relative pl-4 max-w-2xl">
                                        <div className="absolute left-[22px] top-4 bottom-10 w-0.5 bg-slate-100" />
                                        
                                        {activities.map((activity, idx) => (
                                            <div key={idx} className="relative pl-12 mb-8 last:mb-0 group cursor-pointer" onClick={() => handleActivityClick(activity)}>
                                                <div className="absolute left-0 top-0 w-11 h-11 rounded-full border-4 border-white shadow-sm bg-white flex items-center justify-center z-10 transition-transform group-hover:scale-110">
                                                    {(() => {
                                                        const emp = employees.find(e => e.value === activity.user || e.label === activity.user);
                                                        if (emp?.image) {
                                                            return <img src={emp.image} alt="" className="w-full h-full rounded-full object-cover" />;
                                                        }
                                                        return (
                                                            <div className={`w-full h-full rounded-full flex items-center justify-center text-xs font-bold text-white ${
                                                                activity.type === 'estimate' ? 'bg-violet-500' :
                                                                activity.type === 'jha' ? 'bg-emerald-500' :
                                                                'bg-blue-500'
                                                            }`}>
                                                                {(activity.user?.[0] || 'S').toUpperCase()}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                <div>
                                                    <div className="flex items-baseline justify-between mb-1">
                                                        <p className="text-sm font-bold text-slate-800">
                                                            {!activity.user || activity.user === 'system' ? 'Admin' : (employees.find(e => e.value === activity.user)?.label || activity.user)}
                                                        </p>
                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                                                            {new Date(activity.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 leading-snug">
                                                        {activity.title}
                                                    </p>
                                                    
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                                                            activity.type === 'estimate' ? 'bg-violet-50 text-violet-600' :
                                                            activity.type === 'jha' ? 'bg-emerald-50 text-emerald-600' :
                                                            'bg-blue-50 text-blue-600'
                                                        }`}>
                                                            {activity.type.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-white rounded-[32px] p-4 border border-slate-100 shadow-sm min-h-[500px]">
                                <div className="flex items-center justify-between mb-5 px-2">
                                    <button 
                                        onClick={() => {
                                            const d = new Date(scheduleDate);
                                            d.setDate(d.getDate() - 1);
                                            setScheduleDate(d);
                                        }}
                                        className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    
                                    <div className="text-center cursor-pointer relative group" onClick={() => dateInputRef.current?.showPicker()}>
                                        <h3 className="text-2xl font-black text-slate-900 group-hover:text-[#0066FF] transition-colors mb-1">
                                            {scheduleDate.toLocaleDateString('en-US', { weekday: 'long' })}
                                        </h3>
                                        <p className="text-sm font-bold text-slate-400">
                                            {scheduleDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                        </p>
                                        <input 
                                            type="date"
                                            ref={dateInputRef}
                                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    const [y, m, d] = e.target.value.split('-').map(Number);
                                                    setScheduleDate(new Date(y, m - 1, d));
                                                }
                                            }} 
                                        />
                                    </div>

                                    <button 
                                        onClick={() => {
                                            const d = new Date(scheduleDate);
                                            d.setDate(d.getDate() + 1);
                                            setScheduleDate(d);
                                        }}
                                        className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {scheduleLoading ? (
                                        [1,2,3,4,5,6].map(i => (
                                            <div key={i} className="animate-pulse bg-slate-50 h-64 rounded-[40px]" />
                                        ))
                                    ) : dailySchedules.length === 0 ? (
                                        <div className="col-span-full">
                                            <EmptyState 
                                                icon="📅" 
                                                title="No schedules found" 
                                                message="No jobs scheduled for this date."
                                                action={
                                                    <button 
                                                        onClick={() => router.push('/jobs/schedules')}
                                                        className="mt-4 px-4 py-2 bg-[#0F4C75] text-white rounded-lg text-sm font-bold shadow-sm hover:bg-[#0b3a59] transition-colors"
                                                    >
                                                        View All Schedules
                                                    </button>
                                                }
                                            />
                                        </div>
                                    ) : (
                                        dailySchedules.map((item, i) => (
                                            <div
                                                key={item._id || i}
                                                onClick={() => setSelectedSchedule(item)}
                                                className="group relative bg-white rounded-[24px] sm:rounded-[40px] p-4 cursor-pointer transition-all duration-300 transform border border-slate-100 hover:border-[#0F4C75]/30 hover:-translate-y-1 shadow-sm"
                                            >
                                                <div className="flex flex-col h-full justify-between">
                                                    {/* Header: Icon (Tag) + Customer */}
                                                    <div className="flex justify-between items-start mb-3 sm:mb-4">
                                                        <div className="flex items-center gap-2 sm:gap-3">
                                                            {(() => {
                                                                const tagConstant = constants.find(c => c.description === item.item);
                                                                const tagImage = tagConstant?.image;
                                                                const tagColor = tagConstant?.color;
                                                                const tagLabel = item.item || item.service || 'S';

                                                                if (tagImage) {
                                                                    return (
                                                                        <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full overflow-hidden shadow-md">
                                                                            <img src={tagImage} alt={tagLabel} className="w-full h-full object-cover" />
                                                                        </div>
                                                                    );
                                                                } else if (tagColor) {
                                                                    return (
                                                                        <div
                                                                            className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full shadow-[inset_5px_5px_10px_rgba(0,0,0,0.1),inset_-5px_-5px_10px_rgba(255,255,255,0.5)] flex items-center justify-center text-white font-black text-xs sm:text-sm"
                                                                            style={{ backgroundColor: tagColor }}
                                                                        >
                                                                            {tagLabel.substring(0, 2).toUpperCase()}
                                                                        </div>
                                                                    );
                                                                } else {
                                                                    return (
                                                                        <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full bg-[#E6EEF8] shadow-[inset_5px_5px_10px_#d1d9e6,inset_-5px_-5px_10px_#ffffff] flex items-center justify-center text-[#0F4C75] font-black text-xs sm:text-sm">
                                                                            {tagLabel.substring(0, 2).toUpperCase()}
                                                                        </div>
                                                                    );
                                                                }
                                                            })()}
                                                            <div className="flex flex-col">
                                                                <span className="text-xs sm:text-sm font-bold text-slate-500 leading-tight">{getCustomerName(item)}</span>
                                                                {(() => {
                                                                    const est = estimates.find(e => e.value === item.estimate);
                                                                    if (est?.jobAddress) {
                                                                        return (
                                                                            <span className="text-[10px] text-slate-400 font-medium truncate max-w-[150px] mt-0.5">
                                                                                {est.jobAddress}
                                                                            </span>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Row 2: Title */}
                                                    <div className="mb-2">
                                                        <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-tight line-clamp-2">
                                                            {item.title || 'Untitled Schedule'}
                                                        </h3>
                                                    </div>

                                                    {/* Row 3: Job Location */}
                                                    <p className="text-[11px] sm:text-xs font-medium text-slate-400 truncate mb-2">{item.jobLocation}</p>

                                                    {/* Row 4: Estimate # and Project Name */}
                                                    <div className="flex items-center gap-2 mb-3">
                                                        {item.estimate && (
                                                            <span className="text-[10px] sm:text-[11px] font-bold text-[#0F4C75] bg-[#E6EEF8] px-2 py-0.5 rounded-full">
                                                                {item.estimate.replace(/-[vV]\d+$/, '')}
                                                            </span>
                                                        )}
                                                        {item.description && (
                                                            <span className="text-[10px] sm:text-[11px] font-medium text-slate-500 truncate">
                                                                {item.description.split('\n')[0]?.substring(0, 30)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Row 5: Assignees (left) + Badges (right) */}
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex -space-x-2">
                                                            {(item.assignees || []).filter(Boolean).slice(0, 4).map((email: string, i: number) => {
                                                                const emp = employees.find(e => e.value === email);
                                                                return (
                                                                    <div key={i} className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-white flex items-center justify-center text-[8px] sm:text-[9px] font-bold shadow-sm overflow-hidden bg-slate-200 text-slate-600">
                                                                        {emp?.image ? (
                                                                            <img src={emp.image} alt="" className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            email?.[0]?.toUpperCase() || '?'
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                            {(item.assignees || []).filter(Boolean).length > 4 && (
                                                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#38A169] border-2 border-white flex items-center justify-center text-[8px] sm:text-[9px] font-bold text-white shadow-sm">
                                                                    +{(item.assignees?.filter(Boolean).length || 0) - 4}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Badges */}
                                                        <div className="flex -space-x-1.5">
                                                            {[
                                                                { val: item.service, label: 'SV' },
                                                                { val: item.fringe, label: 'FR' },
                                                                { val: item.certifiedPayroll, label: 'CP' },
                                                                { val: item.notifyAssignees, label: 'NA' },
                                                                { val: item.perDiem, label: 'PD' }
                                                            ].filter(attr => attr.val && attr.val !== 'No' && attr.val !== '-' && attr.val !== '').map((attr, i) => {
                                                                const constant = constants.find(c => c.description === attr.val);
                                                                const hasImage = constant?.image;
                                                                const hasColor = constant?.color;

                                                                return (
                                                                    <div
                                                                        key={i}
                                                                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full border border-white flex items-center justify-center text-[7px] sm:text-[8px] font-bold shadow-sm overflow-hidden"
                                                                        style={{
                                                                            backgroundColor: hasColor || '#64748b',
                                                                            color: 'white'
                                                                        }}
                                                                        title={`${attr.label}: ${attr.val}`}
                                                                    >
                                                                        {hasImage ? (
                                                                            <img src={hasImage} alt="" className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            attr.label
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Row 6: Date + PM/Foreman + JHA */}
                                                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-100/50 flex items-center justify-center text-emerald-600">
                                                                <Clock size={12} />
                                                            </div>
                                                            <span className="text-[11px] sm:text-xs font-bold text-slate-700">
                                                                {new Date(item.fromDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                                            </span>
                                                            {item.hasJHA ? (
                                                                <div 
                                                                    className="relative z-10 flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-orange-100 text-orange-600 ml-1 hover:bg-orange-200 transition-colors cursor-pointer" 
                                                                    title="View JHA"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const jhaWithSigs = { 
                                                                            ...item.jha, 
                                                                            signatures: item.JHASignatures || [] 
                                                                        };
                                                                        setSelectedJHA(jhaWithSigs);
                                                                        setIsJhaEditMode(false);
                                                                        setJhaModalOpen(true);
                                                                    }}
                                                                >
                                                                    <ClipboardList size={12} />
                                                                </div>
                                                            ) : (
                                                                <div 
                                                                    className="relative z-10 flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-100 text-slate-400 ml-1 hover:bg-blue-100 hover:text-blue-600 transition-colors cursor-pointer" 
                                                                    title="Create JHA"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
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
                                                                >
                                                                    <FilePlus size={12} />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* PM/Foreman */}
                                                        <div className="flex -space-x-1.5">
                                                            {[item.projectManager, item.foremanName].filter(Boolean).map((email, i) => {
                                                                const emp = employees.find(e => e.value === email);
                                                                const labels = ['PM', 'FM'];
                                                                return (
                                                                    <div
                                                                        key={i}
                                                                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 border-white flex items-center justify-center text-[8px] sm:text-[9px] font-bold shadow-sm overflow-hidden bg-[#0F4C75] text-white"
                                                                        title={`${labels[i]}: ${emp?.label || email}`}
                                                                    >
                                                                        {emp?.image ? (
                                                                            <img src={emp.image} alt="" className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            labels[i]
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Schedule Details Modal */}
            {selectedSchedule && (
                <Modal
                    isOpen={!!selectedSchedule}
                    onClose={() => setSelectedSchedule(null)}
                    title="Job Details"
                    maxWidth="2xl"
                >
                    <div className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                        {/* Row 1: Tag Icon & Client Name */}
                        <div className="flex items-center gap-4">
                            {(() => {
                                const tagConstant = constants.find(c => c.description === selectedSchedule.item);
                                const tagImage = tagConstant?.image;
                                const tagColor = tagConstant?.color;
                                const tagLabel = selectedSchedule.item || selectedSchedule.service || 'S';

                                if (tagImage) {
                                    return (
                                        <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden shadow-md">
                                            <img src={tagImage} alt={tagLabel} className="w-full h-full object-cover" />
                                        </div>
                                    );
                                } else if (tagColor) {
                                    return (
                                        <div className="w-12 h-12 shrink-0 rounded-full shadow-sm flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: tagColor }}>
                                            {tagLabel.substring(0, 2).toUpperCase()}
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="w-12 h-12 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-[#0F4C75] font-black text-sm">
                                            {tagLabel.substring(0, 2).toUpperCase()}
                                        </div>
                                    );
                                }
                            })()}
                            <div>
                                <p className="text-xl font-black text-[#0F4C75] leading-none mb-1">{getCustomerName(selectedSchedule)}</p>
                                {(() => {
                                    const est = estimates.find(e => e.value === selectedSchedule.estimate);
                                    if (est?.jobAddress) {
                                        return <p className="text-xs font-bold text-slate-400 mb-1">{est.jobAddress}</p>;
                                    }
                                    return null;
                                })()}
                                <div className="flex items-center gap-1.5 text-slate-500">
                                    <MapPin size={14} className="text-slate-400 shrink-0" />
                                    <p className="text-xs font-bold text-slate-500 leading-tight">{selectedSchedule.jobLocation || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Row 3: Title & Date */}
                        <div className="grid grid-cols-1 gap-1">
                            <div>
                                <p className="text-base font-black text-slate-800 leading-tight">{selectedSchedule.title}</p>
                            </div>
                            <div className="mt-2 flex items-center gap-3">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-slate-400" />
                                        <span className="text-xs font-bold text-slate-700">
                                            From: {new Date(selectedSchedule.fromDate).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                        </span>
                                    </div>
                                    {selectedSchedule.toDate && (
                                        <div className="flex items-center gap-2">
                                            <div className="w-3.5" />
                                            <span className="text-xs font-bold text-slate-700">
                                                To: {new Date(selectedSchedule.toDate).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {selectedSchedule.estimate && (
                                    <span className="text-[10px] font-bold text-[#0F4C75] bg-[#E6EEF8] px-2 py-0.5 rounded-full">
                                        {selectedSchedule.estimate.replace(/-[vV]\d+$/, '')}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="h-px bg-slate-100 my-2" />

                        {/* Rows 5, 6, 7: PM, Foreman */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { label: 'Project Manager', val: selectedSchedule.projectManager, color: 'bg-blue-600' },
                                { label: 'Foreman', val: selectedSchedule.foremanName, color: 'bg-emerald-600' }
                            ].map((role, idx) => {
                                if (!role.val) return null;
                                const emp = employees.find(e => e.value === role.val);
                                return (
                                    <div key={idx} className="flex items-center gap-2 p-2 rounded-xl transition-colors border border-transparent hover:border-slate-100">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm overflow-hidden shrink-0 ${role.color}`}>
                                            {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : (emp?.label?.[0] || role.val[0])}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{role.label}</p>
                                            <p className="text-xs font-bold text-slate-700 truncate">{emp?.label || role.val}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="h-px bg-slate-100 my-2" />

                        {/* Row 9: Assignees */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Assignees</p>
                            <div className="flex flex-wrap gap-2">
                                {(selectedSchedule.assignees || []).map((assignee: string, i: number) => {
                                    const emp = employees.find(e => e.value === assignee);
                                    return (
                                        <div key={i} className="inline-flex items-center gap-2 pl-1 pr-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                                            <div className="w-6 h-6 rounded-full bg-slate-300 overflow-hidden flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                                                {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : (emp?.label?.[0] || assignee[0])}
                                            </div>
                                            <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]">{emp?.label || assignee}</span>
                                        </div>
                                    );
                                })}
                                {(!selectedSchedule.assignees || selectedSchedule.assignees.length === 0) && (
                                    <span className="text-xs text-slate-400 italic">No assignees</span>
                                )}
                            </div>
                        </div>

                        {/* Row 8: Service, Tag, Notify, Per Diem */}
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Service</p>
                                <Badge variant="default" className="text-slate-600 bg-slate-50 border-slate-200">{selectedSchedule.service || 'N/A'}</Badge>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tag</p>
                                <Badge className="bg-[#E6EEF8] text-[#0F4C75] hover:bg-[#dbe6f5] border-none">{selectedSchedule.item || 'N/A'}</Badge>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notify</p>
                                <Badge variant={selectedSchedule.notifyAssignees === 'Yes' ? 'success' : 'default'} className="gap-1.5 pl-1.5">
                                    <div className={`w-2 h-2 rounded-full ${selectedSchedule.notifyAssignees === 'Yes' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                    {selectedSchedule.notifyAssignees || 'No'}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Per Diem</p>
                                <Badge variant={selectedSchedule.perDiem === 'Yes' ? 'success' : 'default'} className="gap-1.5 pl-1.5">
                                    <div className={`w-2 h-2 rounded-full ${selectedSchedule.perDiem === 'Yes' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                    {selectedSchedule.perDiem || 'No'}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Certified Payroll</p>
                                <Badge variant={selectedSchedule.certifiedPayroll ? 'success' : 'default'} className="gap-1.5 pl-1.5">
                                    <div className={`w-2 h-2 rounded-full ${selectedSchedule.certifiedPayroll ? 'bg-green-500' : 'bg-slate-400'}`} />
                                    {selectedSchedule.certifiedPayroll || 'No'}
                                </Badge>
                            </div>
                        </div>

                        {/* Row 11: Scope / Notes */}
                        {selectedSchedule.description && (
                            <div className="pt-4 border-t border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Scope / Notes</p>
                                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                                    {selectedSchedule.description}
                                </p>
                            </div>
                        )}

                        {/* Aerial Image & Site Layout */}
                        {(selectedSchedule.aerialImage || selectedSchedule.siteLayout) && (
                            <div className="pt-4 border-t border-slate-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {selectedSchedule.aerialImage && (
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Aerial Image</p>
                                            <div 
                                                className="relative group cursor-pointer"
                                                onClick={() => setMediaModal({ isOpen: true, type: 'image', url: selectedSchedule.aerialImage!, title: 'Aerial Site View' })}
                                            >
                                                <img 
                                                    src={selectedSchedule.aerialImage} 
                                                    alt="Aerial View" 
                                                    className="w-full h-40 object-cover rounded-xl border border-slate-200 group-hover:opacity-90 transition-all shadow-sm"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="px-3 py-1.5 bg-white/90 backdrop-blur text-[10px] font-bold text-slate-700 rounded-lg shadow-xl">Click to Enlarge</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {selectedSchedule.siteLayout && (
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Interactive 3D Preview</p>
                                            {(() => {
                                                const earthUrl = selectedSchedule.siteLayout;
                                                const coordsMatch = earthUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                                                const lat = coordsMatch?.[1];
                                                const lng = coordsMatch?.[2];
                                                const embedUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}&t=k&z=19&ie=UTF8&iwloc=&output=embed` : '';
                                                
                                                return (
                                                    <div 
                                                        className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 group cursor-pointer"
                                                        onClick={() => {
                                                            if (embedUrl) {
                                                                setMediaModal({ isOpen: true, type: 'map', url: embedUrl, title: 'Interactive Site Layout' });
                                                            } else {
                                                                window.open(earthUrl, '_blank');
                                                            }
                                                        }}
                                                    >
                                                        {embedUrl ? (
                                                            <div className="w-full h-full">
                                                                <iframe
                                                                    width="100%"
                                                                    height="100%"
                                                                    style={{ border: 0 }}
                                                                    src={embedUrl}
                                                                    className="w-full h-full pointer-events-none"
                                                                />
                                                                <div className="absolute inset-0 bg-transparent flex items-center justify-center group-hover:bg-black/5 transition-all">
                                                                    <div className="px-4 py-2 bg-white/90 backdrop-blur shadow-2xl rounded-xl scale-75 group-hover:scale-100 transition-transform flex items-center gap-2">
                                                                        <MapPin size={16} className="text-blue-600" />
                                                                        <span className="text-[11px] font-black text-slate-800 uppercase">Enlarge Map</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                                                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg mb-3 group-hover:scale-110 transition-transform">
                                                                    <MapPin size={24} className="text-blue-600" />
                                                                </div>
                                                                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Open Google Earth</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* JHA Details Modal */}
            <Modal
                isOpen={jhaModalOpen}
                onClose={() => setJhaModalOpen(false)}
                title="Job Hazard Analysis (JHA)"
                maxWidth="4xl"
            >
                {selectedJHA ? (
                    isJhaEditMode ? (
                        <form onSubmit={handleSaveJHAForm} className="space-y-6">
                            {/* Header Inputs */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Date (Auto)</label>
                                    <div className="w-full text-sm font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5">
                                        {new Date(selectedJHA.date).toLocaleDateString()}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Time (Auto)</label>
                                    <div className="w-full text-sm font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5">
                                        {selectedJHA.jhaTime || new Date().toLocaleTimeString('en-US', { hour12: false })}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Created By</label>
                                    <div className="flex items-center gap-2 w-full text-sm font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5">
                                        {(() => {
                                            const emp = employees.find(e => e.value === selectedJHA.createdBy);
                                            if (emp) {
                                                return (
                                                    <>
                                                        <div className="w-5 h-5 rounded-full bg-slate-300 overflow-hidden shrink-0">
                                                            {emp.image ? <img src={emp.image} className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-[9px] font-bold text-white">{emp.label?.[0]}</span>}
                                                        </div>
                                                        <span className="truncate">{emp.label}</span>
                                                    </>
                                                );
                                            }
                                            return <span className="truncate">{selectedJHA.createdBy || 'You'}</span>;
                                        })()}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">USA No.</label>
                                    <input 
                                        type="text"
                                        className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                                        value={selectedJHA.usaNo || ''}
                                        onChange={(e) => setSelectedJHA({...selectedJHA, usaNo: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Subcontractor USA</label>
                                    <input 
                                        type="text"
                                        className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                                        value={selectedJHA.subcontractorUSANo || ''}
                                        onChange={(e) => setSelectedJHA({...selectedJHA, subcontractorUSANo: e.target.value})}
                                    />
                                </div>
                            </div>

                            {/* Daily Work Checkboxes */}
                            <div>
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Daily Work</h4>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    {[
                                        { key: 'operatingMiniEx', label: 'Operating Mini Ex' },
                                        { key: 'operatingAVacuumTruck', label: 'Vacuum Truck' },
                                        { key: 'excavatingTrenching', label: 'Excavating/Trenching' },
                                        { key: 'acConcWork', label: 'AC/Concrete Work' },
                                        { key: 'operatingBackhoe', label: 'Operating Backhoe' },
                                        { key: 'workingInATrench', label: 'Working in Trench' },
                                        { key: 'trafficControl', label: 'Traffic Control' },
                                        { key: 'roadWork', label: 'Road Work' },
                                        { key: 'operatingHdd', label: 'Operating HDD' },
                                        { key: 'confinedSpace', label: 'Confined Space' },
                                        { key: 'settingUgBoxes', label: 'Setting UG Boxes' },
                                        { key: 'otherDailyWork', label: 'Other Daily Work' },
                                    ].map((item) => (
                                        <div key={item.key} className="flex flex-col gap-2">
                                            <label className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors ${selectedJHA[item.key] ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-[#0F4C75] rounded focus:ring-[#0F4C75]"
                                                    checked={!!selectedJHA[item.key]}
                                                    onChange={(e) => setSelectedJHA({ ...selectedJHA, [item.key]: e.target.checked })}
                                                />
                                                <span className={`text-xs font-bold ${selectedJHA[item.key] ? 'text-blue-900' : 'text-slate-600'}`}>{item.label}</span>
                                            </label>
                                            {item.key === 'otherDailyWork' && selectedJHA[item.key] && (
                                                <input
                                                    type="text"
                                                    placeholder="Specify other work..."
                                                    className="text-xs border-b border-slate-300 focus:border-[#0F4C75] focus:outline-none px-1 py-1 bg-transparent w-full"
                                                    value={selectedJHA.commentsOtherDailyWork || ''}
                                                    onChange={(e) => setSelectedJHA({...selectedJHA, commentsOtherDailyWork: e.target.value})}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Jobsite Hazards */}
                            <div>
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Jobsite Hazards</h4>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                    {[
                                        { key: 'sidewalks', label: 'Sidewalks', commentKey: 'commentsOnSidewalks' },
                                        { key: 'heatAwareness', label: 'Heat Awareness', commentKey: 'commentsOnHeatAwareness' },
                                        { key: 'ladderWork', label: 'Ladder Work', commentKey: 'commentsOnLadderWork' },
                                        { key: 'overheadLifting', label: 'Overhead Lifting', commentKey: 'commentsOnOverheadLifting' },
                                        { key: 'materialHandling', label: 'Material Handling', commentKey: 'commentsOnMaterialHandling' },
                                        { key: 'roadHazards', label: 'Road Hazards', commentKey: 'commentsOnRoadHazards' },
                                        { key: 'heavyLifting', label: 'Heavy Lifting', commentKey: 'commentsOnHeavyLifting' },
                                        { key: 'highNoise', label: 'High Noise', commentKey: 'commentsOnHighNoise' },
                                        { key: 'pinchPoints', label: 'Pinch Points', commentKey: 'commentsOnPinchPoints' },
                                        { key: 'sharpObjects', label: 'Sharp Objects', commentKey: 'commentsOnSharpObjects' },
                                        { key: 'trippingHazards', label: 'Tripping Hazards', commentKey: 'commentsOnTrippingHazards' },
                                        { key: 'otherJobsiteHazards', label: 'Other Hazards', commentKey: 'commentsOnOther' },
                                    ].map((item) => (
                                        <div key={item.key} className="flex flex-col gap-2">
                                            <label className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-colors ${selectedJHA[item.key] ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-600"
                                                    checked={!!selectedJHA[item.key]}
                                                    onChange={(e) => setSelectedJHA({ ...selectedJHA, [item.key]: e.target.checked })}
                                                />
                                                <span className={`text-xs font-bold ${selectedJHA[item.key] ? 'text-orange-900' : 'text-slate-600'}`}>{item.label}</span>
                                            </label>
                                            {selectedJHA[item.key] && (
                                                <input
                                                    type="text"
                                                    placeholder="Add comment..."
                                                    className="ml-1 text-xs border-b border-slate-300 focus:border-orange-500 focus:outline-none px-1 py-1 bg-transparent w-9/10"
                                                    value={selectedJHA[item.commentKey] || ''}
                                                    onChange={(e) => setSelectedJHA({...selectedJHA, [item.commentKey]: e.target.value})}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4">
                                     <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Specific Notes</label>
                                     <textarea
                                        className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                                        rows={2}
                                        value={selectedJHA.anySpecificNotes || ''}
                                        onChange={(e) => setSelectedJHA({...selectedJHA, anySpecificNotes: e.target.value})}
                                        placeholder="Enter any additional safety notes..."
                                     />
                                </div>
                            </div>
                            
                            {/* Emergency Plan */}
                             <div>
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Emergency Plan</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     {[
                                        { key: 'stagingAreaDiscussed', label: 'Staging Area Discussed' },
                                        { key: 'rescueProceduresDiscussed', label: 'Rescue Procedures Discussed' },
                                        { key: 'evacuationRoutesDiscussed', label: 'Evacuation Routes Discussed' },
                                        { key: 'emergencyContactNumberWillBe911', label: 'Emergency Contact is 911' },
                                        { key: 'firstAidAndCPREquipmentOnsite', label: 'First Aid/CPR Onsite' },
                                        { key: 'closestHospitalDiscussed', label: 'Closest Hospital Discussed' },
                                     ].map((item) => (
                                        <label key={item.key} className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-600"
                                                checked={!!selectedJHA[item.key]}
                                                onChange={(e) => setSelectedJHA({ ...selectedJHA, [item.key]: e.target.checked })}
                                            />
                                            <span className="text-sm font-medium text-slate-700">{item.label}</span>
                                        </label>
                                     ))}
                                </div>
                             </div>

                             {/* Hospital Info */}
                             <div className="bg-red-50 p-4 rounded-xl border border-red-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div>
                                     <label className="text-[10px] font-bold text-red-400 uppercase block mb-1">Nearest Hospital Name</label>
                                     <input 
                                        type="text"
                                        className="w-full text-sm font-bold text-slate-700 bg-white border border-red-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-200"
                                        value={selectedJHA.nameOfHospital || ''}
                                        onChange={(e) => setSelectedJHA({...selectedJHA, nameOfHospital: e.target.value})}
                                        placeholder="Enter Hospital Name"
                                     />
                                 </div>
                                 <div>
                                     <label className="text-[10px] font-bold text-red-400 uppercase block mb-1">Hospital Address</label>
                                     <input 
                                        type="text"
                                        className="w-full text-sm font-bold text-slate-700 bg-white border border-red-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-200"
                                        value={selectedJHA.addressOfHospital || ''}
                                        onChange={(e) => setSelectedJHA({...selectedJHA, addressOfHospital: e.target.value})}
                                        placeholder="Enter Hospital Address"
                                     />
                                 </div>
                             </div>

                            {/* Signatures Section (Moved to Bottom) */}
                            <div className="border rounded-xl p-4 border-slate-200 bg-blue-50/50">
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-blue-100 pb-2 flex justify-between">
                                    <span>Signatures</span>
                                    <span className="text-[10px] font-normal text-slate-500 normal-case">All assignees must sign</span>
                                </h4>
                                
                                {activeSignatureEmployee ? (
                                    <div className="max-w-md mx-auto">
                                        <SignaturePad 
                                            employeeName={employees.find(e => e.value === activeSignatureEmployee)?.label || activeSignatureEmployee}
                                            onSave={handleSaveJHASignature} 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setActiveSignatureEmployee(null)} 
                                            className="mt-2 w-full text-xs text-slate-500 hover:text-slate-800"
                                        >
                                            Cancel Signing
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {(() => {
                                            // Get Assignees
                                            const schedule = dailySchedules.find(s => s._id === selectedJHA.schedule_id) || selectedJHA.scheduleRef;
                                            const assignees = schedule?.assignees || [];
                                            
                                            // Ensure uniqueness and filter legacy
                                            const uniqueAssignees = Array.from(new Set(assignees)).filter(Boolean) as string[];

                                            return uniqueAssignees.map((email: string) => {
                                                const emp = employees.find(e => e.value === email);
                                                const sig = selectedJHA.signatures?.find((s: any) => s.employee === email);
                                                
                                                return (
                                                    <div key={email} className={`relative p-3 rounded-xl border transition-all ${sig ? 'bg-white border-green-200 shadow-sm' : 'bg-white border-dashed border-slate-300 hover:border-[#0F4C75]'}`}>
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-white shadow-sm flex items-center justify-center shrink-0">
                                                                {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-slate-500">{emp?.label?.[0]}</span>}
                                                            </div>
                                                            <div className="overflow-hidden">
                                                                <p className="text-xs font-bold text-slate-700 truncate">{emp?.label || email}</p>
                                                                <p className="text-[10px] text-slate-400">{sig ? 'Signed' : 'Pending Signature'}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        {sig ? (
                                                            <div className="h-12 border-t border-slate-50 mt-2 flex items-center justify-center">
                                                                <img src={sig.signature} className="max-h-full max-w-full object-contain opacity-80" />
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveSignatureEmployee(email)}
                                                                className="w-full py-1.5 mt-1 text-xs font-bold text-white bg-[#0F4C75] hover:bg-[#0b3d61] rounded-lg transition-colors flex items-center justify-center gap-1"
                                                            >
                                                                <FilePlus size={12} /> Sign Now
                                                            </button>
                                                        )}
                                                        {sig && (
                                                             <div className="absolute top-2 right-2 text-green-500"><CheckCircle2 size={14} /></div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </div>

                             <div className="flex justify-end pt-4 border-t border-slate-100">
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-[#0F4C75] hover:bg-[#0b3d61] text-white font-bold rounded-xl shadow-lg transition-all"
                                >
                                    Save Entire JHA
                                </button>
                             </div>
                        </form>
                    ) : (
                    <div className="space-y-8">
                        {/* Section 1: JHA Info */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase">JHA Info</h4>
                                <button
                                    onClick={() => setIsJhaEditMode(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F4C75] hover:bg-[#0b3d61] text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    <Edit size={12} /> Edit JHA
                                </button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Date</p><p className="text-sm font-bold text-slate-700">{new Date(selectedJHA.date).toLocaleDateString()}</p></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Time</p><p className="text-sm font-bold text-slate-700">{selectedJHA.jhaTime}</p></div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Created By</p>
                                    {(() => {
                                        const creator = employees.find(e => e.value === selectedJHA.createdBy);
                                        if (creator) {
                                            return (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                                        {creator.image ? <img src={creator.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-slate-500">{creator.label?.[0]}</div>}
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-700 truncate">{creator.label}</p>
                                                </div>
                                            );
                                        }
                                        return <p className="text-sm font-bold text-slate-700 truncate">{selectedJHA.createdBy}</p>;
                                    })()}
                                </div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">USA No.</p><p className="text-sm font-bold text-slate-700">{selectedJHA.usaNo || '-'}</p></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Subcontractor USA</p><p className="text-sm font-bold text-slate-700">{selectedJHA.subcontractorUSANo || '-'}</p></div>
                                <div><p className="text-[10px] font-bold text-slate-400 uppercase">Client Email</p><p className="text-sm font-bold text-slate-700">{selectedJHA.clientEmail || '-'}</p></div>
                            </div>
                        </div>

                        {/* Section 2: Daily Work */}
                        <div>
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Daily Work</h4>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                {[
                                    { label: 'Operating Mini Ex', val: selectedJHA.operatingMiniEx },
                                    { label: 'Vacuum Truck', val: selectedJHA.operatingAVacuumTruck },
                                    { label: 'Excavating/Trenching', val: selectedJHA.excavatingTrenching },
                                    { label: 'AC/Concrete Work', val: selectedJHA.acConcWork },
                                    { label: 'Operating Backhoe', val: selectedJHA.operatingBackhoe },
                                    { label: 'Working in Trench', val: selectedJHA.workingInATrench },
                                    { label: 'Traffic Control', val: selectedJHA.trafficControl },
                                    { label: 'Road Work', val: selectedJHA.roadWork },
                                    { label: 'Operating HDD', val: selectedJHA.operatingHdd },
                                    { label: 'Confined Space', val: selectedJHA.confinedSpace },
                                    { label: 'Setting UG Boxes', val: selectedJHA.settingUgBoxes },
                                    { label: 'Other Daily Work', val: selectedJHA.otherDailyWork, comment: selectedJHA.commentsOtherDailyWork },
                                ].map((item, i) => (
                                    <div key={i} className={`p-3 rounded-lg border flex flex-col gap-2 ${item.val ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100 opacity-60'}`}>
                                        <div className="flex items-center gap-2">
                                            {item.val ? <CheckCircle2 size={16} className="text-blue-600 shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />}
                                            <span className={`text-xs font-bold ${item.val ? 'text-blue-900' : 'text-slate-500'}`}>{item.label}</span>
                                        </div>
                                        {item.val && item.comment && (
                                            <p className="text-[10px] italic text-slate-600 bg-white/50 p-1.5 rounded ml-6 border border-blue-100/50">{item.comment}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Section 3: Jobsite Hazards */}
                        <div>
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Jobsite Hazards</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                {[
                                    { label: 'Sidewalks', val: selectedJHA.sidewalks, c: selectedJHA.commentsOnSidewalks },
                                    { label: 'Heat Awareness', val: selectedJHA.heatAwareness, c: selectedJHA.commentsOnHeatAwareness },
                                    { label: 'Ladder Work', val: selectedJHA.ladderWork, c: selectedJHA.commentsOnLadderWork },
                                    { label: 'Overhead Lifting', val: selectedJHA.overheadLifting, c: selectedJHA.commentsOnOverheadLifting },
                                    { label: 'Material Handling', val: selectedJHA.materialHandling, c: selectedJHA.commentsOnMaterialHandling },
                                    { label: 'Road Hazards', val: selectedJHA.roadHazards, c: selectedJHA.commentsOnRoadHazards },
                                    { label: 'Heavy Lifting', val: selectedJHA.heavyLifting, c: selectedJHA.commentsOnHeavyLifting },
                                    { label: 'High Noise', val: selectedJHA.highNoise, c: selectedJHA.commentsOnHighNoise },
                                    { label: 'Pinch Points', val: selectedJHA.pinchPoints, c: selectedJHA.commentsOnPinchPoints },
                                    { label: 'Sharp Objects', val: selectedJHA.sharpObjects, c: selectedJHA.commentsOnSharpObjects },
                                    { label: 'Tripping Hazards', val: selectedJHA.trippingHazards, c: selectedJHA.commentsOnTrippingHazards },
                                    { label: 'Other Hazards', val: selectedJHA.otherJobsiteHazards, c: selectedJHA.commentsOnOther },
                                ].map((item, i) => (
                                    <div key={i} className="group">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                {item.val ? <AlertCircle size={14} className="text-orange-500" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
                                                <span className={`text-xs font-bold ${item.val ? 'text-slate-800' : 'text-slate-400'}`}>{item.label}</span>
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.val ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-400'}`}>
                                                {item.val ? 'YES' : 'NO'}
                                            </span>
                                        </div>
                                        {item.c && (
                                            <div className="pl-6 text-[11px] text-slate-600 bg-orange-50/50 p-2 rounded border border-orange-100/50 mt-1">
                                                <span className="font-semibold text-orange-800/70">Note:</span> {item.c}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {selectedJHA.anySpecificNotes && (
                                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                                    <p className="text-xs font-bold text-yellow-800 mb-1">Specific Notes:</p>
                                    <p className="text-xs text-yellow-900/80">{selectedJHA.anySpecificNotes}</p>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Section 4: Emergency Action Plan */}
                            <div>
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Emergency Action Plan</h4>
                                <div className="space-y-3">
                                    {[
                                        { label: 'Staging Area Discussed', val: selectedJHA.stagingAreaDiscussed },
                                        { label: 'Rescue Procedures Discussed', val: selectedJHA.rescueProceduresDiscussed },
                                        { label: 'Evacuation Routes Discussed', val: selectedJHA.evacuationRoutesDiscussed },
                                        { label: 'Emergency Contact is 911', val: selectedJHA.emergencyContactNumberWillBe911 },
                                        { label: 'First Aid & CPR Equipment Onsite', val: selectedJHA.firstAidAndCPREquipmentOnsite },
                                        { label: 'Closest Hospital Discussed', val: selectedJHA.closestHospitalDiscussed },
                                    ].map((item, i) => (
                                        <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                                            <span className="text-xs font-medium text-slate-700">{item.label}</span>
                                            {item.val ? 
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                                                    <CheckCircle2 size={10} /> DONE
                                                </div> 
                                                : 
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-100 text-slate-400 px-2 py-1 rounded-full">
                                                    PENDING
                                                </div>
                                            }
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section 5: Hospital */}
                            <div>
                                <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Hospital Information</h4>
                                <div className="bg-red-50 p-5 rounded-xl border border-red-100">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-500 shrink-0">
                                            <Plus size={20} strokeWidth={3} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Nearest Hospital</p>
                                            <p className="text-base font-black text-red-900 mb-1">{selectedJHA.nameOfHospital || 'Not Specified'}</p>
                                            <p className="text-sm text-red-800/80 leading-relaxed">{selectedJHA.addressOfHospital || 'No address provided'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 6: Signatures */}
                        <div>
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Employee Signatures</h4>
                            {selectedJHA.signatures && selectedJHA.signatures.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {selectedJHA.signatures.map((sig: any, index: number) => {
                                        const emp = employees.find(e => e.value === sig.employee);
                                        return (
                                            <div key={index} className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col items-center gap-1.5 hover:shadow-md transition-all">
                                                <div className="w-full h-24 bg-slate-50 rounded border border-slate-100 flex items-center justify-center overflow-hidden relative">
                                                    {sig.signature ? (
                                                        <img src={sig.signature} alt="Signature" className="max-w-full max-h-full object-contain" />
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">No Image</span>
                                                    )}
                                                </div>
                                                
                                                <div className="flex items-center gap-2 mt-1">
                                                     <div className="w-5 h-5 rounded-full bg-slate-200 border border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                                                        {emp?.image ? (
                                                            <img src={emp.image} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <span className="text-[9px] font-bold text-slate-500">{emp?.label?.[0] || 'U'}</span>
                                                        )}
                                                     </div>
                                                     <p className="text-xs font-bold text-slate-700 truncate max-w-[140px]" title={emp?.label || sig.employee}>
                                                        {emp?.label || sig.employee}
                                                     </p>
                                                </div>

                                                <p className="text-[10px] text-slate-400 font-medium">
                                                    {new Date(sig.createdAt || Date.now()).toLocaleString('en-US', { 
                                                        year: 'numeric', 
                                                        month: 'numeric', 
                                                        day: 'numeric', 
                                                        hour: 'numeric', 
                                                        minute: 'numeric', 
                                                        hour12: true 
                                                    })}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                    <p className="text-sm text-slate-400 italic">No signatures recorded.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    )
                ) : (
                    <EmptyState title="No Data" message="Unable to load JHA details." />
                )}
            </Modal>
            {/* Media Modal (Lightbox) */}
            <Modal
                isOpen={mediaModal.isOpen}
                onClose={() => setMediaModal({ ...mediaModal, isOpen: false })}
                title={mediaModal.title}
                maxWidth={mediaModal.type === 'map' ? '6xl' : '4xl'}
            >
                <div className="p-1">
                    {mediaModal.type === 'image' ? (
                        <img 
                            src={mediaModal.url} 
                            alt={mediaModal.title} 
                            className="w-full h-auto rounded-xl shadow-2xl border border-slate-200"
                        />
                    ) : (
                        <div className="w-full aspect-[16/10] rounded-xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-100">
                            <iframe
                                src={mediaModal.url}
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                className="w-full h-full"
                            />
                        </div>
                    )}
                    <div className="mt-6 flex justify-end gap-3">
                        {mediaModal.type === 'map' && (
                            <a 
                                href={mediaModal.url.replace('&output=embed', '').replace('output=embed', '')} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg hover:shadow-blue-200/50 hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                                <MapPin size={18} />
                                Open in Google Earth
                            </a>
                        )}
                        <button
                            onClick={() => setMediaModal({ ...mediaModal, isOpen: false })}
                            className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-black hover:bg-slate-200 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
