'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
    Package, FileText, Calculator, TrendingUp, Activity,
    CheckCircle, Users, Layers, Zap, ArrowRight, ArrowUpRight,
    Clock, MoreHorizontal, Briefcase, FileSpreadsheet,
    Calendar, DollarSign, ClipboardCheck, AlertTriangle,
    Settings, BarChart3, FileCheck, Shield, Plus, Sparkles,
    ChevronRight, ChevronLeft, Truck, Tag, MapPin, X, Edit, Trash2, Phone
} from 'lucide-react';
import { Header, Modal, Badge } from '@/components/ui';

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
    
    // Schedule Logic
    const [scheduleDate, setScheduleDate] = useState(new Date());
    const [dailySchedules, setDailySchedules] = useState<any[]>([]);
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const dateInputRef = useRef<HTMLInputElement>(null);
    const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
    const [constants, setConstants] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);

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
        } catch (error) {
            console.error('Error loading stats:', error);
        }
        setLoading(false);
    };

    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening';
    const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    // Recent activities data
    const recentActivities = [
        { id: '1', name: 'Infrastructure Project', type: 'Estimate', status: 'Open', value: '$45,200', time: '2h ago', avatar: 'IP' },
        { id: '2', name: 'Safety Audit Q4', type: 'JHA', status: 'Processing', value: '-', time: '4h ago', avatar: 'SA' },
        { id: '3', name: 'Equipment Rental', type: 'Proposal', status: 'Completed', value: '$12,800', time: '1d ago', avatar: 'ER' },
        { id: '4', name: 'Labor Cost Review', type: 'Report', status: 'Open', value: '$8,500', time: '2d ago', avatar: 'LC' },
    ];

    // Upcoming schedule
    const schedule = [
        { time: '9:15', period: 'AM', title: 'Weekly Team Sync', desc: 'Align priorities and share updates', color: 'bg-[#0066FF]' },
        { time: '2:00', period: 'PM', title: 'Client Pitch', desc: 'Infrastructure project proposal', color: 'bg-[#0052CC]' },
        { time: '5:30', period: 'PM', title: 'Safety Review', desc: 'Review pending JHA documents', color: 'bg-[#003D99]' },
    ];

    // Quick stats for the week
    const weeklyStats = [
        { label: 'Mon', value: 65 },
        { label: 'Tue', value: 45 },
        { label: 'Wed', value: 80 },
        { label: 'Thu', value: 55 },
        { label: 'Fri', value: 70 },
        { label: 'Sat', value: 40 },
        { label: 'Sun', value: 30 },
    ];

    // Animated counter
    const AnimatedCounter = ({ value, prefix = '', suffix = '', decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) => {
        const [count, setCount] = useState(0);
        const countRef = useRef<HTMLSpanElement>(null);

        useEffect(() => {
            if (!mounted) return;
            const end = value;
            const duration = 1500;
            const startTime = performance.now();

            const animate = (currentTime: number) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeOutQuart = 1 - Math.pow(1 - progress, 4);
                const current = end * easeOutQuart;

                setCount(current);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };

            requestAnimationFrame(animate);
        }, [value, mounted]);

        return <span ref={countRef}>{prefix}{decimals > 0 ? count.toFixed(decimals) : Math.floor(count).toLocaleString()}{suffix}</span>;
    };

    // Progress Ring Component
    const ProgressRing = ({ progress, size = 120, strokeWidth = 10, color = '#0066FF' }: { progress: number; size?: number; strokeWidth?: number; color?: string }) => {
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (progress / 100) * circumference;

        return (
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#E5F0FF"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={loading ? circumference : offset}
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
        );
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Open': return 'status-open';
            case 'Processing': return 'status-processing';
            case 'Completed': return 'status-completed';
            default: return 'status-pending';
        }
    };

    return (
        <>
            <div className="hidden md:block">
                <Header showDashboardActions={true} />
            </div>
            <div className="min-h-screen bg-[#f8fafc] overflow-x-hidden">
                <div className="max-w-[1600px] mx-auto px-2 md:px-6 py-4 md:py-6">

                    {/* Top Bar - REMOVED */}
                    <div className={`hidden md:flex flex-col md:flex-row items-center md:justify-between text-center md:text-left mb-8 ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}>
                        <div>
                            {/* Greeting removed for mobile/sleek look, kept hidden struct for desktop alignment if needed or just remove */}
                        </div>
                    </div>

                    {/* Stats Cards Row - Hidden on Mobile */}
                    <div className="hidden md:grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
                        {[
                            { label: 'Total Estimates', value: stats.estimates, trend: '+12%', trendUp: true, icon: Calculator, gradient: 'from-[#E5F0FF] to-[#CCE0FF]' },
                            { label: 'In Progress', value: stats.activeEstimates, trend: 'Active', trendUp: true, icon: Activity, gradient: 'from-[#E5F0FF] to-[#99C2FF]' },
                            { label: 'Completed', value: stats.completedEstimates, trend: 'Done', trendUp: true, icon: CheckCircle, gradient: 'from-[#DCFCE7] to-[#BBF7D0]' },
                            { label: 'Catalog Items', value: stats.catalogueItems, trend: `${stats.catalogueItems}`, trendUp: true, icon: Package, gradient: 'from-[#FEF3C7] to-[#FDE68A]' },
                            { label: 'Pipeline Value', value: Math.round(stats.totalValue / 1000), prefix: '$', suffix: 'K', trend: '+8%', trendUp: true, icon: DollarSign, gradient: 'from-[#F3E8FF] to-[#E9D5FF]' },
                        ].map((stat, i) => (
                            <div
                                key={stat.label}
                                className={`bg-gradient-to-br ${stat.gradient} rounded-2xl p-4 md:p-5 border border-white/50 shadow-sm card-hover ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`}
                                style={{ animationDelay: `${i * 100}ms` }}
                            >
                                <div className="flex items-center justify-between mb-2 md:mb-3">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-white/80 flex items-center justify-center shadow-sm">
                                        <stat.icon size={18} className="text-[#0066FF]" />
                                    </div>
                                    <span className={`text-[10px] md:text-xs font-semibold px-2 py-0.5 rounded-full ${stat.trendUp ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                        {stat.trend}
                                    </span>
                                </div>
                                <p className="text-xl md:text-3xl font-bold text-slate-900 mb-0.5 md:mb-1">
                                    {loading ? '...' : <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />}
                                </p>
                                <p className="text-[10px] md:text-xs font-medium text-slate-500">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Main Grid */}
                    <div className="grid grid-cols-12 gap-6 mb-8">

                        {/* Recent Activity - Hidden on Mobile */}
                        <div className="hidden lg:block lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
                                <Link href="/estimates" className="text-sm text-[#0066FF] font-medium flex items-center gap-1 hover:gap-2 transition-all">
                                    View all <ArrowRight size={14} />
                                </Link>
                            </div>
                            <div className="space-y-3">
                                {recentActivities.map((item, i) => (
                                    <div
                                        key={item.id}
                                        className={`flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group ${mounted ? 'animate-slide-in-right' : 'opacity-0'}`}
                                        style={{ animationDelay: `${300 + i * 100}ms` }}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0066FF] to-[#3385FF] flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-[#0066FF]/20">
                                            {item.avatar}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-[#0066FF] transition-colors">{item.name}</p>
                                            <p className="text-xs text-slate-400">{item.type}</p>
                                        </div>
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getStatusColor(item.status)}`}>
                                            {item.status}
                                        </span>
                                        <span className="text-sm font-semibold text-slate-700">{item.value}</span>
                                        <span className="text-xs text-slate-400">{item.time}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Schedule - Span 4 */}
                        <div className={`col-span-12 lg:col-span-4 bg-white rounded-3xl p-3 md:p-6 border border-slate-100 shadow-sm ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '300ms' }}>
                            <div className="flex items-center justify-between mb-5">
                                <button 
                                    onClick={() => {
                                        const d = new Date(scheduleDate);
                                        d.setDate(d.getDate() - 1);
                                        setScheduleDate(d);
                                    }}
                                    className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                
                                <div className="text-center cursor-pointer relative group" onClick={() => dateInputRef.current?.showPicker()}>
                                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#0066FF] transition-colors">
                                        {scheduleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} Schedule
                                    </h3>
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
                                    <p className="text-[10px] text-slate-400 font-medium">Tap to change date</p>
                                </div>

                                <button 
                                    onClick={() => {
                                        const d = new Date(scheduleDate);
                                        d.setDate(d.getDate() + 1);
                                        setScheduleDate(d);
                                    }}
                                    className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>

                            <div className="space-y-3 min-h-[200px] max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                                {scheduleLoading ? (
                                    <div className="flex flex-col items-center justify-center h-40 gap-2">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0066FF]"></div>
                                        <p className="text-xs text-slate-400">Loading schedules...</p>
                                    </div>
                                ) : dailySchedules.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                            <Calendar className="text-slate-300" size={24} />
                                        </div>
                                        <p className="text-sm font-semibold text-slate-500">No schedules found</p>
                                        <p className="text-xs text-slate-400">No work scheduled for this day</p>
                                    </div>
                                ) : (
                                    dailySchedules.map((item, i) => (
                                        <div
                                            key={item._id || i}
                                            onClick={() => setSelectedSchedule(item)}
                                            className={`group relative bg-white rounded-[40px] p-7 cursor-pointer transition-all duration-300 transform border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 ${mounted ? 'animate-scale-in' : 'opacity-0'}`}
                                            style={{ animationDelay: `${100 + i * 50}ms` }}
                                        >
                                            {/* Action Overlay */}
                                            <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); }}
                                                    className="p-2 bg-white/80 backdrop-blur rounded-full text-slate-500 hover:text-[#0F4C75] shadow-sm transition-colors"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); }}
                                                    className="p-2 bg-white/80 backdrop-blur rounded-full text-slate-500 hover:text-red-500 shadow-sm transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            <div className="flex flex-col h-full justify-between">

                                                {/* Header: Icon (Tag) + Customer */}
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex items-center gap-3">
                                                        {(() => {
                                                            // Find the tag constant for this schedule item
                                                            const tagConstant = constants.find(c => c.description === item.item);
                                                            const tagImage = tagConstant?.image;
                                                            const tagColor = tagConstant?.color;
                                                            const tagLabel = item.item || item.service || 'S';

                                                            if (tagImage) {
                                                                // Priority 1: Show image (filled circle)
                                                                return (
                                                                    <div className="w-12 h-12 shrink-0 rounded-full overflow-hidden shadow-sm">
                                                                        <img src={tagImage} alt={tagLabel} className="w-full h-full object-cover" />
                                                                    </div>
                                                                );
                                                            } else if (tagColor) {
                                                                // Priority 2: Show color circle with letters
                                                                return (
                                                                    <div
                                                                        className="w-12 h-12 shrink-0 rounded-full shadow-sm flex items-center justify-center text-white font-black text-sm"
                                                                        style={{ backgroundColor: tagColor }}
                                                                    >
                                                                        {tagLabel.substring(0, 2).toUpperCase()}
                                                                    </div>
                                                                );
                                                            } else {
                                                                // Priority 3: Show letters with default styling
                                                                return (
                                                                    <div className="w-12 h-12 shrink-0 rounded-full bg-[#E6EEF8] border border-blue-100 flex items-center justify-center text-[#0F4C75] font-black text-sm">
                                                                        {tagLabel.substring(0, 2).toUpperCase()}
                                                                    </div>
                                                                );
                                                            }
                                                        })()}
                                                        <span className="text-sm font-bold text-slate-500 leading-tight">{item.customerName || 'Client'}</span>
                                                    </div>
                                                </div>

                                                {/* Row 2: Title (smaller font) */}
                                                <div className="mb-2">
                                                    <h3 className="text-base font-bold text-slate-800 leading-tight line-clamp-2">
                                                        {item.title || 'Untitled Schedule'}
                                                    </h3>
                                                </div>

                                                {/* Row 3: Job Location */}
                                                <p className="text-xs font-medium text-slate-400 truncate mb-2">{item.jobLocation}</p>

                                                {/* Row 4: Estimate # and Project Name */}
                                                <div className="flex items-center gap-2 mb-3">
                                                    {item.estimate && (
                                                        <span className="text-[11px] font-bold text-[#0F4C75] bg-[#E6EEF8] px-2 py-0.5 rounded-full">
                                                            {item.estimate}
                                                        </span>
                                                    )}
                                                    {item.description && (
                                                        <span className="text-[11px] font-medium text-slate-500 truncate">
                                                            {item.description.split('\n')[0]?.substring(0, 30)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Row 5: Assignees (left) + Service/Fringe/etc badges (right) */}
                                                <div className="flex items-center justify-between mb-3">
                                                    {/* Assignees - left side */}
                                                    <div className="flex -space-x-2">
                                                        {(item.assignees || []).filter(Boolean).slice(0, 4).map((email: string, i: number) => {
                                                            const emp = employees.find(e => e.value === email);
                                                            return (
                                                                <div key={i} className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold shadow-sm overflow-hidden bg-slate-200 text-slate-600">
                                                                    {emp?.image ? (
                                                                        <img src={emp.image} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        email?.[0]?.toUpperCase() || '?'
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                        {(item.assignees || []).filter(Boolean).length > 4 && (
                                                            <div className="w-7 h-7 rounded-full bg-[#38A169] border-2 border-white flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                                                                +{(item.assignees?.filter(Boolean).length || 0) - 4}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Service, Fringe, Certified Payroll, Notified, Per Diem - right side */}
                                                    <div className="flex -space-x-1.5">
                                                        {[
                                                            { val: item.service, label: 'SV' },
                                                            { val: item.fringe, label: 'FR' },
                                                            { val: item.certifiedPayroll, label: 'CP' },
                                                            { val: item.notifyAssignees, label: 'NA' },
                                                            { val: item.perDiem, label: 'PD' }
                                                        ].filter(attr => attr.val && attr.val !== 'No' && attr.val !== '-' && attr.val !== '').map((attr, i) => {
                                                            // Look up in constants by description
                                                            const constant = constants.find(c => c.description === attr.val);
                                                            const hasImage = constant?.image;
                                                            const hasColor = constant?.color;

                                                            return (
                                                                <div
                                                                    key={i}
                                                                    className="w-6 h-6 rounded-full border border-white flex items-center justify-center text-[8px] font-bold shadow-sm overflow-hidden"
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

                                                {/* Row 6: Date (left) + PM/Foreman/SD (right) */}
                                                <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
                                                    {/* Date - left side */}
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-emerald-100/50 flex items-center justify-center text-emerald-600">
                                                            <Clock size={12} />
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-700">
                                                            {new Date(item.fromDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    </div>

                                                    {/* PM / Foreman / SD - right side */}
                                                    <div className="flex -space-x-1.5">
                                                        {[item.projectManager, item.foremanName, item.SDName].filter(Boolean).map((email, i) => {
                                                            const emp = employees.find(e => e.value === email);
                                                            const labels = ['PM', 'FM', 'SD'];
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold shadow-sm overflow-hidden bg-[#0F4C75] text-white"
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

                        {/* Stats Ring - Hidden on Mobile */}
                        <div className="hidden lg:block lg:col-span-3 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-semibold text-slate-900">Completion</h3>
                                <select className="text-xs text-slate-500 bg-slate-50 border-0 rounded-lg px-2 py-1">
                                    <option>This month</option>
                                </select>
                            </div>
                            <div className="flex justify-center mb-4">
                                <div className="relative">
                                    <ProgressRing
                                        progress={stats.estimates > 0 ? (stats.completedEstimates / stats.estimates) * 100 : 0}
                                        size={140}
                                        strokeWidth={12}
                                    />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-bold text-slate-900">
                                            {loading ? '...' : `${stats.estimates > 0 ? Math.round((stats.completedEstimates / stats.estimates) * 100) : 0}%`}
                                        </span>
                                        <span className="text-xs text-slate-400">Complete</span>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="text-center p-3 bg-[#E5F0FF] rounded-xl">
                                    <p className="text-lg font-bold text-[#0066FF]">{stats.completedEstimates}</p>
                                    <p className="text-xs text-slate-500">Completed</p>
                                </div>
                                <div className="text-center p-3 bg-slate-50 rounded-xl">
                                    <p className="text-lg font-bold text-slate-700">{stats.activeEstimates}</p>
                                    <p className="text-xs text-slate-500">Pending</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Access & Charts Row */}
                    <div className="grid grid-cols-12 gap-6 mb-8">

                        {/* Quick Access Modules */}
                        <div className={`col-span-12 lg:col-span-8 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '500ms' }}>
                            <h3 className="text-lg font-semibold text-slate-900 mb-5">Quick Access</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { href: '/catalogue', icon: Package, label: 'Catalogue', desc: 'Items & Rates', color: 'from-[#0066FF] to-[#3385FF]' },
                                    { href: '/estimates', icon: Calculator, label: 'Estimates', desc: 'Cost Estimation', color: 'from-[#0052CC] to-[#0066FF]' },
                                    { href: '/templates', icon: FileText, label: 'Templates', desc: 'Proposals', color: 'from-[#003D99] to-[#0052CC]' },
                                    { href: '/constants', icon: Settings, label: 'Constants', desc: 'Configuration', color: 'from-[#002966] to-[#003D99]' },
                                ].map((item, i) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`group p-4 bg-white rounded-2xl border-2 border-slate-100 hover:border-[#0066FF]/30 transition-all card-hover ${mounted ? 'animate-scale-in' : 'opacity-0'}`}
                                        style={{ animationDelay: `${600 + i * 50}ms` }}
                                    >
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                                            <item.icon size={24} className="text-white" />
                                        </div>
                                        <p className="text-sm font-semibold text-slate-800 group-hover:text-[#0066FF] transition-colors">{item.label}</p>
                                        <p className="text-xs text-slate-400">{item.desc}</p>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Weekly Chart */}
                        <div className={`col-span-12 lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '600ms' }}>
                            <h3 className="text-lg font-semibold text-slate-900 mb-5">Weekly Activity</h3>
                            <div className="flex items-end justify-between gap-2 h-32">
                                {weeklyStats.map((day, i) => (
                                    <div key={day.label} className="flex-1 flex flex-col items-center gap-2">
                                        <div
                                            className="w-full bg-gradient-to-t from-[#0066FF] to-[#3385FF] rounded-t-lg transition-all duration-500 hover:from-[#0052CC] hover:to-[#0066FF]"
                                            style={{
                                                height: loading ? '0%' : `${day.value}%`,
                                                transitionDelay: `${i * 100}ms`
                                            }}
                                        ></div>
                                        <span className="text-xs text-slate-400">{day.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Documents & Actions Row */}
                    <div className="grid grid-cols-12 gap-6">

                        {/* Documents */}
                        <div className={`col-span-12 lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm ${mounted ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '700ms' }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-semibold text-slate-900">Documents</h3>
                                <Link href="/docs/jha" className="text-sm text-[#0066FF] font-medium">View all</Link>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { icon: ClipboardCheck, label: 'JHA', desc: 'Job Hazard Analysis', href: '/docs/jha' },
                                    { icon: FileCheck, label: 'Job Tickets', desc: 'Work Orders', href: '/docs/job-tickets' },
                                    { icon: AlertTriangle, label: 'Incidents', desc: 'Safety Reports', href: '/docs/incidents' },
                                ].map((doc) => (
                                    <Link key={doc.label} href={doc.href} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-[#E5F0FF] transition-colors group">
                                        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                                            <doc.icon size={18} className="text-[#0066FF]" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 group-hover:text-[#0066FF]">{doc.label}</p>
                                            <p className="text-xs text-slate-400">{doc.desc}</p>
                                        </div>
                                        <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-[#0066FF] group-hover:translate-x-1 transition-all" />
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Reports - Hidden on Mobile */}
                        <div className="hidden md:block md:col-span-12 lg:col-span-4 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm animate-fade-in-up" style={{ animationDelay: '800ms' }}>
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-semibold text-slate-900">Reports</h3>
                                <Link href="/reports/payroll" className="text-sm text-[#0066FF] font-medium">View all</Link>
                            </div>
                            <div className="space-y-3">
                                {[
                                    { icon: DollarSign, label: 'Payroll', desc: 'Employee Pay', href: '/reports/payroll' },
                                    { icon: Shield, label: 'Work Comp', desc: 'Compensation', href: '/reports/work-comp' },
                                    { icon: BarChart3, label: 'Sales', desc: 'Performance', href: '/reports/sales' },
                                ].map((report) => (
                                    <Link key={report.label} href={report.href} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-[#E5F0FF] transition-colors group">
                                        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                                            <report.icon size={18} className="text-[#0066FF]" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-700 group-hover:text-[#0066FF]">{report.label}</p>
                                            <p className="text-xs text-slate-400">{report.desc}</p>
                                        </div>
                                        <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-[#0066FF] group-hover:translate-x-1 transition-all" />
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Quick Actions - Hidden on Mobile */}
                        <div className="hidden md:block md:col-span-12 lg:col-span-4 space-y-4 animate-fade-in-up" style={{ animationDelay: '900ms' }}>
                            <Link href="/estimates" className="block p-5 bg-gradient-to-r from-[#0066FF] to-[#3385FF] rounded-2xl text-white hover:from-[#0052CC] hover:to-[#0066FF] transition-all group shadow-lg shadow-[#0066FF]/20">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                        <Plus size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold">New Estimate</h4>
                                        <p className="text-sm text-blue-100">Create new project estimate</p>
                                    </div>
                                    <ArrowRight size={20} className="ml-auto group-hover:translate-x-2 transition-transform" />
                                </div>
                            </Link>

                            <Link href="/catalogue" className="block p-5 bg-gradient-to-r from-[#0052CC] to-[#0066FF] rounded-2xl text-white hover:from-[#003D99] hover:to-[#0052CC] transition-all group shadow-lg shadow-[#0052CC]/20">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                                        <Package size={24} className="text-white" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold">Add to Catalog</h4>
                                        <p className="text-sm text-blue-100">Equipment, labor, materials</p>
                                    </div>
                                    <ArrowRight size={20} className="ml-auto group-hover:translate-x-2 transition-transform" />
                                </div>
                            </Link>
                        </div>
                    </div>

                </div>
            </div>

            {/* Schedule Details Modal */}
            {selectedSchedule && (
                <Modal
                    isOpen={!!selectedSchedule}
                    onClose={() => setSelectedSchedule(null)}
                    title="Job Details"
                    maxWidth="md"
                >
                    <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
                        
                        {/* Header Section: Icon & Client */}
                        <div className="flex items-center gap-4">
                            {(() => {
                                const tagConstant = constants.find(c => c.description === selectedSchedule.item);
                                const tagImage = tagConstant?.image;
                                const tagColor = tagConstant?.color;
                                const tagLabel = selectedSchedule.item || selectedSchedule.service || 'S';

                                if (tagImage) {
                                    return (
                                        <div className="w-16 h-16 shrink-0 rounded-full overflow-hidden shadow-sm">
                                            <img src={tagImage} alt={tagLabel} className="w-full h-full object-cover" />
                                        </div>
                                    );
                                } else if (tagColor) {
                                    return (
                                        <div className="w-16 h-16 shrink-0 rounded-full shadow-sm flex items-center justify-center text-white font-black text-lg" style={{ backgroundColor: tagColor }}>
                                            {tagLabel.substring(0, 2).toUpperCase()}
                                        </div>
                                    );
                                } else {
                                    return (
                                        <div className="w-16 h-16 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-[#0F4C75] font-black text-lg">
                                            {tagLabel.substring(0, 2).toUpperCase()}
                                        </div>
                                    );
                                }
                            })()}
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Client</p>
                                <p className="text-xl font-black text-[#0F4C75] leading-tight">{selectedSchedule.customerName}</p>
                            </div>
                        </div>

                        {/* Location */}
                        <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="mt-0.5 text-slate-400"><MapPin size={20} /></div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</p>
                                <p className="text-sm font-bold text-slate-700 leading-tight">{selectedSchedule.jobLocation || 'N/A'}</p>
                            </div>
                        </div>

                        {/* Title & Date */}
                        <div className="grid grid-cols-1 gap-2">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Title</p>
                                <p className="text-base font-black text-slate-800 leading-tight">{selectedSchedule.title}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <Clock size={14} className="text-slate-400" />
                                <span className="text-sm font-bold text-slate-700">
                                    {new Date(selectedSchedule.fromDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                                    <span className="text-slate-400 font-normal mx-2">|</span>
                                    {new Date(selectedSchedule.fromDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - {new Date(selectedSchedule.toDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>

                        {/* Roles: PM, Foreman, SD */}
                        <div className="space-y-3">
                            {[
                                { label: 'Project Manager', val: selectedSchedule.projectManager, color: 'bg-blue-600' },
                                { label: 'Foreman', val: selectedSchedule.foremanName, color: 'bg-emerald-600' },
                                { label: 'Site Director', val: selectedSchedule.SDName, color: 'bg-purple-600' }
                            ].map((role, idx) => {
                                if (!role.val) return null;
                                const emp = employees.find(e => e.value === role.val);
                                return (
                                    <div key={idx} className="flex items-center gap-3 p-2.5 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm overflow-hidden shrink-0 ${role.color}`}>
                                            {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : (emp?.label?.[0] || role.val[0])}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{role.label}</p>
                                            <p className="text-sm font-bold text-slate-700 truncate">{emp?.label || role.val}</p>
                                        </div>
                                        {emp?.phone && (
                                            <a href={`tel:${emp.phone}`} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-green-100 hover:text-green-600 transition-colors">
                                                <Phone size={16} />
                                            </a>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Assignees */}
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Assignees</p>
                            <div className="flex flex-wrap gap-2">
                                {(selectedSchedule.assignees || []).map((assignee: string, i: number) => {
                                    const emp = employees.find(e => e.value === assignee);
                                    return (
                                        <div key={i} className="inline-flex items-center gap-2 pl-1 pr-3 py-1.5 bg-slate-50 rounded-full border border-slate-200">
                                            <div className="w-8 h-8 rounded-full bg-slate-300 overflow-hidden flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                                                {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : (emp?.label?.[0] || assignee[0])}
                                            </div>
                                            <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{emp?.label || assignee}</span>
                                        </div>
                                    );
                                })}
                                {(!selectedSchedule.assignees || selectedSchedule.assignees.length === 0) && (
                                    <span className="text-sm text-slate-400 italic">No assignees</span>
                                )}
                            </div>
                        </div>

                        {/* Badges/Flags */}
                        <div className="flex flex-wrap gap-3">
                             {selectedSchedule.service && (
                                <Badge variant="default" className="text-slate-600 bg-slate-50 border-slate-200 py-1.5 px-3">
                                    SV: {selectedSchedule.service}
                                </Badge>
                            )}
                             {selectedSchedule.item && (
                                <Badge className="bg-[#E6EEF8] text-[#0F4C75] border-none py-1.5 px-3">
                                    Tag: {selectedSchedule.item}
                                </Badge>
                            )}
                            <Badge variant={selectedSchedule.notifyAssignees === 'Yes' ? 'success' : 'default'} className="gap-1.5 py-1.5 px-3">
                                <div className={`w-2 h-2 rounded-full ${selectedSchedule.notifyAssignees === 'Yes' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                Notify: {selectedSchedule.notifyAssignees || 'No'}
                            </Badge>
                            <Badge variant={selectedSchedule.perDiem === 'Yes' ? 'success' : 'default'} className="gap-1.5 py-1.5 px-3">
                                <div className={`w-2 h-2 rounded-full ${selectedSchedule.perDiem === 'Yes' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                Per Diem: {selectedSchedule.perDiem || 'No'}
                            </Badge>
                        </div>

                        {selectedSchedule.description && (
                            <div className="pt-2">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Scope / Notes</p>
                                <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    {selectedSchedule.description}
                                </p>
                            </div>
                        )}

                        <div className="mt-8 pt-4 border-t border-slate-100">
                            <button 
                                onClick={() => setSelectedSchedule(null)}
                                className="w-full py-4 bg-[#0F4C75] rounded-xl font-bold text-white hover:bg-[#0b3a59] transition-colors shadow-lg shadow-blue-900/20"
                            >
                                Close Details
                            </button>
                        </div>

                    </div>
                </Modal>
            )}
        </>
    );
}
