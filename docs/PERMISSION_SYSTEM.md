# DEVCO CRM Permission System Architecture

## Overview

This document describes the comprehensive permission system for DEVCO CRM. The system implements Role-Based Access Control (RBAC) with user-level overrides, field-level security, and row-level data scoping.

**Key Principle: Super Admin (appRole === 'Super Admin') bypasses ALL permission checks.**

---

## Architecture Components

### 1. Database Schema

```
┌─────────────────┐     ┌──────────────────────────┐
│     Roles       │     │  UserPermissionOverrides │
├─────────────────┤     ├──────────────────────────┤
│ _id (string)    │     │ userId                   │
│ name            │     │ module                   │
│ description     │     │ grant[]                  │
│ color           │     │ revoke[]                 │
│ icon            │     │ dataScope                │
│ isSystem        │     │ fieldGrant[]             │
│ isActive        │     │ fieldRevoke[]            │
│ permissions[]   │     │ createdBy                │
│ createdBy       │     └──────────────────────────┘
└─────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│           ModulePermission              │
├─────────────────────────────────────────┤
│ module: string                          │
│ actions: ['view','create','edit',...]   │
│ dataScope: 'self' | 'department' | 'all'│
│ fieldPermissions?: FieldPermission[]    │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│           FieldPermission               │
├─────────────────────────────────────────┤
│ field: string                           │
│ actions: ['view','create','update',     │
│           'delete']                     │
└─────────────────────────────────────────┘
```

### 2. Permission Flow

```
User Login → JWT Token (role in payload)
          ↓
Request comes in
          ↓
Middleware checks authentication
          ↓
API Route checks permission:
    ├─ Is Super Admin? → ALLOW ALL
    └─ Load permissions (role + overrides)
        ├─ Check module + action
        ├─ Apply data scope filter
        └─ Filter fields if needed
          ↓
Return filtered response
```

---

## Modules & Actions

### Modules (Pages/Sections)

