'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Clock, Menu, X, BookOpen, Settings } from 'lucide-react';

const MobileNav = () => {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const tabs = [
        { label: 'SCHEDULES', href: '/dashboard', icon: Calendar },
        { label: 'Time Cards', href: '/jobs/time-cards', icon: Clock },
    ];

    const isTabActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        return pathname.startsWith(href);
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
                    
                    {/* Burger Menu Button */}
                    <button 
                        onClick={() => setIsMenuOpen(true)}
                        onContextMenu={(e) => e.preventDefault()}
                        className="flex flex-col items-center justify-center flex-1 transition-all duration-300 relative select-none text-slate-400"
                        style={{ WebkitTouchCallout: 'none' }}
                    >
                        <div className="relative p-2 rounded-xl transition-all duration-500 hover:bg-slate-100">
                            <Menu size={20} strokeWidth={2} />
                        </div>
                        <span 
                            suppressHydrationWarning
                            className="text-[10px] font-black tracking-tight mt-1 uppercase opacity-60"
                        >
                            MORE
                        </span>
                    </button>
                </div>
            </div>
            
            {/* Centered Modal Menu */}
            {isMenuOpen && (
                <div 
                    className="fixed inset-0 z-[150] flex items-center justify-center p-4"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsMenuOpen(false);
                    }}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" />
                    
                    {/* Modal */}
                    <div className="relative w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/20 overflow-hidden animate-in zoom-in-95 fade-in duration-300 border border-white/20">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-100/50 bg-gradient-to-r from-[#0F4C75]/5 to-transparent">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0F4C75] to-[#1B6B9E] flex items-center justify-center shadow-lg shadow-[#0F4C75]/20">
                                    <Settings size={20} className="text-white" />
                                </div>
                                <span className="text-xl font-black text-slate-800 tracking-tight">Menu</span>
                            </div>
                            <button 
                                onClick={() => setIsMenuOpen(false)}
                                className="p-2.5 bg-slate-100 rounded-full hover:bg-slate-200 transition-all duration-200 active:scale-95"
                            >
                                <X size={20} className="text-slate-600" />
                            </button>
                        </div>
                        
                        {/* Content */}
                        <div className="p-5 space-y-3">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Settings</p>
                            
                            {menuItems.map((item, i) => {
                                const Icon = item.icon;
                                const isActive = pathname.startsWith(item.href);
                                
                                return (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            router.push(item.href);
                                            setIsMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 active:scale-[0.98] ${
                                            isActive 
                                                ? 'bg-[#0F4C75]/10 border-[#0F4C75]/20' 
                                                : 'bg-slate-50/80 border-slate-100 hover:bg-slate-100/80 hover:border-slate-200'
                                        }`}
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.bgClass} ${item.colorClass} shadow-sm`}>
                                            <Icon size={24} />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <span className={`text-base font-bold block ${isActive ? 'text-[#0F4C75]' : 'text-slate-700'}`}>
                                                {item.label}
                                            </span>
                                            <span className="text-xs text-slate-500 mt-0.5 block">
                                                {item.description}
                                            </span>
                                        </div>
                                        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#0F4C75]' : 'bg-slate-200'}`} />
                                    </button>
                                );
                            })}
                        </div>
                        
                        {/* Footer */}
                        <div className="px-5 pb-5">
                            <div className="text-center text-xs text-slate-400 py-3 border-t border-slate-100/50">
                                Tap outside to close
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default MobileNav;
