/**
 * Insights Engine V2
 * ─────────────────────────────────────────────────────────────────────────────
 * Rules:
 *   • GROUPED: similar findings → ONE card, worst offenders in chips[]
 *   • ROOT CAUSE: detail explains WHY, not just WHAT
 *   • $ SEVERITY: critical ≥ 5% revenue, warning ≥ 1%, info ≥ 0.1%
 *   • NEXT STEP: actionLabel is a concrete verb phrase
 *   • CAP: max 6 insights, sorted severity → dollarImpact desc
 */
import { FinancialThresholds, DEFAULT_THRESHOLDS } from '@/lib/constants/financialThresholds';

// ── Types ──────────────────────────────────────────────────────────────────

export type InsightSeverity = 'critical' | 'warning' | 'info' | 'positive';

export interface InsightChip {
    label: string;       // e.g. customer name or project code
    value: string;       // e.g. "$42K" or "87d DSO"
}

export interface Insight {
    id: string;
    severity: InsightSeverity;
    icon: string;
    title: string;
    detail: string;      // finding sentence
    rootCause: string;   // "Likely because…" explanation
    dollarImpact: number; // raw $ for sorting / severity gating
    chips?: InsightChip[]; // worst-offender chips (max 3)
    metric?: { label: string; value: string };
    actionLabel?: string;
    actionLink?: string;
    nextStep?: string;   // short imperative CTA e.g. "Send statements"
    /** Maps to metricCatalog id — powers the ⓘ popover on InsightCard */
    ruleId?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtK(n: number): string {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${Math.round(abs)}`;
}

/** Dollar-impact → severity. Falls back to provided fallback if impact is small. */
function dollarSeverity(
    impact: number,
    revenue: number,
    fallback: InsightSeverity = 'info',
): InsightSeverity {
    if (revenue <= 0) return fallback;
    const pct = impact / revenue;
    if (pct >= 0.05) return 'critical';
    if (pct >= 0.01) return 'warning';
    if (pct >= 0.001) return 'info';
    return fallback;
}

// ── Individual insight builders ────────────────────────────────────────────

/** COST — Labor outliers: jobs where labor% > 1.5× org average */
function buildLaborOutliers(projects: any[], revenue: number): Insight | null {
    if (revenue <= 0) return null;
    const totalCost = projects.reduce((s, p) => s + (p.qbCost || 0) + (p.devcoCost || 0), 0);
    const orgRatio = totalCost / revenue;

    const outliers = projects
        .filter(p => {
            const inc = p.income || 0;
            if (inc <= 0) return false;
            const cost = (p.qbCost || 0) + (p.devcoCost || 0);
            return (cost / inc) > orgRatio * 1.5;
        })
        .map(p => {
            const inc = p.income || 0;
            const cost = (p.qbCost || 0) + (p.devcoCost || 0);
            const excess = cost - inc * orgRatio;
            return { p, excess, costPct: (cost / inc) * 100 };
        })
        .sort((a, b) => b.excess - a.excess);

    if (outliers.length === 0) return null;
    const totalExcess = outliers.reduce((s, o) => s + o.excess, 0);

    return {
        id: 'labor-outliers',
        severity: dollarSeverity(totalExcess, revenue, 'warning'),
        icon: 'Hammer',
        title: `${outliers.length} project${outliers.length > 1 ? 's' : ''}: labor 50%+ above average`,
        detail: `${fmtK(totalExcess)} in excess labor cost vs org average (${(orgRatio * 100).toFixed(0)}% of revenue).`,
        rootCause: `Likely causes: extended travel/drive time on remote sites, prevailing-wage crew classification, or under-bid estimates that didn't account for site conditions.`,
        dollarImpact: totalExcess,
        chips: outliers.slice(0, 3).map(o => ({
            label: o.p.DisplayName || o.p.proposalNumber || 'Project',
            value: `${o.costPct.toFixed(0)}% cost ratio`,
        })),
        metric: { label: `${outliers.length} projects`, value: fmtK(totalExcess) },
        actionLabel: `Review ${outliers.length} project${outliers.length > 1 ? 's' : ''}`,
        nextStep: 'Review staffing & estimates',
        ruleId: 'above-avg-labor',
    };
}

