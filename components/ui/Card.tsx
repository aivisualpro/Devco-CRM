'use client';

import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
}

export function Card({ children, className = '', hover = true }: CardProps) {
    return (
        <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${hover ? 'hover:shadow-lg hover:border-gray-200 transition-all duration-300' : ''} ${className}`}>
            {children}
        </div>
    );
}

interface StatCardProps {
    icon: React.ReactNode;
    value: string | number;
    label: string;
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'pink';
    trend?: number;
}

const colors = {
    blue: 'from-blue-100 to-indigo-100 text-blue-600',
    green: 'from-emerald-100 to-teal-100 text-emerald-600',
    purple: 'from-purple-100 to-violet-100 text-purple-600',
    orange: 'from-orange-100 to-amber-100 text-orange-600',
    pink: 'from-pink-100 to-rose-100 text-pink-600'
};

export function StatCard({ icon, value, label, color = 'blue', trend }: StatCardProps) {
    return (
        <Card className="p-6">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-2xl mb-4`}>
                {icon}
            </div>
            <div className="flex items-end justify-between">
                <div>
                    <div className="text-3xl font-bold text-gray-900 tracking-tight">{value}</div>
                    <div className="text-sm text-gray-500 mt-1">{label}</div>
                </div>
                {trend && (
                    <div className={`text-xs font-semibold px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </div>
                )}
            </div>
        </Card>
    );
}

export default Card;
