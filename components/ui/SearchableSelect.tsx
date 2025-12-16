'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check, Plus } from 'lucide-react';

interface SearchableSelectProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
    autoFocus?: boolean;
    id?: string;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    onNext?: () => void;
    className?: string;
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
    className = ''
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(autoFocus || false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);

    const [activeIndex, setActiveIndex] = useState(0);
    const optionsListRef = useRef<HTMLDivElement>(null);

    const filteredOptions = options.filter(opt =>
        String(opt).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const displayOptions = searchTerm
        ? filteredOptions
        : ['-', ...options.filter(o => o !== '-')];

    const isNewValue = searchTerm && !options.some(opt =>
        String(opt).toLowerCase() === searchTerm.toLowerCase()
    );

    // Auto-focus and auto-open on mount if autoFocus is true
    useEffect(() => {
        if (autoFocus) {
            setIsOpen(true);
        }
    }, []);

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

    // Focus input when dropdown opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Reset active index when search changes
    useEffect(() => {
        setActiveIndex(0);
    }, [searchTerm]);

    // Scroll active item into view
    useEffect(() => {
        if (isOpen && optionsListRef.current) {
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

    const focusNextElement = () => {
        // Find the next focusable element in the document relative to our container
        // We do this BEFORE state update if possible, or right after.
        // Best allows the dropdown to close, then we focus.
        // But the input inside dropdown is gone. The trigger is back.
        // So we scan for our container or trigger, then find next.

        // Wait for close render
        setTimeout(() => {
            const allFocusable = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'));
            const visibleFocusable = allFocusable.filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true' && (el as HTMLElement).offsetParent !== null);

            // The trigger (which is now visible/focused or available) is the reference point.
            // If triggerRef.current is focusable (tabindex=0), it should be in the list.
            const currentTrigger = triggerRef.current;

            if (currentTrigger) {
                const idx = visibleFocusable.indexOf(currentTrigger as any);
                if (idx > -1 && idx < visibleFocusable.length - 1) {
                    (visibleFocusable[idx + 1] as HTMLElement).focus();
                } else {
                    // Fallback: search by container position
                    // Find first focusable AFTER container
                    // ... implementation detail: simplified to trigger for now as it is the most reliable anchor
                }
            } else {
                // If trigger ref is lost or not in list, find active element or container
                // ...
            }
        }, 50);
    };

    const handleSelect = (opt: string) => {
        onChange(opt);
        setSearchTerm('');
        setIsOpen(false);
        if (onNext) {
            setTimeout(onNext, 50);
        } else {
            focusNextElement();
        }
    };

    const handleAddNew = () => {
        if (searchTerm.trim()) {
            onChange(searchTerm.trim());
            setSearchTerm('');
            setIsOpen(false);
            if (onNext) {
                setTimeout(onNext, 50);
            } else {
                focusNextElement();
            }
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        const totalItems = displayOptions.length;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => (prev < totalItems - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (displayOptions.length > 0) {
                handleSelect(displayOptions[activeIndex]);
            } else if (isNewValue) {
                handleAddNew();
            } else {
                setIsOpen(false);
                setSearchTerm('');
                if (onNext) {
                    setTimeout(() => onNext(), 50);
                }
            }
        } else if (e.key === 'Tab' && e.shiftKey) {
            setIsOpen(false);
            setSearchTerm('');
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (displayOptions.length > 0 && !value) {
                handleSelect(displayOptions[0]);
            } else if (isNewValue) {
                handleAddNew();
            } else {
                setIsOpen(false);
                setSearchTerm('');
                if (onNext) {
                    setTimeout(() => onNext(), 50);
                }
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
            setSearchTerm('');
        }
    };

    const handleTriggerClick = () => {
        setIsOpen(true);
    };

    return (
        <div className={`${className}`} ref={containerRef}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}

            <div className="relative">
                {/* Closed State - Trigger */}
                {!isOpen && (
                    <div
                        ref={triggerRef}
                        id={id}
                        tabIndex={0}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm cursor-pointer flex items-center justify-between transition-all duration-200 bg-gray-50/50 hover:bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        onClick={() => setIsOpen(true)}
                        onFocus={() => setIsOpen(true)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                                e.preventDefault();
                                setIsOpen(true);
                            }
                            if (onKeyDown) onKeyDown(e);
                        }}
                    >
                        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
                            {value || placeholder}
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                    </div>
                )}

                {/* Open State - Dropdown Panel (replaces trigger) */}
                {isOpen && (
                    <div
                        className="w-full bg-white rounded-xl border border-indigo-500 ring-2 ring-indigo-500/20 overflow-hidden absolute z-50 top-0 left-0"
                        style={{ boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)' }}
                    >
                        {/* Search Input */}
                        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
                            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                placeholder="Search or type to add..."
                                className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
                            />
                            <button
                                onClick={() => { setIsOpen(false); setSearchTerm(''); }}
                                className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Options List */}
                        <div className="max-h-48 overflow-y-auto scroll-smooth" ref={optionsListRef}>
                            {displayOptions.map((opt, i) => {
                                const isHighlighted = i === activeIndex;
                                return (
                                    <div
                                        key={opt + i}
                                        onClick={() => handleSelect(opt)}
                                        onMouseEnter={() => setActiveIndex(i)}
                                        className={`px-4 py-2 text-sm cursor-pointer transition-colors ${isHighlighted
                                            ? 'bg-indigo-50 text-indigo-600 font-medium'
                                            : (opt === '-' && value === '-') ? 'text-gray-500 hover:bg-gray-50' : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                    >
                                        {opt}
                                    </div>
                                );
                            })}

                            {/* No Results */}
                            {displayOptions.length === 0 && !isNewValue && searchTerm && (
                                <div className="px-4 py-3 text-sm text-gray-400 text-center">
                                    No matches found
                                </div>
                            )}
                        </div>

                        {/* Add New Option */}
                        {isNewValue && displayOptions.length === 0 && (
                            <div
                                onClick={handleAddNew}
                                className="px-4 py-2.5 text-sm cursor-pointer text-white bg-indigo-600 hover:bg-indigo-700 font-medium flex items-center gap-2 transition-colors border-t border-indigo-500"
                            >
                                <Plus className="w-4 h-4" />
                                Add "{searchTerm}"
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
