'use client';

import { useId } from 'react';

interface SparklineProps {
    values: number[];
    color?: string;
    height?: number;
    width?: number;
}

export function Sparkline({ values, color = 'currentColor', height = 24, width = 60 }: SparklineProps) {
    const id = useId();
    if (!values || values.length < 3) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = width / Math.max(1, values.length - 1);

    const points = values
        .map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`)
        .join(' ');

    const firstX = '0';
    const lastX = ((values.length - 1) * step).toFixed(2);

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="overflow-visible"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* Area fill */}
            <polygon
                fill={`url(#${id})`}
                points={`${firstX},${height} ${points} ${lastX},${height}`}
            />
            {/* Line */}
            <polyline
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
            {/* Terminal dot */}
            <circle
                cx={lastX}
                cy={values[values.length - 1] !== undefined
                    ? (height - ((values[values.length - 1] - min) / range) * height).toFixed(2)
                    : height}
                r="2"
                fill={color}
            />
        </svg>
    );
}
