'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SidebarAccordionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    rightAction?: React.ReactNode;
}

export function SidebarAccordion({ title, children, defaultOpen = false, rightAction }: SidebarAccordionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    
    return (
        <div className="w-full rounded-[16px] p-4 mb-4" style={{ background: '#e0e5ec', boxShadow: '4px 4px 8px #b8b9be, -4px -4px 8px #ffffff' }}>
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider select-none">{title}</h4>
                </div>
                {rightAction && <div onClick={(e) => e.stopPropagation()}>{rightAction}</div>}
            </div>
            {isOpen && <div className="mt-3">{children}</div>}
        </div>
    );
}
