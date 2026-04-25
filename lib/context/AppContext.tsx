'use client';

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { UserPermissions, ModuleKey, ActionKey } from '@/lib/permissions/types';

interface CurrentUser {
    userId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    avatar?: string;
    [key: string]: any;
}

type AppSettings = Record<string, any>;

interface AppContextValue {
    currentUser: CurrentUser | null;
    permissions: UserPermissions | null;
    settings: AppSettings;
    loading: boolean;
    error: string | null;
    refreshUser: () => Promise<void>;
    refreshPermissions: () => Promise<void>;
    refreshSettings: () => Promise<void>;
    can: (module: ModuleKey, action: ActionKey) => boolean;
}

export const AppContext = createContext<AppContextValue | null>(null);

const fetcher = (url: string) => fetch(url).then(res => {
    if (res.status === 401 || res.status === 404) {
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
        throw new Error('Not authenticated');
    }
    return res.json().then(data => {
        if (!data.success) throw new Error(data.error || 'Fetch failed');
        return data;
    });
});

export function AppContextProvider({ children }: { children: React.ReactNode }) {
    const {
        data: userData,
        error: userError,
        mutate: refreshUser
    } = useSWR('/api/auth/me', fetcher, {
        dedupingInterval: 1000 * 60 * 5, // 5 minutes
    });

    const {
        data: permissionsData,
        error: permissionsError,
        mutate: refreshPermissions
    } = useSWR('/api/auth/me/permissions', fetcher, {
        dedupingInterval: 1000 * 60 * 5,
    });

    const {
        data: settingsData,
        error: settingsError,
        mutate: refreshSettings
    } = useSWR('/api/app-settings/all', fetcher, {
        dedupingInterval: 1000 * 60 * 5,
    });

    const currentUser = userData?.user || null;
    const permissions = permissionsData?.permissions || null;
    const settings = settingsData?.result || {};

    const loading = !userData && !userError || !permissionsData && !permissionsError || !settingsData && !settingsError;
    const error = (userError || permissionsError || settingsError)?.message || null;

    const can = useCallback((module: ModuleKey, action: ActionKey): boolean => {
        if (!permissions) return false;
        if (permissions.isSuperAdmin) return true;
        
        const modulePerm = permissions.modules.find((m: any) => m.module === module);
        return modulePerm?.actions.includes(action) ?? false;
    }, [permissions]);

    const value = useMemo(() => ({
        currentUser,
        permissions,
        settings,
        loading,
        error,
        refreshUser: async () => { await refreshUser(); },
        refreshPermissions: async () => { await refreshPermissions(); },
        refreshSettings: async () => { await refreshSettings(); },
        can
    }), [currentUser, permissions, settings, loading, error, refreshUser, refreshPermissions, refreshSettings, can]);

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
}

export function useCurrentUser() {
    const context = useContext(AppContext);
    if (!context) throw new Error('useCurrentUser must be used within AppContextProvider');
    return context.currentUser;
}

export function usePermissions() {
    const context = useContext(AppContext);
    if (!context) throw new Error('usePermissions must be used within AppContextProvider');
    return context.permissions;
}

export function useAppSettings() {
    const context = useContext(AppContext);
    if (!context) throw new Error('useAppSettings must be used within AppContextProvider');
    return context.settings;
}

export function useCan(module: ModuleKey, action: ActionKey) {
    const context = useContext(AppContext);
    if (!context) throw new Error('useCan must be used within AppContextProvider');
    return context.can(module, action);
}
