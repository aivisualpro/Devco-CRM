'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check, Plus } from 'lucide-react';

export interface SelectOption {
    label: string;
    value: string;
    image?: string;
    color?: string;
    initials?: string;
    subtitle?: string;
}

interface SearchableSelectProps {
    label?: string;
    value: string | string[];
    onChange: (value: any) => void;
    options: (string | SelectOption)[];
    multiple?: boolean;
    placeholder?: string;
    autoFocus?: boolean;
    id?: string;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    onNext?: () => void;
    onAddNew?: (value: string) => void;
    className?: string;
    disableBlank?: boolean;
    submitOnEnter?: boolean;
    openOnFocus?: boolean;
    renderOption?: (option: SelectOption) => React.ReactNode;
}

export function SearchableSelect({
    label,
    value,
    onChange,
    options = [],
    placeholder = 'Select...',
    autoFocus = false,
    id,
    onKeyDown,
    onNext,
    onAddNew,
    className = '',
    multiple = false,
    disableBlank = false,
    submitOnEnter = false,
    openOnFocus = false,
    renderOption
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(autoFocus || false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const optionsListRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    // Normalize options to SelectOption[]
    const normalizedRaw = options.map(opt => {
        if (typeof opt === 'string') {
            return { label: opt, value: opt };
        }
        return opt;
    });

    const hasBlank = normalizedRaw.some(o => o.value === '');
    const normalizedOptions: SelectOption[] = (hasBlank || disableBlank)
        ? normalizedRaw
        : [{ label: '-', value: '', initials: '-' }, ...normalizedRaw];

    // Filter based on search
    const filteredOptions = normalizedOptions.filter(opt =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // If search is empty, show all. If search exists, show filtered.
    const displayOptions = filteredOptions;

    // Check if current search is a new value (single select only)
    const isNewValue = !multiple && searchTerm && !normalizedOptions.some(opt =>
        opt.label.toLowerCase() === searchTerm.toLowerCase()
    );

    // Find current display label(s)
    let displayLabel: React.ReactNode = '';
    let selectedOption: SelectOption | undefined;

    if (multiple) {
        const vals = Array.isArray(value) ? value : [];
        if (vals.length > 0) {
            displayLabel = (
                <div className="flex flex-wrap gap-1">
                    {vals.map(v => {
                        const opt = normalizedOptions.find(o => o.value === v);
                        const label = opt?.label || v;
                        return (
                            <span key={v} className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                                {label}
                                <span
                                    className="ml-1 cursor-pointer hover:text-red-500"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelect(opt || { label: v, value: v });
                                    }}
                                >
                                    ×
                                </span>
                            </span>
                        );
                    })}
                </div>
            );
        }
    } else {
        selectedOption = normalizedOptions.find(o => o.value === value);
        displayLabel = selectedOption ? selectedOption.label : value;
    }

    useEffect(() => {
        if (autoFocus) setIsOpen(true);
    }, [autoFocus]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            const idx = displayOptions.findIndex(o => o.value === value);
            // If match found and it's not the blank one (or if it is but we want to select it), use it.
            // If match is the blank one (index 0 usually) or no match (idx -1), and we have more options, 
            // and we want to "auto select" the real client, we might want index 1.
            // But this applies generally. The user said "Client when active auto select... instead of '-'".
            // If I default to 1 when value is empty, that satisfies it.
            // But only if we have a blank option at 0.

            let targetIndex = idx >= 0 ? idx : 0;

            // If the selected item is the blank one (value is empty string) and we have other options, default to the first real option (index 1)
            // effective only when opening the dropdown.
            if (displayOptions.length > 1 && displayOptions[0].value === '' && (idx === 0 || idx === -1) && !multiple) {
                targetIndex = 1;
            }

            setActiveIndex(targetIndex);

            if (inputRef.current) {
                inputRef.current.focus();
            }
            // Auto-scroll dropdown into view
            if (containerRef.current) {
                setTimeout(() => {
                    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        }
    }, [isOpen]);

    useEffect(() => {
        setActiveIndex(0);
    }, [searchTerm]);

    const isKeyboardRef = useRef(false);

    // ... (existing refs)

    useEffect(() => {
        if (isOpen && optionsListRef.current && isKeyboardRef.current) {
            const activeElement = optionsListRef.current.children[activeIndex] as HTMLElement;
            if (activeElement) {
                const container = optionsListRef.current;
                const itemTop = activeElement.offsetTop;
                const itemBottom = itemTop + activeElement.offsetHeight;
                const containerTop = container.scrollTop;
                const containerBottom = containerTop + container.offsetHeight;

                if (itemTop < containerTop) {
                    container.scrollTop = itemTop;
                } else if (itemBottom > containerBottom) {
                    container.scrollTop = itemBottom - container.offsetHeight;
                }
            }
        }
    }, [activeIndex, isOpen]);

    const handleSelect = (opt: SelectOption) => {
        if (multiple) {
            const current = Array.isArray(value) ? value : [];
            const exists = current.includes(opt.value);
            let next: string[];
            if (exists) {
                next = current.filter(v => v !== opt.value);
            } else {
                next = [...current, opt.value];
            }
            onChange(next);
            // Keep open (re-focus input if we lost it)
            if (inputRef.current) inputRef.current.focus();
        } else {
            onChange(opt.value);
            setSearchTerm('');
            setIsOpen(false);
            if (onNext) setTimeout(onNext, 50);
        }
    };

    const handleAddNew = () => {
        if (searchTerm.trim() && onAddNew) {
            onAddNew(searchTerm.trim());
            setSearchTerm('');
            setIsOpen(false);
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        isKeyboardRef.current = true;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev < displayOptions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (displayOptions.length > 0) {
                handleSelect(displayOptions[activeIndex]);
            } else if (isNewValue && onAddNew) {
                handleAddNew();
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setSearchTerm('');
        } else if (e.key === 'Tab') {
            setIsOpen(false);
            // Allow default tab behavior to move focus
        }
    };

    const getInitials = (name: string) => {
        if (!name) return '??';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 0 || (parts.length === 1 && !parts[0])) return '??';

        if (parts.length === 1) {
            const word = parts[0];
            return (word.length > 1 ? word[0] + word[word.length - 1] : word[0]).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    return (
        <div className={`${className} ${isOpen ? 'relative z-[100]' : ''}`} ref={containerRef}>
            {label && <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>}

            <div className="relative">
                {/* Trigger */}
                <div
                    id={id}
                    tabIndex={0}
                    style={isOpen ? { visibility: 'hidden' } : {}}
                    ref={triggerRef}
                    onClick={() => setIsOpen(true)}
                    onFocus={() => {
                        if (openOnFocus && !isOpen) setIsOpen(true);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'ArrowDown') {
                            e.preventDefault();
                            setIsOpen(true);
                        } else if (e.key === 'Enter') {
                            if (!isOpen && submitOnEnter) {
                                // trigger form submit
                                e.currentTarget.closest('form')?.requestSubmit();
                            } else {
                                e.preventDefault();
                                setIsOpen(true);
                            }
                        } else if (e.key === 'Tab') {
                            setIsOpen(false);
                            // Do NOT prevent default, let Tab move focus
                        } else if (onKeyDown) {
                            onKeyDown(e);
                        }
                    }}
                    className="w-full h-[46px] px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 cursor-pointer flex items-center justify-between transition-all hover:bg-slate-100 hover:border-slate-300 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                >
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                        {(!multiple && (selectedOption?.image || selectedOption?.color || selectedOption?.initials || (displayLabel && displayLabel !== placeholder))) ? (
                            <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600 overflow-hidden shrink-0 border border-slate-200"
                                style={selectedOption?.color && !selectedOption.image ? { backgroundColor: selectedOption.color, color: '#fff', borderColor: 'transparent' } : { backgroundColor: '#e2e8f0' }}
                            >
                                {selectedOption?.image ? (
                                    <img src={selectedOption.image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    selectedOption?.initials || getInitials(typeof displayLabel === 'string' ? displayLabel : '')
                                )}
                            </div>
                        ) : null}

                        {multiple && !displayLabel && <span className="text-slate-500">{placeholder}</span>}
                        {multiple && displayLabel ? displayLabel : <span className="truncate">{typeof displayLabel === 'string' ? (displayLabel || placeholder) : displayLabel}</span>}
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                </div>

                {/* Dropdown Panel */}
                {isOpen && (
                    <div className="absolute top-0 left-0 w-full min-w-[240px] bg-white rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.15)] ring-1 ring-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                        {/* Search Header */}
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                            <Search className="w-4 h-4 text-slate-400 shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                placeholder="Search..."
                                className="flex-1 bg-transparent outline-none text-sm text-slate-900 placeholder:text-slate-400"
                            />
                            <button
                                onClick={() => { setIsOpen(false); setSearchTerm(''); }}
                                className="p-1 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>

                        {/* Options List */}
                        <div className="max-h-[280px] overflow-y-auto p-2 scroll-smooth" ref={optionsListRef}>
                            {displayOptions.length > 0 ? (
                                displayOptions.map((opt, i) => {
                                    const isHighlighted = i === activeIndex;
                                    const isSelected = multiple
                                        ? (Array.isArray(value) && value.includes(opt.value))
                                        : opt.value === value;

                                    return (
                                        <div
                                            key={opt.value + i}
                                            onClick={() => handleSelect(opt)}
                                            onMouseEnter={() => {
                                                isKeyboardRef.current = false;
                                                setActiveIndex(i);
                                            }}
                                            className={`px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all flex items-center justify-between mb-0.5 ${isHighlighted
                                                ? 'bg-slate-100 text-slate-900'
                                                : isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                {/* Avatar / Initials */}
                                                <div
                                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border transition-colors shrink-0 ${isHighlighted ? 'bg-white border-slate-200' : 'bg-slate-100 border-slate-100 text-slate-500'}`}
                                                    style={opt.color && !opt.image ? { backgroundColor: opt.color, color: '#fff', borderColor: 'transparent' } : {}}
                                                >
                                                    {opt.image ? (
                                                        <img src={opt.image} alt="" className="w-full h-full object-cover rounded-full" />
                                                    ) : (
                                                        opt.initials || getInitials(opt.label)
                                                    )}
                                                </div>

                                                <div className="flex flex-col">
                                                    <span className={`font-bold ${isSelected ? 'text-indigo-700' : 'text-slate-700'}`}>{opt.label}</span>
                                                    {opt.subtitle && <span className="text-[10px] text-slate-400">{opt.subtitle}</span>}
                                                </div>
                                            </div>

                                            {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="px-4 py-8 text-center">
                                    {isNewValue && onAddNew ? (
                                        <div
                                            onClick={handleAddNew}
                                            className="text-sm cursor-pointer text-indigo-600 hover:text-indigo-700 font-medium flex flex-col items-center gap-2 group"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Plus className="w-5 h-5" />
                                            </div>
                                            <span>Add "{searchTerm}"</span>
                                        </div>
                                    ) : (
                                        <div className="text-slate-400 text-xs">No matches found</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
