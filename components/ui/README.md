# CRM UI Primitives

This directory contains standardized UI components that form the foundation of our application's design system. By using these primitives, we ensure visual consistency, reduce code duplication, and make future updates easier.

## Available Primitives

### `<StatusBadge />`

Centralized component for displaying statuses (e.g., active, pending, completed). It includes predefined color and icon mappings for consistency.

**Props:**
- `status`: `'active' | 'inactive' | 'pending' | 'approved' | 'rejected' | 'in-progress' | 'completed'`
- `variant`: `'solid' | 'outline' | 'soft'` (Optional, defaults to `'soft'`)
- `className`: Optional string for additional Tailwind classes.

**Usage:**
```tsx
import { StatusBadge } from '@/components/ui';

<StatusBadge status="active" />
<StatusBadge status="completed" variant="solid" />
```

### `<UserChip />`

Standardized avatar and name rendering for employees or users. Replaces scattered inline implementations of profile pictures and initials.

**Props:**
- `user`: Object containing `{ email, firstName?, lastName?, profilePicture? }` or `{ email, firstName?, lastName?, avatar? }`
- `size`: `'sm' | 'md' | 'lg'` (Optional, defaults to `'md'`)
- `className`: Optional string for additional Tailwind classes.

**Usage:**
```tsx
import { UserChip } from '@/components/ui';

<UserChip user={employee} size="sm" />
```

### `<PageHeader />`

Standardized header component for top-level pages. Supports breadcrumbs, titles, and right-aligned actions.

**Props:**
- `title`: `string | React.ReactNode`
- `actions`: `React.ReactNode` (Optional)
- `breadcrumbs`: `Array<{ label: string, href?: string }>` (Optional)
- `className`: Optional string for additional Tailwind classes.

**Usage:**
```tsx
import { PageHeader } from '@/components/ui';

<PageHeader 
    title="Dashboard" 
    breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Dashboard' }]}
    actions={<Button>Create New</Button>}
/>
```

### `<EmptyState />`

Unified component for displaying "No Data" or empty states consistently across the app.

**Props:**
- `icon`: `React.ReactNode` (Optional, defaults to standard placeholder)
- `title`: `string`
- `description`: `string` (Optional)
- `cta`: `React.ReactNode` (Optional, button or link)
- `className`: Optional string for additional Tailwind classes.

**Usage:**
```tsx
import { EmptyState } from '@/components/ui';
import { Search } from 'lucide-react';

<EmptyState 
    icon={<Search className="w-8 h-8 text-slate-400" />} 
    title="No results found" 
    description="Try adjusting your search filters."
    cta={<Button>Clear Filters</Button>}
/>
```

## Migration Guidelines

When working on existing pages:
1. Identify inline badge implementations (`<span className="...">Active</span>`) and replace them with `<StatusBadge />`.
2. Look for manual avatar renderings (initials logic + image fallback) and replace with `<UserChip />`.
3. Replace ad-hoc flex layouts for page titles with `<PageHeader />`.
4. Ensure all "no data found" states utilize `<EmptyState />`.

By keeping these components centralized, any future design changes (e.g., updating the "active" color from green to blue) will only require editing a single file.
