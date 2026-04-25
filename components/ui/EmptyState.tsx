import React from 'react';

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    message?: string; // backwards compatibility
    cta?: React.ReactNode;
    action?: React.ReactNode; // backwards compatibility
    className?: string;
}

export function EmptyState({ 
    icon = '📦', 
    title, 
    description, 
    message, 
    cta, 
    action,
    className = ''
}: EmptyStateProps) {
    const displayMessage = description || message;
    const displayAction = cta || action;

    return (
        <div className={`text-center py-16 ${className}`}>
            <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner border border-slate-50">
                {icon}
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
            {displayMessage && (
                <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto font-medium leading-relaxed">
                    {displayMessage}
                </p>
            )}
            {displayAction && (
                <div className="flex justify-center">
                    {displayAction}
                </div>
            )}
        </div>
    );
}

export default EmptyState;
