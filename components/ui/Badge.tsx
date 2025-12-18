'use client';

import React from 'react';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'cyan' | 'orange' | 'pink';
    className?: string;
    style?: React.CSSProperties;
}

const variants = {
    default: 'bg-gray-100 text-gray-600 border border-gray-200',
    success: 'bg-green-50 text-green-700 border border-green-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-red-50 text-red-700 border border-red-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border border-purple-200',
    cyan: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
    orange: 'bg-orange-50 text-orange-700 border border-orange-200',
    pink: 'bg-pink-50 text-pink-700 border border-pink-200'
};

export function Badge({ children, variant = 'default', className = '', style }: BadgeProps) {
    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${variants[variant]} ${className}`}
            style={style}
        >
            {children}
        </span>
    );
}

export default Badge;
