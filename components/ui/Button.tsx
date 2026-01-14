'use client';

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    className?: string;
}

const variants = {
    primary: 'text-white shadow-lg transition-all duration-300',
    secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 shadow-sm',
    danger: 'bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600 shadow-lg shadow-red-500/25',
    ghost: 'text-gray-600 hover:bg-gray-100'
};

const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'h-10 w-10 p-0 flex items-center justify-center'
};

export function Button({
    children,
    onClick,
    variant = 'primary',
    size = 'md',
    className = '',
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex items-center gap-2 font-semibold rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${variants[variant]} ${sizes[size]} ${className}`}
            style={variant === 'primary' ? {
                background: 'linear-gradient(to right, #0F4C75, #3282B8)',
                boxShadow: '0 10px 15px -3px rgba(15, 76, 117, 0.3)'
            } : {}}
            {...props}
        >
            {children}
        </button>
    );
}

export default Button;
