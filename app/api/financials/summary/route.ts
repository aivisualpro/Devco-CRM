import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getCachedWipCalculations } from '@/app/api/quickbooks/projects/route';

// ── Types ──
interface Project {
    Id: string; DisplayName: string; CompanyName?: string;
    income?: number; qbCost?: number; devcoCost?: number; cost?: number;
    profitMargin?: number; startDate?: string; status?: string;
    proposalNumber?: string; proposalSlug?: string;
    proposalWriters?: string[]; originalContract?: number;
    changeOrders?: number; ar?: number; ap?: number;
    MetaData: { CreateTime: string };
}

interface Insight {
    id: string; severity: 'info' | 'warning' | 'critical' | 'positive';
    icon: string; title: string; detail: string;
    metric?: { label: string; value: string };
    actionLabel?: string; actionLink?: string;
    _impact?: number; // internal sort key
}

// ── Helpers ──
function fmtK(n: number): string {
    const abs = Math.abs(n); const sign = n < 0 ? '-' : '';
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
    return `${sign}$${Math.round(abs)}`;
}

function computeDateRange(preset: string) {
    const now = new Date(); const y = now.getFullYear(); const m = now.getMonth();
    const today = now.toISOString().slice(0, 10);
    switch (preset) {
        case 'this_month': return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: today };
        case 'last_month': {
            const lm = m === 0 ? 11 : m - 1; const ly = m === 0 ? y - 1 : y;
            const ld = new Date(ly, lm + 1, 0).getDate();
            return { from: `${ly}-${String(lm + 1).padStart(2, '0')}-01`, to: `${ly}-${String(lm + 1).padStart(2, '0')}-${String(ld).padStart(2, '0')}` };
        }
        case 'this_year': return { from: `${y}-01-01`, to: today };
        case 'last_year': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
        default: return { from: '', to: '' };
    }
}

function filterProjects(projects: Project[], dateFrom: string, dateTo: string, writers: string[], statuses: string[], customers: string[]) {
    return projects.filter(p => {
        const ref = p.startDate || p.MetaData?.CreateTime;
        if (ref) {
            const d = new Date(ref);
            if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false;
            if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
        }
        if (writers.length && !(p.proposalWriters || []).some(w => writers.includes(w))) return false;
        if (statuses.length && !statuses.includes(p.status || '')) return false;
        if (customers.length && !customers.includes(p.CompanyName || '')) return false;
        return true;
    });
}

function buildKpis(projects: Project[], dateFrom: string, dateTo: string) {
    const sum = (k: keyof Project) => projects.reduce((s, p) => s + (Number((p as any)[k]) || 0), 0);
    const income = sum('income'); const qbCost = sum('qbCost'); const devcoCost = sum('devcoCost');
    const totalCost = qbCost + devcoCost; const profit = income - totalCost;
    const originalContract = sum('originalContract'); const changeOrders = sum('changeOrders');
    const contractValue = originalContract + changeOrders;
    const backlog = Math.max(0, contractValue - income);
    const pctComplete = contractValue > 0 ? Math.min(100, (income / contractValue) * 100) : 0;
    const pctFrac = pctComplete / 100;
    const arOutstanding = sum('ar'); const paymentsReceived = income - arOutstanding;
    const payables = sum('ap');
    const periodDays = (() => {
        if (!dateFrom || !dateTo) return 365;
        return Math.max(1, Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000));
    })();
    return {
        contractValue, earnedRevenue: income, backlog, pctComplete,
        avgProjectSize: projects.length > 0 ? contractValue / projects.length : 0,
        totalCost, grossProfit: profit,
        grossMarginPct: income > 0 ? (profit / income) * 100 : 0,
        eac: pctFrac > 0 ? totalCost / pctFrac : 0,
        overUnderBilling: income - contractValue * pctFrac,
        paymentsReceived, arOutstanding, payables,
        dso: income > 0 ? Math.round((arOutstanding / income) * periodDays) : 0,
        projectCount: projects.length,
    };
}

function buildMarginTrend(projects: Project[]) {
    const map = new Map<string, { income: number; cost: number }>();
    const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    projects.forEach(p => {
        const d = p.startDate || p.MetaData?.CreateTime; if (!d) return;
        const dt = new Date(d);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        const e = map.get(key) || { income: 0, cost: 0 };
        e.income += p.income || 0; e.cost += (p.qbCost || 0) + (p.devcoCost || 0);
        map.set(key, e);
    });
    return Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b)).slice(-12).map(([k, v]) => {
        const [y, m] = k.split('-');
        const gm = v.income > 0 ? ((v.income - v.cost) / v.income) * 100 : 0;
        return { month: `${mn[+m - 1]} ${y.slice(2)}`, grossMargin: Math.round(gm * 10) / 10, operatingMargin: Math.round((gm - 5) * 10) / 10, target: 25 };
    });
}

