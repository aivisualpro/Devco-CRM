/**
 * DEVCO CRM Permission System - Types & Constants
 * 
 * Architecture Overview:
 * - Super Admin (appRole === 'Super Admin') bypasses ALL permission checks
 * - RBAC with Roles + Per-User Overrides
 * - Field-level security for view/create/update/delete
 * - Data scope: SELF, DEPARTMENT, ALL
 * - Deny-by-default principle
 */

// =====================================
// MODULES - All pages/sections in the app
// =====================================
export const MODULES = {
    // CRM
    DASHBOARD: 'dashboard',
    CLIENTS: 'clients',
    EMPLOYEES: 'employees',
    CONTACTS: 'contacts',
    ROLES: 'roles',
    
    // JOBS
    CATALOGUE: 'catalogue',
    TEMPLATES: 'templates',
    ESTIMATES: 'estimates',
    SCHEDULES: 'schedules',
    TIME_CARDS: 'time_cards',
    REPORTS_WIP: 'reports_wip',
    
    // DOCS
    JHA: 'jha',
    JOB_TICKETS: 'job_tickets',
    BILLING_TICKETS: 'billing_tickets',
    POTHOLE: 'pothole',
    DAMAGE_REPORT: 'damage_report',
    INCIDENTS: 'incidents',
    PRE_BORE_LOGS: 'pre_bore_logs',
    VEHICLE_SAFETY: 'vehicle_safety',
    LUBRICATION: 'lubrication',
    REPAIR: 'repair',
    SCOPE_CHANGE: 'scope_change',
    RECEIPTS_COSTS: 'receipts_costs',
    VEHICLE_EQUIPMENT: 'vehicle_equipment',
    
    // MISC
    CONSTANTS: 'constants',
    CHAT: 'chat',
    COMPANY_DOCS: 'company_docs',
    
    // REPORTS
    REPORTS_PAYROLL: 'reports_payroll',
    REPORTS_WORK_COMP: 'reports_work_comp',
    REPORTS_FRINGE: 'reports_fringe',
    REPORTS_SALES: 'reports_sales',
    REPORTS_DAILY_ACTIVITY: 'reports_daily_activity',
} as const;

export type ModuleKey = typeof MODULES[keyof typeof MODULES];

// =====================================
// ACTIONS - What can be done on a module
// =====================================
export const ACTIONS = {
    VIEW: 'view',
    CREATE: 'create',
    EDIT: 'edit',
    DELETE: 'delete',
    EXPORT: 'export',
    APPROVE: 'approve',
    ASSIGN: 'assign',
    CHANGE_STATUS: 'change_status',
} as const;

export type ActionKey = typeof ACTIONS[keyof typeof ACTIONS];

// =====================================
// DATA SCOPE - Row-level access control
// =====================================
export const DATA_SCOPE = {
    SELF: 'self',           // Only records created by or assigned to user
    DEPARTMENT: 'department', // Records in user's department/team
    ALL: 'all',             // All records
} as const;

export type DataScopeKey = typeof DATA_SCOPE[keyof typeof DATA_SCOPE];

// =====================================
// FIELD PERMISSIONS
// =====================================
export const FIELD_ACTIONS = {
    VIEW: 'view',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
} as const;

export type FieldActionKey = typeof FIELD_ACTIONS[keyof typeof FIELD_ACTIONS];

// =====================================
// PERMISSION INTERFACES
// =====================================

// Single module permission
export interface ModulePermission {
    module: ModuleKey;
    actions: ActionKey[];
    dataScope: DataScopeKey;
    fieldPermissions?: FieldPermission[];
}

// Field-level permission
export interface FieldPermission {
    field: string;
    actions: FieldActionKey[];
    dataScope?: 'self' | 'all'; // Some fields/widgets support data scope
}

