'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { FileText, Sparkles, Settings2, Bot, DollarSign } from 'lucide-react';
import { Header } from '@/components/ui';
import Link from 'next/link';

export default function GeneralSettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const tabs = [
        { id: 'document-ids', path: '/settings/general/document-ids', label: 'Estimate Document Ids', icon: <FileText className="w-3.5 h-3.5" /> },
        { id: 'sms-variables', path: '/settings/general/sms-variables', label: 'Customizations', icon: <Sparkles className="w-3.5 h-3.5" /> },
        { id: 'workflow', path: '/settings/general/workflow', label: 'Workflow Settings', icon: <Settings2 className="w-3.5 h-3.5" /> },
        { id: 'email-bots', path: '/settings/general/email-bots', label: 'Email Bot', icon: <Bot className="w-3.5 h-3.5" /> },
        { id: 'financials', path: '/settings/general/financials', label: 'Financials', icon: <DollarSign className="w-3.5 h-3.5" /> },
    ];

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header hideLogo={false} />
            
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="w-full space-y-6">
                    {/* Tabs */}
                    <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
                        {tabs.map(tab => {
                            const isActive = pathname.includes(tab.path);
                            return (
                                <Link
                                    key={tab.id}
                                    href={tab.path}
                                    className={`flex items-center gap-2 pb-3 px-4 font-bold text-sm transition-all whitespace-nowrap ${
                                        isActive 
                                        ? 'text-[#0F4C75] border-b-2 border-[#0F4C75]' 
                                        : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </div>

                    <div className="pb-20">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
