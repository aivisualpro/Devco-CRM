/**
 * Drill-Down System
 * ─────────────────────────────────────────────────────────────────────────────
 * Maps drill keys to human-readable labels and predefined sort/filter logic
 * applied on top of the existing date/PM/status filters.
 *
 * URL contract:  ?view=financials&drill={key}[&drillValue={value}]
 *   key        — identifies the dimension being drilled (see DRILL_KEYS)
 *   drillValue — optional secondary qualifier (customer name, PM name, etc.)
 */

export type DrillKey =
    | 'revenue'
    | 'profit'
    | 'ar-outstanding'
    | 'dso'
    | 'backlog'
    | 'margin'
    | 'cost-variance'
    | 'over-budget'
    | 'under-billing'
    | 'slow-pay'
    | 'health-critical'
    | 'health-at-risk'
    | 'pm'             // drillValue = PM name
    | 'customer'       // drillValue = customer name
    | 'ar-bucket'      // drillValue = "0-30" | "31-60" | "61-90" | "91+"

export interface DrillDefinition {
    key: DrillKey;
    label: string;                  // Human-readable "Drilled view: ___"
    description: (value?: string) => string;
    /** Sort function applied to filtered projects */
    sort?: (a: any, b: any) => number;
    /** Additional predicate filter on top of existing filters */
    predicate?: (p: any, value?: string) => boolean;
    /** Icon name for the banner */
    icon: string;
    /** Colour scheme for the banner */
    color: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';
}

export const DRILL_DEFINITIONS: Record<DrillKey, DrillDefinition> = {
    'revenue': {
        key: 'revenue',
        label: 'Earned Revenue',
        description: () => 'Projects sorted by earned revenue (highest first)',
        sort: (a, b) => (b.income || 0) - (a.income || 0),
        icon: 'DollarSign',
        color: 'green',
    },
    'profit': {
        key: 'profit',
        label: 'Gross Profit',
        description: () => 'Projects sorted by gross profit (highest first)',
        sort: (a, b) => {
            const pa = (a.income || 0) - (a.qbCost || 0) - (a.devcoCost || 0);
            const pb = (b.income || 0) - (b.qbCost || 0) - (b.devcoCost || 0);
            return pb - pa;
        },
        icon: 'TrendingUp',
        color: 'green',
    },
    'ar-outstanding': {
        key: 'ar-outstanding',
        label: 'A/R Outstanding',
        description: () => 'Projects with outstanding receivables — sorted by A/R amount',
        sort: (a, b) => (b.ar || 0) - (a.ar || 0),
        predicate: (p) => (p.ar || 0) > 0,
        icon: 'CreditCard',
        color: 'orange',
    },
    'dso': {
        key: 'dso',
        label: 'DSO (Slow-paying)',
        description: () => 'Projects sorted by days outstanding (slowest first)',
        sort: (a, b) => {
            const dsoA = (a.income || 0) > 0 ? (a.ar || 0) / (a.income || 1) : 0;
            const dsoB = (b.income || 0) > 0 ? (b.ar || 0) / (b.income || 1) : 0;
            return dsoB - dsoA;
        },
        predicate: (p) => (p.ar || 0) > 0,
        icon: 'Clock',
        color: 'orange',
    },
    'backlog': {
        key: 'backlog',
        label: 'Backlog',
        description: () => 'Projects with remaining backlog — sorted by backlog value',
        sort: (a, b) => {
            const bA = Math.max(0, ((a.originalContract || 0) + (a.changeOrders || 0)) - (a.income || 0));
            const bB = Math.max(0, ((b.originalContract || 0) + (b.changeOrders || 0)) - (b.income || 0));
            return bB - bA;
        },
        predicate: (p) => {
            const cv = (p.originalContract || 0) + (p.changeOrders || 0);
            return cv > (p.income || 0);
        },
        icon: 'ArrowDownToLine',
        color: 'blue',
    },
    'margin': {
        key: 'margin',
        label: 'Gross Margin',
        description: () => 'Projects sorted by gross margin % (lowest first — problem jobs at top)',
        sort: (a, b) => {
            const mA = (a.income || 0) > 0 ? ((a.income - (a.qbCost || 0) - (a.devcoCost || 0)) / a.income) * 100 : 0;
            const mB = (b.income || 0) > 0 ? ((b.income - (b.qbCost || 0) - (b.devcoCost || 0)) / b.income) * 100 : 0;
            return mA - mB; // ascending — lowest margin first
        },
        icon: 'Percent',
        color: 'red',
    },
    'cost-variance': {
        key: 'cost-variance',
        label: 'Cost Variance',
        description: () => 'Over-budget projects — sorted by cost overrun % (worst first)',
        sort: (a, b) => {
            const cv = (p: any) => {
                const budget = (p.originalContract || 0) + (p.changeOrders || 0);
                const cost = (p.qbCost || 0) + (p.devcoCost || 0);
                return budget > 0 ? ((cost - budget) / budget) * 100 : 0;
            };
            return cv(b) - cv(a);
        },
        predicate: (p) => {
            const budget = (p.originalContract || 0) + (p.changeOrders || 0);
            const cost = (p.qbCost || 0) + (p.devcoCost || 0);
            return budget > 0 && cost > budget;
        },
        icon: 'AlertTriangle',
        color: 'red',
    },
    'over-budget': {
        key: 'over-budget',
        label: 'At Overrun Risk',
        description: () => 'Projects at 85%+ cost but under 80% complete',
        sort: (a, b) => {
            const cv = (p: any) => {
                const c = (p.originalContract || 0) + (p.changeOrders || 0);
                return c > 0 ? ((p.qbCost || 0) + (p.devcoCost || 0)) / c : 0;
            };
            return cv(b) - cv(a);
        },
        predicate: (p) => {
            const cv = (p.originalContract || 0) + (p.changeOrders || 0);
            const cost = (p.qbCost || 0) + (p.devcoCost || 0);
            const pctComplete = cv > 0 ? Math.min(1, (p.income || 0) / cv) : 0;
            return cv > 0 && cost / cv > 0.85 && pctComplete < 0.80;
        },
        icon: 'AlertOctagon',
        color: 'red',
    },
    'under-billing': {
        key: 'under-billing',
        label: 'Under-billing',
        description: () => 'Jobs where billed < earned (POC × contract value)',
        sort: (a, b) => {
            const gap = (p: any) => {
                const cv = (p.originalContract || 0) + (p.changeOrders || 0);
                const poc = cv > 0 ? Math.min(1, (p.income || 0) / cv) : 0;
                return Math.max(0, cv * poc - (p.income || 0));
            };
            return gap(b) - gap(a);
        },
        predicate: (p) => {
            const cv = (p.originalContract || 0) + (p.changeOrders || 0);
            if (cv <= 0) return false;
            const poc = Math.min(1, (p.income || 0) / cv);
            return (p.income || 0) < cv * poc * 0.9;
        },
        icon: 'FilePlus2',
        color: 'orange',
    },
    'slow-pay': {
        key: 'slow-pay',
        label: 'Slow-paying Customers',
        description: () => 'Projects from customers with DSO > warning threshold',
        sort: (a, b) => (b.ar || 0) - (a.ar || 0),
        predicate: (p) => (p.ar || 0) > 0 && (p.income || 0) > 0,
        icon: 'Clock',
        color: 'orange',
    },
    'health-critical': {
        key: 'health-critical',
        label: 'Critical Health Projects',
        description: () => 'Projects with composite health score below 40',
        sort: (a, b) => (a._healthScore ?? 50) - (b._healthScore ?? 50),
        icon: 'ShieldAlert',
        color: 'red',
    },
    'health-at-risk': {
        key: 'health-at-risk',
        label: 'At-Risk Health Projects',
        description: () => 'Projects with composite health score 40–59',
        sort: (a, b) => (a._healthScore ?? 50) - (b._healthScore ?? 50),
        icon: 'AlertTriangle',
        color: 'orange',
    },
    'pm': {
        key: 'pm',
        label: 'Project Manager',
        description: (v) => v ? `Projects managed by ${v}` : 'Projects by PM',
        sort: (a, b) => (b.income || 0) - (a.income || 0),
        predicate: (p, value) => value ? (p.proposalWriters || []).includes(value) : true,
        icon: 'Users',
        color: 'purple',
    },
    'customer': {
        key: 'customer',
        label: 'Customer',
        description: (v) => v ? `Projects for ${v}` : 'Customer projects',
        sort: (a, b) => (b.income || 0) - (a.income || 0),
        predicate: (p, value) => value ? (p.CompanyName || '') === value : true,
        icon: 'Building2',
        color: 'blue',
    },
    'ar-bucket': {
        key: 'ar-bucket',
        label: 'A/R Aging Bucket',
        description: (v) => v ? `Projects in the ${v} day A/R aging bucket` : 'A/R Aging',
        sort: (a, b) => (b.ar || 0) - (a.ar || 0),
        predicate: (p, value) => {
            if (!value || (p.ar || 0) <= 0) return false;
            const d = p.startDate || p.MetaData?.CreateTime;
            if (!d) return false;
            const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
            if (value === '0-30')  return days <= 30;
            if (value === '31-60') return days > 30 && days <= 60;
            if (value === '61-90') return days > 60 && days <= 90;
            if (value === '91+')   return days > 90;
            return true;
        },
        icon: 'CreditCard',
        color: 'orange',
    },
};