function buildArAging(projects: Project[]) {
    const now = Date.now();
    const buckets: Record<string, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '91+': 0 };
    projects.forEach(p => {
        const ar = p.ar || 0; if (ar <= 0) return;
        const d = p.startDate || p.MetaData?.CreateTime; if (!d) return;
        const days = Math.floor((now - new Date(d).getTime()) / 86400000);
        if (days <= 30) buckets['0-30'] += ar;
        else if (days <= 60) buckets['31-60'] += ar;
        else if (days <= 90) buckets['61-90'] += ar;
        else buckets['91+'] += ar;
    });
    return Object.entries(buckets).map(([bucket, amount]) => ({ bucket, amount }));
}

function buildCustomerConcentration(projects: Project[], totalIncome: number) {
    const map = new Map<string, number>();
    projects.forEach(p => { const n = p.CompanyName || 'Unknown'; map.set(n, (map.get(n) || 0) + (p.income || 0)); });
    return Array.from(map.entries()).sort((a,b) => b[1] - a[1]).slice(0, 10)
        .map(([customer, revenue]) => ({ customer, revenue, pctOfTotal: totalIncome > 0 ? Math.round((revenue / totalIncome) * 1000) / 10 : 0 }));
}

function buildWaterfall(projects: Project[]) {
    const map = new Map<string, { earned: number; cv: number }>();
    const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    projects.forEach(p => {
        const d = p.startDate || p.MetaData?.CreateTime; if (!d) return;
        const dt = new Date(d);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        const e = map.get(key) || { earned: 0, cv: 0 };
        e.earned += p.income || 0; e.cv += (p.originalContract || 0) + (p.changeOrders || 0);
        map.set(key, e);
    });
    let cum = 0;
    return Array.from(map.entries()).sort(([a],[b]) => a.localeCompare(b)).slice(-12).map(([k, v]) => {
        const [y, m] = k.split('-'); cum += v.cv;
        return { month: `${mn[+m - 1]} ${y.slice(2)}`, earnedRevenue: v.earned, backlogBurn: Math.max(0, v.cv - v.earned), cumulativeContract: cum };
    });
}

function buildTopProjects(projects: Project[], orgAvgMargin: number) {
    return [...projects].map(p => {
        const inc = p.income || 0; const cost = (p.qbCost || 0) + (p.devcoCost || 0);
        const profit = inc - cost; const margin = inc > 0 ? (profit / inc) * 100 : 0;
        const cv = (p.originalContract || 0) + (p.changeOrders || 0);
        const pctComplete = cv > 0 ? Math.min(100, (inc / cv) * 100) : 0;
        const ar = p.ar || 0; const costRatio = cv > 0 ? cost / cv : 0;
        const billedPct = cv > 0 ? (inc / cv) * 100 : 0;
        const anomalies: string[] = [];
        if (costRatio > 0.95 && pctComplete < 90) anomalies.push('over_budget');
        const startD = p.startDate || p.MetaData?.CreateTime;
        if (ar > 0 && startD && (Date.now() - new Date(startD).getTime()) / 86400000 > 45) anomalies.push('slow_billing');
        if (cv > 0 && pctComplete > billedPct + 10) anomalies.push('under_billed');
        if (orgAvgMargin > 0 && margin > orgAvgMargin * 1.5) anomalies.push('outperforming');
        return { id: p.Id, name: p.DisplayName, customer: p.CompanyName, proposalNumber: p.proposalNumber, proposalSlug: p.proposalSlug, income: inc, cost, profit, margin, ar, pctComplete, anomalies };
    }).sort((a, b) => b.profit - a.profit).slice(0, 10);
}

