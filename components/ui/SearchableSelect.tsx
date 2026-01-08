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
    align?: 'left' | 'right';
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
    renderOption,
    align = 'left'
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
        opt.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // If search is empty, show all. If search exists, show filtered.
    const displayOptions = filteredOptions;

    // Check if current search is a new value (single select only)
    const isNewValue = searchTerm.trim() !== '' && !normalizedOptions.some(opt =>
        opt.label.toLowerCase() === searchTerm.trim().toLowerCase()
    );

    // Find current display label(s)
    let displayLabel: React.ReactNode = '';
    let selectedOption: SelectOption | undefined;

    if (multiple) {
        const vals = Array.isArray(value) ? value : [];
        if (vals.length > 0) {
            const maxVisible = 5;
            const showAll = vals.length <= maxVisible;
            const visibleVals = showAll ? vals : vals.slice(0, maxVisible - 1);
            const remaining = vals.length - visibleVals.length;

            displayLabel = (
                <div className="flex flex-wrap gap-1.5 py-1">
                    {visibleVals.map(v => {
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
                    {remaining > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            +{remaining} more
                        </span>
                    )}
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

            // Keep the selected index as-is - if blank is selected, highlight blank
            setActiveIndex(targetIndex);

            if (inputRef.current) {
                inputRef.current.focus();
            }
        }
    }, [isOpen]);

    useEffect(() => {
        // When search term changes, try to find current value in filtered results
        const idx = displayOptions.findIndex(o => o.value === value);
        if (idx >= 0) {
            setActiveIndex(idx);
        } else {
            setActiveIndex(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, value]);

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
            if (onNext) setTimeout(onNext, 50);
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
                    className="w-full min-h-[46px] h-auto p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 cursor-pointer flex items-center justify-between transition-all hover:bg-slate-100 hover:border-slate-300 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
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

                {/* Dropdown Panel - Mobile Native (Full Screen Style) */}
                {isOpen && (
                    <div className="md:hidden fixed inset-0 z-[300] flex items-start justify-center">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsOpen(false)}></div>
                        <div className="relative w-full h-[95vh] bg-white rounded-t-[32px] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300 select-none mt-auto" style={{ WebkitTouchCallout: 'none' }}>
                            {/* Header */}
                            <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                                <h3 className="text-2xl font-extrabold text-slate-900">{label || 'Category'}</h3>
                                <button onClick={() => setIsOpen(false)} className="p-2 -mr-2 text-slate-400 bg-slate-50 rounded-full">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Search inside options list */}
                            <div className="px-6 py-4 bg-slate-50/50 shrink-0">
                                <div className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                    <Search size={20} className="text-slate-400" />
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search..."
                                        className="flex-1 bg-transparent border-none outline-none text-base text-slate-900 placeholder:text-slate-400 h-8"
                                    />
                                </div>
                            </div>

                            {/* Options List */}
                            <div className="flex-1 overflow-y-auto py-4">
                                {/* New Option */}
                                {onAddNew && isNewValue && (
                                    <div
                                        onClick={handleAddNew}
                                        className="px-6 py-5 flex items-center gap-4 active:bg-slate-50 transition-colors border-b border-slate-50"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                            <Plus size={24} />
                                        </div>
                                        <span className="text-xl font-bold text-blue-600">New Item</span>
                                    </div>
                                )}

                                {displayOptions.length > 0 ? (
                                    displayOptions.filter(o => o.value !== '').map((opt, i) => {
                                        const isSelected = multiple
                                            ? (Array.isArray(value) && value.includes(opt.value))
                                            : opt.value === value;

                                        return (
                                            <div
                                                key={opt.value + i}
                                                onClick={() => handleSelect(opt)}
                                                className="px-6 py-5 flex items-center justify-between active:bg-slate-50 transition-colors border-b border-slate-50/50"
                                            >
                                                <div className="flex items-center gap-5 flex-1">
                                                    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-blue-600 bg-white' : 'border-slate-300 bg-white'}`}>
                                                        {isSelected && <div className="w-3.5 h-3.5 rounded-full bg-blue-600 animate-in zoom-in-50 duration-200" />}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className={`text-xl font-bold ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                                                            {opt.label}
                                                        </span>
                                                        {opt.subtitle && <span className="text-base text-slate-400 mt-0.5">{opt.subtitle}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    searchTerm.trim() !== '' && (
                                        <div className="px-6 py-12 text-center text-slate-400">
                                            No items found
                                        </div>
                                    )
                                )}
                                <div className="h-32" /> {/* Bottom safe area for footer */}
                            </div>

                            {/* Footer */}
                            <div className="px-8 py-6 border-t border-slate-100 flex items-center justify-between bg-white shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                                <button
                                    onClick={() => { onChange(multiple ? [] : ''); setIsOpen(false); }}
                                    className="text-xl font-bold text-slate-400 active:text-slate-600"
                                >
                                    Clear
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="px-10 py-3 bg-blue-600 text-white rounded-2xl text-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Dropdown Panel - Desktop */}
                {isOpen && (
                    <div className={`hidden md:block absolute top-12 ${align === 'right' ? 'right-0' : 'left-0'} w-full min-w-[320px] bg-white rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.15)] ring-1 ring-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100`}>
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
                            {onAddNew && isNewValue && (
                                <div
                                    onClick={handleAddNew}
                                    className="px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all flex items-center gap-3 mb-0.5 text-blue-600 hover:bg-blue-50/50 font-bold"
                                >
                                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
                                        <Plus className="w-4 h-4" />
                                    </div>
                                    <span>New Item</span>
                                </div>
                            )}

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
                                searchTerm.trim() !== '' && (
                                    <div className="px-4 py-8 text-center text-slate-300 text-xs">No results</div>
                                )
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
