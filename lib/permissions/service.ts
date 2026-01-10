import { connectToDatabase } from '@/lib/db';
import Role, { UserPermissionOverride } from '@/lib/models/Role';
import Employee from '@/lib/models/Employee';
import {
    ModuleKey,
    ActionKey,
    DataScopeKey,
    FieldActionKey,
    ModulePermission,
    UserPermissions,
    ACTIONS,
    DATA_SCOPE,
} from '@/lib/permissions/types';

// =====================================
// SUPER ADMIN CHECK
// =====================================
export function isSuperAdmin(appRole?: string): boolean {
    return appRole?.toLowerCase() === 'super admin';
}

// =====================================
// GET USER PERMISSIONS
// Computes full permissions from role + overrides
// =====================================
export async function getUserPermissions(userId: string): Promise<UserPermissions | null> {
    await connectToDatabase();

    // Get user with role info
    const user = await Employee.findById(userId).lean();
    if (!user) return null;

    // Super Admin bypasses all checks
    if (isSuperAdmin(user.appRole)) {
        return {
            userId,
            roleName: 'Super Admin',
            isSuperAdmin: true,
            department: user.groupNo,
            modules: [], // Empty because Super Admin has all permissions
            lastUpdated: new Date(),
        };
    }

    // Get user's role
    const role = user.appRole ? await Role.findOne({ name: user.appRole, isActive: true }).lean() : null;
    
    // Get user-specific overrides
    const overrides = await UserPermissionOverride.find({ userId }).lean();

    // Build permissions from role
    const modulePermissions: Map<ModuleKey, ModulePermission> = new Map();
    
    if (role?.permissions) {
        for (const perm of role.permissions) {
            modulePermissions.set(perm.module as ModuleKey, { ...perm } as ModulePermission);
        }
    }

    // Apply overrides
    for (const override of overrides) {
        const existing = modulePermissions.get(override.module as ModuleKey);
        
        if (existing) {
            // Apply grants
            if (override.grant) {
                existing.actions = [...new Set([...existing.actions, ...override.grant as ActionKey[]])];
            }
            // Apply revokes
            if (override.revoke) {
                existing.actions = existing.actions.filter(a => !override.revoke!.includes(a as any));
            }
            // Override data scope if specified
            if (override.dataScope) {
                existing.dataScope = override.dataScope as DataScopeKey;
            }
            // Field permissions
            if (override.fieldGrant) {
                existing.fieldPermissions = [...(existing.fieldPermissions || []), ...override.fieldGrant];
            }
            if (override.fieldRevoke && existing.fieldPermissions) {
                const revokeSet = new Set(override.fieldRevoke.map(f => f.field));
                existing.fieldPermissions = existing.fieldPermissions.filter(f => !revokeSet.has(f.field));
            }
        } else if (override.grant && override.grant.length > 0) {
            // Create new permission from override grants
            modulePermissions.set(override.module as ModuleKey, {
                module: override.module as ModuleKey,
                actions: override.grant as ActionKey[],
                dataScope: override.dataScope as DataScopeKey || DATA_SCOPE.SELF,
                fieldPermissions: override.fieldGrant,
            });
        }
    }

    return {
        userId,
        roleId: role?._id,
        roleName: role?.name || 'No Role',
        isSuperAdmin: false,
        department: user.groupNo,
        modules: Array.from(modulePermissions.values()),
        lastUpdated: new Date(),
    };
}

// =====================================
// CHECK PERMISSION
// =====================================
export function hasPermission(
    permissions: UserPermissions | null,
    module: ModuleKey,
    action: ActionKey
): boolean {
    if (!permissions) return false;
    
    // Super Admin has all permissions
    if (permissions.isSuperAdmin) return true;

    const modulePerm = permissions.modules.find(m => m.module === module);
    if (!modulePerm) return false;

    return modulePerm.actions.includes(action);
}

// =====================================
// CHECK FIELD PERMISSION
// =====================================
export function hasFieldPermission(
    permissions: UserPermissions | null,
    module: ModuleKey,
    field: string,
    fieldAction: FieldActionKey
): boolean {
    if (!permissions) return false;
    
    // Super Admin has all permissions
    if (permissions.isSuperAdmin) return true;

    const modulePerm = permissions.modules.find(m => m.module === module);
    if (!modulePerm) return false;

    // If no field permissions defined, use module-level permission
    if (!modulePerm.fieldPermissions || modulePerm.fieldPermissions.length === 0) {
        // Map field action to module action
        const actionMap: Record<FieldActionKey, ActionKey> = {
            view: ACTIONS.VIEW,
            create: ACTIONS.CREATE,
            update: ACTIONS.EDIT,
            delete: ACTIONS.DELETE,
        };
        return modulePerm.actions.includes(actionMap[fieldAction]);
    }

    // Check specific field permission
    const fieldPerm = modulePerm.fieldPermissions.find(f => f.field === field);
    if (!fieldPerm) return false;

    return fieldPerm.actions.includes(fieldAction);
}

// =====================================
// GET DATA SCOPE
// =====================================
export function getDataScope(
    permissions: UserPermissions | null,
    module: ModuleKey
): DataScopeKey {
    if (!permissions) return DATA_SCOPE.SELF;
    
    // Super Admin sees everything
    if (permissions.isSuperAdmin) return DATA_SCOPE.ALL;

    const modulePerm = permissions.modules.find(m => m.module === module);
    return modulePerm?.dataScope || DATA_SCOPE.SELF;
}

