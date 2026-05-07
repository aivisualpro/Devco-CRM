/**
 * Project Health Score Engine
 * Composite 0-100 score per project across 6 weighted dimensions.
 * Pure computation — no React, no side effects.
 */

export interface HealthThresholds {
    targetGrossMarginPct: number;   // e.g. 20 → 20%
    dsoWarningDays: number;         // e.g. 60
    customerConcentrationPct: number;
}

export const DEFAULT_HEALTH_THRESHOLDS: HealthThresholds = {
    targetGrossMarginPct: 20,
    dsoWarningDays: 60,
    customerConcentrationPct: 35,
};

export type HealthBand = 'healthy' | 'watch' | 'at-risk' | 'critical';

export interface ProjectHealthResult {
    overall: number;                // 0-100
    band: HealthBand;
    label: string;                  // "Healthy" | "Watch" | "At Risk" | "Critical"
    components: {
        margin: number;             // 0-100
        schedule: number;           // 0-100
        cost: number;               // 0-100
        cash: number;               // 0-100
        compliance: number;         // 0-100
        risk: number;               // 0-100
    };
}

// ── Component scorers ──────────────────────────────────────────────────────

/**
 * Margin health (30%)
 * Full score at or above target. Score falls linearly to 0 at 50% below target.
 */
function scoreMargin(project: any, settings: HealthThresholds): number {
    const inc = project.income || 0;
    const cost = (project.qbCost || 0) + (project.devcoCost || 0);
    if (inc <= 0) return 50; // neutral if no revenue yet
    const margin = ((inc - cost) / inc) * 100;
    const target = settings.targetGrossMarginPct;
    if (margin >= target) return 100;
    if (margin <= 0) return 0;
    // Linear: 0 at margin=0, 100 at margin=target
    return Math.round(Math.max(0, (margin / target) * 100));
}

/**
 * Schedule health (20%)
 * Compare % revenue collected (proxy for % complete) vs % time elapsed.
 * If no start date, return neutral 60.
 */
function scoreSchedule(project: any): number {
    const startDate = project.startDate || project.MetaData?.CreateTime;
    if (!startDate) return 60;

    const inc = project.income || 0;
    const cv = (project.originalContract || 0) + (project.changeOrders || 0);
    if (cv <= 0) return 60;

    const pctComplete = Math.min(1, inc / cv); // 0-1
    const daysElapsed = Math.max(0, (Date.now() - new Date(startDate).getTime()) / 86400000);

    // Assume average project duration of 60 days
    const estimatedDuration = 60;
    const pctTimeElapsed = Math.min(1, daysElapsed / estimatedDuration);

    if (pctTimeElapsed === 0) return 100;

    // Efficiency = pctComplete / pctTimeElapsed — 1.0 is perfect
    const efficiency = pctComplete / pctTimeElapsed;

    if (efficiency >= 1.0) return 100;        // Ahead of schedule
    if (efficiency >= 0.8) return 80;         // Slightly behind
    if (efficiency >= 0.6) return 60;         // Moderately behind
    if (efficiency >= 0.4) return 40;         // Significantly behind
    return 20;                                  // Severely behind
}

/**
 * Cost discipline (20%)
 * Actual cost vs budget estimate. Budget = contractValue × (1 - targetMargin/100).
 * Over budget is penalized; under budget is rewarded.
 */
function scoreCost(project: any, settings: HealthThresholds): number {
    const cv = (project.originalContract || 0) + (project.changeOrders || 0);
    if (cv <= 0) return 60;
    const actualCost = (project.qbCost || 0) + (project.devcoCost || 0);
    const budgetedCost = cv * (1 - settings.targetGrossMarginPct / 100);
    if (budgetedCost <= 0) return 60;

    const ratio = actualCost / budgetedCost; // 1.0 = exactly on budget
    if (ratio <= 0.9) return 100;   // Under budget — excellent
    if (ratio <= 1.0) return 85;    // On budget
    if (ratio <= 1.05) return 70;   // 5% over
    if (ratio <= 1.10) return 55;   // 10% over
    if (ratio <= 1.20) return 35;   // 20% over
    return 15;                       // >20% over — critical
}

/**
 * Cash health (15%)
 * Composite of collection rate and DSO age.
 * collection rate = (income - AR) / income
 * DSO approximated from AR / income × 365
 */
