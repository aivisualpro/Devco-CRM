'use client';

import { cld } from '@/lib/cld';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Briefcase, Calendar, ChevronDown, CheckCircle, XCircle, Eye, EyeOff, KeyRound, Save, X, RefreshCw, Copy } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

interface Employee {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    mobile?: string;
    appRole?: string;
    companyPosition?: string;
    designation?: string;
    isScheduleActive?: boolean;
    status: string;
    hourlyRateSITE?: number;
    hourlyRateDrive?: number;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    profilePicture?: string;
    password?: string;
    [key: string]: any;

}

interface EmployeeHeaderCardProps {
    employee: Employee;
    onUpdate: (field: string, value: any) => void;
    onEditSignature: () => void;
    animate: boolean;
}

function HeaderPerformanceGauge({ email, fullName, animate }: { email: string; fullName: string; animate: boolean }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        fetch(`/api/employees/performance?writerEmail=${encodeURIComponent(email)}&writerName=${encodeURIComponent(fullName)}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [email, fullName]);

    const score = data?.performanceScore ?? 0;
    const grade = data?.grade ?? { label: '—', color: 'slate' };
    const isWriter = data?.isWriter ?? false;
    const isPM = data?.isPM ?? false;
    const sched = data?.schedules || {};
    const kpis = data?.kpis || {};

    const colorMap: Record<string, string> = { emerald: '#10b981', blue: '#3b82f6', amber: '#f59e0b', red: '#ef4444', slate: '#94a3b8' };
    const textColorMap: Record<string, string> = { emerald: 'text-emerald-600', blue: 'text-blue-600', amber: 'text-amber-500', red: 'text-red-500', slate: 'text-slate-400' };
    const strokeColor = colorMap[grade.color] || '#6366f1';
    const fraction = score / 100;
    const hasData = isWriter || isPM;
    const fmtK = (n: number) => { const a = Math.abs(n), s = n < 0 ? '-' : ''; return a >= 1e6 ? `${s}$${(a/1e6).toFixed(2)}M` : a >= 1000 ? `${s}$${(a/1000).toFixed(1)}k` : `${s}$${Math.round(a)}`; };

    return (
        <>
        <div className="flex flex-col p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] relative overflow-hidden cursor-pointer hover:shadow-[inset_3px_3px_8px_#c8d0de,inset_-3px_-3px_8px_#ffffff] transition-shadow" onClick={() => hasData && setShowModal(true)}>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block text-center">
                Performance Score
            </label>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-4 border-slate-100 border-t-indigo-400 animate-spin" />
                </div>
            ) : !hasData ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-1">
                    <span className="text-3xl font-black text-slate-300">—</span>
                    <span className="text-[10px] text-slate-400 font-bold">No Data</span>
                </div>
            ) : (
                <>
                    <div className="flex-1 flex items-center justify-center relative">
                        <svg viewBox="0 0 100 60" className="w-full h-full max-h-[80px]">
                            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
                            <path
                                d="M 10 50 A 40 40 0 0 1 90 50"
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray="126"
                                className="transition-all duration-1000 ease-out"
                                style={{ strokeDashoffset: animate ? 126 - (126 * fraction) : 126 }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-end justify-center pb-1">
                            <div className={`text-2xl font-black ${textColorMap[grade.color]}`}>
                                {score}<span className="text-sm text-slate-400 font-bold">%</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 px-2">
                        <span>{grade.label}</span>
                        {isPM && <span>Schedules: {sched.total}</span>}
                    </div>
                    {/* Dual-role score bars */}
                    {isPM && isWriter && (
                        <div className="space-y-1.5 mt-2 px-1">
                            <div>
                                <div className="flex justify-between text-[9px] font-bold mb-0.5">
                                    <span className="text-indigo-500">PM Compliance</span>
                                    <span className="text-slate-600">{data.pmScore}%</span>
                                </div>
                                <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${data.pmScore}%` }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] font-bold mb-0.5">
                                    <span className="text-amber-500">Writer Financial</span>
                                    <span className="text-slate-600">{data.writerScore}%</span>
                                </div>
                                <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400 rounded-full transition-all duration-700" style={{ width: `${data.writerScore}%` }} />
                                </div>
                            </div>
                        </div>
                    )}
                    {/* PM-only: JHA/DJT/Both pills */}
                    {isPM && !isWriter && (
                        <div className="flex gap-2 mt-2 px-1">
                            <div className="flex-1 bg-emerald-50 rounded-lg px-2 py-1 text-center border border-emerald-100">
                                <div className="text-[10px] font-black text-emerald-700">{sched.jhaRate}%</div>
                                <div className="text-[8px] font-bold text-emerald-500 uppercase">JHA</div>
                            </div>
                            <div className="flex-1 bg-blue-50 rounded-lg px-2 py-1 text-center border border-blue-100">
                                <div className="text-[10px] font-black text-blue-700">{sched.djtRate}%</div>
                                <div className="text-[8px] font-bold text-blue-500 uppercase">DJT</div>
                            </div>
                            <div className="flex-1 bg-violet-50 rounded-lg px-2 py-1 text-center border border-violet-100">
                                <div className="text-[10px] font-black text-violet-700">{sched.bothRate}%</div>
                                <div className="text-[8px] font-bold text-violet-500 uppercase">Both</div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
        {showModal && hasData && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}>
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-3xl px-6 py-4 flex items-center justify-between z-10">
                        <div><h2 className="text-white font-black text-lg">Performance Breakdown</h2><p className="text-white/60 text-xs font-medium">{fullName}</p></div>
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 rounded-xl px-3 py-1.5 text-center"><div className="text-2xl font-black text-white">{score}%</div><div className="text-[9px] font-bold text-white/60 uppercase">{grade.label}</div></div>
                            <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                    </div>
                    <div className="p-5 space-y-5">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Final Score Formula</p>
                            {isPM && isWriter ? (
                                <><p className="text-sm font-bold text-slate-700">Average of PM + Writer</p><p className="text-xs text-slate-500 font-mono bg-white rounded-lg px-3 py-2 border mt-1">({data.pmScore} + {data.writerScore}) ÷ 2 = <span className="font-black text-indigo-600">{score}%</span></p></>
                            ) : isPM ? (
                                <><p className="text-sm font-bold text-slate-700">PM Compliance Score</p><p className="text-xs text-slate-500 font-mono bg-white rounded-lg px-3 py-2 border mt-1">(Both×0.60) + (JHA×0.20) + (DJT×0.20) = <span className="font-black text-indigo-600">{score}%</span></p></>
                            ) : (
                                <><p className="text-sm font-bold text-slate-700">Writer Financial Score</p><p className="text-xs text-slate-500 font-mono bg-white rounded-lg px-3 py-2 border mt-1">(Margin×0.40) + (Collection×0.30) + (DSO×0.30) = <span className="font-black text-indigo-600">{score}%</span></p></>
                            )}
                        </div>
                        {isPM && (<div>
                            <div className="flex items-center gap-2 mb-3"><div className="w-1 h-4 bg-indigo-500 rounded-full" /><span className="text-xs font-black text-slate-700 uppercase tracking-wider">PM Compliance</span><span className="ml-auto text-xs font-black text-indigo-600">{data.pmScore}%</span></div>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 text-center"><div className="text-xl font-black text-emerald-600">{sched.jhaRate}%</div><div className="text-[9px] font-bold text-slate-500">{sched.withJHA} / {sched.total}</div><div className="text-[8px] font-black text-emerald-400 uppercase mt-1">JHA (×20%)</div></div>
                                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 text-center"><div className="text-xl font-black text-blue-600">{sched.djtRate}%</div><div className="text-[9px] font-bold text-slate-500">{sched.withDJT} / {sched.total}</div><div className="text-[8px] font-black text-blue-400 uppercase mt-1">DJT (×20%)</div></div>
                                <div className="bg-violet-50 rounded-xl p-3 border border-violet-100 text-center"><div className="text-xl font-black text-violet-600">{sched.bothRate}%</div><div className="text-[9px] font-bold text-slate-500">{sched.withBoth} / {sched.total}</div><div className="text-[8px] font-black text-violet-400 uppercase mt-1">Both (×60%)</div></div>
                            </div>
                            <div className="bg-indigo-50 rounded-lg px-3 py-2 border border-indigo-100">
                                <p className="text-[10px] font-mono text-indigo-700">({sched.bothRate}×0.60) + ({sched.jhaRate}×0.20) + ({sched.djtRate}×0.20) = <span className="font-black">{data.pmScore}%</span></p>
                                <p className="text-[9px] text-indigo-400 mt-1">Excludes &quot;Day Off&quot; schedules · {sched.total} qualifying schedules</p>
                            </div>
                        </div>)}
                        {isWriter && kpis && (() => {
                            const mS = Math.round(Math.min(100, Math.max(0, (kpis.marginPct||0)*2.5)));
                            const cS = Math.round(Math.min(100, Math.max(0, kpis.collectedPct||0)));
                            const dS = Math.round(Math.min(100, Math.max(0, 100-((kpis.dso||0)/90)*100)));
                            return (<div>
                                <div className="flex items-center gap-2 mb-3"><div className="w-1 h-4 bg-amber-500 rounded-full" /><span className="text-xs font-black text-slate-700 uppercase tracking-wider">Writer Financial</span><span className="ml-auto text-xs font-black text-amber-600">{data.writerScore}%</span></div>
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 text-center"><div className="text-xl font-black text-amber-600">{mS}</div><div className="text-[10px] font-bold text-slate-600">{(kpis.marginPct||0).toFixed(1)}%</div><div className="text-[8px] font-black text-amber-400 uppercase mt-1">Margin (×40%)</div><div className="text-[8px] text-slate-400 mt-0.5">{fmtK(kpis.profit)} profit</div></div>
                                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 text-center"><div className="text-xl font-black text-amber-600">{cS}</div><div className="text-[10px] font-bold text-slate-600">{(kpis.collectedPct||0).toFixed(0)}%</div><div className="text-[8px] font-black text-amber-400 uppercase mt-1">Collected (×30%)</div><div className="text-[8px] text-slate-400 mt-0.5">{fmtK(kpis.arOutstanding)} A/R</div></div>
                                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 text-center"><div className="text-xl font-black text-amber-600">{dS}</div><div className="text-[10px] font-bold text-slate-600">{kpis.dso||0}d</div><div className="text-[8px] font-black text-amber-400 uppercase mt-1">DSO (×30%)</div><div className="text-[8px] text-slate-400 mt-0.5">Days outstanding</div></div>
                                </div>
                                <div className="bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
                                    <p className="text-[10px] font-mono text-amber-700">({mS}×0.40) + ({cS}×0.30) + ({dS}×0.30) = <span className="font-black">{data.writerScore}%</span></p>
                                    <p className="text-[9px] text-amber-400 mt-1">{data.projectCount} projects as proposal writer</p>
                                </div>
                            </div>);
                        })()}
                    </div>
                </div>
            </div>
        )}
        </>
    );
}

