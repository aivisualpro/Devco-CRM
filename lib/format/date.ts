/**
 * Single source of truth for wall-clock date formatting.
 * 
 * DESIGN CONTRACT:
 * - All user-facing timestamps in this app are "wall-clock / floating".
 * - They must display IDENTICALLY for every viewer regardless of timezone.
 * - NEVER call new Date(x).toLocaleString() or Intl.DateTimeFormat() on these values.
 */

export function normalizeWallClock(input: string | Date | undefined | null): string {
    if (!input) return '';
    
    let str = typeof input === 'string' ? input : '';

    if (input instanceof Date) {
        if (isNaN(input.getTime())) return '';
        // Extract components in their captured locale (browser local time)
        const y = input.getFullYear();
        const m = String(input.getMonth() + 1).padStart(2, '0');
        const d = String(input.getDate()).padStart(2, '0');
        const h = String(input.getHours()).padStart(2, '0');
        const min = String(input.getMinutes()).padStart(2, '0');
        const sec = String(input.getSeconds()).padStart(2, '0');
        return `${y}-${m}-${d}T${h}:${min}:${sec}.000Z`;
    }

    // If it's already standard ISO-Z, return it
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(str)) {
        // Ensure .000Z suffix
        if (!str.includes('.')) {
            return str.replace('Z', '.000Z');
        }
        return str;
    }

    // Handle M/D/YYYY H:mm:ss AM/PM
    const mdMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM|am|pm))?)?/i);
    if (mdMatch) {
        const m = mdMatch[1].padStart(2, '0');
        const d = mdMatch[2].padStart(2, '0');
        const y = mdMatch[3];
        
        let h = 0;
        let min = '00';
        let sec = '00';
        
        if (mdMatch[4] && mdMatch[5]) {
            h = parseInt(mdMatch[4]);
            min = mdMatch[5].padStart(2, '0');
            sec = mdMatch[6] ? mdMatch[6].padStart(2, '0') : '00';
            const ampm = mdMatch[7] ? mdMatch[7].toUpperCase() : null;

            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
        }

        const hStr = String(h).padStart(2, '0');
        return `${y}-${m}-${d}T${hStr}:${min}:${sec}.000Z`;
    }

    // Handle YYYY-MM-DDTHH:mm
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
        const base = str.slice(0, 16); // up to mm
        const secMatch = str.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:(\d{2})/);
        const sec = secMatch ? secMatch[1] : '00';
        return `${base}:${sec}.000Z`;
    }

    // Last resort: Date object as UTC
    try {
        const date = new Date(str.includes('Z') || str.includes('UTC') ? str : str + ' UTC');
        if (!isNaN(date.getTime())) return date.toISOString();
    } catch { }

    return str;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatWallDate(input: string | Date | undefined | null, variant: 'short' | 'long' | 'iso' = 'short'): string {
    const iso = normalizeWallClock(input);
    if (!iso) return '';
    
    const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return iso;
    
    const [, yStr, mStr, dStr] = match;
    const y = parseInt(yStr);
    const m = parseInt(mStr);
    const d = parseInt(dStr);
    
    if (variant === 'iso') return `${yStr}-${mStr}-${dStr}`;
    if (variant === 'short') return `${mStr}/${dStr}/${yStr}`;
    
    // For 'long', we need the day of the week. 
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = DAYS[dateObj.getDay()];
    const monthName = MONTHS[m - 1];
    
    return `${dayOfWeek}, ${monthName} ${d}, ${y}`;
}

export function formatWallTime(input: string | Date | undefined | null, opts?: { seconds?: boolean }): string {
    const iso = normalizeWallClock(input);
    if (!iso) return '';
    
    const match = iso.match(/T(\d{2}):(\d{2}):(\d{2})/);
    if (!match) return iso;
    
    let [, hStr, mStr, sStr] = match;
    let h = parseInt(hStr);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    
    if (opts?.seconds) {
        return `${h}:${mStr}:${sStr} ${ampm}`;
    }
    return `${h}:${mStr} ${ampm}`;
}

export function formatWallDateTime(input: string | Date | undefined | null, opts?: { seconds?: boolean }): string {
    const d = formatWallDate(input, 'short');
    const t = formatWallTime(input, opts);
    if (!d) return t;
    if (!t) return d;
    return `${d} ${t}`;
}

export function formatWallRange(start: string | Date | undefined | null, end: string | Date | undefined | null): string {
    const startStr = formatWallDateTime(start);
    const endStr = formatWallDateTime(end);
    if (!startStr && !endStr) return '';
    if (!startStr) return endStr;
    if (!endStr) return startStr;
    
    const startDate = formatWallDate(start, 'short');
    const endDate = formatWallDate(end, 'short');
    
    if (startDate === endDate) {
        const startTime = formatWallTime(start);
        const endTime = formatWallTime(end);
        return `${startDate} ${startTime} – ${endTime}`;
    }
    
    return `${startStr} – ${endStr}`;
}

export function toWallClockISO(date: Date | null | undefined): string {
    if (!date || isNaN(date.getTime())) return '';
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds())).toISOString();
}