// Role definition
export interface IRole {
    _id?: string;
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    isSystem?: boolean; // System roles cannot be deleted
    isActive: boolean;
    permissions: ModulePermission[];
    createdBy?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

// User permission overrides (can add or restrict)
export interface UserPermissionOverride {
    module: ModuleKey;
    grant?: ActionKey[];      // Additional permissions granted
    revoke?: ActionKey[];     // Permissions revoked from role
    dataScope?: DataScopeKey; // Override data scope
    fieldGrant?: FieldPermission[];  // Additional field permissions
    fieldRevoke?: FieldPermission[]; // Revoked field permissions
}

// Complete user permissions (computed from role + overrides)
export interface UserPermissions {
    userId: string;
    roleId?: string;
    roleName?: string;
    isSuperAdmin: boolean;
    department?: string;
    team?: string;
    modules: ModulePermission[];
    lastUpdated: Date;
}

// =====================================
// MENU STRUCTURE WITH PERMISSIONS
// =====================================
export interface MenuItemPermission {
    label: string;
    href: string;
    module: ModuleKey;
    requiredAction?: ActionKey;
}

export interface MenuGroupPermission {
    label: string;
    items?: MenuItemPermission[];
    href?: string;
    module?: ModuleKey;
}

// =====================================
// DEFAULT ROLES TEMPLATES
// =====================================
export const DEFAULT_ROLES: Partial<IRole>[] = [
    {
        name: 'Super Admin',
        description: 'Full system access - bypasses all permission checks',
        color: '#dc2626',
        icon: 'Shield',
        isSystem: true,
        isActive: true,
        permissions: [], // Empty because Super Admin bypasses checks
    },
    {
        name: 'Admin',
        description: 'Administrative access with most permissions',
        color: '#7c3aed',
        icon: 'UserCog',
        isSystem: true,
        isActive: true,
        permissions: Object.values(MODULES).map(module => ({
            module,
            actions: Object.values(ACTIONS),
            dataScope: DATA_SCOPE.ALL,
        })),
    },
    {
        name: 'Manager',
        description: 'Department management with team oversight',
        color: '#2563eb',
        icon: 'Users',
        isSystem: false,
        isActive: true,
        permissions: Object.values(MODULES).map(module => ({
            module,
            actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT, ACTIONS.EXPORT, ACTIONS.ASSIGN],
            dataScope: DATA_SCOPE.DEPARTMENT,
        })),
    },
    {
        name: 'Staff',
        description: 'Regular employee with basic access',
        color: '#059669',
        icon: 'User',
        isSystem: false,
        isActive: true,
        permissions: [
            { module: MODULES.DASHBOARD, actions: [ACTIONS.VIEW], dataScope: DATA_SCOPE.SELF },
            { module: MODULES.ESTIMATES, actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT], dataScope: DATA_SCOPE.SELF },
            { module: MODULES.SCHEDULES, actions: [ACTIONS.VIEW], dataScope: DATA_SCOPE.SELF },
            { module: MODULES.TIME_CARDS, actions: [ACTIONS.VIEW, ACTIONS.CREATE, ACTIONS.EDIT], dataScope: DATA_SCOPE.SELF },
            { module: MODULES.CHAT, actions: [ACTIONS.VIEW, ACTIONS.CREATE], dataScope: DATA_SCOPE.SELF },
            { module: MODULES.COMPANY_DOCS, actions: [ACTIONS.VIEW], dataScope: DATA_SCOPE.ALL },
        ],
    },
    {
        name: 'Viewer',
        description: 'Read-only access to assigned modules',
        color: '#6b7280',
        icon: 'Eye',
        isSystem: false,
        isActive: true,
        permissions: [
            { module: MODULES.DASHBOARD, actions: [ACTIONS.VIEW], dataScope: DATA_SCOPE.SELF },
            { module: MODULES.ESTIMATES, actions: [ACTIONS.VIEW], dataScope: DATA_SCOPE.ALL },
            { module: MODULES.COMPANY_DOCS, actions: [ACTIONS.VIEW], dataScope: DATA_SCOPE.ALL },
        ],
    },
];

