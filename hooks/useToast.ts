'use client';

import { toast } from 'react-hot-toast';
import { useMemo } from 'react';

export function useToast() {
    return useMemo(() => ({
        toasts: [], // Deprecated
        addToast: (message: string) => toast(message), // Deprecated
        removeToast: (id: string) => toast.dismiss(id), // Deprecated
        success: (message: string) => toast.success(message),
        error: (message: string) => toast.error(message),
        info: (message: string) => toast(message, { icon: 'ℹ️' }),
        warning: (message: string) => toast(message, { icon: '⚠️' })
    }), []);
}

export default useToast;
