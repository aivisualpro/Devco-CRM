'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
    preventClose?: boolean; 
    noBlur?: boolean;
}

// Global tracking of open modals to handle Escape key properly in nested scenarios
let modalStack: string[] = [];

export function Modal({ isOpen, onClose, title, children, footer, maxWidth = '4xl', preventClose = false, noBlur = false }: ModalProps) {
    const [shouldRender, setShouldRender] = React.useState(false);
    const instanceId = React.useRef(Math.random().toString(36).substr(2, 9)).current;

    useEffect(() => {
        if (isOpen) {
            modalStack.push(instanceId);
            // Tiny delay to ensure the browser has a frame to start the transition
            const timer = setTimeout(() => setShouldRender(true), 10);
            return () => {
                modalStack = modalStack.filter(id => id !== instanceId);
                clearTimeout(timer);
                setShouldRender(false);
            };
        }
    }, [isOpen, instanceId]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            // Only close on ESC if preventClose is false AND this is the topmost modal
            if (e.key === 'Escape' && isOpen && !preventClose) {
                if (modalStack[modalStack.length - 1] === instanceId) {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose, preventClose, instanceId]);

    if (!isOpen) return null;

    const maxWidthClass = {
        'sm': 'max-w-sm',
        'md': 'max-w-md',
        'lg': 'max-w-lg',
        'xl': 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl',
        '6xl': 'max-w-6xl',
        '7xl': 'max-w-7xl',
        'full': 'max-w-full'
    }[maxWidth];

    return (
        <div className="fixed inset-0 z-[200] flex items-start md:items-center justify-center p-2 md:p-4 overflow-hidden pt-[calc(env(safe-area-inset-top,0px)+2rem)] md:pt-0">
            {/* Reduced blur from xl to md for better performance */}
            <div 
                className={`absolute inset-0 ${noBlur ? 'bg-black/5' : 'bg-black/40 backdrop-blur-md'} transition-opacity duration-300 ${shouldRender ? 'opacity-100' : 'opacity-0'}`} 
                onClick={preventClose ? undefined : onClose}
            />
            <div className={`relative bg-white rounded-3xl shadow-2xl w-full ${maxWidthClass} max-h-[96vh] flex flex-col overflow-hidden transition-all duration-300 transform ${
                noBlur 
                    ? (shouldRender ? 'opacity-100' : 'opacity-0') 
                    : (shouldRender ? 'scale-100 opacity-100' : 'scale-95 opacity-0 -translate-y-4')
            }`}>
                <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>
                <div className="px-4 pb-4 flex-1 overflow-y-auto">
                    {children}
                </div>
                {footer && (
                    <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100 bg-gray-50 flex-shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Modal;
