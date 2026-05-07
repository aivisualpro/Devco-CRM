/**
 * /lib/financials/leaderboards.ts
 * ─────────────────────────────────────────────────────────────────────
 * PM and Customer leaderboard builders extracted from the summary API.
 * Pure computation — no React, no side effects.
 */

export interface PmLeaderboardRow {
    pm: string;
    projectCount: number;
    totalRevenue: number;
    totalMargin: number;
    avgMarginPct: number;
}

export interface CustomerLeaderboardRow {
    customer: string;
    income: number;
    profit: number;
    marginPct: number;
    projectCount: number;
}

interface ProjectLike {
    income?: number;
    qbCost?: number;
    devcoCost?: number;
    CompanyName?: string;
    proposalWriters?: string[];
}

/**
 * Top PMs sorted by average gross margin %.
 * Filters out PMs with < $1 k revenue to avoid noise from one-off entries.
 */
export function buildPmLeaderboard(
    projects: ProjectLike[],
    limit = 10,
): PmLeaderboardRow[] {
    const map = new Map<string, { inc: number; cost: number; n: number }>();

    projects.forEach(p => {
        const inc  = p.income   || 0;
        const cost = (p.qbCost || 0) + (p.devcoCost || 0);
        (p.proposalWriters || []).forEach(w => {
            const e = map.get(w) || { inc: 0, cost: 0, n: 0 };
            e.inc  += inc;
            e.cost += cost;
            e.n++;
            map.set(w, e);
        });
    });

    return Array.from(map.entries())
        .filter(([, v]) => v.inc > 1_000)
        .map(([pm, v]) => ({
            pm,
            projectCount: v.n,
            totalRevenue: Math.round(v.inc),
            totalMargin:  Math.round(v.inc - v.cost),
            avgMarginPct: v.inc > 0 ? ((v.inc - v.cost) / v.inc) * 100 : 0,
        }))
        .sort((a, b) => b.avgMarginPct - a.avgMarginPct)
        .slice(0, limit);
}

/**
 * Top customers sorted by gross profit.
 */
export function buildCustomerLeaderboard(
    projects: ProjectLike[],
    limit = 10,
): CustomerLeaderboardRow[] {
    const map = new Map<string, { inc: number; cost: number; n: number }>();

    projects.forEach(p => {
        const c    = p.CompanyName || 'Unknown';
        const inc  = p.income   || 0;
        const cost = (p.qbCost || 0) + (p.devcoCost || 0);
        const e    = map.get(c) || { inc: 0, cost: 0, n: 0 };
        e.inc  += inc;
        e.cost += cost;
        e.n++;
        map.set(c, e);
    });

    return Array.from(map.entries())
        .map(([customer, v]) => ({
            customer,
            income:       Math.round(v.inc),
            profit:       Math.round(v.inc - v.cost),
            marginPct:    v.inc > 0 ? ((v.inc - v.cost) / v.inc) * 100 : 0,
            projectCount: v.n,
        }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, limit);
}
