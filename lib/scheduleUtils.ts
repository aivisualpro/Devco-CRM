// Schedule Utility Functions
// Extracted from page.tsx for better maintainability
import { robustNormalizeISO } from '@/lib/timeCardUtils';

/**
 * Format date as YYYY-MM-DD in UTC (consistent with how Mongo treats "YYYY-MM-DD" imports)
 */
export const formatLocalDate = (dateInput: string | Date): string => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Format date for datetime-local input display
 * This extracts the UTC components since we store dates as nominal UTC time
 */
export const formatLocalDateTime = (dateInput: string | Date): string => {
    if (!dateInput) return '';

    // If it's a string in ISO format with Z suffix, parse UTC components directly
    if (typeof dateInput === 'string') {
        // Handle ISO format: "2026-01-26T06:00:00.000Z" or "2026-01-26T06:00:00Z" or "2026-01-26T06:00Z"
        const isoMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (isoMatch) {
            const [, year, month, day, hours, minutes] = isoMatch;
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }
    }

    // Fallback: parse as Date and extract UTC components
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Extract time portion from datetime string (HH:MM format)
 */
export const extractTimeFromDateTime = (dateInput: string | Date): string => {
    const formatted = formatLocalDateTime(dateInput);
    if (!formatted) return '';
    const parts = formatted.split('T');
    return parts[1] || '';
};

/**
 * Combine current date with a time string to create datetime-local value
 */
export const combineCurrentDateWithTime = (timeStr: string): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T${timeStr}`;
};

/**
 * Format date to human readable format
 * TIMEZONE-SAFE: Uses robustNormalizeISO to parse dates as-is without timezone conversion
 */
export const formatToReadableDateTime = (dateInput: string | Date): string => {
    if (!dateInput) return '';
    const iso = typeof dateInput === 'string'
        ? robustNormalizeISO(dateInput)
        : dateInput.toISOString();
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return '';
    const [, y, mo, d, hStr, min] = match;
    const h = parseInt(hStr);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHours = h % 12 || 12;
    return `${parseInt(mo)}/${parseInt(d)}/${y} ${displayHours}:${min} ${ampm}`;
};

/**
 * Format time only (HH:MM AM/PM)
 * TIMEZONE-SAFE: Uses robustNormalizeISO to parse dates as-is without timezone conversion
 */
export const formatTimeOnly = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
        const normalized = robustNormalizeISO(dateStr);
        const match = normalized.match(/T(\d{2}):(\d{2})/);
        if (!match) return '';
        const [, hStr, mStr] = match;
        let h = parseInt(hStr);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if (h === 0) h = 12;
        return `${h}:${mStr} ${ampm}`;
    } catch { return ''; }
};

/**
 * Format date for display (M/D/YYYY)
 * TIMEZONE-SAFE: Uses robustNormalizeISO to parse dates as-is without timezone conversion
 */
export const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
        const normalized = robustNormalizeISO(dateStr);
        const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return dateStr;
        const [, y, m, d] = match;
        return `${parseInt(m)}/${parseInt(d)}/${y}`;
    } catch {
        return dateStr;
    }
};

/**
 * Get day name from date string
 */
export const getDayName = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getUTCDay()];
};

/**
 * Add one day to a date string (YYYY-MM-DD format)
 */
export const addOneDay = (dateStr: string): string => {
    if (!dateStr) return dateStr;
    try {
        // Parse as UTC
        const parts = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!parts) return dateStr;
        const [, y, m, d] = parts;
        const date = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d)));
        date.setUTCDate(date.getUTCDate() + 1);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        // Preserve time if present
        const timePart = dateStr.includes('T') ? dateStr.split('T')[1] : '';
        return timePart ? `${year}-${month}-${day}T${timePart}` : `${year}-${month}-${day}`;
    } catch {
        return dateStr;
    }
};

/**
 * Convert ISO date string to datetime-local format
 */
export const toLocalISO = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    try {
        // Handle ISO format like "2026-01-22T15:00:00.000Z"
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (match) {
            const [, year, month, day, hours, minutes] = match;
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        // Fallback
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const pad = (n: number) => n < 10 ? '0' + n : n;
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    } catch { return ''; }
};

/**
 * Get the current local time as a timezone-agnostic ISO string.
 * Uses local Date components (not UTC) so the string represents
 * exactly what the user sees on their device, regardless of timezone.
 * Example: If user's local time is 2:30 PM PST, this returns "2026-02-07T14:30:00.000Z"
 */
export const getLocalNowISO = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
};

/**
 * Convert degrees to radians
 */
export const deg2rad = (deg: number): number => {
    return deg * (Math.PI / 180);
};

/**
 * Calculate distance between two coordinates in miles
 */
export const getDistanceFromLatLonInMiles = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3958.8; // Radius of Earth in miles
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Check if a value looks like a coordinate
 */
export const isCoord = (val: any): boolean => {
    return typeof val === 'number' && !isNaN(val) && Math.abs(val) <= 180;
};

/**
 * Determine if a hex color is light
 */
export const isLight = (color: string): boolean => {
    if (!color) return true;
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128;
};

/**
 * Get work days between two dates (count of weekdays)
 */
export const getWorkDays = (start: string, end: string): number => {
    if (!start || !end) return 0;
    try {
        const startParts = start.match(/^(\d{4})-(\d{2})-(\d{2})/);
        const endParts = end.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!startParts || !endParts) return 0;

        const startDate = new Date(Date.UTC(parseInt(startParts[1]), parseInt(startParts[2]) - 1, parseInt(startParts[3])));
        const endDate = new Date(Date.UTC(parseInt(endParts[1]), parseInt(endParts[2]) - 1, parseInt(endParts[3])));

        if (startDate > endDate) return 0;

        let count = 0;
        const current = new Date(startDate);
        while (current <= endDate) {
            const day = current.getUTCDay();
            if (day !== 0 && day !== 6) count++; // Not Sunday or Saturday
            current.setUTCDate(current.getUTCDate() + 1);
        }
        return count;
    } catch {
        return 0;
    }
};

/**
 * Get days in a month
 */
export const getDaysInMonth = (date: Date): { day: number; isCurrentMonth: boolean }[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: { day: number; isCurrentMonth: boolean }[] = [];

    // Previous month's days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
        days.push({ day: prevMonthLastDay - i, isCurrentMonth: false });
    }

    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ day: i, isCurrentMonth: true });
    }

    return days;
};

/**
 * Get current week dates (Monday to Sunday) in UTC
 */
export const getCurrentWeekDates = (): string[] => {
    const today = new Date();
    const startOfWeek = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    const dayOfWeek = startOfWeek.getUTCDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() + diff);

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setUTCDate(startOfWeek.getUTCDate() + i);
        const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
        dates.push(dateStr);
    }
    return dates;
};

/**
 * Derives a dashboard weekId (MM/DD-MM/DD) from a given Date or date string.
 * This ensures mutations properly revalidate the correct week cache.
 */
export const getWeekIdFromDate = (dateInput?: string | Date | null): string => {
    let d = new Date();
    if (dateInput) {
        d = new Date(dateInput);
        if (isNaN(d.getTime())) d = new Date();
    }
    
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    
    const start = new Date(d);
    start.setDate(d.getDate() + diff);
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    const fmt = (dt: Date) => `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')}`;
    
    return `${fmt(start)}-${fmt(end)}`;
};
