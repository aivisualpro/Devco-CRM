/**
 * /lib/financials/wipSchedule.ts
 * ─────────────────────────────────────────────────────────────────────
 * WIP Schedule row builder — audit-grade construction schedule.
 * Uses the percentage-of-completion (cost-to-cost) method.
 * Pure computation — no React, no side effects.
 */

export interface WipScheduleRow {
    id: string;
    project: string;
    customer: string;
    proposalNumber?: string;
    proposalSlug?: string;
    contractValue: number;
    estimatedCost: number;
    costToDate: number;
    pctComplete: number;
    earnedRevenue: number;
    billedToDate: number;
    /** Positive = over-billed (liability); Negative = under-billed (asset) */
    overUnderBilled: number;
    marginPct: number;
}

interface ProjectLike {
    Id?: string;
    DisplayName?: string;
    CompanyName?: string;
    proposalNumber?: string;
    proposalSlug?: string;
    income?: number;
    qbCost?: number;
    devcoCost?: number;
    ar?: number;
    originalContract?: number;
    changeOrders?: number;
    /** Per-project target margin override (%) */
    targetMarginPct?: number;
}

/**
 * Build WIP schedule rows from a list of projects.
 *
 * @param projects    Filtered project list
 * @param defaultTargetMarginPct  Org-wide target margin (used when project has no override)
 */
export function buildWipSchedule(
    projects: ProjectLike[],
    defaultTargetMarginPct = 20,
): WipScheduleRow[] {
    return projects.map(p => {
        const contractValue = (p.originalContract || 0) + (p.changeOrders || 0);
        const tgt           = p.targetMarginPct ?? defaultTargetMarginPct;
        const estimatedCost = contractValue > 0
            ? contractValue * (1 - tgt / 100)
            : ((p.qbCost || 0) + (p.devcoCost || 0)) * 1.2;

        const costToDate    = (p.qbCost || 0) + (p.devcoCost || 0);
        const earnedRevenue = p.income || 0;
        const arAdjusted    = p.ar || 0;
        const billedToDate  = earnedRevenue + arAdjusted;
        const overUnderBilled = billedToDate - earnedRevenue;
        const pctComplete   = contractValue > 0
            ? Math.min(100, (earnedRevenue / contractValue) * 100)
            : 0;
        const marginPct     = earnedRevenue > 0
            ? ((earnedRevenue - costToDate) / earnedRevenue) * 100
            : 0;

        return {
            id:              p.Id || Math.random().toString(36).slice(2),
            project:         p.DisplayName || '—',
            customer:        p.CompanyName || '—',
            proposalNumber:  p.proposalNumber,
            proposalSlug:    p.proposalSlug,
            contractValue,
            estimatedCost,
            costToDate,
            pctComplete,
            earnedRevenue,
            billedToDate,
            overUnderBilled,
            marginPct,
        };
    });
}

/**
 * Aggregate WIP schedule rows into a summary totals object.
 */
export function summarizeWipSchedule(rows: WipScheduleRow[]) {
    const sum = (k: keyof WipScheduleRow) =>
        rows.reduce((s, r) => s + (typeof r[k] === 'number' ? (r[k] as number) : 0), 0);

    const totalContract  = sum('contractValue');
    const totalEarned    = sum('earnedRevenue');
    const weightedPct    = totalContract > 0 ? (totalEarned / totalContract) * 100 : 0;
    const avgMargin      = rows.length > 0
        ? rows.reduce((s, r) => s + r.marginPct, 0) / rows.length
        : 0;

    return {
        contractValue:   totalContract,
        estimatedCost:   sum('estimatedCost'),
        costToDate:      sum('costToDate'),
        earnedRevenue:   totalEarned,
        billedToDate:    sum('billedToDate'),
        overUnderBilled: sum('overUnderBilled'),
        pctComplete:     weightedPct,
        avgMarginPct:    avgMargin,
        projectCount:    rows.length,
    };
}