/** COST — Stale CO opportunities: cost > estimate by 10%+ without a change order */
function buildCOOpportunities(projects: any[], revenue: number): Insight | null {
    const hits = projects
        .filter(p => {
            const orig = p.originalContract || 0;
            const co = p.changeOrders || 0;
            const cost = (p.qbCost || 0) + (p.devcoCost || 0);
            return orig > 0 && co === 0 && cost > orig * 1.10;
        })
        .map(p => {
            const orig = p.originalContract || 0;
            const cost = (p.qbCost || 0) + (p.devcoCost || 0);
            const gap = cost - orig;
            return { p, gap };
        })
        .sort((a, b) => b.gap - a.gap);

    if (hits.length === 0) return null;
    const total = hits.reduce((s, h) => s + h.gap, 0);

    return {
        id: 'co-opportunities',
        severity: dollarSeverity(total, revenue, 'warning'),
        icon: 'FilePlus2',
        title: `${hits.length} job${hits.length > 1 ? 's' : ''} need a change order`,
        detail: `${fmtK(total)} in cost overruns with no CO logged. Unbilled overruns hit your margin directly.`,
        rootCause: `Scope expanded in the field but no formal CO was raised. Common on T&M add-ons, owner-directed extras, or accelerated schedules.`,
        dollarImpact: total,
        chips: hits.slice(0, 3).map(h => ({
            label: h.p.DisplayName || h.p.proposalNumber || 'Project',
            value: `+${fmtK(h.gap)} over`,
        })),
        metric: { label: `${hits.length} jobs`, value: fmtK(total) },
        actionLabel: `Log ${hits.length} CO${hits.length > 1 ? 's' : ''}`,
        nextStep: 'Submit change orders',
        ruleId: 'budget-risk',
    };
}

/** CASH — Slow-pay group: customers with avg DSO > threshold */
function buildSlowPayers(
    projects: any[],
    revenue: number,
    dsoWarningDays: number,
): Insight | null {
    const customerMap = new Map<string, { ar: number; income: number; count: number }>();
    projects.forEach(p => {
        const name = p.CompanyName || 'Unknown';
        const ar = p.ar || 0;
        const inc = p.income || 0;
        if (ar <= 0) return;
        const e = customerMap.get(name) || { ar: 0, income: 0, count: 0 };
        e.ar += ar; e.income += inc; e.count += 1;
        customerMap.set(name, e);
    });

    const slow = Array.from(customerMap.entries())
        .map(([customer, d]) => ({
            customer,
            dso: d.income > 0 ? Math.round((d.ar / d.income) * 365) : 999,
            ar: d.ar,
        }))
        .filter(c => c.dso > dsoWarningDays)
        .sort((a, b) => b.ar - a.ar);

    if (slow.length === 0) return null;
    const totalAR = slow.reduce((s, c) => s + c.ar, 0);

    return {
        id: 'slow-payers',
        severity: dollarSeverity(totalAR, revenue, 'warning'),
        icon: 'Clock',
        title: `${slow.length} customer${slow.length > 1 ? 's' : ''} slow-paying`,
        detail: `${fmtK(totalAR)} outstanding across ${slow.length} customer${slow.length > 1 ? 's' : ''} with DSO above ${dsoWarningDays} days.`,
        rootCause: `Customers paying beyond terms lock up cash and inflate DSO. Often tied to disputed invoices, missing lien waivers, or customers using you as a revolving credit line.`,
        dollarImpact: totalAR,
        chips: slow.slice(0, 3).map(c => ({
            label: c.customer,
            value: `${c.dso}d DSO · ${fmtK(c.ar)}`,
        })),
        metric: { label: `${slow.length} customers`, value: fmtK(totalAR) },
        actionLabel: 'Send statements',
        nextStep: 'Send statements',
        ruleId: 'slow-paying-customers',
    };
}

