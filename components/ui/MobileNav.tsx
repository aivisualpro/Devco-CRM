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
            { label: 'Sales', href: '/reports/sales', icon: BarChart3, colorClass: 'text-emerald-500' },
        ]
    }
];

const MobileNav = () => {
    const pathname = usePathname();
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);

    const tabs = [
        { label: 'HOME', href: '/dashboard', icon: Home },
        { label: 'CRM', type: 'menu', icon: Users },
        { label: 'CHAT', type: 'chat', icon: MessageSquare },
        { label: 'JOBS', type: 'menu', icon: Briefcase },
        { label: 'DOCS', type: 'menu', icon: FileText },
        { label: 'REPORTS', type: 'menu', icon: FileSpreadsheet },
    ];

    const isTabActive = (tab: any) => {
        if (tab.type === 'chat') return isChatOpen;
        if (tab.href) {
            if (tab.href === '/dashboard') return pathname === '/dashboard';
            return pathname.startsWith(tab.href);
        }
        if (tab.label === 'CRM') return pathname.startsWith('/clients') || pathname.startsWith('/employees') || pathname.startsWith('/leads');
        if (tab.label === 'JOBS') return pathname.startsWith('/catalogue') || pathname.startsWith('/templates') || pathname.startsWith('/estimates') || pathname.startsWith('/jobs/schedules');
        if (tab.label === 'REPORTS') return pathname.startsWith('/reports');
        if (tab.label === 'DOCS') return pathname.startsWith('/docs');
        return false;
    };

    const getMenuContent = () => {
        return menuStructure.find(m => m.label === activeMenu);
    };

    return (
        <>
            {/* Sub Menu Overlay */}
            {activeMenu && (
                <div className="md:hidden fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setActiveMenu(null)}>
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] p-6 pb-24 shadow-2xl animate-slide-up"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{activeMenu} Menu</h2>
                            <button onClick={() => setActiveMenu(null)} className="p-2 bg-slate-100 rounded-full text-slate-500">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {getMenuContent()?.items.map((item) => {
                                const Icon = item.icon;
                                const isImplemented = ['/catalogue', '/templates', '/estimates', '/clients', '/employees', '/jobs/schedules', '/jobs/time-cards', '/reports/payroll', '/roles', '/constants', '/chat', '/quickbooks', '/dashboard', '/docs'].some(path => item.href.startsWith(path));

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setActiveMenu(null)}
                                        className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${!isImplemented ? 'opacity-50 grayscale pointer-events-none bg-slate-50' : 'bg-slate-50 active:bg-slate-100 hover:bg-[#0F4C75]/5 group'
                                            }`}
                                    >
                                        <div className={`p-2.5 rounded-xl bg-white shadow-sm ${item.colorClass}`}>
                                            <Icon size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <p className={`font-bold text-sm ${isImplemented ? 'text-slate-800' : 'text-slate-400'}`}>{item.label}</p>
                                            {!isImplemented && <p className="text-[10px] text-slate-400 font-medium italic">Coming Soon</p>}
                                        </div>
                                        {isImplemented && <ChevronRight size={18} className="text-slate-300 group-hover:text-[#0F4C75]" />}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Modal */}
            {isChatOpen && <ChatModal onClose={() => setIsChatOpen(false)} />}

            {/* Main Navigation Bar */}
            <div
                className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 z-[120] px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
            >
                <div className="flex justify-around items-center h-16 relative">
                    {/* Online Status Dot */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-emerald-500 rounded-full flex items-center gap-1 shadow-lg shadow-emerald-500/20 border border-white">
                        <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <span className="text-[8px] font-bold text-white tracking-widest">ONLINE</span>
                    </div>

                    {tabs.map((tab) => {
                        const Active = isTabActive(tab);
                        const Icon = tab.icon;
                        const isMenuType = tab.type === 'menu';
                        const isChatType = tab.type === 'chat';

                        const Content = (
                            <div
                                className={`flex flex-col items-center justify-center flex-1 transition-all duration-300 cursor-pointer ${Active ? 'text-[#0F4C75]' : 'text-gray-400'
                                    }`}
                                onClick={() => {
                                    if (isMenuType) {
                                        setActiveMenu(activeMenu === tab.label ? null : tab.label);
                                        setIsChatOpen(false);
                                    } else if (isChatType) {
                                        setIsChatOpen(!isChatOpen);
                                        setActiveMenu(null);
                                    }
                                }}
                            >
                                <div className={`relative p-1.5 rounded-2xl transition-all duration-300 ${Active ? 'bg-[#0F4C75]/10 scale-110' : 'hover:bg-gray-100'}`}>
                                    <Icon size={22} strokeWidth={Active ? 2.5 : 2} />
                                    {Active && (
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#0F4C75]" />
                                    )}
                                </div>
                                <span className={`text-[9px] font-bold tracking-tight mt-1 ${Active ? 'opacity-100' : 'opacity-60'}`}>
                                    {tab.label}
                                </span>
                            </div>
                        );

                        if (isMenuType || isChatType) {
                            return <React.Fragment key={tab.label}>{Content}</React.Fragment>;
                        }

                        return (
                            <Link key={tab.label} href={tab.href as string} className="flex-1" onClick={() => { setIsChatOpen(false); setActiveMenu(null); }}>
                                {Content}
                            </Link>
                        );
                    })}
                </div>
            </div>

            <style jsx global>{`
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slide-up {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 0.2s ease-out forwards;
                }
                .animate-slide-up {
                    animation: slide-up 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
            `}</style>
        </>
    );
};

export default MobileNav;
