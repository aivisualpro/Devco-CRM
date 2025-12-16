'use client';

import React from 'react';
import { Plus } from 'lucide-react';

interface AddButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label?: string;
    variant?: 'primary' | 'outline';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

const variants = {
    primary: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg',
    outline: 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
};

const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5'
};

const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
};

export function AddButton({
    label = "Add New",
    variant = 'primary',
    size = 'md',
    onClick,
    className = '',
    disabled,
    ...props
}: AddButtonProps) {
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Cmd+Shift+A (Mac) or Ctrl+Shift+A (Windows)
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key.toLowerCase() === 'a' || e.code === 'KeyA')) {
                e.preventDefault();
                if (!disabled && onClick) {
                    // Start of workaround: Create a synthetic event if onClick expects one, 
                    // though usually onClick handlers in React for buttons accept React.MouseEvent.
                    // Most handlers defined as `() => void` or similar won't care.
                    // If they use `e.preventDefault()` inside, it might fail if we pass null or a keyboard event.
                    // Safest is to just call it potentially without args if the signature allows,
                    // but TypeScript might complain if we pass nothing.
                    // Casting to any to bypass strict React.MouseEvent requirement for now as we are stimulating it.
                    (onClick as any)();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClick, disabled]);

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                inline-flex items-center justify-center font-bold rounded-xl
                transition-all duration-300
                hover:scale-[1.02] active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                ${variants[variant]}
                ${sizes[size]}
                ${className}
            `}
            {...props}
        >
            <Plus className={`${iconSizes[size]} ${variant === 'primary' ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            {label}
        </button>
    );
}

export default AddButton;