/** BANNER_COLORS maps color key → Tailwind classes */
export const BANNER_COLORS: Record<string, { bg: string; border: string; icon: string; badge: string; badgeText: string }> = {
    green:  { bg: 'bg-emerald-50',  border: 'border-emerald-200', icon: 'text-emerald-600', badge: 'bg-emerald-100', badgeText: 'text-emerald-700' },
    blue:   { bg: 'bg-blue-50',     border: 'border-blue-200',    icon: 'text-blue-600',    badge: 'bg-blue-100',    badgeText: 'text-blue-700' },
    orange: { bg: 'bg-amber-50',    border: 'border-amber-200',   icon: 'text-amber-600',   badge: 'bg-amber-100',   badgeText: 'text-amber-700' },
    red:    { bg: 'bg-red-50',      border: 'border-red-200',     icon: 'text-red-600',     badge: 'bg-red-100',     badgeText: 'text-red-700' },
    purple: { bg: 'bg-violet-50',   border: 'border-violet-200',  icon: 'text-violet-600',  badge: 'bg-violet-100',  badgeText: 'text-violet-700' },
    slate:  { bg: 'bg-slate-50',    border: 'border-slate-200',   icon: 'text-slate-600',   badge: 'bg-slate-100',   badgeText: 'text-slate-700' },
};

/** Build a full drill URL from the current URL */
export function buildDrillUrl(key: DrillKey, value?: string, base?: string): string {
    const url = new URL(base ?? (typeof window !== 'undefined' ? window.location.href : '/'), 'http://x');
    url.searchParams.set('drill', key);
    if (value) url.searchParams.set('drillValue', value);
    else url.searchParams.delete('drillValue');
    return url.pathname + url.search;
}

/** Remove drill params from URL */
export function clearDrillUrl(base?: string): string {
    const url = new URL(base ?? (typeof window !== 'undefined' ? window.location.href : '/'), 'http://x');
    url.searchParams.delete('drill');
    url.searchParams.delete('drillValue');
    return url.pathname + url.search;
}
