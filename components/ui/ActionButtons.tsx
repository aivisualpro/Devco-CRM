'use client';

import React from 'react';
import { Button } from './Button';
import { Check, X } from 'lucide-react';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label?: string;
    loading?: boolean;
}

export function SaveButton({ label = 'Save', loading, className = '', ...props }: ActionButtonProps) {
    return (
        <Button
            variant="primary"
            disabled={loading}
            className={`min-w-[100px] bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-md hover:shadow-lg border-0 ${className}`}
            {...props}
        >
            <Check className="w-4 h-4 stroke-[3px]" />
            {loading ? 'Saving...' : label}
        </Button>
    );
}

export function CancelButton({ label = 'Cancel', className = '', ...props }: ActionButtonProps) {
    return (
        <Button
            variant="secondary"
            className={`min-w-[100px] bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 shadow-sm ${className}`}
            {...props}
        >
            <X className="w-4 h-4" />
            {label}
        </Button>
    );
}