/** CASH — Under-billing: billed < 90% of (POC × contract value) */
function buildUnderBilling(
    projects: any[],
    revenue: number,
    tolerancePct: number,
): Insight | null {
    const hits = projects
        .filter(p => {
            const inc = p.income || 0;
            const cv = (p.originalContract || 0) + (p.changeOrders || 0);
            if (cv <= 0) return false;
            const poc = Math.min(1, inc / cv);
            const earned = cv * poc;
            return inc < earned * (1 - tolerancePct / 100);
        })
        .map(p => {
            const inc = p.income || 0;
            const cv = (p.originalContract || 0) + (p.changeOrders || 0);
            const poc = Math.min(1, inc / cv);
            const gap = cv * poc - inc;
            return { p, gap };
        })
        .sort((a, b) => b.gap - a.gap);

    if (hits.length === 0) return null;
    const total = hits.reduce((s, h) => s + h.gap, 0);

    return {
        id: 'under-billing',
        severity: dollarSeverity(total, revenue, 'warning'),
        icon: 'AlertTriangle',
        title: `Under-billing on ${hits.length} job${hits.length > 1 ? 's' : ''}`,
        detail: `${fmtK(total)} in earned-but-not-billed revenue. This is cash you've earned and aren't collecting.`,
        rootCause: `Work is running ahead of your invoice schedule. Common on large contracts billed monthly — submit application for payment now to avoid end-of-job compression.`,
        dollarImpact: total,
        chips: hits.slice(0, 3).map(h => ({
            label: h.p.DisplayName || h.p.proposalNumber || 'Project',
            value: `${fmtK(h.gap)} gap`,
        })),
        metric: { label: `${hits.length} jobs`, value: fmtK(total) },
        actionLabel: 'Submit invoices',
        nextStep: 'Submit invoices',
        ruleId: 'under-billing',
    };
}

/** CASH — Concentrated A/R: top 3 customers = X% of A/R */
function buildConcentratedAR(projects: any[], revenue: number): Insight | null {
    const arMap = new Map<string, number>();
    projects.forEach(p => {
        const name = p.CompanyName || 'Unknown';
        arMap.set(name, (arMap.get(name) || 0) + (p.ar || 0));
    });
    const totalAR = Array.from(arMap.values()).reduce((s, v) => s + v, 0);
    if (totalAR <= 0) return null;

    const sorted = Array.from(arMap.entries()).sort((a, b) => b[1] - a[1]);
    const top3 = sorted.slice(0, 3);
    const top3AR = top3.reduce((s, [, v]) => s + v, 0);
    const top3Pct = Math.round((top3AR / totalAR) * 100);

    if (top3Pct < 50 || top3.length < 2) return null; // Only flag if concentrated

    return {
        id: 'concentrated-ar',
        severity: dollarSeverity(top3AR * 0.5, revenue, 'info'),
        icon: 'ShieldAlert',
        title: `A/R concentrated: top ${top3.length} customers = ${top3Pct}%`,
        detail: `${fmtK(top3AR)} of your ${fmtK(totalAR)} A/R sits with just ${top3.length} customers. A single default could be material.`,
        rootCause: `High concentration is typical for specialty trades with a few anchor clients. Mitigate by tightening credit terms, requiring retainage releases, or diversifying the pipeline.`,
        dollarImpact: top3AR * 0.5, // Risk-adjusted
        chips: top3.map(([name, ar]) => ({
            label: name,
            value: `${fmtK(ar)} (${Math.round((ar / totalAR) * 100)}%)`,
        })),
        metric: { label: `${top3Pct}% concentrated`, value: fmtK(top3AR) },
        actionLabel: 'Review credit limits',
        nextStep: 'Review credit limits',
    };
}

