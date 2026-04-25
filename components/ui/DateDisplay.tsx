import React from 'react';
import { formatWallDate, formatWallTime, formatWallDateTime, formatWallRange } from '@/lib/format/date';

interface BaseProps {
    className?: string;
    fallback?: string;
}

export function WallDate({ value, variant = 'short', className, fallback = '—' }: BaseProps & { value: string | Date | undefined | null; variant?: 'short' | 'long' | 'iso' }) {
    const formatted = formatWallDate(value, variant);
    return <span className={className}>{formatted || fallback}</span>;
}

export function WallTime({ value, seconds = false, className, fallback = '—' }: BaseProps & { value: string | Date | undefined | null; seconds?: boolean }) {
    const formatted = formatWallTime(value, { seconds });
    return <span className={className}>{formatted || fallback}</span>;
}

export function WallDateTime({ value, seconds = false, className, fallback = '—' }: BaseProps & { value: string | Date | undefined | null; seconds?: boolean }) {
    const formatted = formatWallDateTime(value, { seconds });
    return <span className={className}>{formatted || fallback}</span>;
}

export function WallRange({ start, end, className, fallback = '—' }: BaseProps & { start: string | Date | undefined | null; end: string | Date | undefined | null }) {
    const formatted = formatWallRange(start, end);
    return <span className={className}>{formatted || fallback}</span>;
}
