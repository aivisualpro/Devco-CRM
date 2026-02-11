'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
    Shield, Plus, Pencil, Trash2, Users, Eye, ShieldCheck, Copy,
    ChevronDown, ChevronRight, Check, X, Search, Save, ArrowLeft,
    UserCog, User, Lock, AlertTriangle, Settings, Key, History,
    Package, FileText, Calculator, Calendar, DollarSign, MoreVertical,
    ClipboardCheck, Truck, Wrench, BarChart, MessageSquare, Home,
    Briefcase, Globe, Building2, UserCheck, Filter, RefreshCw, Contact
} from 'lucide-react';
import { 
    Form, 
    FormControl, 
    FormField, 
    FormItem, 
    FormLabel, 
    FormMessage,
    FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/switch';
import {
    MODULES,
    ACTIONS,
    DATA_SCOPE,
    MODULE_LABELS,
    ACTION_LABELS,
    PERMISSION_GROUPS,
    MODULE_FIELDS,
    ModuleKey,
    ActionKey,
    DataScopeKey,
    ModulePermission,
    IRole,
} from '@/lib/permissions/types';

// Icons mapping
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
    contacts: <Contact className="w-4 h-4" />,
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
    receipts_costs: <DollarSign className="w-4 h-4" />,
    vehicle_equipment: <Truck className="w-4 h-4" />,
};

// Module icon colors
const MODULE_COLORS: Record<string, string> = {
    dashboard: '#3b82f6',
    clients: '#06b6d4',
    employees: '#10b981',
    contacts: '#f59e0b',
    roles: '#ef4444',
    catalogue: '#8b5cf6',
    templates: '#6366f1',
    estimates: '#ec4899',
    schedules: '#14b8a6',
    time_cards: '#84cc16',
    quickbooks: '#22c55e',
    vehicle_equipment: '#d97706',
};

// Color presets
const COLOR_PRESETS = [
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
    '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b',
    '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#64748b',
];

const roleFormSchema = z.object({
    name: z.string().min(1, 'Role name is required'),
    description: z.string().optional(),
    color: z.string().default('#3b82f6'),
    icon: z.string().default('User'),
    isActive: z.boolean().default(true),
    permissions: z.array(z.any()).default([]),
});

type RoleFormValues = z.infer<typeof roleFormSchema>;

interface RoleFormProps {
    initialData?: IRole | null;
    onSave: (data: RoleFormValues) => Promise<void>;
    onCancel: () => void;
    onDelete?: (role: IRole) => void;
    isSaving?: boolean;
}

