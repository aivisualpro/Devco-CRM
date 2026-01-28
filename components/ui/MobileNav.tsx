'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Clock, Menu, X, BookOpen, Settings, MessageSquare } from 'lucide-react';

const MobileNav = () => {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const tabs = [
        { label: 'SCHEDULES', href: '/dashboard', icon: Calendar },
        { label: 'Chat', href: '/dashboard?view=chat', icon: MessageSquare },
        { label: 'Time Cards', href: '/jobs/time-cards', icon: Clock },
    ];

    const isTabActive = (tabHref: string) => {
        const view = searchParams.get('view');
        if (tabHref === '/dashboard') {
            return pathname === '/dashboard' && !view;
        }
        if (tabHref === '/dashboard?view=chat') {
            return pathname === '/dashboard' && view === 'chat';
        }
        return pathname.startsWith(tabHref);
    };

    // Close modal on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsMenuOpen(false);
        };
        if (isMenuOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isMenuOpen]);

    const menuItems = [
        { 
            label: 'Knowledgebase', 
            href: '/settings/knowledgebase', 
            icon: BookOpen, 
            colorClass: 'text-blue-500',
            bgClass: 'bg-blue-50',
            description: 'Help articles & guides'
        },
    ];

    return (
        <>
            <div
                className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 z-[120] px-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
                style={{ height: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
            >
                 <div className="flex justify-around items-center h-full relative">
                    {tabs.map((tab) => {
                        const Active = isTabActive(tab.href);
                        const Icon = tab.icon;

                        return (
                            <button 
                                key={tab.label} 
                                onClick={() => {
                                    const weekParam = searchParams.get('week');
                                    let url = tab.href;
                                    if (weekParam) {
                                        url += (url.includes('?') ? '&' : '?') + `week=${weekParam}`;
                                    }
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
        </>
    );
};

export default MobileNav;
