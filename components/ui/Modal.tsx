'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
    hideHeader?: boolean;
    fullScreenOnMobile?: boolean;
}

// Global tracking of open modals to handle Escape key properly in nested scenarios
let modalStack: string[] = [];

export function Modal({ 
    isOpen, 
    onClose, 
    title, 
    children, 
    footer, 
    maxWidth = '4xl', 
    preventClose = false, 
    noBlur = false,
    hideHeader = false,
    fullScreenOnMobile = false
}: ModalProps) {
    const [shouldRender, setShouldRender] = useState(false);
    const [mounted, setMounted] = useState(false);
    const instanceId = React.useRef(Math.random().toString(36).substr(2, 9)).current;

    // Ensure we only render portal after mount (for SSR compatibility)
    useEffect(() => {
        setMounted(true);
    }, []);

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

    if (!isOpen || !mounted) return null;

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

    const modalContent = (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center ${fullScreenOnMobile ? 'p-0 md:p-4' : 'p-2 md:p-4'} overflow-hidden`}>
            {/* Darker backdrop to fully hide content behind */}
            <div 
                className={`absolute inset-0 ${noBlur ? 'bg-black/5' : 'bg-black/60 backdrop-blur-lg'} transition-opacity duration-300 ${shouldRender ? 'opacity-100' : 'opacity-0'}`} 
                onClick={preventClose ? undefined : onClose}
            />
            <div className={`relative bg-white shadow-2xl w-full ${maxWidthClass} transition-all duration-300 transform ${
                fullScreenOnMobile 
                    ? 'h-full md:h-auto md:max-h-[96vh] rounded-none md:rounded-3xl' 
                    : 'max-h-[96vh] rounded-3xl'
            } flex flex-col overflow-hidden ${
                noBlur 
                    ? (shouldRender ? 'opacity-100' : 'opacity-0') 
                    : (shouldRender ? 'scale-100 opacity-100' : 'scale-95 opacity-0 -translate-y-4')
            }`}>
                {!hideHeader && (
                    <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
                        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                )}
                <div className={`${fullScreenOnMobile ? 'px-0 pb-0 md:px-4 md:pb-4' : 'px-4 pb-4'} flex-1 overflow-y-auto`}>
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

    // Use portal to render modal at document.body level, breaking out of any stacking context
    return createPortal(modalContent, document.body);
}

export default Modal;
