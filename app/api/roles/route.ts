import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import Role, { UserPermissionOverride, PermissionAuditLog } from '@/lib/models/Role';
import Employee from '@/lib/models/Employee';
import { getUserFromRequest } from '@/lib/permissions/middleware';
import { isSuperAdmin } from '@/lib/permissions/service';
import { MODULES, ACTIONS, DATA_SCOPE, DEFAULT_ROLES } from '@/lib/permissions/types';

// =====================================
// GET ALL ROLES
// =====================================
export async function GET(request: NextRequest) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        // Allow Super Admin and Admin to view roles
        const allowedRoles = ['super admin', 'admin'];
        if (!allowedRoles.includes(user.role?.toLowerCase() || '')) {
            return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
        }

        await connectToDatabase();

        // Initialize default roles if none exist
        const roleCount = await Role.countDocuments();
        if (roleCount === 0) {
            for (const roleDef of DEFAULT_ROLES) {
                const role = new Role(roleDef);
                await role.save();
            }
        }

        const roles = await Role.find().sort({ isSystem: -1, name: 1 }).lean();

        // Get employee counts per role
        const roleCounts = await Employee.aggregate([
            { $match: { status: 'Active' } },
            { $group: { _id: '$appRole', count: { $sum: 1 } } }
        ]);
        
        const countMap = new Map(roleCounts.map((r: { _id: string; count: number }) => [r._id, r.count]));
        
        const rolesWithCounts = roles.map(role => ({
            ...role,
            employeeCount: countMap.get(role.name) || 0,
        }));

        return NextResponse.json({
            success: true,
            roles: rolesWithCounts,
            modules: Object.entries(MODULES).map(([key, value]) => ({ key, value })),
            actions: Object.entries(ACTIONS).map(([key, value]) => ({ key, value })),
            scopes: Object.entries(DATA_SCOPE).map(([key, value]) => ({ key, value })),
        });
    } catch (error) {
        console.error('Error fetching roles:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch roles' }, { status: 500 });
    }
}

// =====================================
// CREATE ROLE
// =====================================
export async function POST(request: NextRequest) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        // Only Super Admin can create roles
        if (!isSuperAdmin(user.role)) {
            return NextResponse.json({ success: false, error: 'Only Super Admin can create roles' }, { status: 403 });
        }

        await connectToDatabase();
        const body = await request.json();

        const { name, description, color, icon, permissions, isActive = true } = body;

        if (!name) {
            return NextResponse.json({ success: false, error: 'Role name is required' }, { status: 400 });
        }

        // Check if role exists
        const existing = await Role.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
        if (existing) {
            return NextResponse.json({ success: false, error: 'Role already exists' }, { status: 400 });
        }

        const role = new Role({
            // Let MongoDB auto-generate ObjectId
            name,
            description,
            color: color || '#6b7280',
            icon: icon || 'User',
            permissions: permissions || [],
            isSystem: false,
            isActive,
            createdBy: user.userId,
        });

        await role.save();

        // Audit log
        await PermissionAuditLog.create({
            action: 'create',
            targetType: 'role',
            targetId: role._id,
            targetName: role.name,
            changes: { created: { from: null, to: role.toObject() } },
            performedBy: user.userId,
            performedByName: user.email,
        });

        return NextResponse.json({ success: true, role });
    } catch (error) {
        console.error('Error creating role:', error);
        return NextResponse.json({ success: false, error: 'Failed to create role' }, { status: 500 });
    }
}

