'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, FileText, Package, Calculator, Sliders, Users, Contact, Briefcase, FileSpreadsheet, Calendar, DollarSign, ClipboardCheck, AlertTriangle, Truck, Wrench, Settings, BarChart, FileCheck, Search, Bell, BookOpen, Command, LogOut, User as UserIcon, Clock } from 'lucide-react';

interface SubItem {
    label: string;
    href: string;
    icon?: React.ReactNode;
    description: string;
    colorClass: string;
}

interface MenuItem {
    label: string;
    items: SubItem[];
}

const menuStructure: MenuItem[] = [
    {
        label: 'CRM',
        items: [
            { label: 'Clients', href: '/clients', icon: <Users className="w-5 h-5" />, description: 'Manage client relationships and data', colorClass: 'text-cyan-500' },
            { label: 'Employees', href: '/employees', icon: <Briefcase className="w-5 h-5" />, description: 'Manage company employees', colorClass: 'text-green-500' },

            { label: 'Leads', href: '/leads', icon: <Briefcase className="w-5 h-5" />, description: 'Track potential sales opportunities', colorClass: 'text-pink-500' },
        ]
    },
    {
        label: 'JOBS',
        items: [
            { label: 'Catalogue', href: '/catalogue', icon: <Package className="w-5 h-5" />, description: 'Manage resource and item library', colorClass: 'text-blue-500' },
            { label: 'Templates', href: '/templates', icon: <FileText className="w-5 h-5" />, description: 'Reusable proposal templates', colorClass: 'text-indigo-500' },
            { label: 'Estimates & Proposals', href: '/estimates', icon: <Calculator className="w-5 h-5" />, description: 'Create and manage cost estimates', colorClass: 'text-orange-500' },
            { label: 'Schedules', href: '/jobs/schedules', icon: <Calendar className="w-5 h-5" />, description: 'Project timelines and scheduling', colorClass: 'text-teal-500' },
            { label: 'Time Cards', href: '/jobs/time-cards', icon: <Clock className="w-5 h-5" />, description: 'Employee time cards', colorClass: 'text-purple-500' },
        ]
    },
    {
        label: 'DOCS',
        items: [
            { label: 'JHA', href: '/docs/jha', icon: <ClipboardCheck className="w-5 h-5" />, description: 'Job Hazard Analysis forms', colorClass: 'text-rose-500' },
            { label: 'Job Tickets', href: '/docs/job-tickets', icon: <FileCheck className="w-5 h-5" />, description: 'Daily job execution records', colorClass: 'text-violet-500' },
            { label: 'Billing Tickets', href: '/docs/billing-tickets', icon: <DollarSign className="w-5 h-5" />, description: 'Invoicing and billing details', colorClass: 'text-green-500' },
            { label: 'Pothole', href: '/docs/pothole', icon: <AlertTriangle className="w-5 h-5" />, description: 'Pothole repair documentation', colorClass: 'text-amber-600' },
            { label: 'Damage Report', href: '/docs/damage-report', icon: <AlertTriangle className="w-5 h-5" />, description: 'Log equipment or site damages', colorClass: 'text-red-500' },
            { label: 'Incidents', href: '/docs/incidents', icon: <AlertTriangle className="w-5 h-5" />, description: 'Safety incident reports', colorClass: 'text-red-600' },
            { label: 'Pre Bore Logs', href: '/docs/pre-bore-logs', icon: <FileText className="w-5 h-5" />, description: 'Drilling and boling logs', colorClass: 'text-blue-600' },
            { label: 'Vehicle Maint', href: '/docs/vehicle-safety', icon: <Truck className="w-5 h-5" />, description: 'Vehicle safety checklists', colorClass: 'text-orange-600' },
            { label: 'Lubrication', href: '/docs/lubrication', icon: <Wrench className="w-5 h-5" />, description: 'Equipment lubrication logs', colorClass: 'text-slate-600' },
            { label: 'Repair Report', href: '/docs/repair', icon: <Wrench className="w-5 h-5" />, description: 'Maintenance and repair logs', colorClass: 'text-gray-600' },
            { label: 'Scope Change', href: '/docs/scope-change', icon: <FileText className="w-5 h-5" />, description: 'Document change orders', colorClass: 'text-indigo-600' },
        ]
    },
    {
        label: 'MISC',
        items: [
            { label: 'Constants', href: '/constants', icon: <Sliders className="w-5 h-5" />, description: 'System-wide configuration settings', colorClass: 'text-fuchsia-500' },
        ]
    },
    {
        label: 'REPORTS',
        items: [
            { label: 'Payroll', href: '/reports/payroll', icon: <DollarSign className="w-5 h-5" />, description: 'Employee payroll summary', colorClass: 'text-green-600' },
            { label: 'Work Comp', href: '/reports/work-comp', icon: <FileCheck className="w-5 h-5" />, description: 'Insurance and compensation', colorClass: 'text-blue-700' },
            { label: 'Fringe Benefits', href: '/reports/fringe', icon: <Settings className="w-5 h-5" />, description: 'Benefits analysis', colorClass: 'text-purple-600' },
            { label: 'Sales Performance', href: '/reports/sales', icon: <BarChart className="w-5 h-5" />, description: 'Revenue and sales metrics', colorClass: 'text-rose-600' },
        ]
    }
];

