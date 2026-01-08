'use client';

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Check } from 'lucide-react';

interface Option {
    id: string;
    label: string;
    value: string;
    color?: string;
    profilePicture?: string;
    icon?: React.ReactNode;
}

interface MyDropDownProps {
    isOpen: boolean;
    onClose: () => void;
    options: Option[];
    selectedValues: string[];
    onSelect: (value: string) => void;
    onAdd?: (search: string) => Promise<void>;
    isAdding?: boolean;
    placeholder?: string;
    emptyMessage?: string;
    width?: string;
    className?: string;
    hideSelectionIndicator?: boolean;
    anchorId?: string;
    positionMode?: 'overlay' | 'bottom';
    multiSelect?: boolean;
}

export function MyDropDown({
    isOpen,
    onClose,
    options,
    selectedValues,
    onSelect,
    onAdd,
    isAdding = false,
    placeholder = "Search or add...",
    emptyMessage = "No options available",
    width = "w-80",
    hideSelectionIndicator = false,
    className = "",
    anchorId,
    positionMode = 'bottom',
    multiSelect = false
}: MyDropDownProps) {
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
    const [adjustedLeft, setAdjustedLeft] = useState<number | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const updatePosition = () => {
        if (anchorId) {
            const anchor = document.getElementById(anchorId);
            if (anchor) {
                const rect = anchor.getBoundingClientRect();
                setCoords({
                    top: (positionMode === 'overlay' ? rect.top : rect.bottom) + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width
                });
            }
        }
    };

    useLayoutEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);
        }
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, anchorId, positionMode]);

    // Adjust for viewport collision
    useLayoutEffect(() => {
        if (isOpen && dropdownRef.current && coords) {
            const rect = dropdownRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const horizontalMargin = 16;

            if (rect.right > viewportWidth) {
                const overflow = rect.right - viewportWidth;
                setAdjustedLeft(coords.left - overflow - horizontalMargin);
            } else {
                setAdjustedLeft(null);
            }
        }
    }, [isOpen, coords]);

    // Handle click outside and Escape key
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                onClose();
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape' && isOpen) {
                event.stopPropagation();
                onClose();
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !isMounted) return null;

    const filteredOptions = options.filter(opt =>
        (opt.label || '').toLowerCase().includes(search.toLowerCase())
    );

    const isSelected = (value: string) => selectedValues.includes(value);

    const handleAddNew = async () => {
        if (!search.trim() || !onAdd) return null;
        await onAdd(search.trim());
        const newVal = search.trim();
        setSearch('');
        return newVal;
    };

    const getInitials = (label: string) => {
        if (!label) return '';
        const parts = label.split(' ').filter(p => p.length > 0);
        if (parts.length === 0) return '';
        if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
        return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
    };

    const dropdownContent = (
        <div 
            ref={dropdownRef}
            className={`${anchorId ? 'fixed' : 'absolute top-full left-0 pt-2'} rounded-2xl z-[9999] ${className}`}
            style={anchorId ? {
                top: coords ? `${coords.top}px` : '0px',
                left: adjustedLeft !== null ? `${adjustedLeft}px` : (coords ? `${coords.left}px` : '0px'),
                width: width === 'w-full' && coords ? `${coords.width}px` : (width.startsWith('w-') ? undefined : width),
                minWidth: width === 'w-full' && coords ? `${coords.width}px` : 'max-content',
                display: coords ? 'block' : 'none'
            } : { 
                width: width.startsWith('w-') ? undefined : width,
                minWidth: 'max-content'
            }}
        >
            <div className="p-4 rounded-2xl bg-[#eef2f6] shadow-[8px_8px_16px_#d1d9e6,-8px_-8px_16px_#ffffff] border border-white/40">
                {/* Search Input */}
                <div className="mb-3">
                    <div className="relative shadow-[inset_2px_2px_4px_#d1d9e6,inset_-2px_-2px_4px_#ffffff] rounded-xl p-1 bg-[#eef2f6]">
                        <input
                            type="text"
                            autoFocus
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={placeholder}
                            className="w-full bg-transparent text-sm font-medium text-slate-700 h-8 px-3 outline-none"
                            onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const firstOption = filteredOptions[0];
                                    if (firstOption) {
                                        onSelect(firstOption.value);
                                    } else if (search.trim()) {
                                        await handleAddNew();
                                    }
                                } else if (e.key === 'Tab') {
                                    const firstOption = filteredOptions[0];
                                    if (firstOption) {
                                        onSelect(firstOption.value);
                                    } else if (search.trim()) {
                                        await handleAddNew();
                                    }
                                }
                            }}
                        />
                    </div>
                </div>

                {/* Options List */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                    {filteredOptions.map((opt) => {
                        const active = isSelected(opt.value);
                        return (
                            <div
                                key={opt.id}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    onSelect(opt.value);
                                }}
                                className={`
                                    group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200
                                    ${active
                                        ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff]'
                                        : 'hover:bg-white/50'
                                    }
                                `}
                            >
                                {multiSelect && !hideSelectionIndicator && (
                                    <div className={`
                                        w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0
                                        ${active ? 'bg-[#0F4C75] border-[#0F4C75]' : 'border-slate-300 group-hover:border-[#0F4C75]'}
                                    `}>
                                        {active && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                )}

                                {/* Visual Representation (Avatar/Color/Initials) */}
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#0F4C75] border border-blue-50 shadow-sm overflow-hidden border-white/50">
                                    {opt.profilePicture ? (
                                        <img src={opt.profilePicture} alt={opt.label} className="w-full h-full object-cover" />
                                    ) : opt.icon ? (
                                        <div className="flex items-center justify-center w-full h-full text-[#0F4C75]">
                                            {opt.icon}
                                        </div>
                                    ) : opt.color ? (
                                        <div className="w-full h-full" style={{ backgroundColor: opt.color }} />
                                    ) : (
                                        <span>{getInitials(opt.label)}</span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <span className={`text-[11px] font-bold whitespace-nowrap leading-tight block ${active ? 'text-[#0F4C75]' : 'text-slate-600'}`}>
                                        {opt.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {/* Add New Option */}
                    {onAdd && search && !filteredOptions.find(o => o.label.toLowerCase() === search.toLowerCase()) && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAddNew();
                            }}
                            className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/50 border border-dashed border-slate-300 transition-all text-blue-600"
                        >
                            <div className="w-4 h-4 rounded border border-blue-400 flex items-center justify-center">
                                <Plus className="w-3 h-3" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider">
                                {isAdding ? 'Adding...' : `Add "${search}"`}
                            </span>
                        </div>
                    )}

                    {filteredOptions.length === 0 && !search && (
                        <div className="text-xs text-slate-400 text-center py-2">{emptyMessage}</div>
                    )}
                </div>
            </div>
        </div>
    );

    if (anchorId) {
        return createPortal(dropdownContent, document.body);
    }

    return dropdownContent;
}