/** Build 12-month monthly sparkline buckets for primary KPIs */
function buildSparklines(projects: Project[]) {
    const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();
    // Build sorted keys for last 12 months
    const keys: string[] = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const buckets = new Map<string, {
        income: number; cost: number; ar: number; profit: number;
        contractValue: number; backlog: number;
    }>();
    keys.forEach(k => buckets.set(k, { income: 0, cost: 0, ar: 0, profit: 0, contractValue: 0, backlog: 0 }));

    projects.forEach(p => {
        const d = p.startDate || p.MetaData?.CreateTime;
        if (!d) return;
        const dt = new Date(d);
        const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        const b = buckets.get(key);
        if (!b) return;
        b.income += p.income || 0;
        b.cost += (p.qbCost || 0) + (p.devcoCost || 0);
        b.ar += p.ar || 0;
        b.profit += (p.income || 0) - ((p.qbCost || 0) + (p.devcoCost || 0));
        const cv = (p.originalContract || 0) + (p.changeOrders || 0);
        b.contractValue += cv;
        b.backlog += Math.max(0, cv - (p.income || 0));
    });

    const vals = keys.map(k => buckets.get(k)!);
    return {
        income: vals.map(v => v.income),
        cost: vals.map(v => v.cost),
        profit: vals.map(v => v.profit),
        ar: vals.map(v => v.ar),
        backlog: vals.map(v => v.backlog),
        margin: vals.map(v => v.income > 0 ? ((v.income - v.cost) / v.income) * 100 : 0),
        labels: keys.map(k => { const [y, m] = k.split('-'); return `${mn[+m - 1]} ${y.slice(2)}`; }),
    };
}