export function EmployeeHeaderCard({ employee, onUpdate, animate, onEditSignature }: EmployeeHeaderCardProps) {
    const [showPassword, setShowPassword] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { user: currentUser } = usePermissions();
    const isOwnRecord = currentUser?.email === employee._id || currentUser?.userId === employee._id;

    const formatRate = (val?: number) => val ? `$${val.toFixed(2)}` : '$0.00';

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                onUpdate('profilePicture', reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSavePassword = async () => {
        if (!newPassword.trim()) return;
        
        setSaving(true);
        try {
            const res = await fetch(`/api/employees/${employee._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: employee._id, item: { password: newPassword } })
            });
            const data = await res.json();
            if (data.success) {
                onUpdate('password', newPassword);
                setIsChangingPassword(false);
                setNewPassword('');
            }
        } catch (err) {
            console.error('Error saving password:', err);
        } finally {
            setSaving(false);
        }
    };

    const generateStrongPassword = (): string => {
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const digits = '0123456789';
        const symbols = '!@#$%&*';
        const all = upper + lower + digits + symbols;
        let pwd = '';
        pwd += upper[Math.floor(Math.random() * upper.length)];
        pwd += lower[Math.floor(Math.random() * lower.length)];
        pwd += digits[Math.floor(Math.random() * digits.length)];
        pwd += symbols[Math.floor(Math.random() * symbols.length)];
        for (let i = 4; i < 12; i++) {
            pwd += all[Math.floor(Math.random() * all.length)];
        }
        return pwd.split('').sort(() => Math.random() - 0.5).join('');
    };

    const handleCopyPassword = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-[#eef2f6] rounded-[40px] shadow-[12px_12px_24px_#d1d9e6,-12px_-12px_24px_#ffffff] p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                {/* PART 1: Identity */}
                <div className="flex flex-col gap-4 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff]">
                    <div className="flex items-center gap-4">
                        <div 
                            className="relative group cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageUpload}
                            />
                            {employee.profilePicture ? (
                                <div className="relative w-16 h-16 rounded-2xl overflow-hidden"><Image fill priority sizes="(max-width: 768px) 100vw, 33vw"
                                    src={employee.profilePicture}
                                    alt={`${employee.firstName} ${employee.lastName}`}
                                    className="rounded-2xl object-cover shadow-lg transform rotate-3 group-hover:opacity-80 transition-opacity w-full h-full"
                                /></div>
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg transform rotate-3 group-hover:opacity-80 transition-opacity">
                                    {employee.firstName?.[0]}{employee.lastName?.[0]}
                                </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                                <span className="bg-black/50 text-white text-[10px] px-1 rounded">Edit</span>
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">

                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                                Employee
                            </label>
                            <div className="text-xl font-black text-slate-800 tracking-tight truncate">
                                {employee.firstName} {employee.lastName}
                            </div>
                            <div className="text-sm font-medium text-indigo-600 truncate">
                                {employee.companyPosition || 'No Position'}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <Briefcase className="w-4 h-4" />
                            <span>{employee.designation || 'No Designation'}</span>
                        </div>
                    </div>
                    
                    {/* Signature Option */}
                    <div className="mt-1 pt-3 border-t border-gray-100/50">
                         <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Signature
                            </label>
                            <button
                                onClick={onEditSignature}
                                className="text-[10px] text-indigo-600 font-bold hover:underline"
                            >
                                {employee.signature ? 'Edit' : 'Add'}
                            </button>
                         </div>
                         {employee.signature ? (
                             <div 
                                onClick={onEditSignature}
                                className="relative mt-2 h-12 border border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-white/50 cursor-pointer hover:bg-white transition-colors"
                             >
                                 <div className="relative w-full h-full"><Image priority fill sizes="(max-width: 768px) 100vw, 33vw" src={cld(employee.signature, { w: 1200 })} alt="Signature" className="w-full h-full object-contain" /></div>
                             </div>
                         ) : (
                             <div 
                                onClick={onEditSignature}
                                className="mt-2 py-2 text-center text-xs text-slate-400 italic cursor-pointer hover:text-indigo-500 transition-colors"
                             >
                                 No signature on file
                             </div>
                         )}
                    </div>
                </div>

                {/* PART 2: Contact Info */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff]">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                        Contact Details
                    </label>
                    <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                        <Mail className="w-4 h-4 text-indigo-400" />
                        <a href={`mailto:${employee.email}`} className="hover:text-indigo-600 truncate">{employee.email}</a>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                        <Phone className="w-4 h-4 text-emerald-400" />
                        <a href={`tel:${employee.mobile || employee.phone}`} className="hover:text-emerald-600">
                            {(employee.mobile || employee.phone || '').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') || '-'}
                        </a>

                    </div>
                    <div className="flex items-start gap-3 text-sm font-medium text-slate-600">
                        <MapPin className="w-4 h-4 text-rose-400 mt-0.5" />
                        <span className="leading-snug">
                            {[employee.address, employee.city, employee.state].filter(Boolean).join(', ') || 'No Address'}
                        </span>
                    </div>
                </div>

                {/* PART 3: Status, Rates & Password */}
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff]">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Status
                        </label>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${employee.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                            {employee.status}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#eef2f6] rounded-xl p-2 shadow-[inset_2px_2px_4px_#d1d9e6,inset_-2px_-2px_4px_#ffffff]">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Site Rate</div>
                            <div className="text-base font-bold text-slate-700">{formatRate(employee.hourlyRateSITE)}</div>
                        </div>
                        <div className="bg-[#eef2f6] rounded-xl p-2 shadow-[inset_2px_2px_4px_#d1d9e6,inset_-2px_-2px_4px_#ffffff]">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Drive Rate</div>
                            <div className="text-base font-bold text-slate-700">{formatRate(employee.hourlyRateDrive)}</div>
                        </div>
                    </div>

                    {/* Password Section */}
                    <div className="bg-[#eef2f6] rounded-xl p-3 shadow-[inset_2px_2px_4px_#d1d9e6,inset_-2px_-2px_4px_#ffffff]">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                                <span className="text-[10px] text-slate-400 font-bold uppercase">Password</span>
                            </div>
                            {isOwnRecord && !isChangingPassword && (
                                <button 
                                    onClick={() => setIsChangingPassword(true)}
                                    className="text-[10px] text-indigo-600 font-semibold hover:text-indigo-700 transition-colors"
                                >
                                    Change
                                </button>
                            )}
                        </div>
                        
                        {!isOwnRecord ? (
                            <div className="flex items-center justify-between">
                                <div className="font-mono text-sm text-slate-400 tracking-wider">••••••••</div>
                                <span className="text-[10px] text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full">Hidden</span>
                            </div>
                        ) : !isChangingPassword ? (
                            <div className="flex items-center justify-between">
                                <div className="font-mono text-sm font-bold text-slate-700 tracking-wider">
                                    {showPassword ? (employee.password || 'Not Set') : '••••••••'}
                                </div>
                                <div className="flex items-center gap-0.5">
                                    <button 
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="p-1.5 rounded-lg hover:bg-white/50 transition-colors text-slate-500 hover:text-indigo-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                    {showPassword && employee.password && (
                                        <button 
                                            onClick={() => handleCopyPassword(employee.password!)}
                                            className="p-1.5 rounded-lg hover:bg-white/50 transition-colors text-slate-500 hover:text-indigo-600"
                                            title={copied ? 'Copied!' : 'Copy password'}
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="New password"
                                        className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                                        autoFocus
                                    />
                                    <button 
                                        onClick={handleSavePassword}
                                        disabled={saving || !newPassword.trim()}
                                        className="p-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Save className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => { setIsChangingPassword(false); setNewPassword(''); }}
                                        className="p-1.5 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const suggested = generateStrongPassword();
                                        setNewPassword(suggested);
                                    }}
                                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 transition-colors px-1 py-0.5 rounded hover:bg-white/50"
                                >
                                    <RefreshCw className="w-3 h-3" />
                                    Suggest Strong Password
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* PART 4: Performance Score (live data) */}
                <HeaderPerformanceGauge
                    email={employee.email}
                    fullName={`${employee.firstName} ${employee.lastName}`.trim()}
                    animate={animate}
                />
            </div>
        </div>
    );
}

// Reusable Detail Section Component (Flat list looking like table rows)
interface DetailRowProps {
    label: string;
    value: string | number | undefined | null;
    isLink?: boolean;
    href?: string;
    editNode?: React.ReactNode;
}

export function DetailRow({ label, value, isLink, href, editNode }: DetailRowProps) {
    return (
        <div className="flex items-center justify-between py-2 px-4 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide w-1/2 mr-3">
                {label}
            </div>
            <div className={`flex-1 flex justify-end text-right text-sm font-medium ${isLink && !editNode ? 'text-indigo-600' : 'text-slate-700'}`}>
                {editNode || (isLink ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">
                        {value || '-'}
                    </a>
                ) : (
                    <span className="break-words">{value || '-'}</span>
                ))}
            </div>
        </div>
    );
}

export function AccordionCard({ title, isOpen, onToggle, children, icon: Icon, action }: any) {
    return (
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] overflow-hidden transition-all duration-300 border border-gray-100">
            <div
                onClick={onToggle}
                role="button"
                tabIndex={0}
                className={`w-full flex items-center justify-between p-4 sm:p-5 cursor-pointer transition-colors ${isOpen ? 'bg-slate-50/80' : 'bg-white hover:bg-gray-50'}`}
            >
                <div className="flex items-center gap-3">
                    {Icon && <Icon className="w-5 h-5 text-indigo-500" />}
                    <h3 className="text-lg font-bold text-slate-700 tracking-tight">{title}</h3>
                </div>
                <div className="flex items-center gap-2">
                    {action && (
                        <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            {action}
                        </div>
                    )}
                    <div className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                        <ChevronDown className="w-5 h-5" />
                    </div>
                </div>
            </div>
            <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
                <div className="p-0">
                    {children}
                </div>
            </div>
        </div>
    );
}
