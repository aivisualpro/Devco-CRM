'use client';

import { createContext, useContext, useMemo, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// ── Week helpers ────────────────────────────────────────────────────────────────
export const getWeekRange = (date: Date = new Date()) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    const start = new Date(d);
    start.setDate(d.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    const fmt = (dt: Date) =>
        `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
    const toISO = (dt: Date, isEnd: boolean) => {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return isEnd ? `${y}-${m}-${dd}T23:59:59.999Z` : `${y}-${m}-${dd}T00:00:00.000Z`;
    };
    return {
        start,
        end,
        label: `${fmt(start)}-${fmt(end)}`,
        startISO: toISO(start, false),
        endISO: toISO(end, true),
    };
};

export const shiftWeek = (current: Date, direction: number): Date => {
    const d = new Date(current);
    d.setDate(d.getDate() + direction * 7);
    return d;
};

export const getWeekNumber = (d: Date): number => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 4 - (date.getDay() || 7));
    const yearStart = new Date(date.getFullYear(), 0, 1);
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
};

export const generateWeeksForPicker = () => {
    const weeks: {
        id: string;
        label: string;
        value: string;
        weekNum: number;
        startDate: Date;
        isCurrentWeek: boolean;
    }[] = [];
    const now = new Date();
    const currentWeekRange = getWeekRange(now);
    for (let i = -20; i <= 10; i++) {
        const weekDate = new Date(now);
        weekDate.setDate(weekDate.getDate() + i * 7);
        const range = getWeekRange(weekDate);
        const weekNum = getWeekNumber(range.start);
        const isCurrentWeek = range.label === currentWeekRange.label;
        const fmt = (d: Date) =>
            `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
        weeks.push({
            id: range.label,
            label: `${fmt(range.start)} to ${fmt(range.end)}${isCurrentWeek ? ' (Current)' : ''}`,
            value: range.label,
            weekNum,
            startDate: range.start,
            isCurrentWeek,
        });
    }
    return weeks.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
};

// ── Context types ────────────────────────────────────────────────────────────────
interface DashboardContextValue {
    currentWeekDate: Date;
    setCurrentWeekDate: (d: Date) => void;
    weekRange: ReturnType<typeof getWeekRange>;
    scheduleScope: 'all' | 'self';
    setScheduleScope: (s: 'all' | 'self') => void;
    weekOptions: ReturnType<typeof generateWeeksForPicker>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children, initialWeek }: { children: ReactNode; initialWeek?: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [currentWeekDate, setCurrentWeekDate] = useState<Date>(() => {
        const week = searchParams.get('week') || initialWeek;
        if (week && week.includes('-')) {
            try {
                const [startPart] = week.split('-');
                const [m, d] = startPart.split('/').map(Number);
                const date = new Date();
                date.setMonth(m - 1);
                date.setDate(d);
                if (!isNaN(date.getTime())) return date;
            } catch {}
        }
        return new Date();
    });

    const weekRange = useMemo(() => getWeekRange(currentWeekDate), [currentWeekDate]);
    const weekOptions = useMemo(() => generateWeeksForPicker(), [currentWeekDate]);
    const [scheduleScope, setScheduleScope] = useState<'all' | 'self'>('self');

    // Sync from localStorage on mount
    useEffect(() => {
        if (!searchParams.get('week')) {
            const stored = localStorage.getItem('selected_week');
            if (stored && stored.includes('-')) {
                try {
                    const [startPart] = stored.split('-');
                    const [m, d] = startPart.split('/').map(Number);
                    const date = new Date();
                    date.setMonth(m - 1);
                    date.setDate(d);
                    if (!isNaN(date.getTime())) setCurrentWeekDate(date);
                } catch {}
            }
        }
    }, []);

    // Sync to URL + localStorage when week changes
    useEffect(() => {
        const newLabel = weekRange.label;
        localStorage.setItem('selected_week', newLabel);
        const currentWeekParam = searchParams.get('week');
        if (newLabel !== currentWeekParam) {
            const params = new URLSearchParams(searchParams.toString());
            params.set('week', newLabel);
            router.replace(`?${params.toString()}`, { scroll: false });
        }
    }, [weekRange.label, router, searchParams]);

    return (
        <DashboardContext.Provider
            value={{ currentWeekDate, setCurrentWeekDate, weekRange, scheduleScope, setScheduleScope, weekOptions }}
        >
            {children}
        </DashboardContext.Provider>
    );
}

export function useDashboardContext() {
    const ctx = useContext(DashboardContext);
    if (!ctx) throw new Error('useDashboardContext must be used inside DashboardProvider');
    return ctx;
}