/** COST — Budget overrun risk: cost > 85% of contract at < 80% complete */
function buildBudgetOverrun(projects: any[], revenue: number): Insight | null {
    const hits = projects
        .filter(p => {
            const cv = (p.originalContract || 0) + (p.changeOrders || 0);
            const inc = p.income || 0;
            const cost = (p.qbCost || 0) + (p.devcoCost || 0);
            if (cv <= 0) return false;
            const pctComplete = Math.min(1, inc / cv);
            const costRatio = cost / cv;
            return costRatio > 0.85 && pctComplete < 0.80;
        })
        .map(p => {
            const cv = (p.originalContract || 0) + (p.changeOrders || 0);
            const cost = (p.qbCost || 0) + (p.devcoCost || 0);
            const projectedOverrun = cost - cv; // likely overrun amount
            return { p, projectedOverrun: Math.max(0, projectedOverrun) };
        })
        .sort((a, b) => b.projectedOverrun - a.projectedOverrun);

    if (hits.length === 0) return null;
    const totalOverrun = hits.reduce((s, h) => s + h.projectedOverrun, 0);

    return {
        id: 'budget-overrun',
        severity: dollarSeverity(Math.max(totalOverrun, revenue * 0.01), revenue, 'critical'),
        icon: 'AlertOctagon',
        title: `${hits.length} project${hits.length > 1 ? 's' : ''} at overrun risk`,
        detail: `At 85%+ cost but under 80% complete — these jobs will likely finish over budget without intervention.`,
        rootCause: `Productivity loss is the most common cause: rework, crew changes, weather delays, or scope that expanded without a CO. Immediate job cost review required.`,
        dollarImpact: Math.max(totalOverrun, revenue * 0.01),
        chips: hits.slice(0, 3).map(h => {
            const cv = (h.p.originalContract || 0) + (h.p.changeOrders || 0);
            const cost = (h.p.qbCost || 0) + (h.p.devcoCost || 0);
            return {
                label: h.p.DisplayName || h.p.proposalNumber || 'Project',
                value: `${cv > 0 ? ((cost / cv) * 100).toFixed(0) : '?'}% cost used`,
            };
        }),
        metric: { label: `${hits.length} jobs`, value: hits.length > 0 ? `${fmtK(totalOverrun)} likely overrun` : 'at risk' },
        actionLabel: `Review ${hits.length} job${hits.length > 1 ? 's' : ''}`,
        nextStep: 'Review job cost immediately',
        ruleId: 'budget-risk',
    };
}

/** COMPLIANCE — Margin erosion: trailing-3mo vs trailing-12mo */
function buildMarginErosion(projects: any[], revenue: number): Insight | null {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);

    const calcMargin = (ps: any[]) => {
        const inc = ps.reduce((s, p) => s + (p.income || 0), 0);
        const cost = ps.reduce((s, p) => s + (p.qbCost || 0) + (p.devcoCost || 0), 0);
        return inc > 0 ? ((inc - cost) / inc) * 100 : null;
    };

    const recent = projects.filter(p => {
        const d = p.startDate || p.MetaData?.CreateTime;
        return d && new Date(d) >= threeMonthsAgo;
    });
    const prior = projects.filter(p => {
        const d = p.startDate || p.MetaData?.CreateTime;
        return d && new Date(d) >= twelveMonthsAgo && new Date(d) < threeMonthsAgo;
    });

    const m3 = calcMargin(recent);
    const m12 = calcMargin(prior);
    if (m3 === null || m12 === null || m12 <= 0 || m3 >= m12 - 3) return null;

    const drop = m12 - m3;
    const dollarDrop = revenue * (drop / 100);

    return {
        id: 'margin-erosion',
        severity: dollarSeverity(dollarDrop, revenue, 'warning'),
        icon: 'TrendingDown',
        title: `Margin down ${drop.toFixed(1)} pts in 3 months`,
        detail: `Last 3 months: ${m3.toFixed(1)}% gross margin vs ${m12.toFixed(1)}% prior period. Annualised impact: ${fmtK(dollarDrop * 4)}.`,
        rootCause: `Margin compression usually signals rising material/sub costs not passed through, a shift toward lower-margin project types, or a drop in billing velocity inflating overhead per dollar earned.`,
        dollarImpact: dollarDrop,
        metric: { label: 'Drop', value: `${drop.toFixed(1)} pts` },
        actionLabel: 'Review margin by job type',
        nextStep: 'Adjust estimating rates',
        ruleId: 'margin-erosion',
    };
}

/** POSITIVE — Best PM this period */
function buildBestPM(projects: any[]): Insight | null {
    const pmMap = new Map<string, { totalMargin: number; count: number; income: number }>();
    projects.forEach(p => {
        const inc = p.income || 0;
        if (inc <= 0) return;
        const cost = (p.qbCost || 0) + (p.devcoCost || 0);
        const margin = ((inc - cost) / inc) * 100;
        (p.proposalWriters || []).forEach((w: string) => {
            const e = pmMap.get(w) || { totalMargin: 0, count: 0, income: 0 };
            e.totalMargin += margin; e.count += 1; e.income += inc;
            pmMap.set(w, e);
        });
    });

    let best = { pm: '', avgMargin: 0, count: 0, income: 0 };
    pmMap.forEach((d, pm) => {
        if (d.count < 2) return;
        const avg = d.totalMargin / d.count;
        if (avg * d.count > best.avgMargin * best.count) {
            best = { pm, avgMargin: avg, count: d.count, income: d.income };
        }
    });
    if (!best.pm) return null;

    return {
        id: 'best-pm',
        severity: 'positive',
        icon: 'Award',
        title: `${best.pm} — top performer this period`,
        detail: `${best.avgMargin.toFixed(0)}% avg margin across ${best.count} projects (${fmtK(best.income)} revenue).`,
        rootCause: `High-margin PMs typically excel at scope control, early CO identification, and keeping crews productive. Their estimating assumptions are worth benchmarking.`,
        dollarImpact: best.income * (best.avgMargin / 100),
        metric: { label: 'Avg margin', value: `${best.avgMargin.toFixed(0)}%` },
        actionLabel: 'View projects',
        nextStep: 'Benchmark their estimates',
    };
}