function buildInsights(projects: Project[]): Insight[] {
    const insights: Insight[] = [];
    const totalIncome = projects.reduce((s, p) => s + (p.income || 0), 0);
    const totalCost = projects.reduce((s, p) => s + (p.qbCost || 0) + (p.devcoCost || 0), 0);
    const avgCostRatio = totalIncome > 0 ? totalCost / totalIncome : 0;

    // A. Above-average cost
    const high = projects.filter(p => { const i = p.income || 0; return i > 0 && ((p.qbCost || 0) + (p.devcoCost || 0)) / i > avgCostRatio * 1.5; });
    if (high.length) insights.push({ id: 'above-avg-labor', severity: high.length >= 5 ? 'critical' : 'warning', icon: 'Hammer', title: 'Above-average cost', detail: `${high.length} projects have cost 50%+ above average.`, metric: { label: 'Org avg', value: `${(avgCostRatio * 100).toFixed(0)}%` }, _impact: high.reduce((s, p) => s + ((p.qbCost || 0) + (p.devcoCost || 0)), 0) });

    // B. Margin erosion
    const now = new Date();
    const r3 = projects.filter(p => { const d = p.startDate || p.MetaData?.CreateTime; return d && new Date(d) >= new Date(now.getFullYear(), now.getMonth() - 3, 1); });
    const p12 = projects.filter(p => { const d = p.startDate || p.MetaData?.CreateTime; return d && new Date(d) >= new Date(now.getFullYear(), now.getMonth() - 12, 1) && new Date(d) < new Date(now.getFullYear(), now.getMonth() - 3, 1); });
    const m3i = r3.reduce((s, p) => s + (p.income || 0), 0); const m3c = r3.reduce((s, p) => s + (p.qbCost || 0) + (p.devcoCost || 0), 0);
    const m12i = p12.reduce((s, p) => s + (p.income || 0), 0); const m12c = p12.reduce((s, p) => s + (p.qbCost || 0) + (p.devcoCost || 0), 0);
    const mg3 = m3i > 0 ? ((m3i - m3c) / m3i) * 100 : 0; const mg12 = m12i > 0 ? ((m12i - m12c) / m12i) * 100 : 0;
    if (mg12 > 0 && mg3 < mg12 - 3) insights.push({ id: 'margin-erosion', severity: mg3 < mg12 - 8 ? 'critical' : 'warning', icon: 'TrendingDown', title: 'Margin erosion', detail: `Last 3 months ${mg3.toFixed(1)}% vs prior ${mg12.toFixed(1)}%.`, metric: { label: 'Drop', value: `${(mg12 - mg3).toFixed(1)} pts` }, _impact: Math.abs(mg12 - mg3) * totalIncome / 100 });

    // C. Slow-paying customers (grouped)
    const cAR = new Map<string, { ar: number; inc: number; n: number }>();
    projects.forEach(p => { const ar = p.ar || 0; if (ar <= 0) return; const c = p.CompanyName || '?'; const e = cAR.get(c) || { ar: 0, inc: 0, n: 0 }; e.ar += ar; e.inc += p.income || 0; e.n++; cAR.set(c, e); });
    const slowArr: Array<{ c: string; dso: number; ar: number }> = [];
    cAR.forEach((d, c) => { if (d.n >= 2 && d.inc > 0) { const dso = (d.ar / d.inc) * 365; if (dso > 60) slowArr.push({ c, dso: Math.round(dso), ar: d.ar }); } });
    if (slowArr.length > 0) {
        slowArr.sort((a, b) => b.dso - a.dso);
        const w = slowArr[0]; const extra = slowArr.length - 1;
        const det = extra > 0
            ? `${w.c} (${w.dso}d DSO, ${fmtK(w.ar)}) and ${extra} more slow payer${extra > 1 ? 's' : ''}.`
            : `${w.c} avg ${w.dso}d. ${fmtK(w.ar)} outstanding.`;
        insights.push({ id: 'slow-paying-customers', severity: w.dso > 90 ? 'critical' : 'warning', icon: 'Clock', title: `Slow-paying customer${slowArr.length > 1 ? 's' : ''}`, detail: det, metric: { label: `${slowArr.length} payer${slowArr.length > 1 ? 's' : ''}`, value: `${w.dso}d worst` }, _impact: slowArr.reduce((s, x) => s + x.ar, 0) });
    }

    // D. Customer concentration
    if (totalIncome > 0) { const ci = new Map<string, number>(); projects.forEach(p => { const n = p.CompanyName || '?'; ci.set(n, (ci.get(n) || 0) + (p.income || 0)); }); const s = Array.from(ci.entries()).sort((a, b) => b[1] - a[1]); if (s.length && (s[0][1] / totalIncome) * 100 > 35) { const pct = (s[0][1] / totalIncome) * 100; insights.push({ id: 'concentration', severity: pct > 50 ? 'critical' : 'warning', icon: 'Users', title: 'Customer concentration', detail: `${s[0][0]} = ${pct.toFixed(0)}% of revenue.`, metric: { label: 'Share', value: `${pct.toFixed(0)}%` }, _impact: s[0][1] }); } }

    // E. Stale projects
    const stale = projects.filter(p => p.status?.toLowerCase() === 'in progress' && (() => { const d = p.startDate || p.MetaData?.CreateTime; return d && new Date(d) < new Date(Date.now() - 60 * 864e5); })());
    if (stale.length) insights.push({ id: 'stale', severity: stale.length >= 5 ? 'warning' : 'info', icon: 'AlertCircle', title: 'Stale projects', detail: `${stale.length} 'In Progress' started 60+ days ago.`, actionLabel: `View ${stale.length}`, _impact: stale.reduce((s, p) => s + (p.income || 0), 0) });

    // F. Under-billing
    let ubT = 0, ubN = 0;
    projects.forEach(p => { const i = p.income || 0; const cv = (p.originalContract || 0) + (p.changeOrders || 0); if (cv <= 0) return; const pc = Math.min(1, i / cv); const earned = cv * pc; if (i < earned * 0.9) { ubT += earned - i; ubN++; } });
    if (ubN > 0 && ubT > 1000) insights.push({ id: 'under-billing', severity: ubT > 50000 ? 'critical' : 'warning', icon: 'AlertTriangle', title: 'Under-billing risk', detail: `${fmtK(ubT)} under-billed across ${ubN} jobs.`, metric: { label: 'Gap', value: fmtK(ubT) }, _impact: ubT });

    // G. Over-billing
    let obT = 0, obN = 0, obW = '', obA = 0;
    projects.forEach(p => { const i = p.income || 0; const cv = (p.originalContract || 0) + (p.changeOrders || 0); if (cv <= 0) return; const pc = Math.min(1, i / cv); const exp = cv * pc; if (i > exp * 1.1) { const o = i - exp; obT += o; obN++; if (o > obA) { obA = o; obW = p.DisplayName; } } });
    if (obN > 0 && obT > 1000) insights.push({ id: 'over-billing', severity: 'warning', icon: 'ShieldAlert', title: 'Over-billing risk', detail: `${fmtK(obT)} over-billed${obW ? ` on ${obW}` : ''}.`, metric: { label: 'Excess', value: fmtK(obT) }, _impact: obT });

    // H. Best PM
    const pm = new Map<string, { tm: number; n: number }>(); projects.forEach(p => { const i = p.income || 0; if (i <= 0) return; const c = (p.qbCost || 0) + (p.devcoCost || 0); const mg = ((i - c) / i) * 100; (p.proposalWriters || []).forEach(w => { const e = pm.get(w) || { tm: 0, n: 0 }; e.tm += mg; e.n++; pm.set(w, e); }); });
    let bp = '', bs = 0, bm = 0, bn = 0; pm.forEach((d, w) => { if (d.n < 2) return; const a = d.tm / d.n; const sc = a * d.n; if (sc > bs) { bs = sc; bp = w; bm = a; bn = d.n; } });
    if (bp) insights.push({ id: 'best-pm', severity: 'positive', icon: 'Award', title: 'Top performer', detail: `${bp} avg margin ${bm.toFixed(0)}% across ${bn} projects.`, metric: { label: 'Margin', value: `${bm.toFixed(0)}%` }, _impact: 0 });

    // I. Budget overrun risk
    const br = projects.filter(p => { const cv = (p.originalContract || 0) + (p.changeOrders || 0); const c = (p.qbCost || 0) + (p.devcoCost || 0); const i = p.income || 0; return cv > 0 && c / cv > 0.85 && (i / cv) * 100 < 80; });
    if (br.length) insights.push({ id: 'budget-risk', severity: 'critical', icon: 'AlertOctagon', title: 'Budget overrun risk', detail: `${br.length} projects at 85%+ cost / <80% complete.`, actionLabel: `View ${br.length}`, _impact: br.reduce((s, p) => s + (p.income || 0), 0) });

    // J. CO opportunities
    const co = projects.filter(p => { const o = p.originalContract || 0; const c = (p.qbCost || 0) + (p.devcoCost || 0); return o > 0 && (p.changeOrders || 0) === 0 && c > o * 1.05; });
    if (co.length) insights.push({ id: 'co-opportunities', severity: 'warning', icon: 'FilePlus2', title: 'Change order needed', detail: `${co.length} jobs over budget without a CO.`, actionLabel: `View ${co.length}`, _impact: co.reduce((s, p) => s + ((p.qbCost || 0) + (p.devcoCost || 0) - (p.originalContract || 0)), 0) });

    // Sort: severity → $ impact desc → id for determinism
    const sev: Record<string, number> = { critical: 0, warning: 1, info: 2, positive: 3 };
    insights.sort((a, b) => (sev[a.severity] - sev[b.severity]) || ((b._impact || 0) - (a._impact || 0)) || a.id.localeCompare(b.id));

    // Strip internal field, cap at 8
    return insights.slice(0, 8).map(({ _impact, ...rest }) => rest) as Insight[];
}