// =====================================
// BUILD DATA SCOPE FILTER
// Returns MongoDB query filter for row-level security
// =====================================
export function buildDataScopeFilter(
    permissions: UserPermissions | null,
    module: ModuleKey,
    ownerField: string = 'createdBy',
    departmentField: string = 'department'
): Record<string, any> {
    if (!permissions) {
        return { [ownerField]: '__DENY_ALL__' }; // No access
    }

    // Super Admin sees everything
    if (permissions.isSuperAdmin) {
        return {}; // No filter
    }

    const scope = getDataScope(permissions, module);

    switch (scope) {
        case DATA_SCOPE.SELF:
            return { [ownerField]: permissions.userId };
        
        case DATA_SCOPE.DEPARTMENT:
            if (permissions.department) {
                return {
                    $or: [
                        { [ownerField]: permissions.userId },
                        { [departmentField]: permissions.department },
                    ]
                };
            }
            return { [ownerField]: permissions.userId };
        
        case DATA_SCOPE.ALL:
            return {}; // No filter
        
        default:
            return { [ownerField]: permissions.userId };
    }
}

// =====================================
// FILTER FIELDS BASED ON PERMISSIONS
// Returns only fields user can view
// =====================================
export function filterFieldsForView<T extends Record<string, any>>(
    permissions: UserPermissions | null,
    module: ModuleKey,
    data: T
): Partial<T> {
    if (!permissions) return {};
    
    // Super Admin sees everything
    if (permissions.isSuperAdmin) return data;

    const modulePerm = permissions.modules.find(m => m.module === module);
    if (!modulePerm) return {};

    // If no field-level permissions, return all (respecting module permission)
    if (!modulePerm.fieldPermissions || modulePerm.fieldPermissions.length === 0) {
        return data;
    }

    // Filter to only viewable fields
    const viewableFields = modulePerm.fieldPermissions
        .filter(f => f.actions.includes('view'))
        .map(f => f.field);

    const filtered: Partial<T> = {};
    for (const field of viewableFields) {
        if (field in data) {
            (filtered as any)[field] = data[field];
        }
    }

    // Always include _id
    if ('_id' in data) {
        (filtered as any)._id = data._id;
    }

    return filtered;
}

// =====================================
// GET EDITABLE FIELDS
// Returns list of fields user can edit
// =====================================
export function getEditableFields(
    permissions: UserPermissions | null,
    module: ModuleKey
): string[] {
    if (!permissions) return [];
    
    // Super Admin can edit everything
    if (permissions.isSuperAdmin) return ['*'];

    const modulePerm = permissions.modules.find(m => m.module === module);
    if (!modulePerm) return [];

    // If no field-level permissions, all fields are editable (if has edit action)
    if (!modulePerm.fieldPermissions || modulePerm.fieldPermissions.length === 0) {
        return modulePerm.actions.includes(ACTIONS.EDIT) ? ['*'] : [];
    }

    return modulePerm.fieldPermissions
        .filter(f => f.actions.includes('update'))
        .map(f => f.field);
}

// =====================================
// CACHE PERMISSIONS (for JWT payload optimization)
// =====================================
export interface CachedPermissions {
    isSuperAdmin: boolean;
    role?: string;
    department?: string;
    // Only store module names + basic actions for JWT
    quickAccess: {
        [module: string]: {
            actions: string[];
            scope: string;
        };
    };
}

export function createCachedPermissions(permissions: UserPermissions): CachedPermissions {
    const quickAccess: CachedPermissions['quickAccess'] = {};
    
    for (const mod of permissions.modules) {
        quickAccess[mod.module] = {
            actions: mod.actions,
            scope: mod.dataScope,
        };
    }

    return {
        isSuperAdmin: permissions.isSuperAdmin,
        role: permissions.roleName,
        department: permissions.department,
        quickAccess,
    };
}

// =====================================
// PERMISSION CHECKER CLASS
// For API routes - includes request context
// =====================================
export class PermissionChecker {
    private permissions: UserPermissions | null = null;
    private userId: string;

    constructor(userId: string) {
        this.userId = userId;
    }

    async load(): Promise<this> {
        this.permissions = await getUserPermissions(this.userId);
        return this;
    }

    get isSuperAdmin(): boolean {
        return this.permissions?.isSuperAdmin ?? false;
    }

    get isLoaded(): boolean {
        return this.permissions !== null;
    }

    can(module: ModuleKey, action: ActionKey): boolean {
        return hasPermission(this.permissions, module, action);
    }

    canField(module: ModuleKey, field: string, action: FieldActionKey): boolean {
        return hasFieldPermission(this.permissions, module, field, action);
    }

    getScope(module: ModuleKey): DataScopeKey {
        return getDataScope(this.permissions, module);
    }

    buildFilter(
        module: ModuleKey,
        ownerField?: string,
        departmentField?: string
    ): Record<string, any> {
        return buildDataScopeFilter(this.permissions, module, ownerField, departmentField);
    }

    filterView<T extends Record<string, any>>(module: ModuleKey, data: T): Partial<T> {
        return filterFieldsForView(this.permissions, module, data);
    }

    getEditableFields(module: ModuleKey): string[] {
        return getEditableFields(this.permissions, module);
    }

    getPermissions(): UserPermissions | null {
        return this.permissions;
    }

    // Throws if permission denied
    require(module: ModuleKey, action: ActionKey): void {
        if (!this.can(module, action)) {
            throw new PermissionDeniedError(module, action);
        }
    }
}

// =====================================
// PERMISSION DENIED ERROR
// =====================================
export class PermissionDeniedError extends Error {
    module: ModuleKey;
    action: ActionKey;
    statusCode = 403;

    constructor(module: ModuleKey, action: ActionKey) {
        super(`Permission denied: Cannot ${action} on ${module}`);
        this.name = 'PermissionDeniedError';
        this.module = module;
        this.action = action;
    }
}
