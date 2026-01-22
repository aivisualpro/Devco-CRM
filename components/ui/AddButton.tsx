'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from './Button';

interface AddButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label?: string;
    variant?: 'primary' | 'outline' | 'default';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const sizes = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-9 px-4 text-sm gap-2',
    lg: 'h-10 px-6 text-base gap-2.5'
};

const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
};

export function AddButton({
    label = "Add New",
    variant = 'default',
    size = 'md',
    onClick,
    className = '',
    disabled,
    ...props
}: AddButtonProps) {
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key.toLowerCase() === 'a' || e.code === 'KeyA')) {
                e.preventDefault();
                if (!disabled && onClick) {
                    (onClick as any)();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClick, disabled]);

    return (
        <Button
            onClick={onClick}
            disabled={disabled}
            variant={variant === 'primary' ? 'default' : variant}
            className={`font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] ${sizes[size]} ${className}`}
            {...props}
        >
            <Plus className={`${iconSizes[size]} stroke-[2.5px]`} />
            {label}
        </Button>
    );
}

export default AddButton;