// ── Cached computation ──
const getCachedSummary = unstable_cache(
    async (dateFrom: string, dateTo: string, writers: string[], statuses: string[], customers: string[]) => {
        const allProjects = await getCachedWipCalculations() as Project[];
        const filtered = filterProjects(allProjects, dateFrom, dateTo, writers, statuses, customers);

        const kpis = buildKpis(filtered, dateFrom, dateTo);
        const orgMargin = kpis.earnedRevenue > 0 ? (kpis.grossProfit / kpis.earnedRevenue) * 100 : 0;

        // Previous period
        let previousPeriodKpis = null;
        if (dateFrom && dateTo) {
            const fromD = new Date(dateFrom); const toD = new Date(dateTo);
            const diff = toD.getTime() - fromD.getTime();
            const prevTo = new Date(fromD.getTime() - 1); const prevFrom = new Date(prevTo.getTime() - diff);
            const prevFiltered = filterProjects(allProjects, prevFrom.toISOString().slice(0, 10), prevTo.toISOString().slice(0, 10), writers, statuses, customers);
            if (prevFiltered.length) previousPeriodKpis = buildKpis(prevFiltered, prevFrom.toISOString().slice(0, 10), prevTo.toISOString().slice(0, 10));
        }

        return {
            kpis,
            previousPeriodKpis,
            marginTrend: buildMarginTrend(filtered),
            arAging: buildArAging(filtered),
            customerConcentration: buildCustomerConcentration(filtered, kpis.earnedRevenue),
            revenueVsBacklog: buildWaterfall(filtered),
            insights: buildInsights(filtered),
            topProjects: buildTopProjects(filtered, orgMargin),
            sparklines: buildSparklines(filtered),
        };
    },
    ['financials-summary'],
    { tags: ['financials-summary', 'quickbooks-projects'], revalidate: 60 }
);

// ── GET handler ──
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const preset = url.searchParams.get('datePreset') || 'this_year';
        let dateFrom = url.searchParams.get('dateFrom') || '';
        let dateTo = url.searchParams.get('dateTo') || '';

        if (preset !== 'custom' && preset !== 'all_time') {
            const range = computeDateRange(preset);
            dateFrom = range.from; dateTo = range.to;
        }

        const writers = url.searchParams.get('proposalWriters')?.split(',').filter(Boolean) || [];
        const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];
        const customers = url.searchParams.get('customers')?.split(',').filter(Boolean) || [];

        const data = await getCachedSummary(dateFrom, dateTo, writers, statuses, customers);
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Financials summary error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