// =====================================
// FIELD DEFINITIONS PER MODULE
// =====================================
export const MODULE_FIELDS: Record<ModuleKey, string[]> = {
    [MODULES.DASHBOARD]: [
        'widget_upcoming_schedules',
        'widget_chat',
        'widget_estimates_overview',
        'widget_time_cards',
        'widget_tasks'
    ],
    [MODULES.CLIENTS]: ['name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'notes', 'status'],
    [MODULES.EMPLOYEES]: [
        'firstName', 'lastName', 'email', 'phone', 'mobile', 'appRole', 'companyPosition', 
        'designation', 'status', 'groupNo', 'hourlyRateSITE', 'hourlyRateDrive', 'dob', 
        'driverLicense', 'address', 'city', 'state', 'zip', 'password', 'profilePicture',
        'applicationResume', 'dateHired', 'separationDate', 'separationReason',
        'employeeHandbook', 'quickbooksW4I9DD', 'workforce', 'emergencyContact',
        'dotRelease', 'dmvPullNotifications', 'drivingRecordPermission', 'backgroundCheck',
        'copyOfDL', 'copyOfSS', 'lcpTracker', 'edd', 'autoInsurance', 'veriforce', 'unionPaperwork1184'
    ],
    [MODULES.CONTACTS]: ['firstName', 'lastName', 'email', 'mobile'],
    [MODULES.ROLES]: ['name', 'description', 'color', 'icon', 'isActive', 'permissions'],
    [MODULES.CATALOGUE]: ['name', 'description', 'category', 'unitCost', 'unit', 'status'],
    [MODULES.TEMPLATES]: ['name', 'description', 'category', 'content', 'isActive'],
    [MODULES.ESTIMATES]: [
        'title', 'client', 'status', 'totalAmount', 'items', 'notes', 'validUntil',
        'assignedTo', 'approvedBy', 'discount', 'tax'
    ],
    [MODULES.SCHEDULES]: ['title', 'date', 'assignedTo', 'status', 'location', 'notes'],
    [MODULES.TIME_CARDS]: ['employee', 'date', 'hoursWorked', 'project', 'status', 'notes'],
    [MODULES.REPORTS_WIP]: ['syncStatus', 'lastSync', 'items'],
    [MODULES.JHA]: ['title', 'date', 'hazards', 'controls', 'status', 'assignedTo'],
    [MODULES.JOB_TICKETS]: ['title', 'date', 'description', 'status', 'assignedTo'],
    [MODULES.BILLING_TICKETS]: ['title', 'amount', 'status', 'client', 'date'],
    [MODULES.POTHOLE]: ['location', 'size', 'status', 'date', 'repairedBy'],
    [MODULES.DAMAGE_REPORT]: ['title', 'description', 'severity', 'status', 'date', 'reportedBy'],
    [MODULES.INCIDENTS]: ['title', 'description', 'severity', 'status', 'date', 'involvedParties'],
    [MODULES.PRE_BORE_LOGS]: ['title', 'location', 'depth', 'date', 'operator'],
    [MODULES.VEHICLE_SAFETY]: ['vehicle', 'checkItems', 'status', 'date', 'inspector'],
    [MODULES.LUBRICATION]: ['equipment', 'lubricant', 'date', 'operator'],
    [MODULES.REPAIR]: ['equipment', 'issue', 'solution', 'status', 'date', 'technician'],
    [MODULES.SCOPE_CHANGE]: ['title', 'description', 'status', 'requestedBy', 'approvedBy', 'date'],
    [MODULES.RECEIPTS_COSTS]: ['vendor', 'date', 'cost', 'description', 'category', 'status', 'approvalStatus'],
    [MODULES.VEHICLE_EQUIPMENT]: ['unit', 'unitNumber', 'vinSerialNumber', 'documents'],
    [MODULES.CONSTANTS]: ['name', 'value', 'category', 'description'],
    [MODULES.CHAT]: ['message', 'attachments'],
    [MODULES.COMPANY_DOCS]: ['title', 'url', 'status'],
    [MODULES.REPORTS_PAYROLL]: [],
    [MODULES.REPORTS_WORK_COMP]: [],
    [MODULES.REPORTS_FRINGE]: [],
    [MODULES.REPORTS_SALES]: [],
    [MODULES.REPORTS_DAILY_ACTIVITY]: [],
};

// =====================================
// PERMISSION GROUPS (for UI organization)
// =====================================
export const PERMISSION_GROUPS = {
    CRM: {
        label: 'CRM & People',
        modules: [MODULES.CLIENTS, MODULES.EMPLOYEES, MODULES.CONTACTS],
        color: '#0F4C75',
    },
    JOBS: {
        label: 'Jobs & Projects',
        modules: [MODULES.CATALOGUE, MODULES.TEMPLATES, MODULES.ESTIMATES, MODULES.SCHEDULES, MODULES.TIME_CARDS],
        color: '#ea580c',
    },
    DOCS: {
        label: 'Documents & Forms',
        modules: [
            MODULES.JHA, MODULES.JOB_TICKETS, MODULES.BILLING_TICKETS, MODULES.POTHOLE,
            MODULES.DAMAGE_REPORT, MODULES.INCIDENTS, MODULES.PRE_BORE_LOGS,
            MODULES.VEHICLE_SAFETY, MODULES.LUBRICATION, MODULES.REPAIR, MODULES.SCOPE_CHANGE,
            MODULES.RECEIPTS_COSTS, MODULES.VEHICLE_EQUIPMENT, MODULES.COMPANY_DOCS
        ],
        color: '#7c3aed',
    },
    SETTINGS: {
        label: 'Settings',
        modules: [MODULES.CONSTANTS, MODULES.ROLES],
        color: '#64748b',
    },
    REPORTS: {
        label: 'Reports & Analytics',
        modules: [MODULES.REPORTS_PAYROLL, MODULES.REPORTS_FRINGE, MODULES.REPORTS_WORK_COMP, MODULES.REPORTS_WIP, MODULES.REPORTS_DAILY_ACTIVITY],
        color: '#059669',
    },
};

// =====================================
// HELPER: Module display names
// =====================================
export const MODULE_LABELS: Record<ModuleKey, string> = {
    [MODULES.DASHBOARD]: 'Dashboard',
    [MODULES.CLIENTS]: 'Clients',
    [MODULES.EMPLOYEES]: 'Employees',
    [MODULES.CONTACTS]: 'Contacts',
    [MODULES.ROLES]: 'Roles & Permissions',
    [MODULES.CATALOGUE]: 'Catalogue',
    [MODULES.TEMPLATES]: 'Templates',
    [MODULES.ESTIMATES]: 'Estimates & Proposals',
    [MODULES.SCHEDULES]: 'Schedules',
    [MODULES.TIME_CARDS]: 'Time Cards',
    [MODULES.REPORTS_WIP]: 'Work in Progress Report',
    [MODULES.JHA]: 'JHA',
    [MODULES.JOB_TICKETS]: 'Job Tickets',
    [MODULES.BILLING_TICKETS]: 'Billing Tickets',
    [MODULES.POTHOLE]: 'Pothole',
    [MODULES.DAMAGE_REPORT]: 'Damage Report',
    [MODULES.INCIDENTS]: 'Incidents',
    [MODULES.PRE_BORE_LOGS]: 'Pre Bore Logs',
    [MODULES.VEHICLE_SAFETY]: 'Vehicle Safety',
    [MODULES.LUBRICATION]: 'Lubrication',
    [MODULES.REPAIR]: 'Repair Report',
    [MODULES.SCOPE_CHANGE]: 'Scope Change',
    [MODULES.RECEIPTS_COSTS]: 'Receipts & Costs',
    [MODULES.VEHICLE_EQUIPMENT]: 'Vehicle Equipment',
    [MODULES.CONSTANTS]: 'Constants',
    [MODULES.CHAT]: 'Chat',
    [MODULES.COMPANY_DOCS]: 'Company Docs',
    [MODULES.REPORTS_PAYROLL]: 'Payroll Report',
    [MODULES.REPORTS_WORK_COMP]: 'Work Comp Report',
    [MODULES.REPORTS_FRINGE]: 'Fringe Benefits',
    [MODULES.REPORTS_SALES]: 'Sales Performance',
    [MODULES.REPORTS_DAILY_ACTIVITY]: 'Daily Activity',
};

// =====================================
// HELPER: Action display names
// =====================================
export const ACTION_LABELS: Record<ActionKey, string> = {
    [ACTIONS.VIEW]: 'View',
    [ACTIONS.CREATE]: 'Create',
    [ACTIONS.EDIT]: 'Edit',
    [ACTIONS.DELETE]: 'Delete',
    [ACTIONS.EXPORT]: 'Export',
    [ACTIONS.APPROVE]: 'Approve',
    [ACTIONS.ASSIGN]: 'Assign',
    [ACTIONS.CHANGE_STATUS]: 'Change Status',
};

// =====================================
// URL to MODULE mapping
// =====================================
export const URL_TO_MODULE: Record<string, ModuleKey> = {
    '/': MODULES.DASHBOARD,
    '/dashboard': MODULES.DASHBOARD,
    '/clients': MODULES.CLIENTS,
    '/employees': MODULES.EMPLOYEES,
    '/contacts': MODULES.CONTACTS,
    '/roles': MODULES.ROLES,
    '/catalogue': MODULES.CATALOGUE,
    '/templates': MODULES.TEMPLATES,
    '/estimates': MODULES.ESTIMATES,
    '/jobs/schedules': MODULES.SCHEDULES,
    '/jobs/time-cards': MODULES.TIME_CARDS,
    '/reports/wip': MODULES.REPORTS_WIP,
    '/docs/jha': MODULES.JHA,
    '/docs/job-tickets': MODULES.JOB_TICKETS,
    '/docs/billing-tickets': MODULES.BILLING_TICKETS,
    '/docs/pothole': MODULES.POTHOLE,
    '/docs/damage-report': MODULES.DAMAGE_REPORT,
    '/docs/incidents': MODULES.INCIDENTS,
    '/docs/pre-bore-logs': MODULES.PRE_BORE_LOGS,
    '/docs/vehicle-safety': MODULES.VEHICLE_SAFETY,
    '/docs/lubrication': MODULES.LUBRICATION,
    '/docs/repair': MODULES.REPAIR,
    '/docs/scope-change': MODULES.SCOPE_CHANGE,
    '/docs/receipts-costs': MODULES.RECEIPTS_COSTS,
    '/docs/vehicle-equipment': MODULES.VEHICLE_EQUIPMENT,
    '/constants': MODULES.CONSTANTS,
    '/chat': MODULES.CHAT,
    '/docs/company-docs': MODULES.COMPANY_DOCS,
    '/settings/general': MODULES.CONSTANTS,
    '/settings/imports': MODULES.CONSTANTS,
    '/settings/knowledgebase': MODULES.CONSTANTS,
    '/reports/payroll': MODULES.REPORTS_PAYROLL,
    '/reports/workers-comp': MODULES.REPORTS_WORK_COMP,
    '/reports/fringe-benefits': MODULES.REPORTS_FRINGE,
    '/reports/sales': MODULES.REPORTS_SALES,
    '/reports/daily-activities': MODULES.REPORTS_DAILY_ACTIVITY,
};
