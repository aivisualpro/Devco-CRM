'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Briefcase, FileText, X, ChevronRight, Package, Calculator, FileSpreadsheet, Calendar, DollarSign, ClipboardCheck, FileCheck, AlertTriangle, Truck, Wrench, MessageSquare, Clock, BarChart3 } from 'lucide-react';
import ChatModal from '../Chat/ChatModal';

const menuStructure = [
    {
        label: 'CRM',
        items: [
            { label: 'Clients', href: '/clients', icon: Users, colorClass: 'text-cyan-500' },
            { label: 'Employees', href: '/employees', icon: Briefcase, colorClass: 'text-green-500' },
            { label: 'Leads', href: '/leads', icon: Briefcase, colorClass: 'text-pink-500' },
        ]
    },
    {
        label: 'JOBS',
        items: [
            { label: 'Catalogue', href: '/catalogue', icon: Package, colorClass: 'text-blue-500' },
            { label: 'Templates', href: '/templates', icon: FileText, colorClass: 'text-indigo-500' },
            { label: 'Estimates & Proposals', href: '/estimates', icon: Calculator, colorClass: 'text-orange-500' },
            { label: 'Schedules', href: '/jobs/schedules', icon: Calendar, colorClass: 'text-teal-500' },
            { label: 'Time Cards', href: '/jobs/time-cards', icon: Clock, colorClass: 'text-purple-500' },
        ]
    },
    {
        label: 'DOCS',
        items: [
            { label: 'JHA', href: '/docs/jha', icon: ClipboardCheck, colorClass: 'text-rose-500' },
            { label: 'Job Tickets', href: '/docs/job-tickets', icon: FileCheck, colorClass: 'text-violet-500' },
            { label: 'Incidents', href: '/docs/incidents', icon: AlertTriangle, colorClass: 'text-red-600' },
            { label: 'Vehicle Maint', href: '/docs/vehicle-safety', icon: Truck, colorClass: 'text-orange-600' },
        ]
    },
    {
        label: 'REPORTS',
        items: [
            { label: 'Payroll', href: '/reports/payroll', icon: DollarSign, colorClass: 'text-green-600' },
            { label: 'Work Comp', href: '/reports/work-comp', icon: FileCheck, colorClass: 'text-blue-700' },
            { label: 'WIP Report', href: '/reports/wip', icon: DollarSign, colorClass: 'text-emerald-500' },
            { label: 'Sales', href: '/reports/sales', icon: BarChart3, colorClass: 'text-emerald-500' },
        ]
    }
];

const MobileNav = () => {
    const pathname = usePathname();
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);

    const tabs = [
        { label: 'SCHEDULES', href: '/dashboard/jobschedule', icon: Calendar },
        { label: 'TIMESHEET', href: '/jobs/time-cards', icon: Clock },
    ];

    const isTabActive = (href: string) => {
        if (href === '/dashboard/jobschedule') return pathname.startsWith('/dashboard');
        return pathname.startsWith(href);
    };

    return (
        <div
            className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 z-[120] px-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
            style={{ height: 'calc(4rem + env(safe-area-inset-bottom))' }}
        >
            <div className="flex justify-around items-center h-full relative">
                {tabs.map((tab) => {
                    const Active = isTabActive(tab.href);
                    const Icon = tab.icon;

                    return (
                        <Link 
                            key={tab.label} 
                            href={tab.href as string} 
                            className={`flex flex-col items-center justify-center flex-1 transition-all duration-300 relative ${Active ? 'text-[#0F4C75]' : 'text-slate-400'}`}
                        >
                            <div className={`relative p-2 rounded-xl transition-all duration-500 ${Active ? 'bg-[#0F4C75]/10 scale-110 shadow-inner' : 'hover:bg-slate-100'}`}>
                                <Icon size={20} strokeWidth={Active ? 2.5 : 2} />
                                {Active && (
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#0F4C75] animate-pulse" />
                                )}
                            </div>
                            <span 
                                suppressHydrationWarning
                                className={`text-[10px] font-black tracking-tight mt-1 uppercase ${Active ? 'opacity-100' : 'opacity-60'}`}
                            >
                                {tab.label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export default MobileNav;
