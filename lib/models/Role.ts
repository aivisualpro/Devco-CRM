import mongoose, { Schema, Model } from 'mongoose';
import { ModulePermission, ModuleKey, ActionKey, DataScopeKey, FieldPermission } from '@/lib/permissions/types';

// =====================================
// ROLE MODEL
// =====================================
export interface IRole {
    _id?: any; // MongoDB ObjectId
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    isSystem: boolean;
    isActive: boolean;
    permissions: ModulePermission[];
    createdBy?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const FieldPermissionSchema = new Schema({
    field: { type: String, required: true },
    actions: [{ type: String, enum: ['view', 'create', 'update', 'delete'] }],
    dataScope: { type: String, enum: ['self', 'all', 'department'] },
}, { _id: false });

const ModulePermissionSchema = new Schema({
    module: { type: String, required: true },
    actions: [{ type: String, enum: ['view', 'create', 'edit', 'delete', 'export', 'approve', 'assign', 'change_status'] }],
    dataScope: { type: String, enum: ['self', 'department', 'all'], default: 'self' },
    fieldPermissions: [FieldPermissionSchema],
}, { _id: false });

const RoleSchema = new Schema({
    // Let MongoDB use default ObjectId for _id
    name: { type: String, required: true, unique: true },
    description: { type: String },
    color: { type: String, default: '#6b7280' },
    icon: { type: String, default: 'User' },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    permissions: [ModulePermissionSchema],
    createdBy: { type: String },
}, {
    timestamps: true,
    collection: 'devcoRoles'
});

// Clear cached model on HMR to pick up schema changes
if (process.env.NODE_ENV !== 'production' && mongoose.models.Role) {
    console.log('[MODEL] Deleting Role model from cache for HMR');
    delete mongoose.models.Role;
}

const Role: Model<IRole> = mongoose.models.Role || mongoose.model<IRole>('Role', RoleSchema);
console.log('[MODEL] Role model registered/retrieved');
export default Role;

// =====================================
// USER PERMISSION OVERRIDE MODEL
// =====================================
export interface IUserPermissionOverride {
    _id?: string;
    userId: string;
    module: ModuleKey;
    grant?: ActionKey[];
    revoke?: ActionKey[];
    dataScope?: DataScopeKey;
    fieldGrant?: FieldPermission[];
    fieldRevoke?: FieldPermission[];
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const UserPermissionOverrideSchema = new Schema({
    userId: { type: String, required: true, index: true },
    module: { type: String, required: true },
    grant: [{ type: String }],
    revoke: [{ type: String }],
    dataScope: { type: String, enum: ['self', 'department', 'all'] },
    fieldGrant: [FieldPermissionSchema],
    fieldRevoke: [FieldPermissionSchema],
    createdBy: { type: String, required: true },
}, {
    timestamps: true,
    collection: 'devcoUserPermissionOverrides'
});

// Compound index for efficient lookups
UserPermissionOverrideSchema.index({ userId: 1, module: 1 }, { unique: true });

export const UserPermissionOverride: Model<IUserPermissionOverride> = 
    mongoose.models.UserPermissionOverride || 
    mongoose.model<IUserPermissionOverride>('UserPermissionOverride', UserPermissionOverrideSchema);

// =====================================
// PERMISSION AUDIT LOG
// =====================================
export interface IPermissionAuditLog {
    _id?: string;
    action: 'create' | 'update' | 'delete' | 'assign' | 'revoke';
    targetType: 'role' | 'user_override' | 'user_role';
    targetId: string;
    targetName?: string;
    changes: Record<string, { from: unknown; to: unknown }>;
    performedBy: string;
    performedByName?: string;
    ipAddress?: string;
    userAgent?: string;
    createdAt?: Date;
}

const PermissionAuditLogSchema = new Schema({
    action: { type: String, required: true, enum: ['create', 'update', 'delete', 'assign', 'revoke'] },
    targetType: { type: String, required: true, enum: ['role', 'user_override', 'user_role'] },
    targetId: { type: String, required: true },
    targetName: { type: String },
    changes: { type: Schema.Types.Mixed },
    performedBy: { type: String, required: true },
    performedByName: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
}, {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'devcoPermissionAuditLogs'
});

// Index for efficient queries
PermissionAuditLogSchema.index({ performedBy: 1, createdAt: -1 });
PermissionAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export const PermissionAuditLog: Model<IPermissionAuditLog> = 
    mongoose.models.PermissionAuditLog || 
    mongoose.model<IPermissionAuditLog>('PermissionAuditLog', PermissionAuditLogSchema);

// =====================================
// DEPARTMENT/TEAM MODEL
// =====================================
export interface IDepartment {
    _id: string;
    name: string;
    description?: string;
    managerId?: string;
    parentDepartmentId?: string;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const DepartmentSchema = new Schema({
    _id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    managerId: { type: String },
    parentDepartmentId: { type: String },
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true,
    collection: 'devcoDepartments'
});

export const Department: Model<IDepartment> = 
    mongoose.models.Department || 
    mongoose.model<IDepartment>('Department', DepartmentSchema);