export function RoleForm({ initialData, onSave, onCancel, onDelete, isSaving = false }: RoleFormProps) {
    const [activeTab, setActiveTab] = useState<'general' | 'permissions' | 'data-scope'>('general');
    const [moduleFilter, setModuleFilter] = useState<string>('all');
    const [dataScopeModule, setDataScopeModule] = useState<ModuleKey | null>(null);

    const form = useForm<RoleFormValues>({
        resolver: zodResolver(roleFormSchema) as any,
        defaultValues: {
            name: initialData?.name || '',
            description: initialData?.description || '',
            color: initialData?.color || '#3b82f6',
            icon: initialData?.icon || 'User',
            isActive: initialData?.isActive ?? true,
            permissions: initialData?.permissions || [],
        },
    });

    const permissions = form.watch('permissions');

    const updatePermissions = (newPermissions: ModulePermission[]) => {
        form.setValue('permissions', newPermissions, { shouldDirty: true });
    };

    const handleTogglePermission = (module: ModuleKey, action: ActionKey) => {
        const currentPerms = [...(permissions || [])] as ModulePermission[];
        const idx = currentPerms.findIndex(p => p.module === module);

        if (idx >= 0) {
            const current = { ...currentPerms[idx] };
            if (current.actions.includes(action)) {
                // If turning off VIEW, remove all permissions for this module
                if (action === ACTIONS.VIEW) {
                    currentPerms.splice(idx, 1);
                } else {
                    current.actions = current.actions.filter(a => a !== action);
                    if (current.actions.length === 0) {
                        currentPerms.splice(idx, 1);
                    } else {
                        currentPerms[idx] = current;
                    }
                }
            } else {
                current.actions = [...current.actions, action];
                // Optional: If enabling an action, ensure VIEW is also enabled?
                // For now, adhering strictly to "auto turn off" rule.
                currentPerms[idx] = current;
            }
        } else {
            currentPerms.push({
                module,
                actions: [action],
                dataScope: DATA_SCOPE.SELF,
            });
        }
        updatePermissions(currentPerms);
    };

    const hasAction = (module: ModuleKey, action: ActionKey): boolean => {
        const perm = (permissions as ModulePermission[])?.find(p => p.module === module);
        return perm?.actions.includes(action) ?? false;
    };

    const getModuleDataScope = (module: ModuleKey): DataScopeKey => {
        const perm = (permissions as ModulePermission[])?.find(p => p.module === module);
        return perm?.dataScope || DATA_SCOPE.SELF;
    };

    const setModuleDataScope = (module: ModuleKey, scope: DataScopeKey) => {
        const currentPerms = [...(permissions || [])] as ModulePermission[];
        const idx = currentPerms.findIndex(p => p.module === module);
        if (idx >= 0) {
            currentPerms[idx] = { ...currentPerms[idx], dataScope: scope };
            updatePermissions(currentPerms);
        }
    };

    const filteredModules = useMemo(() => {
        const allModules = Object.values(MODULES);
        if (moduleFilter === 'all') return allModules;
        
        const group = PERMISSION_GROUPS[moduleFilter as keyof typeof PERMISSION_GROUPS];
        return group ? group.modules : allModules;
    }, [moduleFilter]);

    // Data Scope Helpers
    const getActiveModuleForDataScope = (): ModuleKey | null => {
        const enabledModules = (permissions || [])
            .filter((p: any) => p.actions && p.actions.length > 0)
            .map((p: any) => p.module as ModuleKey);
        
        if (enabledModules.length === 0) return null;
        
        return (dataScopeModule && enabledModules.includes(dataScopeModule)) 
            ? dataScopeModule 
            : enabledModules[0];
    };

    const activeDataScopeModule = getActiveModuleForDataScope();

    const toggleFieldPerm = (field: string, action: 'view' | 'create' | 'update' | 'delete') => {
        if (!activeDataScopeModule) return;
        const perms = [...permissions] as ModulePermission[];
        const modIdx = perms.findIndex(p => p.module === activeDataScopeModule);
        
        if (modIdx >= 0) {
            const currentFieldPerms = perms[modIdx].fieldPermissions ? [...perms[modIdx].fieldPermissions!] : [];
            const fieldIdx = currentFieldPerms.findIndex(f => f.field === field);
            
            if (fieldIdx >= 0) {
                const actions = currentFieldPerms[fieldIdx].actions;
                if (actions.includes(action)) {
                    // If turning off VIEW, remove all other actions too
                    if (action === 'view') {
                        currentFieldPerms[fieldIdx].actions = []; // Clear all
                    } else {
                        currentFieldPerms[fieldIdx].actions = actions.filter(a => a !== action);
                    }
                } else {
                    // If turning on query/update/delete, View must be on? 
                    // User requirement: "if view is turned off, edit and delete should be turned off"
                    // Implies we can't have Edit/Delete without View.
                    // Let's auto-enable View if Edit/Delete is turned on, just in case, 
                    // though UI will disable the toggles so this might not be reached.
                    
                    let newActions = [...actions, action];
                    if (action !== 'view' && !actions.includes('view')) {
                         newActions.push('view');
                    }
                    currentFieldPerms[fieldIdx].actions = newActions;
                }
            } else {
                // Creating new field permission
                // If adding non-view action, must include view
                const initialActions = [action];
                if (action !== 'view') initialActions.push('view');
                
                currentFieldPerms.push({
                    field,
                    actions: initialActions as any
                });
            }
            
            perms[modIdx] = { ...perms[modIdx], fieldPermissions: currentFieldPerms };
            updatePermissions(perms);
        }
    };

    const hasFieldPerm = (field: string, action: 'view' | 'create' | 'update' | 'delete') => {
        if (!activeDataScopeModule) return true;
        const perm = (permissions as ModulePermission[]).find(p => p.module === activeDataScopeModule);
        const fp = perm?.fieldPermissions?.find(f => f.field === field);
        return fp?.actions.includes(action) ?? true;
    };

    const getFieldDataScope = (field: string) => {
        if (!activeDataScopeModule) return 'self';
        const perm = (permissions as ModulePermission[]).find(p => p.module === activeDataScopeModule);
        const fp = perm?.fieldPermissions?.find(f => f.field === field);
        return fp?.dataScope || 'self';
    };

    const setFieldDataScope = (field: string, scope: 'self' | 'all') => {
        if (!activeDataScopeModule) return;
        const perms = [...permissions] as ModulePermission[];
        const modIdx = perms.findIndex(p => p.module === activeDataScopeModule);
        
        if (modIdx >= 0) {
            const currentFieldPerms = perms[modIdx].fieldPermissions ? [...perms[modIdx].fieldPermissions!] : [];
            const fieldIdx = currentFieldPerms.findIndex(f => f.field === field);
            
            if (fieldIdx >= 0) {
                currentFieldPerms[fieldIdx].dataScope = scope;
            } else {
                currentFieldPerms.push({
                    field,
                    actions: ['view'],
                    dataScope: scope
                });
            }
            
            perms[modIdx] = { ...perms[modIdx], fieldPermissions: currentFieldPerms };
            updatePermissions(perms);
        }
    };

    const formatFieldName = (field: string) => {
        return field
            .replace(/^widget_/, '')
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/_/g, ' ');
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="flex flex-col h-full overflow-hidden">
                <div className="flex flex-1 h-full overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-64 border-r border-slate-200 bg-slate-50/50 p-4 flex flex-col gap-2 shrink-0 overflow-y-auto">
                        {[
                            { id: 'general', label: 'General Info', icon: Settings },
                            { id: 'permissions', label: 'Permissions', icon: Shield },
                            { id: 'data-scope', label: 'Data Scope', icon: Globe },
                        ].map(tab => (
                            <div key={tab.id} className="flex flex-col gap-1">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${
                                        activeTab === tab.id
                                            ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                                            : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                                    }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    <span>{tab.label}</span>
                                </button>
                                
                                {tab.id === 'permissions' && activeTab === 'permissions' && (
                                    <div className="pl-4 flex flex-col gap-1 mt-1 border-l-2 border-slate-100 ml-4">
                                        {['all', 'CRM', 'JOBS', 'DOCS', 'REPORTS', 'SETTINGS'].map(filter => (
                                            <button
                                                key={filter}
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setModuleFilter(filter);
                                                }}
                                                className={`text-left px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                                    moduleFilter === filter
                                                        ? 'bg-slate-200 text-slate-900 border-l-2 border-blue-500 rounded-none' // custom active style
                                                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                                }`}
                                                style={moduleFilter === filter ? { borderLeftWidth: '2px', borderLeftColor: '#3b82f6', borderRadius: '0 4px 4px 0', backgroundColor: '#f1f5f9' } : {}}
                                            >
                                                {filter === 'all' ? 'All Modules' : filter}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex flex-col min-w-0 bg-white">
                        <div className="flex-1 p-6 overflow-y-auto">
                    {initialData?.name === 'Super Admin' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-6">
                            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-amber-800">Super Admin Role</h4>
                                <p className="text-sm text-amber-600 mt-1">
                                    This role bypasses all permission checks.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'general' && (
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <FormField<RoleFormValues>
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Role Name *</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    {...field} 
                                                    placeholder="e.g., Sales Manager" 
                                                    disabled={initialData?.isSystem}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField<RoleFormValues>
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Description</FormLabel>
                                            <FormControl>
                                                <textarea
                                                    {...field}
                                                    placeholder="Brief description..."
                                                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                                    rows={3}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />


                            </div>

                            <div className="space-y-6">
                                <FormField<RoleFormValues>
                                    control={form.control}
                                    name="color"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Color</FormLabel>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {COLOR_PRESETS.map(color => (
                                                    <button
                                                        key={color}
                                                        type="button"
                                                        onClick={() => field.onChange(color)}
                                                        className={`w-8 h-8 rounded-lg transition-all hover:scale-110 ${
                                                            field.value === color ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                                                        }`}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField<RoleFormValues>
                                    control={form.control}
                                    name="icon"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Icon</FormLabel>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {Object.entries(ROLE_ICONS).map(([name, icon]) => (
                                                    <button
                                                        key={name}
                                                        type="button"
                                                        onClick={() => field.onChange(name)}
                                                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                                                            field.value === name
                                                                ? 'bg-blue-500 text-white'
                                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                        }`}
                                                    >
                                                        {icon}
                                                    </button>
                                                ))}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'permissions' && initialData?.name !== 'Super Admin' && (
                        <div className="flex gap-6">
                            <div className="flex-1">
                                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden max-h-[400px] overflow-y-auto">
                                    <table className="w-full">
                                        <thead className="sticky top-0 bg-slate-100 z-10">
                                            <tr className="border-b border-slate-200">
                                                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Module</th>
                                                {[ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE].map(action => (
                                                    <th key={action} className="text-center py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">
                                                        {ACTION_LABELS[action]}
                                                    </th>
                                                ))}
                                                <th className="text-center py-3 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Self/All</th>
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
                                                    {[ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.DELETE].map(action => (
                                                        <td key={action} className="text-center py-3 px-2">
                                                            {/* Logic to hide non-view actions for specific modules */}
                                                            {
                                                                ((module === 'dashboard' || module === 'contacts') && action !== 'view') || 
                                                                (PERMISSION_GROUPS['REPORTS'].modules.includes(module as any) && action !== 'view') ? (
                                                                <span className="text-slate-300">—</span>
                                                            ) : (
                                                                <div className="flex justify-center">
                                                                    <Switch
                                                                        checked={hasAction(module, action)}
                                                                        onCheckedChange={() => handleTogglePermission(module, action)}
                                                                        className="scale-75"
                                                                    />
                                                                </div>
                                                            )}
                                                        </td>
                                                    ))}
                                                    <td className="text-center py-3 px-2">
                                                        {((module === 'dashboard' || module === 'contacts') ||
                                                            PERMISSION_GROUPS['REPORTS'].modules.includes(module as any)) ? (
                                                            <span className="text-slate-300">—</span>
                                                        ) : (
                                                            <div className="flex justify-center">
                                                                <Switch
                                                                    checked={getModuleDataScope(module) === 'all'}
                                                                    onCheckedChange={(checked) => setModuleDataScope(module, checked ? DATA_SCOPE.ALL : DATA_SCOPE.SELF)}
                                                                    disabled={!hasAction(module, ACTIONS.VIEW)}
                                                                    className={`scale-75 ${!hasAction(module, ACTIONS.VIEW) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                />
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'data-scope' && initialData?.name !== 'Super Admin' && (
                        <div className="space-y-6">


                            {!activeDataScopeModule ? (
                                <div className="text-center py-12 bg-slate-50 rounded-xl">
                                    <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-500 font-medium">No modules with permissions</p>
                                    <p className="text-sm text-slate-400 mt-1">Enable permissions for modules in the Permissions tab first.</p>
                                </div>
                            ) : (
                                <div className="flex gap-6 h-[400px]">
                                    <div className="w-56 flex-shrink-0 flex flex-col">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Modules</p>
                                        <div className="space-y-1 overflow-y-auto flex-1">
                                        {(permissions || [])
                                                .filter((p: any) => p.actions && p.actions.length > 0)
                                                .map((p: any) => p.module as ModuleKey)
                                                .filter((mod: ModuleKey) => mod !== 'chat') // Chat is a Dashboard widget, not a standalone module
                                                .map((mod: ModuleKey) => (
                                                <button
                                                    key={mod}
                                                    type="button"
                                                    onClick={() => setDataScopeModule(mod)}
                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                                                        activeDataScopeModule === mod
                                                            ? 'bg-blue-500 text-white'
                                                            : 'bg-white text-slate-700 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                                        activeDataScopeModule === mod ? 'bg-white/20' : 'bg-slate-100'
                                                    }`}>
                                                        {MODULE_ICONS[mod] || <Package className="w-3.5 h-3.5" />}
                                                    </div>
                                                    <span className="font-medium text-sm truncate">{MODULE_LABELS[mod]}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden flex flex-col">
                                        <div className="p-4 border-b border-slate-200 bg-white shrink-0">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div 
                                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                                                        style={{ backgroundColor: MODULE_COLORS[activeDataScopeModule] || '#64748b' }}
                                                    >
                                                        {MODULE_ICONS[activeDataScopeModule] || <Package className="w-5 h-5" />}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-slate-900">{MODULE_LABELS[activeDataScopeModule]}</h3>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 overflow-y-auto">
                                            <table className="w-full">
                                                <thead className="sticky top-0 bg-slate-100 z-10">
                                                    <tr className="border-b border-slate-200">
                                                        <th className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                                            {activeDataScopeModule === 'dashboard' ? 'Widget' : 'Field'}
                                                        </th>
                                                            <th className="text-center py-2.5 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">View</th>
                                                            <th className="text-center py-2.5 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Edit</th>
                                                            <th className="text-center py-2.5 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Delete</th>
                                                            <th className="text-center py-2.5 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">View All</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white">
                                                        {(MODULE_FIELDS[activeDataScopeModule] || []).map((field: string, idx: number) => {
                                                            const canView = hasFieldPerm(field, 'view');
                                                            const isAll = getFieldDataScope(field) === 'all';
                                                            const noEditDelete = field === 'widget_weekly_snapshot' || field === 'widget_estimates_overview' || field === 'widget_time_cards';
                                                            return (
                                                            <tr key={field} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                                <td className="py-2.5 px-4">
                                                                    <span className="font-medium text-sm text-slate-700">{formatFieldName(field)}</span>
                                                                </td>
                                                                <td className="text-center py-2.5 px-2">
                                                                    <div className="flex justify-center">
                                                                        <Switch
                                                                            checked={canView}
                                                                            onCheckedChange={() => toggleFieldPerm(field, 'view')}
                                                                            className="scale-75"
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="text-center py-2.5 px-2">
                                                                    {noEditDelete ? (
                                                                        <span className="text-slate-300">—</span>
                                                                    ) : (
                                                                    <div className="flex justify-center">
                                                                        <Switch
                                                                            checked={hasFieldPerm(field, 'update')}
                                                                            onCheckedChange={() => toggleFieldPerm(field, 'update')}
                                                                            disabled={!canView}
                                                                            className={`scale-75 ${!canView ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                        />
                                                                    </div>
                                                                    )}
                                                                </td>
                                                                <td className="text-center py-2.5 px-2">
                                                                    {noEditDelete ? (
                                                                        <span className="text-slate-300">—</span>
                                                                    ) : (
                                                                    <div className="flex justify-center">
                                                                        <Switch
                                                                            checked={hasFieldPerm(field, 'delete')}
                                                                            onCheckedChange={() => toggleFieldPerm(field, 'delete')}
                                                                            disabled={!canView}
                                                                            className={`scale-75 ${!canView ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                        />
                                                                    </div>
                                                                    )}
                                                                </td>
                                                                <td className="text-center py-2.5 px-2">
                                                                    <div className="flex justify-center">
                                                                        <Switch
                                                                            checked={isAll}
                                                                            onCheckedChange={(checked) => setFieldDataScope(field, checked ? 'all' : 'self')}
                                                                            disabled={!canView}
                                                                            className={`scale-75 ${!canView ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                        />
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}


                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between border-t border-slate-200 p-4 bg-white shrink-0">
                            <button
                                type="button"
                                onClick={onCancel}
                                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                            >
                                Cancel
                            </button>
                            <div className="flex items-center gap-2">

                                <Button
                                    type="submit"
                                    disabled={isSaving || initialData?.name === 'Super Admin'}
                                    className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium px-6 py-2.5 flex items-center gap-2"
                                >
                                    {isSaving ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </Form>
    );
}
