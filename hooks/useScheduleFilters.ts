'use client';

import { useState, useMemo } from 'react';
import { formatLocalDate } from '@/lib/scheduleUtils';

/**
 * Get current week dates (Monday to Sunday) as array of YYYY-MM-DD strings
 */
function getCurrentWeekDates(): string[] {
    const today = new Date();
    const startOfWeek = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const dayOfWeek = startOfWeek.getUTCDay(); // 0 = Sunday, 1 = Monday
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() + diff); // Go back to Monday

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setUTCDate(startOfWeek.getUTCDate() + i);
        const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
        dates.push(dateStr);
    }
    return dates;
}

/**
 * Get current week filter value in format "YYYY-MM-DD|YYYY-MM-DD"
 */
function getCurrentWeekFilterValue(): string {
    const today = new Date();
    const startOfWeek = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const dayOfWeek = startOfWeek.getUTCDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() + diff);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
    const startStr = `${startOfWeek.getUTCFullYear()}-${String(startOfWeek.getUTCMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getUTCDate()).padStart(2, '0')}`;
    const endStr = `${endOfWeek.getUTCFullYear()}-${String(endOfWeek.getUTCMonth() + 1).padStart(2, '0')}-${String(endOfWeek.getUTCDate()).padStart(2, '0')}`;
    return `${startStr}|${endStr}`;
}

export interface ScheduleFilters {
    // Search
    search: string;
    setSearch: (value: string) => void;
    
    // Date selection
    selectedDates: string[];
    setSelectedDates: React.Dispatch<React.SetStateAction<string[]>>;
    
    // Week filter dropdown
    filterWeek: string;
    setFilterWeek: (value: string) => void;
    
    // Specific filters
    filterEstimate: string;
    setFilterEstimate: (value: string) => void;
    filterClient: string;
    setFilterClient: (value: string) => void;
    filterEmployee: string;
    setFilterEmployee: (value: string) => void;
    filterService: string;
    setFilterService: (value: string) => void;
    filterTag: string;
    setFilterTag: (value: string) => void;
    filterCertifiedPayroll: string;
    setFilterCertifiedPayroll: (value: string) => void;
    
    // Dropdown state
    openDropdownId: string | null;
    setOpenDropdownId: (value: string | null) => void;
    
    // Week options for dropdown
    weekOptions: { label: string; value: string }[];
    
    // Clear all filters
    clearFilters: () => void;
    
    // Check if any filter is active
    hasActiveFilters: boolean;
}

/**
 * Custom hook to manage schedule filter state
 */
export function useScheduleFilters(): ScheduleFilters {
    // Search
    const [search, setSearch] = useState('');
    
    // Date selection - initialized to current week
    const [selectedDates, setSelectedDates] = useState<string[]>(getCurrentWeekDates);
    
    // Week filter dropdown - initialized to current week
    const [filterWeek, setFilterWeek] = useState(getCurrentWeekFilterValue);
    
    // Specific filters
    const [filterEstimate, setFilterEstimate] = useState('');
    const [filterClient, setFilterClient] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterService, setFilterService] = useState('');
    const [filterTag, setFilterTag] = useState('');
    const [filterCertifiedPayroll, setFilterCertifiedPayroll] = useState('');
    
    // Dropdown state
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    
    // Generate week options for the year
    const weekOptions = useMemo(() => {
        const options = [];
        const today = new Date();
        const currentYear = today.getFullYear();
        
        // Start Jan 1 UTC
        let d = new Date(Date.UTC(currentYear, 0, 1));
        const day = d.getUTCDay();
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Monday start
        d.setUTCDate(diff);

        for (let i = 0; i < 54; i++) { 
            const startOfWeek = new Date(d);
            const endOfWeek = new Date(d);
            endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6); // Sunday end

            const startLabel = `${startOfWeek.getUTCMonth() + 1}/${startOfWeek.getUTCDate().toString().padStart(2, '0')}`;
            const endLabel = `${endOfWeek.getUTCMonth() + 1}/${endOfWeek.getUTCDate().toString().padStart(2, '0')}`;
            const startValue = formatLocalDate(startOfWeek);
            const endValue = formatLocalDate(endOfWeek);

            options.push({
                label: `${startLabel} - ${endLabel}`,
                value: `${startValue}|${endValue}`
            });

            d.setUTCDate(d.getUTCDate() + 7); // next week
        }

        return options;
    }, []);
    
    // Clear all filters
    const clearFilters = () => {
        setSearch('');
        setSelectedDates([]);
        setFilterWeek('');
        setFilterEstimate('');
        setFilterClient('');
        setFilterEmployee('');
        setFilterService('');
        setFilterTag('');
        setFilterCertifiedPayroll('');
    };
    
    // Check if any filter is active
    const hasActiveFilters = !!(
        search ||
        selectedDates.length > 0 ||
        filterWeek ||
        filterEstimate ||
        filterClient ||
        filterEmployee ||
        filterService ||
        filterTag ||
        filterCertifiedPayroll
    );
    
    return {
        search,
        setSearch,
        selectedDates,
        setSelectedDates,
        filterWeek,
        setFilterWeek,
        filterEstimate,
        setFilterEstimate,
        filterClient,
        setFilterClient,
        filterEmployee,
        setFilterEmployee,
        filterService,
        setFilterService,
        filterTag,
        setFilterTag,
        filterCertifiedPayroll,
        setFilterCertifiedPayroll,
        openDropdownId,
        setOpenDropdownId,
        weekOptions,
        clearFilters,
        hasActiveFilters
    };
}
