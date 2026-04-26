'use client';

import React, { useState, createContext, useContext } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { MyDropDown } from '@/components/ui/MyDropDown';
import { useDashboardContext, shiftWeek } from './DashboardContext';

interface WeekPickerContextValue {
    isWeekPickerOpen: boolean;
    setIsWeekPickerOpen: (v: boolean) => void;
    weekPickerAnchor: 'mobile' | 'desktop';
    setWeekPickerAnchor: (v: 'mobile' | 'desktop') => void;
}

const WeekPickerContext = createContext<WeekPickerContextValue | null>(null);

export function WeekPickerProvider({ children }: { children: React.ReactNode }) {
    const [isWeekPickerOpen, setIsWeekPickerOpen] = useState(false);
    const [weekPickerAnchor, setWeekPickerAnchor] = useState<'mobile' | 'desktop'>('desktop');

    return (
        <WeekPickerContext.Provider value={{ isWeekPickerOpen, setIsWeekPickerOpen, weekPickerAnchor, setWeekPickerAnchor }}>
            {children}
        </WeekPickerContext.Provider>
    );
}

function useWeekPicker() {
    const ctx = useContext(WeekPickerContext);
    if (!ctx) throw new Error('useWeekPicker must be used within WeekPickerProvider');
    return ctx;
}

export function WeekPickerMobile() {
    const { currentWeekDate, setCurrentWeekDate, weekRange } = useDashboardContext();
    const { isWeekPickerOpen, setIsWeekPickerOpen, setWeekPickerAnchor } = useWeekPicker();

    return (
        <div className="flex xl:hidden items-center gap-1 bg-white rounded-xl px-2 py-1.5 shadow-sm border border-slate-200 relative">
            <button 
                onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, -1))}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
                id="week-picker-trigger-mobile"
                onClick={() => {
                    setWeekPickerAnchor('mobile');
                    setIsWeekPickerOpen(!isWeekPickerOpen);
                }}
                className="px-2 py-0.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1"
                title="Click to select week"
            >
                <span className="font-bold text-sm text-slate-800 tabular-nums">{weekRange.label}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isWeekPickerOpen ? 'rotate-180' : ''}`} />
            </button>
            <button 
                onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, 1))}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
            >
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

export function WeekPickerDesktop() {
    const { currentWeekDate, setCurrentWeekDate, weekRange } = useDashboardContext();
    const { isWeekPickerOpen, setIsWeekPickerOpen, setWeekPickerAnchor } = useWeekPicker();

    return (
        <>
            <div className="hidden xl:flex items-center gap-1 bg-white rounded-xl px-2 py-1.5 shadow-sm border border-slate-200 relative">
                <button 
                    onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, -1))}
                    className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                    id="week-picker-trigger-desktop"
                    onClick={() => {
                        setWeekPickerAnchor('desktop');
                        setIsWeekPickerOpen(!isWeekPickerOpen);
                    }}
                    className="px-2 py-0.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1"
                    title="Click to select week"
                >
                    <span className="font-bold text-sm text-slate-800 tabular-nums">{weekRange.label}</span>
                    <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isWeekPickerOpen ? 'rotate-180' : ''}`} />
                </button>
                <button 
                    onClick={() => setCurrentWeekDate(shiftWeek(currentWeekDate, 1))}
                    className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
            <button
                onClick={() => setCurrentWeekDate(new Date())}
                className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#0F4C75] bg-[#0F4C75]/10 hover:bg-[#0F4C75]/20 rounded-lg transition-colors"
                title="Go to Today"
            >
                Go to Today
            </button>
        </>
    );
}

export function WeekPickerDropDown() {
    const { setCurrentWeekDate, weekRange, weekOptions } = useDashboardContext();
    const { isWeekPickerOpen, setIsWeekPickerOpen, weekPickerAnchor } = useWeekPicker();

    return (
        <MyDropDown
            isOpen={isWeekPickerOpen}
            onClose={() => setIsWeekPickerOpen(false)}
            anchorId={weekPickerAnchor === 'desktop' ? "week-picker-trigger-desktop" : "week-picker-trigger-mobile"}
            positionMode="bottom"
            options={weekOptions.map(w => ({
                id: w.id,
                label: w.label,
                value: w.value,
                badge: String(w.weekNum).padStart(2, '0'),
                color: w.isCurrentWeek ? '#10b981' : '#0F4C75'
            }))}
            selectedValues={[weekRange.label]}
            onSelect={(value: string) => {
                const selected = weekOptions.find(w => w.value === value);
                if (selected) {
                    setCurrentWeekDate(selected.startDate);
                }
                setIsWeekPickerOpen(false);
            }}
            placeholder="Search weeks..."
            emptyMessage="No weeks found"
            width="w-80"
            hideSelectionIndicator={true}
        />
    );
}
