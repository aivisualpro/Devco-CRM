'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    ModuleKey,
    ActionKey,
    FieldActionKey,
    UserPermissions,
    ACTIONS,
    DATA_SCOPE,
} from '@/lib/permissions/types';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui';

// =====================================
// PERMISSION CONTEXT
// =====================================
interface PermissionContextType {
    permissions: UserPermissions | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    can: (module: ModuleKey, action: ActionKey) => boolean;
    canField: (module: ModuleKey, field: string, action: FieldActionKey) => boolean;
    canAccessRoute: (path: string) => boolean;
    isSuperAdmin: boolean;
    getEditableFields: (module: ModuleKey) => string[];
    getDataScope: (module: ModuleKey) => string;
    user: { userId: string; email: string; role: string } | null;
}

const PermissionContext = createContext<PermissionContextType | null>(null);

// =====================================
// PERMISSION PROVIDER
// =====================================
export function PermissionProvider({ children }: { children: React.ReactNode }) {
    const [permissions, setPermissions] = useState<UserPermissions | null>(null);
    const [user, setUser] = useState<{ userId: string; email: string; role: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPermissions = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await fetch('/api/auth/me/permissions');
            
            if (response.status === 401 || response.status === 404) {
               // User not authenticated or inactive - force logout
               window.location.href = '/login';
               return;
            }

            const data = await response.json();
            
            if (data.success) {
                setPermissions(data.permissions);
                if (data.user) {
                    setUser(data.user);
                }
            } else {
                setError(data.error || 'Failed to load permissions');
            }
        } catch (err) {
            console.error('Failed to fetch permissions:', err);
            setError('Failed to load permissions');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPermissions();
        
        // Refresh permissions every 5 minutes
        const interval = setInterval(fetchPermissions, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [fetchPermissions]);

    // Check permission for module + action
    const can = useCallback((module: ModuleKey, action: ActionKey): boolean => {
        if (!permissions) return false;
        if (permissions.isSuperAdmin) return true;
        
        const modulePerm = permissions.modules.find(m => m.module === module);
        return modulePerm?.actions.includes(action) ?? false;
    }, [permissions]);

    // Check field-level permission
    const canField = useCallback((module: ModuleKey, field: string, action: FieldActionKey): boolean => {
        if (!permissions) return false;
        if (permissions.isSuperAdmin) return true;
        
        const modulePerm = permissions.modules.find(m => m.module === module);
        if (!modulePerm) return false;

        // If no field permissions, use module-level
        if (!modulePerm.fieldPermissions?.length) {
            const actionMap: Record<FieldActionKey, ActionKey> = {
                view: ACTIONS.VIEW,
                create: ACTIONS.CREATE,
                update: ACTIONS.EDIT,
                delete: ACTIONS.DELETE,
            };
            return modulePerm.actions.includes(actionMap[action]);
        }

        const fieldPerm = modulePerm.fieldPermissions.find(f => f.field === field);
        if (fieldPerm) {
            return fieldPerm.actions.includes(action);
        }

        // Implicit Allow: If field not explicitly strictly, inherit module permission
        // Since we already checked module access above, we just check if the action maps to a module action
        const actionMap: Record<FieldActionKey, ActionKey> = {
            view: ACTIONS.VIEW,
            create: ACTIONS.CREATE,
            update: ACTIONS.EDIT,
            delete: ACTIONS.DELETE,
        };
        return modulePerm.actions.includes(actionMap[action]);
    }, [permissions]);

    // Check route access
    const canAccessRoute = useCallback((path: string): boolean => {
        if (!permissions) return false;
        if (permissions.isSuperAdmin) return true;
        
        // Import URL_TO_MODULE mapping
        const { URL_TO_MODULE } = require('@/lib/permissions/types');
        
        // Find module for path
        let module: ModuleKey | null = null;
        if (URL_TO_MODULE[path]) {
            module = URL_TO_MODULE[path];
        } else {
            for (const [route, mod] of Object.entries(URL_TO_MODULE)) {
                if (path.startsWith(route + '/') || path === route) {
                    module = mod as ModuleKey;
                    break;
                }
            }
        }
        
        if (!module) return true; // Unknown routes are allowed
        
        return can(module, 'view');
    }, [permissions, can]);

    // Get editable fields
    const getEditableFields = useCallback((module: ModuleKey): string[] => {
        if (!permissions) return [];
        if (permissions.isSuperAdmin) return ['*'];
        
        const modulePerm = permissions.modules.find(m => m.module === module);
        if (!modulePerm) return [];
        
        if (!modulePerm.fieldPermissions?.length) {
            return modulePerm.actions.includes(ACTIONS.EDIT) ? ['*'] : [];
        }
        
        return modulePerm.fieldPermissions
            .filter(f => f.actions.includes('update'))
            .map(f => f.field);
    }, [permissions]);

    // Get data scope
    const getDataScope = useCallback((module: ModuleKey): string => {
        if (!permissions) return DATA_SCOPE.SELF;
        if (permissions.isSuperAdmin) return DATA_SCOPE.ALL;
        
        const modulePerm = permissions.modules.find(m => m.module === module);
        return modulePerm?.dataScope || DATA_SCOPE.SELF;
    }, [permissions]);

    const value: PermissionContextType = {
        permissions,
        loading,
        error,
        refresh: fetchPermissions,
        can,
        canField,
        canAccessRoute,
        isSuperAdmin: permissions?.isSuperAdmin ?? false,
        getEditableFields,
        getDataScope,
        user,
    };

    return (
        <PermissionContext.Provider value={value}>
            {children}
        </PermissionContext.Provider>
    );
}

// =====================================
// USE PERMISSIONS HOOK
// =====================================
export function usePermissions(): PermissionContextType {
    const context = useContext(PermissionContext);
    if (!context) {
        throw new Error('usePermissions must be used within a PermissionProvider');
    }
    return context;
}

// =====================================
// PERMISSION GUARD COMPONENT
// =====================================
interface PermissionGuardProps {
    module: ModuleKey;
    action: ActionKey;
    children: React.ReactNode;
    fallback?: React.ReactNode;
    showLoading?: boolean;
}

export function PermissionGuard({
    module,
    action,
    children,
    fallback = null,
    showLoading = false,
}: PermissionGuardProps) {
    const { can, loading } = usePermissions();

    if (loading && showLoading) {
        return <div className="animate-pulse bg-gray-100 rounded h-8 w-24" />;
    }

    if (!can(module, action)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

// =====================================
// FIELD PERMISSION GUARD
// =====================================
interface FieldGuardProps {
    module: ModuleKey;
    field: string;
    action: FieldActionKey;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function FieldGuard({
    module,
    field,
    action,
    children,
    fallback = null,
}: FieldGuardProps) {
    const { canField } = usePermissions();

    if (!canField(module, field, action)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

// =====================================
// ROUTE GUARD COMPONENT
// =====================================
interface RouteGuardProps {
    path: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function RouteGuard({ path, children, fallback }: RouteGuardProps) {
    const { canAccessRoute, loading } = usePermissions();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || loading) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F4C75]" />
            </div>
        );
    }

    if (!canAccessRoute(path)) {
        return fallback || (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
                <p className="text-gray-500 max-w-md">
                    You don't have permission to access this page. Please contact your administrator if you believe this is an error.
                </p>
            </div>
        );
    }

    return <>{children}</>;
}

// =====================================
// ACTION BUTTON WITH PERMISSION
// =====================================
interface PermissionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    module: ModuleKey;
    action: ActionKey;
    hideIfDenied?: boolean;
    disabledMessage?: string;
}

export function PermissionButton({
    module,
    action,
    hideIfDenied = false,
    disabledMessage = 'You do not have permission for this action',
    children,
    ...props
}: PermissionButtonProps) {
    const { can, loading } = usePermissions();
    const hasPermission = can(module, action);

    if (loading) {
        return (
            <button {...props} disabled className="opacity-50 cursor-not-allowed">
                {children}
            </button>
        );
    }

    if (!hasPermission) {
        if (hideIfDenied) return null;
        
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        {...props}
                        disabled
                        className={`${props.className} opacity-50 cursor-not-allowed`}
                    >
                        {children}
                    </button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{disabledMessage}</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    return <button {...props}>{children}</button>;
}

// =====================================
// PERMISSION-AWARE INPUT
// =====================================
interface PermissionInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    module: ModuleKey;
    field: string;
    showIfNoView?: boolean;
}

export function PermissionInput({
    module,
    field,
    showIfNoView = false,
    ...props
}: PermissionInputProps) {
    const { canField } = usePermissions();
    
    const canView = canField(module, field, 'view');
    const canUpdate = canField(module, field, 'update');

    if (!canView && !showIfNoView) {
        return null;
    }

    if (!canUpdate) {
        return (
            <input
                {...props}
                disabled
                readOnly
                className={`${props.className} bg-gray-50 cursor-not-allowed`}
            />
        );
    }

    return <input {...props} />;
}

// =====================================
// SUPER ADMIN ONLY GUARD
// =====================================
interface SuperAdminOnlyProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function SuperAdminOnly({ children, fallback = null }: SuperAdminOnlyProps) {
    const { isSuperAdmin } = usePermissions();

    if (!isSuperAdmin) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

// =====================================
// USE PERMISSION CHECK HOOK
// For conditional rendering in components
// =====================================
export function useCanDo(module: ModuleKey, action: ActionKey): boolean {
    const { can } = usePermissions();
    return can(module, action);
}

export function useCanDoField(module: ModuleKey, field: string, action: FieldActionKey): boolean {
    const { canField } = usePermissions();
    return canField(module, field, action);
}