function scoreCash(project: any, settings: HealthThresholds): number {
    const inc = project.income || 0;
    if (inc <= 0) return 60;
    const ar = project.ar || 0;
    const collectedPct = (inc - ar) / inc; // 0-1
    const dso = ar > 0 ? (ar / inc) * 365 : 0;

    // Collection score (70% weight within cash)
    const collectionScore = collectedPct >= 0.95 ? 100
        : collectedPct >= 0.80 ? 80
        : collectedPct >= 0.60 ? 60
        : collectedPct >= 0.40 ? 40
        : 20;

    // DSO score (30% weight within cash)
    const dsoScore = dso === 0 ? 100
        : dso <= settings.dsoWarningDays ? 90
        : dso <= settings.dsoWarningDays * 1.5 ? 65
        : dso <= settings.dsoWarningDays * 2 ? 40
        : 15;

    return Math.round(collectionScore * 0.7 + dsoScore * 0.3);
}

/**
 * Compliance (10%)
 * Checks: has status set, has start date, has income (active/billable).
 * In a full implementation this would check JHA / DJT presence.
 * For now we use available proxy fields.
 */
function scoreCompliance(project: any): number {
    let score = 100;
    if (!project.status) score -= 25;
    if (!project.startDate && !project.MetaData?.CreateTime) score -= 25;
    if (!project.proposalNumber) score -= 20;
    if (!project.proposalWriters || project.proposalWriters.length === 0) score -= 15;
    if (!project.originalContract || project.originalContract <= 0) score -= 15;
    return Math.max(0, score);
}

/**
 * Risk flags (5%)
 * Anomaly penalties: over-budget, slow billing, no revenue on old project.
 */
function scoreRisk(project: any): number {
    let score = 100;
    const inc = project.income || 0;
    const cv = (project.originalContract || 0) + (project.changeOrders || 0);
    const cost = (project.qbCost || 0) + (project.devcoCost || 0);
    const ar = project.ar || 0;

    // Over budget without being done
    if (cv > 0) {
        const pctComplete = Math.min(1, inc / cv);
        const costRatio = cv > 0 ? cost / cv : 0;
        if (costRatio > 0.95 && pctComplete < 0.90) score -= 40;
    }

    // Significant outstanding AR on an old project
    const startDate = project.startDate || project.MetaData?.CreateTime;
    if (ar > 0 && startDate) {
        const daysElapsed = (Date.now() - new Date(startDate).getTime()) / 86400000;
        if (daysElapsed > 90 && ar > inc * 0.3) score -= 30;
        else if (daysElapsed > 45 && ar > inc * 0.5) score -= 20;
    }

    // No income on a project that's been around 30+ days
    if (inc === 0 && startDate) {
        const daysElapsed = (Date.now() - new Date(startDate).getTime()) / 86400000;
        if (daysElapsed > 30) score -= 25;
    }

    return Math.max(0, score);
}

// ── Main export ────────────────────────────────────────────────────────────

const WEIGHTS = {
    margin:     0.30,
    schedule:   0.20,
    cost:       0.20,
    cash:       0.15,
    compliance: 0.10,
    risk:       0.05,
} as const;

const BANDS: { min: number; band: HealthBand; label: string }[] = [
    { min: 80, band: 'healthy',  label: 'Healthy' },
    { min: 60, band: 'watch',    label: 'Watch' },
    { min: 40, band: 'at-risk',  label: 'At Risk' },
    { min: 0,  band: 'critical', label: 'Critical' },
];

export function computeProjectHealth(
    project: any,
    settings: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS,
): ProjectHealthResult {
    const components = {
        margin:     scoreMargin(project, settings),
        schedule:   scoreSchedule(project),
        cost:       scoreCost(project, settings),
        cash:       scoreCash(project, settings),
        compliance: scoreCompliance(project),
        risk:       scoreRisk(project),
    };

    const overall = Math.round(
        (Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>).reduce(
            (sum, k) => sum + components[k] * WEIGHTS[k],
            0,
        ),
    );

    const { band, label } = BANDS.find(b => overall >= b.min) ?? BANDS[BANDS.length - 1];

    return { overall, band, label, components };
}

/** Colour tokens for each band — usable directly in className or style */
export const HEALTH_COLORS: Record<HealthBand, { bg: string; text: string; border: string; hex: string }> = {
    healthy:  { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', hex: '#10b981' },
    watch:    { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',   hex: '#f59e0b' },
    'at-risk':{ bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-200',  hex: '#f97316' },
    critical: { bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200',     hex: '#ef4444' },
};
