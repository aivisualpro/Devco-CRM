'use client';

import { toast } from 'sonner';
import { useMemo } from 'react';
 
export function useToast() {
    return useMemo(() => ({
        toasts: [], // Deprecated
        addToast: (message: string) => toast(message), // Deprecated
        removeToast: (id: string | number) => toast.dismiss(id), // Deprecated
        success: (message: string, description?: string) => toast.success(message, { description }),
        error: (message: string, description?: string) => toast.error(message, { description }),
        info: (message: string, description?: string) => toast.info(message, { description }),
        warning: (message: string, description?: string) => toast.warning(message, { description })
    }), []);
}

export default useToast;
