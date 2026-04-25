import React from 'react';
import PrefetchLink from '@/components/PrefetchLink';
import { ChevronRight } from 'lucide-react';

interface Breadcrumb {
    label: string;
    href?: string;
}

interface PageHeaderProps {
    title: React.ReactNode;
    actions?: React.ReactNode;
    breadcrumbs?: Breadcrumb[];
    className?: string;
}

export function PageHeader({ title, actions, breadcrumbs, className = '' }: PageHeaderProps) {
    return (
        <div className={`flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between w-full ${className}`}>
            <div>
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <nav className="flex items-center space-x-1 text-xs font-medium text-slate-500 mb-1.5">
                        {breadcrumbs.map((crumb, index) => (
                            <React.Fragment key={index}>
                                {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                {crumb.href ? (
                                    <PrefetchLink href={crumb.href} className="hover:text-[#0F4C75] transition-colors">
                                        {crumb.label}
                                    </PrefetchLink>
                                ) : (
                                    <span className="text-slate-800">{crumb.label}</span>
                                )}
                            </React.Fragment>
                        ))}
                    </nav>
                )}
                {typeof title === 'string' ? (
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {title}
                    </h1>
                ) : (
                    title
                )}
            </div>
            
            {actions && (
                <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                    {actions}
                </div>
            )}
        </div>
    );
}