| Module Key | Label | Location |
|------------|-------|----------|
| `dashboard` | Dashboard | / |
| `clients` | Clients | /clients |
| `employees` | Employees | /employees |
| `leads` | Leads | /leads |
| `roles` | Roles & Permissions | /roles |
| `catalogue` | Catalogue | /catalogue |
| `templates` | Templates | /templates |
| `estimates` | Estimates & Proposals | /estimates |
| `schedules` | Schedules | /jobs/schedules |
| `time_cards` | Time Cards | /jobs/time-cards |
| `quickbooks` | QuickBooks | /quickbooks |
| `jha` | JHA | /docs/jha |
| `job_tickets` | Job Tickets | /docs/job-tickets |
| `billing_tickets` | Billing Tickets | /docs/billing-tickets |
| `constants` | Constants | /constants |
| `chat` | Chat | /chat |
| `reports_*` | Reports | /reports/* |

### Actions

| Action Key | Description |
|------------|-------------|
| `view` | Can see records |
| `create` | Can create new records |
| `edit` | Can modify existing records |
| `delete` | Can remove records |
| `export` | Can export data |
| `approve` | Can approve workflows |
| `assign` | Can assign to users |
| `change_status` | Can change record status |

### Data Scopes

| Scope | Description |
|-------|-------------|
| `self` | Only records created by or assigned to user |
| `department` | Records in user's department/team |
| `all` | All records (no filter) |

---

## Backend Implementation

### 1. Permission Service (`lib/permissions/service.ts`)

```typescript
// Check if user is Super Admin
isSuperAdmin(appRole?: string): boolean

// Load full permissions for a user
getUserPermissions(userId: string): Promise<UserPermissions>

// Check specific permission
hasPermission(permissions, module, action): boolean
hasFieldPermission(permissions, module, field, fieldAction): boolean

// Get data scope for filtering
getDataScope(permissions, module): DataScopeKey

// Build MongoDB filter for row-level security
buildDataScopeFilter(permissions, module, ownerField?, departmentField?): Query

// Filter response fields
filterFieldsForView(permissions, module, data): Partial<T>
getEditableFields(permissions, module): string[]
```

### 2. Permission Middleware (`lib/permissions/middleware.ts`)

```typescript
// Get user from JWT cookie
getUserFromRequest(request): Promise<JWTPayload>

// Wrap API handler with permission check
withPermissionGuard(request, options, handler): Promise<NextResponse>

// Create permission-aware handler factory
createPermissionHandler(module): { GET, POST, PUT, DELETE, withAction }
```

### 3. Example API Route

```typescript
// app/api/estimates/route.ts
import { createPermissionHandler, MODULES } from '@/lib/permissions';

const permissionHandler = createPermissionHandler(MODULES.ESTIMATES);

export async function GET(request: NextRequest) {
    return permissionHandler.GET(request, async (checker, user) => {
        // Super Admin check
        if (checker.isSuperAdmin) {
            // No filters needed
            const estimates = await Estimate.find();
            return NextResponse.json({ success: true, data: estimates });
        }
        
        // Build data scope filter
        const filter = checker.buildFilter(MODULES.ESTIMATES, 'createdBy');
        const estimates = await Estimate.find(filter);
        
        // Filter fields for each record
        const filtered = estimates.map(e => checker.filterView(MODULES.ESTIMATES, e));
        
        return NextResponse.json({ success: true, data: filtered });
    });
}

export async function POST(request: NextRequest) {
    return permissionHandler.POST(request, async (checker, user) => {
        const body = await request.json();
        
        // Check editable fields
        const editable = checker.getEditableFields(MODULES.ESTIMATES);
        if (!editable.includes('*')) {
            // Filter body to only editable fields
            const filtered = {};
            for (const field of editable) {
                if (body[field] !== undefined) filtered[field] = body[field];
            }
            body = filtered;
        }
        
        const estimate = await Estimate.create({
            ...body,
            createdBy: user.userId,
        });
        
        return NextResponse.json({ success: true, data: estimate });
    });
}
```

---

## Frontend Implementation

### 1. Permission Context (`hooks/usePermissions.tsx`)

```tsx
// Wrap your app with PermissionProvider
<PermissionProvider>
    <App />
</PermissionProvider>

// Use the hook in components
const { 
    can,              // (module, action) => boolean
    canField,         // (module, field, action) => boolean
    canAccessRoute,   // (path) => boolean
    isSuperAdmin,     // boolean
    getEditableFields,// (module) => string[]
    permissions,      // Full permissions object
    loading,          // boolean
    refresh,          // () => Promise<void>
} = usePermissions();
```

### 2. Guard Components

```tsx
// Hide/show based on permission
<PermissionGuard module="estimates" action="create">
    <CreateButton />
</PermissionGuard>

// Field-level guard
<FieldGuard module="employees" field="hourlyRateSITE" action="view">
    <SalaryField />
</FieldGuard>

// Route protection
<RouteGuard path="/roles">
    <RolesPage />
</RouteGuard>

// Button with auto-disable
<PermissionButton 
    module="estimates" 
    action="delete"
    hideIfDenied={true}
>
    Delete
</PermissionButton>

// Permission-aware input
<PermissionInput 
    module="employees" 
    field="hourlyRateSITE"
    value={rate}
    onChange={...}
/>

// Super Admin only content
<SuperAdminOnly>
    <DangerousSettings />
</SuperAdminOnly>
```

### 3. Conditional Hooks

```tsx
const canEdit = useCanDo('estimates', 'edit');
const canViewSalary = useCanDoField('employees', 'hourlyRateSITE', 'view');
```

---

## Default Roles

| Role | Description | Scope |
|------|-------------|-------|
| **Super Admin** | Full access, bypasses all checks | N/A |
| **Admin** | All modules, all actions | ALL |
| **Manager** | Most modules, no delete | DEPARTMENT |
| **Staff** | Basic modules, limited actions | SELF |
| **Viewer** | View only | ALL |

---

## JWT Token Strategy

### What's stored in JWT:
```json
{
    "userId": "user@example.com",
    "email": "user@example.com",
    "role": "Manager",
    "iat": 1234567890,
    "exp": 1234567890
}
```

### Server-side fetch:
- Full permissions loaded on each API request
- Cached for 5 minutes (configurable)
- Refresh on role change

---

## Security Checklist

✅ **Deny by default** - No permission = no access
✅ **Server enforcement** - UI is just cosmetic, real checks on backend
✅ **Super Admin bypass** - Clearly identified, cannot be modified
✅ **Audit logging** - All permission changes logged
✅ **Row-level security** - Data scope filters in queries
✅ **Field-level security** - View/edit restrictions per field
✅ **System roles protected** - Cannot delete Super Admin/Admin

---

## Admin UI Features (Roles Page)

Located at `/roles` under CRM menu:

1. **View all roles** with permission summaries
2. **Create new roles** with permission builder
3. **Edit role permissions** per module
4. **Set data scopes** (Self/Department/All)
5. **Configure field-level security**
6. **View employee counts** per role
7. **Audit trail** of permission changes

---

## Files Created/Modified

### New Files:
- `lib/permissions/types.ts` - Types and constants
- `lib/permissions/service.ts` - Core permission logic
- `lib/permissions/middleware.ts` - API middleware
- `lib/permissions/index.ts` - Exports
- `lib/models/Role.ts` - Database models
- `hooks/usePermissions.tsx` - React hooks
- `app/api/roles/route.ts` - Roles CRUD API
- `app/api/auth/me/permissions/route.ts` - Get user permissions
- `app/(protected)/roles/page.tsx` - Roles management UI

### Modified Files:
- `lib/models/index.ts` - Added Role exports
- `app/(protected)/layout.tsx` - Added PermissionProvider
- `components/ui/Header.tsx` - Added Roles menu item

---

## Usage Examples

### Protect an entire page:

```tsx
// pages/admin-settings.tsx
export default function AdminSettings() {
    const { isSuperAdmin, loading } = usePermissions();
    
    if (loading) return <Loading />;
    if (!isSuperAdmin) return <AccessDenied />;
    
    return <Settings />;
}
```

### Conditional UI elements:

```tsx
const { can } = usePermissions();

return (
    <div>
        <h1>Estimates</h1>
        
        {can('estimates', 'create') && (
            <Button onClick={openCreate}>New Estimate</Button>
        )}
        
        <Table>
            {estimates.map(e => (
                <Row key={e._id}>
                    <Cell>{e.title}</Cell>
                    {can('estimates', 'edit') && (
                        <Cell><EditButton /></Cell>
                    )}
                    {can('estimates', 'delete') && (
                        <Cell><DeleteButton /></Cell>
                    )}
                </Row>
            ))}
        </Table>
    </div>
);
```

### Field-level forms:

```tsx
const { canField, getEditableFields } = usePermissions();
const editableFields = getEditableFields('employees');
const canEditAll = editableFields.includes('*');

return (
    <Form>
        <Input 
            label="Name" 
            value={name}
            disabled={!canEditAll && !editableFields.includes('firstName')}
        />
        
        {canField('employees', 'hourlyRateSITE', 'view') && (
            <Input 
                label="Hourly Rate" 
                value={rate}
                disabled={!canField('employees', 'hourlyRateSITE', 'update')}
            />
        )}
    </Form>
);
```
