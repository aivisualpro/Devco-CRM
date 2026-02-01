'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, FileText, Package, Calculator, Sliders, Users, Contact, Briefcase, FileSpreadsheet, Calendar, DollarSign, ClipboardCheck, AlertTriangle, Truck, Wrench, Settings, BarChart, FileCheck, Search, Bell, BookOpen, Command, LogOut, User as UserIcon, Clock, Import, X, Menu, MessageSquare, GraduationCap, Activity, Receipt } from 'lucide-react';
import { MyDropDown } from './MyDropDown';
import { usePermissions } from '@/hooks/usePermissions';

interface SubItem {
    label: string;
    href: string;
    icon?: React.ReactNode;
    description: string;
    colorClass: string;
}

interface MenuItem {
    label: string;
    items?: SubItem[];
    href?: string;
}

const IMPLEMENTED_ROUTES = ['/catalogue', '/templates', '/estimates', '/clients', '/employees', '/contacts', '/jobs/schedules', '/jobs/time-cards', '/reports/payroll', '/reports/workers-comp', '/reports/fringe-benefits', '/reports/wip', '/reports/daily-activities', '/roles', '/constants', '/dashboard', '/docs/jha', '/docs/job-tickets', '/settings/imports', '/settings/knowledgebase', '/settings/general', '/docs/receipts-costs'];

const menuStructure: MenuItem[] = [
    {
        label: 'CRM',
        items: [
            { label: 'Clients', href: '/clients', icon: <Users className="w-5 h-5" />, description: 'Manage client relationships and data', colorClass: 'text-cyan-500' },
            { label: 'Employees', href: '/employees', icon: <Briefcase className="w-5 h-5" />, description: 'Manage company employees', colorClass: 'text-green-500' },
            { label: 'Contacts', href: '/contacts', icon: <Contact className="w-5 h-5" />, description: 'View employee contacts', colorClass: 'text-pink-500' },
        ]
    },
    {
        label: 'JOBS',
        items: [
            { label: 'Estimates & Proposals', href: '/estimates', icon: <Calculator className="w-5 h-5" />, description: 'Create and manage cost estimates', colorClass: 'text-orange-500' },
            { label: 'Schedules', href: '/jobs/schedules', icon: <Calendar className="w-5 h-5" />, description: 'Project timelines and scheduling', colorClass: 'text-teal-500' },
            { label: 'Time Cards', href: '/jobs/time-cards', icon: <Clock className="w-5 h-5" />, description: 'Employee time cards', colorClass: 'text-purple-500' },
            { label: 'Templates', href: '/templates', icon: <FileText className="w-5 h-5" />, description: 'Reusable proposal templates', colorClass: 'text-indigo-500' },
            { label: 'Catalogue', href: '/catalogue', icon: <Package className="w-5 h-5" />, description: 'Manage resource and item library', colorClass: 'text-blue-500' },
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
            { label: 'Receipts & Costs', href: '/docs/receipts-costs', icon: <Receipt className="w-5 h-5" />, description: 'Track job receipts and costs', colorClass: 'text-teal-600' },
        ]
    },
    {
        label: 'REPORTS',
        items: [
            { label: 'Payroll', href: '/reports/payroll', icon: <DollarSign className="w-5 h-5" />, description: 'Employee payroll summary', colorClass: 'text-green-600' },
            { label: 'Fringe Benefits', href: '/reports/fringe-benefits', icon: <DollarSign className="w-5 h-5" />, description: 'Benefits analysis', colorClass: 'text-purple-600' },
            { label: 'Workers Comp', href: '/reports/workers-comp', icon: <FileCheck className="w-5 h-5" />, description: 'Insurance and compensation', colorClass: 'text-blue-700' },
            { label: 'Work in Progress', href: '/reports/wip', icon: <BarChart className="w-5 h-5" />, description: 'Live QuickBooks project financials', colorClass: 'text-emerald-500' },
            { label: 'Daily Activity', href: '/reports/daily-activities', icon: <Activity className="w-5 h-5" />, description: 'Track daily team activities', colorClass: 'text-orange-500' },
        ]
    },
    {
        label: 'SETTINGS',
        items: [
            { label: 'General', href: '/settings/general', icon: <Settings className="w-5 h-5" />, description: 'General system configuration', colorClass: 'text-gray-500' },
            { label: 'Constants', href: '/constants', icon: <Sliders className="w-5 h-5" />, description: 'System-wide configuration settings', colorClass: 'text-fuchsia-500' },
            { label: 'Roles & Permissions', href: '/roles', icon: <Settings className="w-5 h-5" />, description: 'Manage access control and permissions', colorClass: 'text-red-500' },
            { label: 'Imports', href: '/settings/imports', icon: <Import className="w-5 h-5" />, description: 'Bulk import data from CSV files', colorClass: 'text-blue-500' },
            { label: 'Knowledgebase', href: '/settings/knowledgebase', icon: <BookOpen className="w-5 h-5" />, description: 'System documentation and changelog', colorClass: 'text-amber-500' },
        ]
    },
];

