'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
    Shield, Plus, Pencil, Trash2, Users, Eye, ShieldCheck, Copy,
    ChevronDown, ChevronRight, Check, X, Search, Save, ArrowLeft,
    UserCog, User, Lock, AlertTriangle, Settings, Key, History,
    Package, FileText, Calculator, Calendar, DollarSign, MoreVertical,
    ClipboardCheck, Truck, Wrench, BarChart, MessageSquare, Home,
    Briefcase, Globe, Building2, UserCheck, Filter, RefreshCw
} from 'lucide-react';
import { Header, Modal, Input, Badge, ConfirmModal, SearchInput } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import {
    MODULES,
    ACTIONS,
    DATA_SCOPE,
    MODULE_LABELS,
    ACTION_LABELS,
    PERMISSION_GROUPS,
    ModuleKey,
    ActionKey,
    DataScopeKey,
    ModulePermission,
    IRole,
    MODULE_FIELDS,
} from '@/lib/permissions/types';

// Icon mapping for roles
const ROLE_ICONS: Record<string, React.ReactNode> = {
    Shield: <Shield className="w-5 h-5" />,
    UserCog: <UserCog className="w-5 h-5" />,
    Users: <Users className="w-5 h-5" />,
    User: <User className="w-5 h-5" />,
    Eye: <Eye className="w-5 h-5" />,
    Lock: <Lock className="w-5 h-5" />,
    Settings: <Settings className="w-5 h-5" />,
};

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
};

// Module icon colors
const MODULE_COLORS: Record<string, string> = {
    dashboard: '#3b82f6',
    clients: '#06b6d4',
    employees: '#10b981',
    leads: '#f59e0b',
    roles: '#ef4444',
    catalogue: '#8b5cf6',
    templates: '#6366f1',
    estimates: '#ec4899',
    schedules: '#14b8a6',
    time_cards: '#84cc16',
    quickbooks: '#22c55e',
};

interface RoleWithCount extends IRole {
    employeeCount?: number;
}

