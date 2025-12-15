'use client';

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export function Input({ label, className = '', ...props }: InputProps) {
    return (
        <div className={className}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
            <input
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 bg-gray-50/50 hover:bg-white"
                {...props}
            />
        </div>
    );
}

interface SearchInputProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onEnter?: () => void;
    placeholder?: string;
    className?: string;
}

export function SearchInput({ value, onChange, onEnter, placeholder = 'Search...', className = '' }: SearchInputProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = React.useState(false);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && onEnter) {
            onEnter();
        }
    };

    return (
        <div className={`relative transition-all duration-500 ease-out ${isFocused ? 'w-80 md:w-96' : 'w-48 md:w-64'} ${className}`}>
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={onChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={placeholder}
                className={`w-full px-4 py-2.5 pl-10 bg-gray-50 border border-gray-200 rounded-xl text-sm 
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 
                    transition-all duration-300 hover:bg-white shadow-sm
                    ${isFocused ? 'shadow-md bg-white' : ''}
                `}
            />
            <svg
                className={`absolute left-3 top-3 w-4 h-4 transition-colors duration-300 ${isFocused ? 'text-indigo-500' : 'text-gray-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round"></path>
            </svg>

            {/* Keyboard Shortcut Hint */}
            {!isFocused && !value && (
                <div className="absolute right-3 top-2.5 pointer-events-none hidden md:flex items-center gap-1">
                    <kbd className="hidden sm:inline-block px-1.5 h-5 text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded leading-5 min-w-[20px] text-center">
                        ⌘
                    </kbd>
                    <span className="text-xs text-gray-300">+</span>
                    <kbd className="hidden sm:inline-block px-1.5 h-5 text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded leading-5 min-w-[20px] text-center">
                        ⇧
                    </kbd>
                    <span className="text-xs text-gray-300">+</span>
                    <kbd className="hidden sm:inline-block px-1.5 h-5 text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded leading-5 min-w-[20px] text-center">
                        F
                    </kbd>
                </div>
            )}
        </div>
    );
}

export default Input;
