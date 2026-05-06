'use client';

import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface MultiSelectProps {
    label: string;
    options: { value: string; label: string }[];
    selected: string[];
    onChange: (next: string[]) => void;
    icon?: ReactNode;
    placeholder?: string;
}

export function MultiSelect({
    label,
    options,
    selected,
    onChange,
    icon,
    placeholder,
}: MultiSelectProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click & Escape
    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [open]);

    const toggle = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter(v => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const displayText = selected.length === 0
        ? (placeholder || 'All')
        : selected.length === 1
            ? options.find(o => o.value === selected[0])?.label || '1 selected'
            : `${selected.length} selected`;

    return (
        <div className="space-y-1" ref={ref}>
            <label className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                {icon}
                {label}
            </label>
            <div className="relative">
                <button
                    type="button"
                    className="w-full h-9 px-3 pr-8 rounded-lg border border-slate-200 bg-white text-xs text-left outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 cursor-pointer truncate font-medium text-slate-700 hover:border-slate-300 transition-colors"
                    onClick={() => setOpen(v => !v)}
                >
                    {displayText}
                </button>
                <ChevronDown className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />

                {open && (
                    <div className="absolute left-0 right-0 top-10 z-50 max-h-[260px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
                        {/* Clear all */}
                        {selected.length > 0 && (
                            <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-[11px] text-red-500 hover:bg-red-50 border-b border-slate-100 font-semibold flex items-center gap-1.5 transition-colors"
                                onClick={() => onChange([])}
                            >
                                <X className="w-3 h-3" />
                                Clear all ({selected.length})
                            </button>
                        )}
                        {/* Options */}
                        {options.map((opt) => (
                            <label
                                key={opt.value}
                                className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.includes(opt.value)}
                                    onChange={() => toggle(opt.value)}
                                    className="w-3.5 h-3.5 rounded border-slate-300 accent-blue-600"
                                />
                                <span className="truncate font-medium text-slate-700">{opt.label}</span>
                            </label>
                        ))}
                        {options.length === 0 && (
                            <div className="px-3 py-4 text-xs text-slate-400 text-center">
                                No options available
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MultiSelect;