/** POSITIVE — Customer expansion: customer who grew spend > 25% vs prior period */
function buildCustomerExpansion(projects: any[], revenue: number): Insight | null {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);

    const incomeByPeriod = (ps: any[], from: Date, to: Date) => {
        const map = new Map<string, number>();
        ps.filter(p => {
            const d = p.startDate || p.MetaData?.CreateTime;
            if (!d) return false;
            const dt = new Date(d);
            return dt >= from && dt < to;
        }).forEach(p => {
            const name = p.CompanyName || 'Unknown';
            map.set(name, (map.get(name) || 0) + (p.income || 0));
        });
        return map;
    };

    const recent = incomeByPeriod(projects, sixMonthsAgo, now);
    const prior = incomeByPeriod(projects, twelveMonthsAgo, sixMonthsAgo);

    const growers: { customer: string; growth: number; recentIncome: number }[] = [];
    recent.forEach((inc, customer) => {
        const prev = prior.get(customer) || 0;
        if (prev > 0 && inc > prev * 1.25) {
            growers.push({ customer, growth: ((inc - prev) / prev) * 100, recentIncome: inc });
        }
    });
    growers.sort((a, b) => b.recentIncome - a.recentIncome);
    if (growers.length === 0) return null;

    const top = growers[0];
    return {
        id: 'customer-expansion',
        severity: 'positive',
        icon: 'TrendingUp',
        title: `${top.customer} spend up ${Math.round(top.growth)}% YoY`,
        detail: `${fmtK(top.recentIncome)} in last 6 months${growers.length > 1 ? ` · ${growers.length - 1} more customer${growers.length > 2 ? 's' : ''} growing` : ''}.`,
        rootCause: `Repeat customers who grow spend signal strong service satisfaction and are your best referral source. Now is the time to schedule a QBR and quote their next project.`,
        dollarImpact: top.recentIncome,
        chips: growers.slice(0, 3).map(g => ({
            label: g.customer,
            value: `+${Math.round(g.growth)}%`,
        })),
        metric: { label: 'Growth', value: `+${Math.round(top.growth)}%` },
        actionLabel: 'Schedule QBR',
        nextStep: 'Quote next project',
    };
}

// ── Main export ────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
    critical: 0, warning: 1, info: 2, positive: 3,
};

const MAX_INSIGHTS = 6;

export function computeInsightsV2(
    projects: any[],
    thresholds?: Partial<FinancialThresholds>,
): Insight[] {
    if (!projects.length) return [];
    const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
    const revenue = projects.reduce((s, p) => s + (p.income || 0), 0);

    const candidates: (Insight | null)[] = [
        // Cost anomalies — highest margin impact first
        buildBudgetOverrun(projects, revenue),
        buildLaborOutliers(projects, revenue),
        buildCOOpportunities(projects, revenue),
        // Cash risks
        buildSlowPayers(projects, revenue, t.dsoWarningDays),
        buildUnderBilling(projects, revenue, t.underBillingTolerancePct),
        buildConcentratedAR(projects, revenue),
        // Trend
        buildMarginErosion(projects, revenue),
        // Positive
        buildBestPM(projects),
        buildCustomerExpansion(projects, revenue),
    ];

    return candidates
        .filter((x): x is Insight => x !== null)
        .sort((a, b) => {
            const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
            if (sevDiff !== 0) return sevDiff;
            return b.dollarImpact - a.dollarImpact;
        })
        .slice(0, MAX_INSIGHTS);
}

// Re-export Insight type for consumers
export type { Insight as InsightV2 };