// =====================================
// UPDATE ROLE
// =====================================
export async function PUT(request: NextRequest) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        // Only Super Admin can update roles
        if (!isSuperAdmin(user.role)) {
            return NextResponse.json({ success: false, error: 'Only Super Admin can update roles' }, { status: 403 });
        }

        await connectToDatabase();
        const body = await request.json();

        const { id, name, description, color, icon, permissions, isActive } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'Role ID is required' }, { status: 400 });
        }

        console.log('PUT /api/roles - Looking for role with id:', id, 'type:', typeof id);
        
        // Build query conditions - handle both ObjectId and string IDs
        const queryConditions: any[] = [
            { name: id },
            { name: { $regex: new RegExp(`^${id}$`, 'i') } }
        ];
        
        // Try as string _id
        queryConditions.push({ _id: id });
        
        // Try slug format
        const idSlug = String(id).toLowerCase().replace(/\s+/g, '_');
        queryConditions.push({ _id: idSlug });
        
        // Try as ObjectId if it's a valid ObjectId string
        if (mongoose.Types.ObjectId.isValid(id)) {
            queryConditions.push({ _id: new mongoose.Types.ObjectId(id) });
        }
        
        const role = await Role.findOne({ $or: queryConditions });
        
        if (!role) {
            const allRoles = await Role.find().select('_id name').lean();
            console.log('PUT /api/roles - Role not found. Searched for:', { id, idSlug });
            console.log('PUT /api/roles - Available roles:', allRoles);
            return NextResponse.json({ success: false, error: `Role not found: ${id}` }, { status: 404 });
        }
        
        console.log('PUT /api/roles - Found role:', role._id, role.name);

        // Cannot modify Super Admin role permissions
        if (role.name === 'Super Admin' && permissions) {
            return NextResponse.json({ 
                success: false, 
                error: 'Cannot modify Super Admin permissions' 
            }, { status: 400 });
        }

        // Track changes for audit
        const changes: Record<string, { from: any; to: any }> = {};
        
        if (name !== undefined && name !== role.name) {
            changes.name = { from: role.name, to: name };
            role.name = name;
        }
        if (description !== undefined && description !== role.description) {
            changes.description = { from: role.description, to: description };
            role.description = description;
        }
        if (color !== undefined && color !== role.color) {
            changes.color = { from: role.color, to: color };
            role.color = color;
        }
        if (icon !== undefined && icon !== role.icon) {
            changes.icon = { from: role.icon, to: icon };
            role.icon = icon;
        }
        if (permissions !== undefined) {
            // Filter out invalid permissions (must have module and at least one action)
            const validPermissions = (permissions || []).filter((p: any) => 
                p && p.module && typeof p.module === 'string' && p.module.trim() !== ''
            );
            changes.permissions = { from: role.permissions, to: validPermissions };
            role.permissions = validPermissions;
        }
        if (isActive !== undefined && isActive !== role.isActive) {
            changes.isActive = { from: role.isActive, to: isActive };
            role.isActive = isActive;
        }

        await role.save();

        // Audit log
        if (Object.keys(changes).length > 0) {
            await PermissionAuditLog.create({
                action: 'update',
                targetType: 'role',
                targetId: role._id,
                targetName: role.name,
                changes,
                performedBy: user.userId,
                performedByName: user.email,
            });
        }

        return NextResponse.json({ success: true, role });
    } catch (error) {
        console.error('Error updating role:', error);
        return NextResponse.json({ success: false, error: 'Failed to update role' }, { status: 500 });
    }
}

// =====================================
// DELETE ROLE
// =====================================
export async function DELETE(request: NextRequest) {
    try {
        const user = await getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        if (!isSuperAdmin(user.role)) {
            return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
        }

        await connectToDatabase();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'Role ID is required' }, { status: 400 });
        }

        // Build query conditions - handle both ObjectId and string IDs
        const queryConditions: any[] = [
            { _id: id },
            { name: id }
        ];
        
        // Try as ObjectId if it's a valid ObjectId string
        if (mongoose.Types.ObjectId.isValid(id)) {
            queryConditions.push({ _id: new mongoose.Types.ObjectId(id) });
        }
        
        const role = await Role.findOne({ $or: queryConditions });
        if (!role) {
            return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
        }

        if (role.isSystem) {
            return NextResponse.json({ success: false, error: 'Cannot delete system roles' }, { status: 400 });
        }

        // Check if any employees have this role
        const employeeCount = await Employee.countDocuments({ appRole: role.name });
        if (employeeCount > 0) {
            return NextResponse.json({ 
                success: false, 
                error: `Cannot delete role. ${employeeCount} employee(s) are assigned to this role.` 
            }, { status: 400 });
        }

        await Role.deleteOne({ _id: id });

        // Audit log
        await PermissionAuditLog.create({
            action: 'delete',
            targetType: 'role',
            targetId: id,
            targetName: role.name,
            changes: { deleted: { from: role.toObject(), to: null } },
            performedBy: user.userId,
            performedByName: user.email,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting role:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete role' }, { status: 500 });
    }
}
