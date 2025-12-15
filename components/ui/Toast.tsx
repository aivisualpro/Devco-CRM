'use client';

import React, { useEffect } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, AlertTriangle } from 'lucide-react';

export interface ToastData {
    id: string;
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
}

interface ToastProps extends ToastData {
    onClose: () => void;
}

const variantStyles = {
    success: 'bg-white border-l-4 border-green-500 text-gray-800',
    error: 'bg-white border-l-4 border-red-500 text-gray-800',
    info: 'bg-white border-l-4 border-blue-500 text-gray-800',
    warning: 'bg-white border-l-4 border-amber-500 text-gray-800'
};

const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    info: <AlertCircle className="w-5 h-5 text-blue-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />
};

export function Toast({ message, type = 'info', onClose }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`flex items-center w-full max-w-sm p-4 mb-4 rounded-lg shadow-lg shadow-gray-200 transition-all duration-300 ${variantStyles[type]}`}>
            <div className="flex-shrink-0">
                {icons[type]}
            </div>
            <div className="ml-3 text-sm font-medium pr-4">
                {message}
            </div>
            <button onClick={onClose} className="ml-auto -mx-1.5 -my-1.5 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8 text-gray-500 items-center justify-center transition-colors">
                <span className="sr-only">Close</span>
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}

interface ToastContainerProps {
    toasts: ToastData[];
    removeToast: (id: string) => void;
}

export function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col items-end gap-2">
            {toasts.map(toast => (
                <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    );
}

export default Toast;
