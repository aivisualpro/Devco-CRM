'use client';

import React, { useState } from 'react';
// import Link from 'next/link'; // Unused
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Home, Users, Briefcase, FileText, X, ChevronRight, Package, Calculator, FileSpreadsheet, Calendar, DollarSign, ClipboardCheck, FileCheck, AlertTriangle, Truck, Wrench, MessageSquare, Clock, BarChart3, Menu } from 'lucide-react';
import ChatModal from '../Chat/ChatModal';

const menuStructure: {
    label: string;
    href?: string;
    items?: {
        label: string;
        href: string;
        icon: any;
        colorClass: string;
    }[];
}[] = [
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
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);

    const tabs = [
        { label: 'SCHEDULES', href: '/dashboard', icon: Calendar },
        { label: 'Time Cards', href: '/jobs/time-cards', icon: Clock },
    ];

    const isTabActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        return pathname.startsWith(href);
    };

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    return (
        <>
            <div
                className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 z-[120] px-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
                style={{ height: 'calc(4rem + env(safe-area-inset-bottom))' }}
            >
                {/* ... existing bottom nav content ... */}
                {/* ... existing bottom nav content ... */}
                 <div className="flex justify-around items-center h-full relative">
                    {tabs.map((tab) => {
                        const Active = isTabActive(tab.href);
                        const Icon = tab.icon;

                        return (
                            <button 
                                key={tab.label} 
                                onClick={() => {
                                    const weekParam = searchParams.get('week');
                                    const url = weekParam ? `${tab.href}?week=${weekParam}` : tab.href;
                                    router.push(url);
                                }}
                                onContextMenu={(e) => e.preventDefault()}
                                className={`flex flex-col items-center justify-center flex-1 transition-all duration-300 relative select-none ${Active ? 'text-[#0F4C75]' : 'text-slate-400'}`}
                                style={{ WebkitTouchCallout: 'none' }}
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
                            </button>
                        );
                    })}
                </div>
            </div>
            
            {/* Mobile Menu Drawer */}
            {isMenuOpen && (
                <div className="fixed inset-0 z-[150] bg-white/95 backdrop-blur-xl animate-in slide-in-from-right duration-300">
                    <div className="flex flex-col h-full">
                         <div className="flex items-center justify-between p-4 border-b border-slate-100">
                            <span className="text-xl font-black text-[#0F4C75] tracking-tighter">MENU</span>
                            <button 
                                onClick={() => setIsMenuOpen(false)}
                                className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
                            >
                                <X size={24} className="text-slate-600" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            {menuStructure.map((section, idx) => (
                                <div key={idx}>
                                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 pl-2">{section.label}</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {section.items?.map((item, i) => {
                                            const Icon = item.icon as any; // Type casting for Lucide icon
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => {
                                                        router.push(item.href);
                                                        setIsMenuOpen(false);
                                                    }}
                                                    className="flex flex-col items-center justify-center p-3 bg-slate-50 rounded-2xl border border-slate-100 active:scale-95 transition-all"
                                                >
                                                    <div className={`w-10 h-10 rounded-xl mb-2 flex items-center justify-center ${item.colorClass.replace('text-', 'bg-').replace('500', '100').replace('600', '100')} ${item.colorClass}`}>
                                                        <Icon size={20} />
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-700 text-center leading-tight">{item.label}</span>
                                                </button>
                                            )
                                        })}
                                        {/* Direct Href (like CHAT) */}
                                        {section.href && (
                                            <button
                                                onClick={() => {
                                                    router.push(section.href as string);
                                                    setIsMenuOpen(false);
                                                }}
                                                className="col-span-2 flex items-center gap-4 p-4 bg-[#0F4C75] text-white rounded-2xl shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
                                            >
                                                <MessageSquare size={24} className="text-white" />
                                                <span className="text-lg font-black tracking-tight">{section.label}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            
                            <div className="pt-4 border-t border-slate-100">
                                <button 
                                    onClick={() => {
                                        // Handle logout if needed
                                        router.push('/login');
                                    }}
                                    className="w-full flex items-center justify-center gap-2 p-4 bg-rose-50 text-rose-600 rounded-2xl font-bold"
                                >
                                    Log Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );

};

export default MobileNav;
