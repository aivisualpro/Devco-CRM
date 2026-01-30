import { ScheduleItem } from "@/app/(protected)/jobs/schedules/components/ScheduleCard";

// Constants
export const SPEED_MPH = 55;
export const EARTH_RADIUS_MI = 3958.8;
export const DRIVING_FACTOR = 1.50;

export const robustNormalizeISO = (str?: string) => {
    if (!str) return '';
    // If it's already standard ISO-Z, return it
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(str)) return str;

    // Handle M/D/YYYY H:mm:ss AM/PM
    const mdMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(:(\d{2}))?(\s+(AM|PM))?/i);
    if (mdMatch) {
        const m = mdMatch[1].padStart(2, '0');
        const d = mdMatch[2].padStart(2, '0');
        const y = mdMatch[3];
        let h = parseInt(mdMatch[4]);
        const min = mdMatch[5].padStart(2, '0');
        const sec = mdMatch[7] ? mdMatch[7].padStart(2, '0') : '00';
        const ampm = mdMatch[9] ? mdMatch[9].toUpperCase() : null;
        
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        
        const hStr = String(h).padStart(2, '0');
        return `${y}-${m}-${d}T${hStr}:${min}:${sec}.000Z`;
    }

    // Handle YYYY-MM-DDTHH:mm
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
        // Just append :00.000Z if missing
        // But check if it already has seconds
        const base = str.slice(0, 16); // up to mm
        return `${base}:00.000Z`;
    }

    // Last resort: Date object as UTC
    try {
        const date = new Date(str.includes('Z') || str.includes('UTC') ? str : str + ' UTC');
        if (!isNaN(date.getTime())) return date.toISOString();
    } catch {}

    return str;
};

export const formatTimeOnly = (dateStr?: string) => {
    if (!dateStr) return '-';
    const normalized = robustNormalizeISO(dateStr);
    const match = normalized.match(/T(\d{2}):(\d{2})/);
    if (match) {
        let [ , hStr, mStr] = match;
        let h = parseInt(hStr);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if (h === 0) h = 12;
        return `${h}:${mStr} ${ampm}`;
    }
    return dateStr;
};

export const formatDateOnly = (dateStr?: string) => {
    if (!dateStr) return '-';
    const normalized = robustNormalizeISO(dateStr);
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [ , y, m, d] = match;
        return `${m}/${d}/${y}`;
    }
    return dateStr;
};

export const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = EARTH_RADIUS_MI; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
};

export const calculateTimesheetData = (ts: any, scheduleDate?: string) => {
    const typeLower = (ts.type || '').toLowerCase();
    const isDrive = typeLower.includes('drive');

    // Parse location coordinates for distance calculation
    const parseLoc = (val: any) => {
        const str = String(val || '').trim();
        if (str.includes(',')) {
            const parts = str.split(',').map(p => parseFloat(p.trim()));
            if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                return { lat: parts[0], lon: parts[1] };
            }
        }
        return null;
    };

    const locIn = parseLoc(ts.locationIn);
    const locOut = parseLoc(ts.locationOut);
    let calculatedDistance = 0;
    if (locIn && locOut) {
        calculatedDistance = haversine(locIn.lat, locIn.lon, locOut.lat, locOut.lon) * DRIVING_FACTOR;
    }

    let distance = 0;
    let hours = 0;

    if (isDrive) {
        // ========== DRIVE TIME CALCULATION ==========
        
        const getQty = (val: any) => {
            const str = String(val || '');
            const match = str.match(/\((\d+)\s+qty\)/);
            if (match) return parseFloat(match[1]);
            if (val === true || str.toLowerCase() === 'true' || str.toLowerCase() === 'yes') return 1;
            return 0;
        };

        const washoutQty = getQty(ts.dumpWashout);
        const shopQty = getQty(ts.shopTime);
        const specialHrs = (washoutQty * 0.5) + (shopQty * 0.25);

        // Priority 1: Manual Distance (ignores calculated if set)
        const manualDist = ts.manualDistance ? parseFloat(String(ts.manualDistance)) : 0;
        if (manualDist > 0) {
            distance = manualDist;
        } else {
            // Priority 2: Calculated Distance
            distance = calculatedDistance;
        }

        // Manual Hours override
        const manualHrs = ts.manualDuration ? parseFloat(String(ts.manualDuration)) : 0;
        if (manualHrs > 0) {
            hours = manualHrs;
        } else {
            // Formula: (Distance / Speed) + Washout Hours + Shop Hours
            hours = (distance / SPEED_MPH) + specialHrs;
        }
    } else {
        // ========== SITE TIME CALCULATION ==========
        
        const manualHrs = ts.manualDuration ? parseFloat(String(ts.manualDuration)) : 0;
        if (manualHrs > 0) {
            hours = manualHrs;
        } else {
            const calcTimeHours = () => {
                if (!ts.clockIn || !ts.clockOut) return 0;
                
                const startStr = robustNormalizeISO(ts.clockIn);
                const endStr = robustNormalizeISO(ts.clockOut);
                
                const start = new Date(startStr).getTime();
                const end = new Date(endStr).getTime();
                let durationMs = end - start;

                if (ts.lunchStart && ts.lunchEnd) {
                    const lStartStr = robustNormalizeISO(ts.lunchStart);
                    const lEndStr = robustNormalizeISO(ts.lunchEnd);
                    const lStart = new Date(lStartStr).getTime();
                    const lEnd = new Date(lEndStr).getTime();
                    if (lEnd > lStart) durationMs -= (lEnd - lStart);
                }
                if (durationMs <= 0) return 0;
                
                const totalHoursRaw = durationMs / (1000 * 60 * 60);

                // Cutoff rounding logic - Ensure UTC comparison
                const cutoff2025 = new Date('2025-10-26T00:00:00.000Z');
                if (new Date(robustNormalizeISO(ts.clockIn)) < cutoff2025) return totalHoursRaw;
                if (totalHoursRaw >= 7.75 && totalHoursRaw < 8.0) return 8.0;

                const h = Math.floor(totalHoursRaw);
                const m = Math.round((totalHoursRaw - h) * 60);
                let roundedM = 0;
                if (m > 1 && m <= 14) roundedM = 0;
                else if (m > 14 && m <= 29) roundedM = 15;
                else if (m > 29 && m <= 44) roundedM = 30;
                else if (m > 44 && m <= 59) roundedM = 45;
                return h + (roundedM / 60);
            };
            hours = calcTimeHours();
        }
        distance = 0;
    }

    return { hours, distance, calculatedDistance };
};

export const startOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday start
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff, 0, 0, 0, 0));
    return start;
};

export const endOfWeek = (date: Date) => {
    const d = startOfWeek(date);
    const end = new Date(d);
    end.setUTCDate(d.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);
    return end;
};

export const addWeeks = (date: Date, weeks: number) => {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + (weeks * 7));
    return d;
};

export const subWeeks = (date: Date, weeks: number) => addWeeks(date, -weeks);

