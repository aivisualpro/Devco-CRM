/**
 * Compute financial insights from project data.
 * Pure math — no AI. Each insight is a bite-sized finding with an action link.
 */
import { DEFAULT_THRESHOLDS, FinancialThresholds } from '@/lib/constants/financialThresholds';

export interface Insight {
    id: string;
    severity: 'info' | 'warning' | 'critical' | 'positive';
    icon: string;
    title: string;
    detail: string;
    metric?: { label: string; value: string };
    actionLabel?: string;
    actionLink?: string;
}

interface ProjectData {
    Id: string;
    DisplayName: string;
    CompanyName?: string;
    income?: number;
    cost?: number;
    qbCost?: number;
    devcoCost?: number;
    profitMargin?: number;
    startDate?: string;
    status?: string;
    proposalNumber?: string;
    proposalWriters?: string[];
    originalContract?: number;
    changeOrders?: number;
    ar?: number;
    ap?: number;
    avgCostPerHr?: number; // Labor cost per site hour (payroll / site hours)
    MetaData: { CreateTime: string };
}

function fmtK(n: number): string {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
    return `${sign}$${Math.round(abs)}`;
}

export function computeInsights(projects: ProjectData[], thresholds?: Partial<FinancialThresholds>): Insight[] {
    const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
    const insights: Insight[] = [];
    if (!projects.length) return insights;

    const totalIncome = projects.reduce((s, p) => s + (p.income || 0), 0);
    const totalCost = projects.reduce((s, p) => s + (p.qbCost || 0) + (p.devcoCost || 0), 0);

    // ── A. Above-average labor cost ──
    const avgLaborRatio = totalIncome > 0 ? totalCost / totalIncome : 0;
    const highLaborProjects = projects.filter(p => {
        const inc = p.income || 0;
        if (inc <= 0) return false;
        const cost = (p.qbCost || 0) + (p.devcoCost || 0);
        return (cost / inc) > avgLaborRatio * 1.5;
    });
    if (highLaborProjects.length > 0) {
        insights.push({
            id: 'above-avg-labor',
            severity: highLaborProjects.length >= 5 ? 'critical' : 'warning',
            icon: 'Hammer',
            title: 'Above-average cost',
            detail: `${highLaborProjects.length} project${highLaborProjects.length > 1 ? 's' : ''} have cost 50%+ above average. Review staffing.`,
            metric: { label: 'Org avg', value: `${(avgLaborRatio * 100).toFixed(0)}%` },
            actionLabel: `View ${highLaborProjects.length} projects`,
        });
    }

    // ── B. Margin erosion ──
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    const recent3 = projects.filter(p => {
        const d = p.startDate || p.MetaData?.CreateTime;
        return d && new Date(d) >= threeMonthsAgo;
    });
    const prior12 = projects.filter(p => {
        const d = p.startDate || p.MetaData?.CreateTime;
        return d && new Date(d) >= twelveMonthsAgo && new Date(d) < threeMonthsAgo;
    });
    const margin3 = (() => {
        const inc = recent3.reduce((s, p) => s + (p.income || 0), 0);
        const cost = recent3.reduce((s, p) => s + (p.qbCost || 0) + (p.devcoCost || 0), 0);
        return inc > 0 ? ((inc - cost) / inc) * 100 : 0;
    })();
    const margin12 = (() => {
        const inc = prior12.reduce((s, p) => s + (p.income || 0), 0);
        const cost = prior12.reduce((s, p) => s + (p.qbCost || 0) + (p.devcoCost || 0), 0);
        return inc > 0 ? ((inc - cost) / inc) * 100 : 0;
    })();
    if (margin12 > 0 && margin3 < margin12 - 3) {
        insights.push({
            id: 'margin-erosion',
            severity: margin3 < margin12 - 8 ? 'critical' : 'warning',
            icon: 'TrendingDown',
            title: 'Margin erosion',
            detail: `Gross margin trending down — last 3 months ${margin3.toFixed(1)}%, prior ${margin12.toFixed(1)}%.`,
            metric: { label: 'Drop', value: `${(margin12 - margin3).toFixed(1)} pts` },
        });
    }

    // ── C. Slow-paying customers ──
    const customerAR = new Map<string, { totalAR: number; totalIncome: number; count: number }>();
    projects.forEach(p => {
        const name = p.CompanyName || 'Unknown';
        const ar = p.ar || 0;
        const inc = p.income || 0;
        if (ar <= 0) return;
        const e = customerAR.get(name) || { totalAR: 0, totalIncome: 0, count: 0 };
        e.totalAR += ar;
        e.totalIncome += inc;
        e.count += 1;
        customerAR.set(name, e);
    });
    customerAR.forEach((data, customer) => {
        if (data.count >= 2 && data.totalIncome > 0) {
            const avgDSO = (data.totalAR / data.totalIncome) * 365;
            if (avgDSO > t.dsoWarningDays) {
                insights.push({
                    id: `slow-pay-${customer.replace(/\s/g, '-').toLowerCase()}`,
                    severity: avgDSO > 90 ? 'critical' : 'warning',
                    icon: 'Clock',
                    title: 'Slow-paying customer',
                    detail: `${customer} avg pays in ${Math.round(avgDSO)} days. ${fmtK(data.totalAR)} outstanding.`,
                    metric: { label: 'DSO', value: `${Math.round(avgDSO)}d` },
                });
            }
        }
    });

    // ── D. Single-customer concentration ──
    if (totalIncome > 0) {
        const customerIncome = new Map<string, number>();
        projects.forEach(p => {
            const name = p.CompanyName || 'Unknown';
            customerIncome.set(name, (customerIncome.get(name) || 0) + (p.income || 0));
        });
        const sorted = Array.from(customerIncome.entries()).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
            const topPct = (sorted[0][1] / totalIncome) * 100;
            if (topPct > t.customerConcentrationPct) {
                insights.push({
                    id: 'customer-concentration',
                    severity: topPct > 50 ? 'critical' : 'warning',
                    icon: 'Users',
                    title: 'Customer concentration',
                    detail: `${sorted[0][0]} = ${topPct.toFixed(0)}% of revenue this period. Consider diversifying.`,
                    metric: { label: 'Revenue share', value: `${topPct.toFixed(0)}%` },
                });
            }
        }
    }

    // ── E. Stale projects ──
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
    const staleProjects = projects.filter(p => {
        if (p.status?.toLowerCase() !== 'in progress') return false;
        const d = p.startDate || p.MetaData?.CreateTime;
        if (!d) return false;
        return new Date(d) < sixtyDaysAgo;
    });
    if (staleProjects.length > 0) {
        insights.push({
            id: 'stale-projects',
            severity: staleProjects.length >= 5 ? 'warning' : 'info',
            icon: 'AlertCircle',
            title: 'Stale projects',
            detail: `${staleProjects.length} project${staleProjects.length > 1 ? 's' : ''} marked 'In Progress' started 60+ days ago. Verify status.`,
            actionLabel: `View ${staleProjects.length} projects`,
        });
    }

    // ── F. Under-billing (cash flow risk) ──
    let underBilledTotal = 0;
    let underBilledCount = 0;
    projects.forEach(p => {
        const inc = p.income || 0;
        const cv = (p.originalContract || 0) + (p.changeOrders || 0);
        if (cv <= 0) return;
        const pctComplete = Math.min(1, inc / cv);
        const earned = cv * pctComplete;
        if (inc < earned * (1 - t.underBillingTolerancePct / 100)) {
            underBilledTotal += earned - inc;
            underBilledCount++;
        }
    });
    if (underBilledCount > 0 && underBilledTotal > 1000) {
        insights.push({
            id: 'under-billing',
            severity: underBilledTotal > 50000 ? 'critical' : 'warning',
            icon: 'AlertTriangle',
            title: 'Under-billing risk',
            detail: `${fmtK(underBilledTotal)} under-billed across ${underBilledCount} job${underBilledCount > 1 ? 's' : ''}. Submit invoices.`,
            metric: { label: 'Gap', value: fmtK(underBilledTotal) },
        });
    }

    // ── G. Over-billing (audit risk) ──
    let overBilledTotal = 0;
    let overBilledCount = 0;
    let worstOverProject = '';
    let worstOverAmount = 0;
    projects.forEach(p => {
        const inc = p.income || 0;
        const cv = (p.originalContract || 0) + (p.changeOrders || 0);
        if (cv <= 0) return;
        const pctComplete = Math.min(1, inc / cv);
        const expected = cv * pctComplete;
        if (inc > expected * (1 + t.overBillingTolerancePct / 100)) {
            const over = inc - expected;
            overBilledTotal += over;
            overBilledCount++;
            if (over > worstOverAmount) {
                worstOverAmount = over;
                worstOverProject = p.DisplayName;
            }
        }
    });
    if (overBilledCount > 0 && overBilledTotal > 1000) {
        insights.push({
            id: 'over-billing',
            severity: 'warning',
            icon: 'ShieldAlert',
            title: 'Over-billing risk',
            detail: `${fmtK(overBilledTotal)} over-billed${worstOverProject ? ` on ${worstOverProject}` : ''}. Refund risk on audit.`,
            metric: { label: 'Excess', value: fmtK(overBilledTotal) },
        });
    }

    // ── H. Best-performing PM ──
    const pmStats = new Map<string, { totalMargin: number; count: number }>();
    projects.forEach(p => {
        const writers = p.proposalWriters || [];
        const inc = p.income || 0;
        if (inc <= 0) return;
        const cost = (p.qbCost || 0) + (p.devcoCost || 0);
        const margin = ((inc - cost) / inc) * 100;
        writers.forEach(w => {
            const e = pmStats.get(w) || { totalMargin: 0, count: 0 };
            e.totalMargin += margin;
            e.count += 1;
            pmStats.set(w, e);
        });
    });
    let bestPM = '';
    let bestScore = 0;
    let bestAvgMargin = 0;
    let bestCount = 0;
    pmStats.forEach((data, pm) => {
        if (data.count < 2) return;
        const avg = data.totalMargin / data.count;
        const score = avg * data.count;
        if (score > bestScore) {
            bestScore = score;
            bestPM = pm;
            bestAvgMargin = avg;
            bestCount = data.count;
        }
    });
    if (bestPM) {
        insights.push({
            id: 'best-pm',
            severity: 'positive',
            icon: 'Award',
            title: 'Top performer',
            detail: `${bestPM} has highest avg margin (${bestAvgMargin.toFixed(0)}%) across ${bestCount} projects.`,
            metric: { label: 'Avg margin', value: `${bestAvgMargin.toFixed(0)}%` },
        });
    }

    // ── I. Approaching budget ──
    const budgetRisk = projects.filter(p => {
        const cv = (p.originalContract || 0) + (p.changeOrders || 0);
        const inc = p.income || 0;
        const cost = (p.qbCost || 0) + (p.devcoCost || 0);
        if (cv <= 0) return false;
        const costRatio = cost / cv;
        const pctComplete = Math.min(100, (inc / cv) * 100);
        return costRatio > 0.85 && pctComplete < 80;
    });
    if (budgetRisk.length > 0) {
        insights.push({
            id: 'approaching-budget',
            severity: 'critical',
            icon: 'AlertOctagon',
            title: 'Budget overrun risk',
            detail: `${budgetRisk.length} project${budgetRisk.length > 1 ? 's' : ''} at 85%+ cost but <80% complete. Likely overrun.`,
            actionLabel: `View ${budgetRisk.length} projects`,
        });
    }

    // ── J. Change-order opportunities ──
    const coOpportunities = projects.filter(p => {
        const original = p.originalContract || 0;
        const co = p.changeOrders || 0;
        const cost = (p.qbCost || 0) + (p.devcoCost || 0);
        return original > 0 && co === 0 && cost > original * 1.05;
    });
    if (coOpportunities.length > 0) {
        insights.push({
            id: 'co-opportunities',
            severity: 'warning',
            icon: 'FilePlus2',
            title: 'Change order needed',
            detail: `${coOpportunities.length} job${coOpportunities.length > 1 ? 's' : ''} ran over budget without a CO. Bill the customer.`,
            actionLabel: `View ${coOpportunities.length} projects`,
        });
    }

    // ── K. High avg labor cost per hour ──
    const HIGH_COST_THRESHOLD = 100; // $/hr
    const highCostProjects = projects.filter(p => (p.avgCostPerHr || 0) >= HIGH_COST_THRESHOLD);
    if (highCostProjects.length > 0) {
        const worst = highCostProjects.reduce((a, b) => (a.avgCostPerHr || 0) > (b.avgCostPerHr || 0) ? a : b);
        const worstRate = worst.avgCostPerHr || 0;
        insights.push({
            id: 'high-cost-per-hour',
            severity: worstRate >= 150 ? 'critical' : 'warning',
            icon: 'Clock',
            title: 'High labor cost/hr',
            detail: `${highCostProjects.length} project${highCostProjects.length > 1 ? 's' : ''} exceed $${HIGH_COST_THRESHOLD}/hr avg labor cost. Worst: ${worst.DisplayName} at $${worstRate}/hr.`,
            metric: { label: 'Worst rate', value: `$${worstRate}/hr` },
            actionLabel: `View ${highCostProjects.length} projects`,
        });
    }

    // Sort: critical → warning → info → positive
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2, positive: 3 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return insights;
}
