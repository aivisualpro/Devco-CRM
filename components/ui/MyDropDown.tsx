'use client';

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

interface Option {
    id: string;
    label: string;
    value: string;
    color?: string;
    profilePicture?: string;
    badge?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    tooltip?: string;
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
    showSearch?: boolean;
    transparentBackdrop?: boolean;
    modal?: boolean;
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
    multiSelect = false,
    showSearch = true,
    transparentBackdrop = false,
    modal = true
}: MyDropDownProps) {
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState<{ top: number; left: number; width: number; isBottom: boolean; maxHeight?: number } | null>(null);
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
                const dropdownHeight = 350; // Estimated max height
                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;
                // Prefer above when space below is insufficient, even if above isn't full 350px
                const shouldShowAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
                const availableSpace = shouldShowAbove ? spaceAbove : spaceBelow;
                const maxHeight = Math.min(dropdownHeight, availableSpace - 20); // 20px margin

                setCoords({
                    top: (shouldShowAbove ? rect.top : rect.bottom),
                    left: rect.left,
                    width: rect.width,
                    isBottom: !shouldShowAbove,
                    maxHeight: maxHeight > 100 ? maxHeight : undefined // Only constrain if meaningful
                });
            }
        }
    };

    useLayoutEffect(() => {
        if (isOpen) {
            updatePosition();
            window.addEventListener('resize', updatePosition);
            // Throttle or use requestAnimationFrame for scroll?
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
                // When not using a modal backdrop, check if the click was on the parent trigger button.
                // If so, skip onClose() and let the parent's onClick toggle handle it,
                // otherwise we get a race condition that re-opens the dropdown.
                if (!modal && dropdownRef.current.parentElement?.contains(event.target as Node)) {
                    return;
                }
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
    }, [isOpen, onClose, modal]);

    if (!isOpen || !isMounted) return null;

    const filteredOptions = options.filter(opt =>
        String(opt.label || '').toLowerCase().includes(search.toLowerCase()) ||
        String(opt.badge || '').toLowerCase().includes(search.toLowerCase())
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
        const labelStr = String(label || '');
        if (!labelStr) return '';
        const parts = labelStr.split(' ').filter(p => p.length > 0);
        if (parts.length === 0) return '';
        if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
        return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
    };

    const dropdownContent = (
        <>
            {/* Backdrop Overlay - Only render if modal is true */}
            {modal && (
                <div 
                    className={`fixed inset-0 z-[9998] animate-in fade-in duration-300 ${transparentBackdrop ? 'bg-transparent' : 'bg-slate-900/10 backdrop-blur-[1px]'}`}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                />
            )}
            <div 
                ref={dropdownRef}
                className={`${anchorId ? 'fixed' : 'absolute top-full left-0 pt-2'} rounded-2xl z-[9999] ${className} animate-in fade-in zoom-in-95 duration-200 transition-all`}
                style={anchorId ? {
                    top: coords ? `${coords.top}px` : '0px',
                    left: adjustedLeft !== null ? `${adjustedLeft}px` : (coords ? `${coords.left}px` : '0px'),
                    width: width === 'w-full' && coords ? `${coords.width}px` : (width.startsWith('w-') ? undefined : width),
                    minWidth: width === 'w-full' && coords ? `${coords.width}px` : 'max-content',
                    transform: coords?.isBottom ? 'translateY(10px)' : 'translateY(-100%) translateY(-10px)',
                    display: coords ? 'block' : 'none'
                } : { 
                    width: width.startsWith('w-') ? undefined : width,
                    minWidth: 'max-content'
                }}
            >
            <div className="p-2 rounded-2xl bg-white shadow-2xl border border-slate-200">
                {/* Search Input */}
                {showSearch && (
                <div className="mb-2">
                    <div className="relative border border-slate-200 rounded-xl p-1 bg-slate-50">
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
                )}

                {/* Options List */}
                <div 
                    className="space-y-2 overflow-y-auto pr-1 custom-scrollbar overscroll-contain"
                    style={{ maxHeight: coords?.maxHeight ? `${coords.maxHeight - 60}px` : '15rem' }}
                    onWheel={(e) => e.stopPropagation()}
                >
                    {filteredOptions.map((opt) => {
                        const active = isSelected(opt.value);
                        const content = (
                            <div
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if (!opt.disabled) {
                                        onSelect(opt.value);
                                    }
                                }}
                                className={`
                                    group flex items-center gap-3 p-3 rounded-xl transition-all duration-200
                                    ${opt.disabled
                                        ? 'cursor-not-allowed opacity-50 bg-slate-50'
                                        : active
                                            ? 'bg-slate-100 cursor-pointer'
                                            : opt.color && opt.badge
                                                ? 'cursor-pointer ring-1 ring-emerald-200'
                                                : 'hover:bg-slate-50 cursor-pointer'
                                    }
                                `}
                                style={opt.color && opt.badge && !active ? { backgroundColor: `${opt.color}12` } : undefined}
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
                                <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#0F4C75] border border-blue-50 shadow-sm overflow-hidden border-white/50 ${opt.disabled ? 'grayscale' : ''}`}>
                                    {opt.profilePicture ? (
                                        <img src={opt.profilePicture} alt={opt.label} className="w-full h-full object-cover" />
                                    ) : opt.icon ? (
                                        <div className="flex items-center justify-center w-full h-full text-[#0F4C75]">
                                            {opt.icon}
                                        </div>
                                    ) : opt.color ? (
                                        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: opt.color }}>
                                            {opt.badge && <span className="text-white shadow-sm">{opt.badge}</span>}
                                        </div>
                                    ) : opt.badge ? (
                                        <span>{opt.badge}</span>
                                    ) : (
                                        <span>{getInitials(opt.label)}</span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span 
                                            className={`text-[11px] font-bold whitespace-nowrap leading-tight block ${active ? 'text-[#0F4C75]' : opt.color && opt.badge ? 'font-black' : 'text-slate-600'}`}
                                            style={opt.color && opt.badge && !active ? { color: opt.color } : undefined}
                                        >
                                            {opt.label}
                                        </span>
                                        {opt.disabled && !opt.tooltip && (
                                            <span className="text-[9px] text-slate-400 font-medium italic border border-slate-200 px-1 rounded">Soon</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );

                        if (opt.tooltip && opt.disabled) {
                            return (
                                <Tooltip key={opt.id}>
                                    <TooltipTrigger asChild>
                                        {content}
                                    </TooltipTrigger>
                                    <TooltipContent className="z-[10000]">
                                        {opt.tooltip}
                                    </TooltipContent>
                                </Tooltip>
                            );
                        }

                        return <div key={opt.id}>{content}</div>;
                    })}

                    {/* Add New Option */}
                    {onAdd && search && !filteredOptions.find(o => o.label.toLowerCase() === search.toLowerCase()) && (
                        <div
                            onMouseDown={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                await handleAddNew();
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
        </>
    );

    if (anchorId) {
        return createPortal(dropdownContent, document.body);
    }

    return dropdownContent;
}