const CURRENT_VERSION = 'V.0.57';

interface HeaderProps {
    rightContent?: React.ReactNode;
    leftContent?: React.ReactNode;
    centerContent?: React.ReactNode;
    showDashboardActions?: boolean;
    hideLogo?: boolean;
}

interface User {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string;
}

export function Header({ rightContent, leftContent, centerContent, showDashboardActions, hideLogo }: HeaderProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [user, setUser] = useState<User | null>(null);
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('devco_user');
        if (storedUser) {
            try {
                const parsed = JSON.parse(storedUser);
                // Ensure it's an object and has at least an email or id
                if (parsed && typeof parsed === 'object') {
                    setUser(parsed);
                } else {
                    console.warn('Invalid user data found, clearing...');
                    localStorage.removeItem('devco_user');
                }
            } catch (e) {
                console.error('Failed to parse user data, clearing...', e);
                localStorage.removeItem('devco_user');
            }
        }
        
        // Click outside listener for dropdowns
        const handleClickOutside = (event: MouseEvent) => {
           if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
               setUserDropdownOpen(false);
           }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('devco_user');
        localStorage.removeItem('devco_session_valid');
        router.push('/login');
    };

    // Keyboard shortcut for search
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(true);
            }
            if (e.key === 'Escape') {
                setSearchOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Focus input when search opens
    useEffect(() => {
        if (searchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [searchOpen]);

    const isGroupActive = (items: SubItem[]) => {
        return items.some(item => pathname.startsWith(item.href));
    };

    // All searchable items
    const allItems = menuStructure.flatMap(group =>
        group.items.map(item => ({ ...item, group: group.label }))
    );
    const filteredItems = searchQuery
        ? allItems.filter(item =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : [];

    return (
        <>
            <header className="md:sticky top-0 z-50 bg-[#f0f2f5] border-b border-gray-200">
                <div className="w-full px-4 md:px-6">
                    <div className="flex items-center justify-between h-16 relative">
                        {/* Left Content + Navigation Menu */}
                        <div className="flex items-center gap-4">
                            {!hideLogo && (
                                <Link href="/" className="hidden md:block text-2xl tracking-tight hover:opacity-80 transition-opacity mr-2" style={{ color: '#0F4C75', fontFamily: "'BBH Hegarty', sans-serif" }}>
                                    DEVCO
                                </Link>
                            )}
                            {leftContent}
                            <nav className="hidden md:flex items-center gap-2">
                                {menuStructure.map((group) => {
                                    const active = isGroupActive(group.items);

                                    let dropdownWidth = 'w-72';
                                    let gridCols = 'grid-cols-1';

                                    if (group.items.length > 8) {
                                        dropdownWidth = 'w-[800px]';
                                        gridCols = 'grid-cols-3';
                                    } else if (group.items.length > 4) {
                                        dropdownWidth = 'w-[500px]';
                                        gridCols = 'grid-cols-2';
                                    }

                                    return (
                                        <div key={group.label} className="relative group">
                                            <button
                                                className={`px-4 py-2 rounded-lg text-sm font-bold tracking-wide transition-all flex items-center gap-1 ${active ? 'text-gray-900 bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                                                    }`}
                                            >
                                                {group.label}
                                                <ChevronDown className={`w-4 h-4 transition-transform duration-200 group-hover:rotate-180 ${active ? '' : 'text-gray-400'}`} style={active ? { color: '#0F4C75' } : {}} />
                                            </button>

                                            {/* Mega Dropdown */}
                                            <div className={`absolute top-full left-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-left z-50 ${dropdownWidth}`}>
                                                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 overflow-hidden ring-1 ring-black/5">
                                                    <div className={`grid ${gridCols} gap-4`}>
                                                        {group.items.map((item) => {
                                                            const isImplemented = ['/catalogue', '/templates', '/estimates', '/constants', '/clients', '/employees', '/knowledgebase', '/jobs/schedules', '/jobs/time-cards', '/reports/payroll'].includes(item.href);


                                                            const Content = () => (
                                                                <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group/item">
                                                                    <div className={`mt-1 bg-gray-50 p-2 rounded-lg group-hover/item:bg-white group-hover/item:shadow-sm transition-all ${item.colorClass && item.colorClass.replace('text-', 'bg-').replace('500', '100').replace('600', '100').replace('700', '100')}`}>
                                                                        {item.icon && React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, {
                                                                            className: `w-5 h-5 ${item.colorClass}`
                                                                        })}
                                                                    </div>
                                                                    <div>
                                                                        <h3 className={`font-bold text-base ${item.colorClass}`}>
                                                                            {item.label}
                                                                        </h3>
                                                                        <p className="text-xs text-gray-400 font-medium leading-relaxed mt-0.5">
                                                                            {item.description}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            );

                                                            if (!isImplemented) {
                                                                return (
                                                                    <div key={item.href} className="opacity-60 cursor-not-allowed grayscale">
                                                                        <Content />
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <Link key={item.href} href={item.href}>
                                                                    <Content />
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Mobile Centered Logo */}
                        {!hideLogo && (
                            <div className="md:hidden absolute left-1/2 -translate-x-1/2">
                                <Link href="/" className="text-2xl tracking-tight hover:opacity-80 transition-opacity" style={{ color: '#0F4C75', fontFamily: "'BBH Hegarty', sans-serif" }}>
                                    DEVCO
                                </Link>
                            </div>
                        )}

                        {/* Center Content */}
                        {centerContent && (
                            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
                                {centerContent}
                            </div>
                        )}

                        {/* Right Actions - Default Header Actions */}
                        <div className="flex items-center gap-3">
                            {showDashboardActions && (
                                <>
                                    {/* Search Button with Shortcut */}
                                    <button
                                        onClick={() => setSearchOpen(true)}
                                        className="flex items-center gap-2 px-3 md:px-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-500 transition-all flex-1 md:w-64 shadow-sm group overflow-hidden"
                                        style={{ border: searchOpen ? '1px solid #0F4C75' : '' }}
                                    >
                                        <Search size={18} className="shrink-0 group-hover:scale-110 transition-transform group-hover:text-[#0F4C75]" />
                                        <span className="flex-1 text-left font-medium">Search...</span>
                                        <kbd className="hidden lg:flex items-center gap-0.5 px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 border border-slate-200">
                                            <Command size={10} />K
                                        </kbd>
                                    </button>

                                    {/* Version Badge - Links to Knowledgebase */}
                                    <Link
                                        href="/knowledgebase"
                                        className="flex items-center gap-2 px-3 md:px-4 py-2 text-white rounded-full text-sm font-bold transition-all shadow-lg group hover:-translate-y-0.5 whitespace-nowrap"
                                        style={{ background: 'linear-gradient(to right, #0F4C75, #3282B8)', boxShadow: '0 10px 15px -3px rgba(15, 76, 117, 0.2)' }}
                                    >
                                        <BookOpen size={18} className="shrink-0 group-hover:rotate-12 transition-transform" />
                                        <span className="hidden xs:inline">{CURRENT_VERSION}</span>
                                    </Link>
                                </>
                            )}

                            {/* Additional right content if provided */}
                            {rightContent}

                            {/* User Profile Dropdown - Always visible for logout access */}
                            <div className="relative ml-2" ref={dropdownRef}>
                                <button
                                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                                    className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-[#0F4C75]/20 transition-all focus:outline-none"
                                >
                                    {user?.profilePicture ? (
                                        <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-[#0F4C75] text-white flex items-center justify-center text-sm font-bold">
                                            {user ? `${(user.firstName?.[0] || '')}${(user.lastName?.[0] || '')}` : <UserIcon size={20} />}
                                        </div>
                                    )}
                                </button>

                                {userDropdownOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-[60] animate-scale-in origin-top-right">
                                        <div className="px-4 py-4 border-b border-slate-50 bg-slate-50/50">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-10 h-10 rounded-full bg-[#0F4C75] text-white flex items-center justify-center text-sm font-bold shadow-sm">
                                                    {user ? `${(user.firstName?.[0] || '')}${(user.lastName?.[0] || '')}` : <UserIcon size={20} />}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="text-sm font-bold text-slate-900 truncate">
                                                        {user ? `${user.firstName} ${user.lastName}` : 'Guest User'}
                                                    </p>
                                                    <p className="text-xs text-slate-500 truncate font-medium bg-slate-200/50 px-1.5 py-0.5 rounded-md inline-block mt-0.5">
                                                        {user ? 'Active' : 'Not Logged In'}
                                                    </p>
                                                </div>
                                            </div>
                                            {user && <p className="text-xs text-slate-400 truncate pl-1">{user.email}</p>}
                                        </div>
                                        <div className="p-1.5 space-y-0.5">
                                            {user && (
                                                <Link
                                                    href={`/employees/${user._id}`}
                                                    onClick={() => setUserDropdownOpen(false)}
                                                    className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-[#0F4C75] rounded-xl transition-colors font-medium group"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-[#0F4C75]/10 text-slate-500 group-hover:text-[#0F4C75] transition-colors">
                                                        <UserIcon size={16} />
                                                    </div>
                                                    My Profile
                                                </Link>
                                            )}
                                            
                                            {/* Sign In option if no user */}
                                            {!user && (
                                                 <Link
                                                    href="/login"
                                                    onClick={() => setUserDropdownOpen(false)}
                                                    className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-[#0F4C75] rounded-xl transition-colors font-medium group"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-[#0F4C75]/10 text-slate-500 group-hover:text-[#0F4C75] transition-colors">
                                                        <UserIcon size={16} />
                                                    </div>
                                                    Sign In
                                                </Link>
                                            )}

                                            <button
                                                onClick={handleLogout}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left font-medium group"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center group-hover:bg-red-100 text-red-500 group-hover:text-red-700 transition-colors">
                                                    <LogOut size={16} />
                                                </div>
                                                Logout
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Search Modal Overlay */}
            {searchOpen && (
                <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[15vh]" onClick={() => setSearchOpen(false)}>
                    <div
                        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Search Input */}
                        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                            <Search size={20} className="text-slate-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search pages, features, and more..."
                                className="flex-1 text-lg outline-none placeholder-slate-400"
                            />
                            <kbd className="px-2 py-1 bg-slate-100 rounded text-xs font-medium text-slate-400">ESC</kbd>
                        </div>

                        {/* Search Results */}
                        <div className="max-h-[400px] overflow-y-auto">
                            {searchQuery && filteredItems.length === 0 && (
                                <div className="p-8 text-center text-slate-400">
                                    No results found for &quot;{searchQuery}&quot;
                                </div>
                            )}
                            {filteredItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                                    className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors group"
                                >
                                    <div className={`p-2 rounded-lg bg-slate-100 group-hover:bg-white group-hover:shadow-sm transition-all`}>
                                        {item.icon && React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, {
                                            className: `w-5 h-5 ${item.colorClass}`
                                        })}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-slate-800 group-hover:text-[#0F4C75]">{item.label}</p>
                                        <p className="text-sm text-slate-400">{item.description}</p>
                                    </div>
                                    <span className="text-xs text-slate-300 font-medium">{item.group}</span>
                                </Link>
                            ))}
                            {!searchQuery && (
                                <div className="p-6 text-center text-slate-400 text-sm">
                                    Start typing to search...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Header;
