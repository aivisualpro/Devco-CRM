'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
    Shield, Plus, Pencil, Trash2, Users, Eye, ShieldCheck, 
    Lock, Settings, Key,
    Package, FileText, Calculator, Calendar, DollarSign,
    ClipboardCheck, Truck, Wrench, BarChart, MessageSquare,
    Briefcase,
    RefreshCw
} from 'lucide-react';
import { Header, Modal, Badge, ConfirmModal, SearchInput } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import {
    MODULES,
    MODULE_LABELS,
    ModuleKey,
    IRole,
} from '@/lib/permissions/types';
import { RoleForm } from './role-form';

// Icon mapping for roles
const ROLE_ICONS: Record<string, React.ReactNode> = {
    Shield: <Shield className="w-5 h-5" />,
    UserCog: <UserCog className="w-5 h-5" />, // Note: UserCog wasn't imported in my list above, need to add it
    Users: <Users className="w-5 h-5" />,
    User: <User className="w-5 h-5" />, // User needed
    Eye: <Eye className="w-5 h-5" />,
    Lock: <Lock className="w-5 h-5" />,
    Settings: <Settings className="w-5 h-5" />,
};

// Need access to User and UserCog for the icons above
import { User, UserCog, ArrowLeft } from 'lucide-react'; // Adding missing imports

// Module icons
const MODULE_ICONS: Record<string, React.ReactNode> = {
    dashboard: <BarChart className="w-4 h-4" />,
    clients: <Users className="w-4 h-4" />,
    employees: <Briefcase className="w-4 h-4" />,
    leads: <Briefcase className="w-4 h-4" />,
    roles: <Shield className="w-4 h-4" />,
    catalogue: <Package className="w-4 h-4" />,
    templates: <FileText className="w-4 h-4" />,
    estimates: <Calculator className="w-4 h-4" />,
    schedules: <Calendar className="w-4 h-4" />,
    time_cards: <Calendar className="w-4 h-4" />,
    quickbooks: <DollarSign className="w-4 h-4" />,
    jha: <ClipboardCheck className="w-4 h-4" />,
    job_tickets: <FileText className="w-4 h-4" />,
    billing_tickets: <DollarSign className="w-4 h-4" />,
    vehicle_safety: <Truck className="w-4 h-4" />,
    repair: <Wrench className="w-4 h-4" />,
    constants: <Settings className="w-4 h-4" />,
    chat: <MessageSquare className="w-4 h-4" />,
    company_docs: <FileText className="w-4 h-4" />,
};

interface RoleWithCount extends IRole {
    employeeCount?: number;
}

// Access Restricted Component
function AccessRestricted() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
            <div className="w-32 h-32 rounded-full bg-blue-50 flex items-center justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                    <Lock className="w-10 h-10 text-blue-500" />
                </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-3">Access Restricted</h1>
            <p className="text-slate-500 max-w-md mb-2">
                You do not have the required permissions to view the
            </p>
            <p className="text-slate-700 font-semibold mb-1">Roles & Permissions</p>
            <p className="text-slate-500 max-w-md mb-8">
                module. Please contact your organization's Super Admin if you believe this is an error.
            </p>
            <div className="flex gap-3">
                <button className="px-6 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all">
                    <Key className="w-4 h-4" />
                    Request Access
                </button>
                <button 
                    onClick={() => window.location.href = '/dashboard'}
                    className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 flex items-center gap-2 transition-all"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Go to Dashboard
                </button>
            </div>
            <p className="text-sm text-slate-400 mt-8">
                Need immediate help? <a href="#" className="text-blue-500 hover:underline">Contact Support</a>
            </p>
        </div>
    );
}

