'use client';

import React from 'react';

interface LoadingProps {
    text?: string;
}

export function Loading({ text = 'Loading...' }: LoadingProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 text-sm">{text}</p>
        </div>
    );
}

interface EmptyStateProps {
    icon?: string;
    title: string;
    message: string;
    action?: React.ReactNode;
}

export function EmptyState({ icon = '📦', title, message, action }: EmptyStateProps) {
    return (
        <div className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">{message}</p>
            {action}
        </div>
    );
}

export default Loading;