// Toggle Switch Component
function ToggleSwitch({ 
    checked, 
    onChange, 
    disabled = false,
    size = 'md'
}: { 
    checked: boolean; 
    onChange: () => void; 
    disabled?: boolean;
    size?: 'sm' | 'md';
}) {
    const sizeClasses = size === 'sm' 
        ? 'w-8 h-4' 
        : 'w-10 h-5';
    const dotSize = size === 'sm'
        ? 'w-3 h-3'
        : 'w-4 h-4';
    const dotTranslate = size === 'sm'
        ? 'translate-x-4'
        : 'translate-x-5';

    return (
        <button
            onClick={onChange}
            disabled={disabled}
            className={`relative inline-flex items-center rounded-full transition-colors duration-200 ${sizeClasses} ${
                disabled 
                    ? 'bg-slate-100 cursor-not-allowed' 
                    : checked 
                        ? 'bg-blue-500' 
                        : 'bg-slate-300 hover:bg-slate-400'
            }`}
        >
            <span
                className={`inline-block ${dotSize} transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    checked ? dotTranslate : 'translate-x-0.5'
                }`}
            />
        </button>
    );
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
    const [activeTab, setActiveTab] = useState<'general' | 'permissions' | 'data-scope' | 'users' | 'audit'>('general');
    const [selectedModule, setSelectedModule] = useState<ModuleKey | null>(null);
    const [moduleFilter, setModuleFilter] = useState<string>('all');
    const [dataScopeModule, setDataScopeModule] = useState<ModuleKey | null>(null);

    // Form state for editing
    const [editForm, setEditForm] = useState({
        name: '',
        description: '',
        color: '#3b82f6',
        icon: 'User',
        isActive: true,
        permissions: [] as ModulePermission[],
    });

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
        setEditForm({
            name: role.name,
            description: role.description || '',
            color: role.color || '#3b82f6',
            icon: role.icon || 'User',
            isActive: role.isActive,
            permissions: role.permissions || [],
        });
        setActiveTab('general');
        setSelectedModule(null);
        setIsModalOpen(true);
    };

    // Create new role
    const openNewRoleModal = () => {
        setSelectedRole(null);
        setEditForm({
            name: '',
            description: '',
            color: '#3b82f6',
            icon: 'User',
            isActive: true,
            permissions: [],
        });
        setActiveTab('general');
        setIsModalOpen(true);
    };

    // Save role
    const handleSave = async () => {
        if (!editForm.name.trim()) {
            showError('Role name is required');
            return;
        }

        setSaving(true);
        try {
            const method = selectedRole ? 'PUT' : 'POST';
            const body = selectedRole 
                ? { id: selectedRole._id, ...editForm }
                : editForm;

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
        if (!roleToDelete) return;

        try {
            const res = await fetch(`/api/roles?id=${roleToDelete._id}`, {
                method: 'DELETE',
            });

            const data = await res.json();
            if (data.success) {
                success('Role deleted successfully');
                fetchRoles();
            } else {
                showError(data.error || 'Failed to delete role');
            }
        } catch (err) {
            showError('Failed to delete role');
        }

        setIsDeleteModalOpen(false);
        setRoleToDelete(null);
    };

    // Check if action is enabled
    const hasAction = (module: ModuleKey, action: ActionKey): boolean => {
        const perm = editForm.permissions.find(p => p.module === module);
        return perm?.actions.includes(action) ?? false;
    };

    // Toggle permission
    const togglePermission = (module: ModuleKey, action: ActionKey) => {
        const perms = [...editForm.permissions];
        const idx = perms.findIndex(p => p.module === module);

        if (idx >= 0) {
            const current = perms[idx];
            if (current.actions.includes(action)) {
                current.actions = current.actions.filter(a => a !== action);
                if (current.actions.length === 0) {
                    perms.splice(idx, 1);
                }
            } else {
                current.actions.push(action);
            }
        } else {
            perms.push({
                module,
                actions: [action],
                dataScope: DATA_SCOPE.SELF,
            });
        }

        setEditForm({ ...editForm, permissions: perms });
    };

    // Get data scope for module
    const getDataScope = (module: ModuleKey): DataScopeKey => {
        const perm = editForm.permissions.find(p => p.module === module);
        return perm?.dataScope || DATA_SCOPE.SELF;
    };

    // Set data scope
    const setDataScope = (module: ModuleKey, scope: DataScopeKey) => {
        const perms = [...editForm.permissions];
        const idx = perms.findIndex(p => p.module === module);

        if (idx >= 0) {
            perms[idx].dataScope = scope;
        } else {
            perms.push({
                module,
                actions: [ACTIONS.VIEW],
                dataScope: scope,
            });
        }

        setEditForm({ ...editForm, permissions: perms });
    };

    // Filter modules
    const filteredModules = useMemo(() => {
        const allModules = Object.values(MODULES);
        if (moduleFilter === 'all') return allModules;
        
        const group = PERMISSION_GROUPS[moduleFilter as keyof typeof PERMISSION_GROUPS];
        return group ? group.modules : allModules;
    }, [moduleFilter]);

    // Color presets
    const colorPresets = [
        '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
        '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b',
        '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
        '#06b6d4', '#0ea5e9', '#64748b',
    ];

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
                footer={
                    <div className="flex items-center justify-between w-full">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                        >
                            Cancel
                        </button>
                        <div className="flex items-center gap-2">
                            {selectedRole && selectedRole.name !== 'Super Admin' && (
                                <button
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        setRoleToDelete(selectedRole);
                                        setIsDeleteModalOpen(true);
                                    }}
                                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                                >
                                    Delete Role
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saving || selectedRole?.name === 'Super Admin'}
                                className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2 transition-all"
                            >
                                {saving ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                }
            >
                <div className="flex flex-col">
                    {/* Tabs */}
                    <div className="flex gap-6 border-b border-slate-200 p-4">
                        {[
                            { id: 'general', label: 'General Info', icon: Settings },
                            { id: 'permissions', label: 'Permissions', icon: Shield },
                            { id: 'data-scope', label: 'Data Scope', icon: Globe },
                            { id: 'users', label: 'Assigned Users', icon: Users },
                            { id: 'audit', label: 'Audit Log', icon: History },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                className={`flex items-center gap-2 pb-3 border-b-2 transition-colors ${
                                    activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span className="font-medium">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Super Admin Warning */}
                    {selectedRole?.name === 'Super Admin' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-amber-800">Super Admin Role</h4>
                                <p className="text-sm text-amber-600 mt-1">
                                    This role bypasses all permission checks. Users with this role have unrestricted access to all modules and data.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* General Tab */}
                    {activeTab === 'general' && (
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Role Name *</label>
                                    <Input
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        placeholder="e.g., Sales Manager"
                                        disabled={selectedRole?.isSystem}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                    <textarea
                                        value={editForm.description}
                                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                        placeholder="Brief description of this role's purpose..."
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                                        rows={3}
                                    />
                                </div>
                                <div className="flex items-center justify-between py-3 border-t border-slate-100">
                                    <div>
                                        <p className="font-medium text-slate-900">Active Status</p>
                                        <p className="text-sm text-slate-500">Enable or disable this role</p>
                                    </div>
                                    <ToggleSwitch
                                        checked={editForm.isActive}
                                        onChange={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
                                    <div className="flex flex-wrap gap-2">
                                        {colorPresets.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setEditForm({ ...editForm, color })}
                                                className={`w-8 h-8 rounded-lg transition-all hover:scale-110 ${
                                                    editForm.color === color ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                                                }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Icon</label>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(ROLE_ICONS).map(([name, icon]) => (
                                            <button
                                                key={name}
                                                onClick={() => setEditForm({ ...editForm, icon: name })}
                                                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                                                    editForm.icon === name
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Permissions Tab */}
                    {activeTab === 'permissions' && selectedRole?.name !== 'Super Admin' && (
                        <div className="flex gap-6">
                            {/* Permissions Matrix */}
                            <div className="flex-1">
                                {/* Filter Bar */}
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex gap-2">
                                        {['all', 'CRM', 'JOBS', 'DOCS', 'SETTINGS'].map(filter => (
                                            <button
                                                key={filter}
                                                onClick={() => setModuleFilter(filter)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                                    moduleFilter === filter
                                                        ? 'bg-slate-900 text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}
                                            >
                                                {filter === 'all' ? 'All Modules' : filter}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Permission Table */}
                                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden max-h-[400px] overflow-y-auto">
                                    <table className="w-full">
                                        <thead className="sticky top-0 bg-slate-100">
                                            <tr className="border-b border-slate-200">
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Module</th>
                                                {Object.values(ACTIONS).slice(0, 6).map(action => (
                                                    <th key={action} className="text-center py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">
                                                        {ACTION_LABELS[action]}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            {filteredModules.map((module) => (
                                                <tr key={module} className="border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div 
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
                                                                style={{ backgroundColor: MODULE_COLORS[module] || '#64748b' }}
                                                            >
                                                                {MODULE_ICONS[module] || <Package className="w-3.5 h-3.5" />}
                                                            </div>
                                                            <span className="font-medium text-slate-700 text-sm">{MODULE_LABELS[module]}</span>
                                                        </div>
                                                    </td>
                                                    {Object.values(ACTIONS).slice(0, 6).map(action => (
                                                        <td key={action} className="text-center py-3 px-2">
                                                            {module === 'dashboard' && action !== 'view' ? (
                                                                <span className="text-slate-300">—</span>
                                                            ) : (
                                                                <div className="flex justify-center">
                                                                    <ToggleSwitch
                                                                        checked={hasAction(module, action)}
                                                                        onChange={() => togglePermission(module, action)}
                                                                        size="sm"
                                                                    />
                                                                </div>
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Module Detail Panel */}
                            {selectedModule && (
                                <div className="w-72 bg-slate-50 rounded-xl border border-slate-200 p-4 h-fit">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-semibold text-slate-900">{MODULE_LABELS[selectedModule]}</h3>
                                        <button onClick={() => setSelectedModule(null)} className="text-slate-400 hover:text-slate-600">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {/* Add module-specific settings here */}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Data Scope Tab - Field Level Permissions */}
                    {activeTab === 'data-scope' && selectedRole?.name !== 'Super Admin' && (
                        <div className="space-y-6">
                            {/* Info Banner */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                                <Eye className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-blue-800">Field-Level Visibility</h4>
                                    <p className="text-sm text-blue-600 mt-1">
                                        Control which fields are visible for this role. Hidden fields can still be granted to specific users via User Overrides.
                                    </p>
                                </div>
                            </div>

                            {/* Module Tabs for Field Permissions */}
                            {(() => {
                                // Only show modules that have permissions enabled
                                const enabledModules = editForm.permissions
                                    .filter(p => p.actions.length > 0)
                                    .map(p => p.module);
                                
                                if (enabledModules.length === 0) {
                                    return (
                                        <div className="text-center py-12 bg-slate-50 rounded-xl">
                                            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                            <p className="text-slate-500 font-medium">No modules with permissions</p>
                                            <p className="text-sm text-slate-400 mt-1">Enable permissions for modules in the Permissions tab first.</p>
                                        </div>
                                    );
                                }

                                // Use the first enabled module if current selection is not valid
                                const activeModule = (dataScopeModule && enabledModules.includes(dataScopeModule)) 
                                    ? dataScopeModule 
                                    : enabledModules[0];
                                const currentModuleFields = MODULE_FIELDS[activeModule] || [];
                                const currentPerm = editForm.permissions.find(p => p.module === activeModule);
                                const fieldPerms = currentPerm?.fieldPermissions || [];
                                
                                // Check if field has permission
                                const hasFieldPerm = (field: string, action: 'view' | 'create' | 'update' | 'delete') => {
                                    const fp = fieldPerms.find(f => f.field === field);
                                    return fp?.actions.includes(action) ?? true; // Default to true (visible)
                                };

                                // Toggle field permission
                                const toggleFieldPerm = (field: string, action: 'view' | 'create' | 'update' | 'delete') => {
                                    const perms = [...editForm.permissions];
                                    const modIdx = perms.findIndex(p => p.module === activeModule);
                                    
                                    if (modIdx >= 0) {
                                        const currentFieldPerms = perms[modIdx].fieldPermissions || [];
                                        const fieldIdx = currentFieldPerms.findIndex(f => f.field === field);
                                        
                                        if (fieldIdx >= 0) {
                                            // Toggle the action
                                            const actions = currentFieldPerms[fieldIdx].actions;
                                            if (actions.includes(action)) {
                                                currentFieldPerms[fieldIdx].actions = actions.filter(a => a !== action);
                                            } else {
                                                currentFieldPerms[fieldIdx].actions = [...actions, action];
                                            }
                                        } else {
                                            // Create new field permission with this action disabled (remove from default all)
                                            currentFieldPerms.push({
                                                field,
                                                actions: ['view', 'create', 'update', 'delete'].filter(a => a !== action) as any
                                            });
                                        }
                                        
                                        perms[modIdx].fieldPermissions = currentFieldPerms;
                                        setEditForm({ ...editForm, permissions: perms });
                                    }
                                };

                                // Format field name for display
                                const formatFieldName = (field: string) => {
                                    return field
                                        .replace(/([A-Z])/g, ' $1')
                                        .replace(/^./, str => str.toUpperCase())
                                        .replace(/_/g, ' ');
                                };

                                return (
                                    <div className="flex gap-6">
                                        {/* Module Sidebar */}
                                        <div className="w-56 flex-shrink-0">
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Modules</p>
                                            <div className="space-y-1 max-h-[400px] overflow-y-auto">
                                                {enabledModules.map(mod => (
                                                    <button
                                                        key={mod}
                                                        onClick={() => setDataScopeModule(mod)}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                                                            activeModule === mod
                                                                ? 'bg-blue-500 text-white'
                                                                : 'bg-white text-slate-700 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                                            activeModule === mod ? 'bg-white/20' : 'bg-slate-100'
                                                        }`}>
                                                            {MODULE_ICONS[mod] || <Package className="w-3.5 h-3.5" />}
                                                        </div>
                                                        <span className="font-medium text-sm">{MODULE_LABELS[mod]}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Field Permissions Grid */}
                                        <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                            <div className="p-4 border-b border-slate-200 bg-white">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div 
                                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                                                            style={{ backgroundColor: MODULE_COLORS[activeModule] || '#64748b' }}
                                                        >
                                                            {MODULE_ICONS[activeModule] || <Package className="w-5 h-5" />}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-slate-900">{MODULE_LABELS[activeModule]}</h3>
                                                            <p className="text-xs text-slate-500">{currentModuleFields.length} fields</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={() => {
                                                                // Enable all fields
                                                                const perms = [...editForm.permissions];
                                                                const modIdx = perms.findIndex(p => p.module === activeModule);
                                                                if (modIdx >= 0) {
                                                                    perms[modIdx].fieldPermissions = [];
                                                                    setEditForm({ ...editForm, permissions: perms });
                                                                }
                                                            }}
                                                            className="px-3 py-1.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                                                        >
                                                            Show All
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                // Hide all fields
                                                                const perms = [...editForm.permissions];
                                                                const modIdx = perms.findIndex(p => p.module === activeModule);
                                                                if (modIdx >= 0) {
                                                                    perms[modIdx].fieldPermissions = currentModuleFields.map(f => ({
                                                                        field: f,
                                                                        actions: []
                                                                    }));
                                                                    setEditForm({ ...editForm, permissions: perms });
                                                                }
                                                            }}
                                                            className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                                                        >
                                                            Hide All
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {currentModuleFields.length === 0 ? (
                                                <div className="text-center py-12">
                                                    <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                                    <p className="text-slate-500">No configurable fields for this module</p>
                                                </div>
                                            ) : (
                                                <div className="max-h-[350px] overflow-y-auto">
                                                    <table className="w-full">
                                                        <thead className="sticky top-0 bg-slate-100">
                                                            <tr className="border-b border-slate-200">
                                                                <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Field</th>
                                                                <th className="text-center py-2.5 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">View</th>
                                                                <th className="text-center py-2.5 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Edit</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white">
                                                            {currentModuleFields.map((field, idx) => (
                                                                <tr key={field} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                                    <td className="py-2.5 px-4">
                                                                        <span className="font-medium text-sm text-slate-700">{formatFieldName(field)}</span>
                                                                        <code className="ml-2 text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{field}</code>
                                                                    </td>
                                                                    <td className="text-center py-2.5 px-2">
                                                                        <div className="flex justify-center">
                                                                            <ToggleSwitch
                                                                                checked={hasFieldPerm(field, 'view')}
                                                                                onChange={() => toggleFieldPerm(field, 'view')}
                                                                                size="sm"
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                    <td className="text-center py-2.5 px-2">
                                                                        <div className="flex justify-center">
                                                                            <ToggleSwitch
                                                                                checked={hasFieldPerm(field, 'update')}
                                                                                onChange={() => toggleFieldPerm(field, 'update')}
                                                                                size="sm"
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Users Tab */}
                    {activeTab === 'users' && (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500">No users assigned to this role yet.</p>
                            <button className="mt-3 text-blue-500 font-medium hover:underline flex items-center gap-1 mx-auto">
                                <Plus className="w-4 h-4" />
                                Add first user
                            </button>
                        </div>
                    )}

                    {/* Audit Tab */}
                    {activeTab === 'audit' && (
                        <div className="text-center py-12">
                            <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500">No audit history available yet.</p>
                            <p className="text-sm text-slate-400 mt-1">Changes to this role will be logged here.</p>
                        </div>
                    )}
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