export default function RolesPage() {
    const { success, error: showError } = useToast();
    const [roles, setRoles] = useState<RoleWithCount[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(true);
    const [selectedRole, setSelectedRole] = useState<RoleWithCount | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [roleToDelete, setRoleToDelete] = useState<RoleWithCount | null>(null);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');

    // Fetch roles
    useEffect(() => {
        fetchRoles();
    }, []);

    async function fetchRoles() {
        setLoading(true);
        try {
            const res = await fetch('/api/roles');
            const data = await res.json();
            if (data.success) {
                setRoles(data.roles);
                setHasAccess(true);
            } else if (res.status === 403) {
                setHasAccess(false);
            } else {
                showError(data.error || 'Failed to load roles');
            }
        } catch (err) {
            showError('Failed to load roles');
        } finally {
            setLoading(false);
        }
    }

    // Filter roles by search
    const filteredRoles = useMemo(() => {
        if (!search) return roles;
        const q = search.toLowerCase();
        return roles.filter(r => 
            r.name.toLowerCase().includes(q) || 
            r.description?.toLowerCase().includes(q)
        );
    }, [roles, search]);

    // Open modal for editing
    const openEditModal = (role: RoleWithCount) => {
        setSelectedRole(role);
        setIsModalOpen(true);
    };

    // Create new role
    const openNewRoleModal = () => {
        setSelectedRole(null);
        setIsModalOpen(true);
    };

    // Save role
    const handleSave = async (formData: any) => {
        setSaving(true);
        try {
            const method = selectedRole ? 'PUT' : 'POST';
            const body = selectedRole 
                ? { id: selectedRole._id, ...formData }
                : formData;

            const res = await fetch('/api/roles', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (data.success) {
                success(selectedRole ? 'Role updated successfully' : 'Role created successfully');
                setIsModalOpen(false);
                fetchRoles();
            } else {
                showError(data.error || 'Failed to save role');
            }
        } catch (err) {
            showError('Failed to save role');
        } finally {
            setSaving(false);
        }
    };

    // Delete role
    const handleDelete = async () => {
        const targetRole = roleToDelete || selectedRole; // Handle delete from modal or list
        if (!targetRole) return;

        try {
            const res = await fetch(`/api/roles?id=${targetRole._id}`, {
                method: 'DELETE',
            });

            const data = await res.json();
            if (data.success) {
                success('Role deleted successfully');
                fetchRoles();
                if (isModalOpen) setIsModalOpen(false); // Close edit modal if open
            } else {
                showError(data.error || 'Failed to delete role');
            }
        } catch (err) {
            showError('Failed to delete role');
        }

        setIsDeleteModalOpen(false);
        setRoleToDelete(null);
    };

    if (!hasAccess) {
        return (
            <div className="flex flex-col h-full bg-[#eef2f6]">
                <Header hideLogo={false} />
                <AccessRestricted />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#eef2f6]">
            <Header 
                hideLogo={false}
                rightContent={
                    <div className="flex items-center gap-3">
                        <SearchInput
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search roles..."
                        />
                        <button
                            onClick={openNewRoleModal}
                            className="w-10 h-10 bg-[#0F4C75] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#0b3c5d] active:scale-95 transition-all"
                            title="Create Role"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                }
            />

            <div className="flex-1 overflow-auto p-4">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-48 bg-white rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : filteredRoles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                        <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mb-6">
                            <Shield className="w-12 h-12 text-slate-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-700 mb-3">No roles found</h3>
                        <p className="text-gray-500 max-w-md mb-8">Create your first role to manage permissions for your team.</p>
                        <button
                            onClick={openNewRoleModal}
                            className="px-8 py-4 rounded-full font-bold text-white flex items-center gap-3 bg-[#0F4C75] hover:bg-[#0b3c5d] transition-all active:scale-[0.98] shadow-lg"
                        >
                            <Plus className="w-5 h-5" />
                            Create Role
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredRoles.map((role) => (
                            <div
                                key={role._id}
                                className="group relative bg-white rounded-2xl border-2 border-slate-100 hover:border-slate-200 transition-all hover:shadow-xl cursor-pointer overflow-hidden"
                                onClick={() => openEditModal(role)}
                            >
                                {/* Gradient top bar */}
                                <div 
                                    className="h-2 w-full"
                                    style={{ background: `linear-gradient(90deg, ${role.color}, ${role.color}88)` }}
                                />

                                <div className="p-4">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
                                                style={{ backgroundColor: role.color }}
                                            >
                                                {ROLE_ICONS[role.icon || 'User'] || <User className="w-6 h-6" />}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                                    {role.name}
                                                    {role.isSystem && (
                                                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                                                    )}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Badge 
                                                        variant={role.isActive ? 'success' : 'default'}
                                                        className="text-[10px]"
                                                    >
                                                        {role.isActive ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                    {role.employeeCount ? (
                                                        <span className="text-xs text-slate-400 flex items-center gap-1">
                                                            <Users className="w-3 h-3" />
                                                            {role.employeeCount}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <p className="text-sm text-slate-500 mb-4 line-clamp-2 min-h-[40px]">
                                        {role.description || 'No description'}
                                    </p>

                                    {/* Permission summary */}
                                    <div className="flex flex-wrap gap-1.5">
                                        {role.name === 'Super Admin' ? (
                                            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg font-medium">
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                                Full Access (Bypasses All Checks)
                                            </div>
                                        ) : (
                                            <>
                                                {role.permissions?.slice(0, 4).map((p, index) => (
                                                    <span
                                                        key={`${role._id}-${p.module}-${index}`}
                                                        className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full"
                                                    >
                                                        {MODULE_LABELS[p.module as ModuleKey] || p.module}
                                                    </span>
                                                ))}
                                                {(role.permissions?.length || 0) > 4 && (
                                                    <span key={`${role._id}-more`} className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">
                                                        +{role.permissions!.length - 4} more
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="absolute top-4 right-4 flex gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openEditModal(role);
                                        }}
                                        className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 transition-colors"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    {role.name !== 'Super Admin' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setRoleToDelete(role);
                                                setIsDeleteModalOpen(true);
                                            }}
                                            className="w-8 h-8 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Add new role card */}
                        <button
                            onClick={openNewRoleModal}
                            className="h-48 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 hover:text-[#0F4C75] hover:border-[#0F4C75] transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-slate-100 group-hover:bg-[#0F4C75]/10 flex items-center justify-center mb-3 transition-colors">
                                <Plus className="w-6 h-6" />
                            </div>
                            <span className="font-medium">Create New Role</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Role Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={selectedRole ? `Role: ${selectedRole.name}` : 'Create New Role'}
                maxWidth="6xl"
                // No footer passed here, handled by RoleForm
            >
                <div className="h-[70vh] flex flex-col">
                    <RoleForm 
                        initialData={selectedRole}
                        onSave={handleSave}
                        onCancel={() => setIsModalOpen(false)}
                        onDelete={(role) => {
                            setRoleToDelete(role);
                            setIsDeleteModalOpen(true);
                        }}
                        isSaving={saving}
                    />
                </div>
            </Modal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Delete Role"
                message={`Are you sure you want to delete the role "${roleToDelete?.name}"? This action cannot be undone.`}
                confirmText="Delete Role"
            />
        </div>
    );
}
