'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, FileText, Package, Calculator, Sliders, Users, Contact, Briefcase, FileSpreadsheet, Calendar, DollarSign, ClipboardCheck, AlertTriangle, Truck, Wrench, Settings, BarChart, FileCheck } from 'lucide-react';

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
            { label: 'Contacts', href: '/contacts', icon: <Contact className="w-5 h-5" />, description: 'Directory of all business contacts', colorClass: 'text-purple-500' },
            { label: 'Employees', href: '/employees', icon: <Briefcase className="w-5 h-5" />, description: 'Manage company employees', colorClass: 'text-green-500' },
            { label: 'Leads', href: '/leads', icon: <Briefcase className="w-5 h-5" />, description: 'Track potential sales opportunities', colorClass: 'text-pink-500' },
        ]
    },
    {
        label: 'JOBS',
        items: [
            { label: 'Catalogue', href: '/catalogue', icon: <Package className="w-5 h-5" />, description: 'Manage resource and item library', colorClass: 'text-blue-500' },
            { label: 'Templates', href: '/templates', icon: <FileText className="w-5 h-5" />, description: 'Reusable proposal templates', colorClass: 'text-indigo-500' },
            { label: 'Estimates', href: '/estimates', icon: <Calculator className="w-5 h-5" />, description: 'Create and manage cost estimates', colorClass: 'text-orange-500' },
            { label: 'Proposals', href: '/jobs/proposals', icon: <FileSpreadsheet className="w-5 h-5" />, description: 'Send professional proposals', colorClass: 'text-amber-500' },
            { label: 'Schedules', href: '/jobs/schedules', icon: <Calendar className="w-5 h-5" />, description: 'Project timelines and scheduling', colorClass: 'text-teal-500' },
            { label: 'Project Cost', href: '/jobs/project-cost', icon: <DollarSign className="w-5 h-5" />, description: 'Track actual vs estimated costs', colorClass: 'text-emerald-500' },
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

interface HeaderProps {
    rightContent?: React.ReactNode;
}

export function Header({ rightContent }: HeaderProps) {
    const pathname = usePathname();

    const isGroupActive = (items: SubItem[]) => {
        return items.some(item => pathname.startsWith(item.href));
    };

    return (
        <header className="sticky top-0 z-50 bg-[#f0f2f5] border-b border-gray-200">
            <div className="w-full px-6">
                <div className="flex items-center justify-between h-16">
                    {/* Navigation Menu */}
                    <nav className="flex items-center gap-2">
                        {menuStructure.map((group) => {
                            const active = isGroupActive(group.items);
                            const hasManyItems = group.items.length > 6;

                            // Calculate width and grid cols based on item count
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
                                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 group-hover:rotate-180 ${active ? 'text-indigo-600' : 'text-gray-400'}`} />
                                    </button>

                                    {/* Mega Dropdown */}
                                    <div className={`absolute top-full left-0 mt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-left z-50 ${dropdownWidth}`}>
                                        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 overflow-hidden ring-1 ring-black/5">
                                            <div className={`grid ${gridCols} gap-4`}>
                                                {group.items.map((item) => {
                                                    const isActive = pathname === item.href;
                                                    // Updated isImplemented check to be more aligned with what we actually have active
                                                    const isImplemented = ['/catalogue', '/templates', '/estimates', '/constants', '/clients', '/contacts', '/employees'].includes(item.href);

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

                    {/* Right Actions */}
                    {rightContent && (
                        <div className="flex items-center gap-4">
                            {rightContent}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

export default Header;