const CURRENT_VERSION = 'V.0.78';

interface HeaderProps {
    rightContent?: React.ReactNode;
    leftContent?: React.ReactNode;
    centerContent?: React.ReactNode;
    showDashboardActions?: boolean;
    hideLogo?: boolean;
    wipReportFilters?: {
        activeTab: string;
        setActiveTab: (tab: string) => void;
        searchQuery: string;
        setSearchQuery: (query: string) => void;
        dateRangeFilter: string;
        setDateRangeFilter: (range: string) => void;
        hasActiveFilters: boolean;
        clearFilters: () => void;
    };
}

interface User {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string;
}

export function Header({ rightContent, leftContent, centerContent, showDashboardActions, hideLogo, wipReportFilters }: HeaderProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { canAccessRoute } = usePermissions();
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [user, setUser] = useState<User | null>(null);
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

    const handleLogout = async () => {
        try {
            // Call server-side logout to clear HTTP-only cookie
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (err) {
            console.error('Logout error:', err);
        }
        // Also clear client-side storage
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
        (group.items || []).map(item => ({ ...item, group: group.label }))
    );
    const filteredItems = searchQuery
        ? allItems.filter(item =>
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : [];

    return (
        <>
            <header className="md:sticky top-0 z-[100] bg-[#eef2f6] border-b border-gray-200">
                <div className="w-full px-4">
                    <div className="flex items-center justify-between h-12 relative">
                        {/* Left Content + Navigation Menu */}
                        <div className="flex items-center gap-2">
                             {/* Mobile Burger Menu Button */}
                             <button
                                onClick={() => setIsMobileMenuOpen(true)}
                                className="md:hidden p-1.5 text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors"
                            >
                                <Menu size={20} />
                            </button>
                            {!hideLogo && (
                                <div className="hidden lg:flex items-center">
                                    <Link href="/dashboard" className="text-xl tracking-tight hover:opacity-80 transition-opacity mr-2" style={{ color: '#0F4C75', fontFamily: "'BBH Hegarty', sans-serif" }}>
                                        DEVCO
                                    </Link>
                                </div>
                            )}
                            {leftContent}
                            <nav className="hidden md:flex items-center gap-2">
                                {menuStructure.map((group) => {
                                    // Filter items based on permissions
                                    const visibleItems = (group.items || []).filter(item => canAccessRoute(item.href));
                                    
                                    // If group has no visible items and no direct href, hide it
                                    if (visibleItems.length === 0 && !group.href) {
                                        return null;
                                    }

                                    // If group has a direct href, check if it's accessible
                                    if (group.href && !canAccessRoute(group.href)) {
                                        return null;
                                    }

                                    const active = isGroupActive(visibleItems);

                                    if (group.href) {
                                        const isLinkActive = pathname.startsWith(group.href);
                                        return (
                                            <Link
                                                key={group.label}
                                                href={group.href}
                                                className={`px-3 py-3 rounded-lg text-sm font-bold leading-4 transition-all flex items-center gap-1 focus:outline-none ${isLinkActive ? 'text-gray-900 bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'}`}
                                            >
                                                {group.label}
                                            </Link>
                                        );
                                    }

                                    return (
                                        <div 
                                            key={group.label} 
                                            className="relative"
                                            onMouseEnter={() => setOpenMenu(group.label)}
                                            onMouseLeave={() => setOpenMenu(null)}
                                        >
                                            <button
                                                className={`px-3 py-3 rounded-lg text-sm font-bold leading-4 transition-all flex items-center gap-1 focus:outline-none ${active ? 'text-gray-900 bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                                                    }`}
                                            >
                                                {group.label}
                                                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openMenu === group.label ? 'rotate-180' : ''} ${active ? '' : 'text-gray-400'}`} style={active ? { color: '#0F4C75' } : {}} />
                                            </button>

                                            <MyDropDown
                                                isOpen={openMenu === group.label}
                                                onClose={() => setOpenMenu(null)}
                                                options={visibleItems.map(item => ({
                                                    id: item.href,
                                                    label: item.label,
                                                    value: item.href,
                                                    icon: item.icon,
                                                    disabled: !IMPLEMENTED_ROUTES.some(route => item.href.startsWith(route))
                                                }))}
                                                selectedValues={[pathname]}
                                                onSelect={(value) => {
                                                    router.push(value);
                                                    setOpenMenu(null);
                                                }}
                                                placeholder={`Search ${group.label}...`}
                                                emptyMessage="No pages found"
                                                width="w-64"
                                                className="!left-0 !translate-x-0"
                                                hideSelectionIndicator={true}
                                                modal={false}
                                            />
                                        </div>
                                    );
                                })}
                            </nav>
                        </div>



                        {/* Center Content */}
                        {centerContent && (
                            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center whitespace-nowrap z-20">
                                {centerContent}
                            </div>
                        )}

                        {/* Right Actions - Default Header Actions */}
                        <div className="flex items-center gap-3">
                            {wipReportFilters && (
                                <div className="flex items-center gap-3 mr-4">
                                    {/* Toggle WIP/QuickBooks */}
                                    <div className="flex p-0.5 bg-slate-200/50 rounded-xl border border-slate-200/50">
                                        <button 
                                            onClick={() => wipReportFilters.setActiveTab('wip')}
                                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${wipReportFilters.activeTab === 'wip' ? 'bg-white text-[#0F4C75] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            WIP
                                        </button>
                                        <button 
                                            onClick={() => wipReportFilters.setActiveTab('quickbooks')}
                                            className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${wipReportFilters.activeTab === 'quickbooks' ? 'bg-white text-[#0F4C75] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            QB
                                        </button>
                                    </div>

                                    <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>

                                    {/* Date Range Select */}
                                    <div className="relative group">
                                        <select 
                                            value={wipReportFilters.dateRangeFilter}
                                            onChange={(e) => wipReportFilters.setDateRangeFilter(e.target.value)}
                                            className="appearance-none bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 pr-7 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] cursor-pointer min-w-[100px] shadow-sm hover:bg-slate-50 transition-all"
                                        >
                                            <option value="all">All Time</option>
                                            <option value="this_month">This Month</option>
                                            <option value="this_year">This Year</option>
                                            <option value="last_year">Last Year</option>
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                    </div>

                                    {/* Search Input */}
                                    <div className="relative w-[220px]">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <input 
                                            type="text" 
                                            placeholder="Search projects..." 
                                            value={wipReportFilters.searchQuery}
                                            onChange={(e) => wipReportFilters.setSearchQuery(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] shadow-sm hover:bg-slate-50 transition-all" 
                                        />
                                    </div>

                                    {wipReportFilters.hasActiveFilters && (
                                        <button 
                                            onClick={wipReportFilters.clearFilters}
                                            className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                                            title="Clear filters"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            )}

                            {showDashboardActions && (
                                <>
                                    {/* Search Button with Shortcut */}
                                    {!wipReportFilters && (
                                        <button
                                            onClick={() => setSearchOpen(true)}
                                            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-full text-xs text-slate-500 transition-all flex-1 md:w-64 shadow-sm group overflow-hidden"
                                            style={{ border: searchOpen ? '1px solid #0F4C75' : '' }}
                                        >
                                            <Search size={18} className="shrink-0 group-hover:scale-110 transition-transform group-hover:text-[#0F4C75]" />
                                            <span className="flex-1 text-left font-medium">Search...</span>
                                            <kbd className="hidden lg:flex items-center gap-0.5 px-2 py-0.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 border border-slate-200">
                                                <Command size={10} />K
                                            </kbd>
                                        </button>
                                    )}

                                    {/* Version Badge - Only on Homepage/Dashboard */}
                                    {(pathname === '/' || pathname === '/dashboard') && (
                                        <Link
                                            href="/settings/knowledgebase"
                                            className="flex items-center gap-2 px-3 py-2 text-white rounded-full text-xs font-bold transition-all shadow-lg group hover:-translate-y-0.5 whitespace-nowrap"
                                            style={{ background: 'linear-gradient(to right, #0F4C75, #3282B8)', boxShadow: '0 10px 15px -3px rgba(15, 76, 117, 0.2)' }}
                                        >
                                            <BookOpen size={18} className="shrink-0 group-hover:rotate-12 transition-transform" />
                                            <span className="hidden xs:inline">{CURRENT_VERSION}</span>
                                        </Link>
                                    )}
                                </>
                            )}

                            {/* Additional right content if provided */}
                            {rightContent}

                            {/* User Profile Dropdown - Always visible for logout access */}
                            <div className="relative ml-2" ref={dropdownRef}>
                                <button
                                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                                    className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-[#0F4C75]/20 transition-all focus:outline-none"
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
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-[#0F4C75] text-white flex items-center justify-center text-sm font-bold shadow-sm">
                                                    {user ? `${(user.firstName?.[0] || '')}${(user.lastName?.[0] || '')}` : <UserIcon size={20} />}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="text-sm font-bold text-slate-900 truncate">
                                                        {user ? `${user.firstName} ${user.lastName}` : 'Guest User'}
                                                    </p>
                                                </div>
                                            </div>
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
                                                    Profile
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

            {/* Mobile Menu Drawer */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[150] bg-white/95 backdrop-blur-xl animate-in slide-in-from-right duration-300 md:hidden">
                    <div className="flex flex-col h-full">
                         <div className="flex items-center justify-between p-4 border-b border-slate-100/50 bg-gradient-to-r from-[#0F4C75]/5 to-transparent">
                            <span className="text-xl font-black text-slate-800 tracking-tight uppercase">Menu</span>
                            <button 
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
                            >
                                <X size={24} className="text-slate-600" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-6">
                            <div>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 pl-1">Settings</h3>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => {
                                            router.push('/dashboard?view=training');
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 active:scale-[0.98] ${
                                            pathname === '/dashboard' && new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('view') === 'training'
                                                ? 'bg-[#0F4C75]/10 border-[#0F4C75]/20' 
                                                : 'bg-amber-50/80 border-amber-100 hover:bg-amber-100/80 hover:border-amber-200'
                                        }`}
                                    >
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-100 text-amber-600 shadow-sm">
                                            <GraduationCap size={24} />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <span className={`text-base font-bold block ${
                                                pathname === '/dashboard' && new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('view') === 'training'
                                                    ? 'text-[#0F4C75]' 
                                                    : 'text-slate-700'
                                            }`}>
                                                Training & Certifications
                                            </span>
                                            <span className="text-xs text-slate-500 mt-0.5 block">
                                                Your compliance status
                                            </span>
                                        </div>
                                        <div className={`w-2 h-2 rounded-full ${
                                            pathname === '/dashboard' && new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('view') === 'training'
                                                ? 'bg-[#0F4C75]' 
                                                : 'bg-amber-200'
                                        }`} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="pt-6 border-t border-slate-100">
                                <button 
                                    onClick={() => {
                                         handleLogout();
                                         setIsMobileMenuOpen(false);
                                    }}
                                    className="w-full flex items-center justify-center gap-3 p-4 bg-rose-50 text-rose-600 rounded-2xl font-bold border border-rose-100/50 active:scale-95 transition-all"
                                >
                                    <LogOut size={20} />
                                    Log Out
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
                            {filteredItems.map((item) => {
                                const isImplemented = IMPLEMENTED_ROUTES.some(route => item.href.startsWith(route));
                                const Content = (
                                    <div className="flex items-center gap-4 px-5 py-3 transition-colors group">
                                        <div className={`p-2 rounded-lg bg-slate-100 group-hover:bg-white group-hover:shadow-sm transition-all ${!isImplemented ? 'grayscale' : ''}`}>
                                            {item.icon && React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, {
                                                className: `w-5 h-5 ${item.colorClass}`
                                            })}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between">
                                                <p className={`font-semibold ${isImplemented ? 'text-slate-800 group-hover:text-[#0F4C75]' : 'text-slate-400'}`}>{item.label}</p>
                                                {!isImplemented && (
                                                    <span className="text-[10px] text-slate-400 font-medium italic border border-slate-200 px-1.5 py-0.5 rounded bg-slate-50">Soon</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-400">{item.description}</p>
                                        </div>
                                        <span className="text-xs text-slate-300 font-medium">{item.group}</span>
                                    </div>
                                );

                                if (!isImplemented) {
                                    return (
                                        <div key={item.href} className="opacity-60 cursor-not-allowed">
                                            {Content}
                                        </div>
                                    );
                                }

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                                        className="hover:bg-slate-50 block"
                                    >
                                        {Content}
                                    </Link>
                                );
                            })}
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
