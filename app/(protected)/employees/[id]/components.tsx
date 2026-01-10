'use client';

import { useState } from 'react';
import { User, Mail, Phone, MapPin, Briefcase, Calendar, ChevronDown, CheckCircle, XCircle } from 'lucide-react';

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
    [key: string]: any;

}

interface EmployeeHeaderCardProps {
    employee: Employee;
    onUpdate: (field: string, value: any) => void;
    animate: boolean;
}

export function EmployeeHeaderCard({ employee, onUpdate, animate }: EmployeeHeaderCardProps) {
    const isEditing = false; // Add edit functionality later if needed

    const formatRate = (val?: number) => val ? `$${val.toFixed(2)}` : '$0.00';

    return (
        <div className="bg-[#eef2f6] rounded-[40px] shadow-[12px_12px_24px_#d1d9e6,-12px_-12px_24px_#ffffff] p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

                {/* PART 1: Identity */}
                <div className="flex flex-col gap-4 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff]">
                    <div className="flex items-center gap-4">
                        {employee.profilePicture ? (
                            <img
                                src={employee.profilePicture}
                                alt={`${employee.firstName} ${employee.lastName}`}
                                className="w-16 h-16 rounded-2xl object-cover shadow-lg transform rotate-3"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg transform rotate-3">
                                {employee.firstName?.[0]}{employee.lastName?.[0]}
                            </div>
                        )}
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
                    <div className="mt-2 flex items-center gap-2 text-slate-500 text-sm">
                        <Briefcase className="w-4 h-4" />
                        <span>{employee.designation || 'No Designation'}</span>
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

                {/* PART 3: Status & Rates */}
                <div className="flex flex-col gap-4 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff]">
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

                    <div className="grid grid-cols-2 gap-3 mt-1">
                        <div className="bg-[#eef2f6] rounded-xl p-2 shadow-[inset_2px_2px_4px_#d1d9e6,inset_-2px_-2px_4px_#ffffff]">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Site Rate</div>
                            <div className="text-lg font-bold text-slate-700">{formatRate(employee.hourlyRateSITE)}</div>
                        </div>
                        <div className="bg-[#eef2f6] rounded-xl p-2 shadow-[inset_2px_2px_4px_#d1d9e6,inset_-2px_-2px_4px_#ffffff]">
                            <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Drive Rate</div>
                            <div className="text-lg font-bold text-slate-700">{formatRate(employee.hourlyRateDrive)}</div>
                        </div>
                    </div>
                </div>

                {/* PART 4: KPI (Mocked for style) */}
                <div className="flex flex-col p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] relative overflow-hidden">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block text-center">
                        Performance Score
                    </label>

                    <div className="flex-1 flex items-center justify-center relative">
                        {/* Simple Gauge */}
                        <svg viewBox="0 0 100 60" className="w-full h-full max-h-[80px]">
                            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e2e8f0" strokeWidth="8" strokeLinecap="round" />
                            <path
                                d="M 10 50 A 40 40 0 0 1 90 50"
                                fill="none"
                                stroke="#6366f1"
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray="126"
                                strokeDashoffset={126 - (126 * 0.85)} // 85% score
                                className="transition-all duration-1000 ease-out"
                                style={{ strokeDashoffset: animate ? 126 - (126 * 0.85) : 126 }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-end justify-center pb-1">
                            <div className="text-2xl font-black text-indigo-600">98<span className="text-sm text-slate-400 font-bold">%</span></div>
                        </div>
                    </div>

                    <div className="flex justify-between text-[10px] font-bold text-slate-400 px-4">
                        <span>Reliability</span>
                        <span>Projects: 12</span>
                    </div>
                </div>
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
}

export function DetailRow({ label, value, isLink, href }: DetailRowProps) {
    return (
        <div className="flex items-center justify-between py-3 px-4 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest w-1/3">
                {label}
            </div>
            <div className={`flex-1 text-right text-sm font-medium ${isLink ? 'text-indigo-600' : 'text-slate-700'}`}>
                {isLink ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">
                        {value || '-'}
                    </a>
                ) : (
                    <span className="break-words">{value || '-'}</span>
                )}
            </div>
        </div>
    );
}

export function AccordionCard({ title, isOpen, onToggle, children, icon: Icon }: any) {
    return (
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] overflow-hidden transition-all duration-300 border border-gray-100">
            <button
                onClick={onToggle}
                className={`w-full flex items-center justify-between p-4 sm:p-5 transition-colors ${isOpen ? 'bg-slate-50/80' : 'bg-white hover:bg-gray-50'}`}
            >
                <div className="flex items-center gap-3">
                    {Icon && <Icon className="w-5 h-5 text-indigo-500" />}
                    <h3 className="text-lg font-bold text-slate-700 tracking-tight">{title}</h3>
                </div>
                <div className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-5 h-5" />
                </div>
            </button>
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
