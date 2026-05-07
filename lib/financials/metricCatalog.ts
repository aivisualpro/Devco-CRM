/**
 * /lib/financials/metricCatalog.ts
 * Metric explainer catalog — powers the MetricInfoPopover on every card/chart.
 */

export interface MetricInput {
    label: string;
    source: string;
    notes?: string;
}

export interface MetricInterpretation {
    good: string;
    watch: string;
    bad: string;
}

export interface MetricExplainer {
    id: string;
    title: string;
    shortDef: string;
    formula: string;
    inputs: MetricInput[];
    why: string;
    interpretation: MetricInterpretation;
    relatedMetrics: string[];
    faq?: Array<{ q: string; a: string }>;
    seeAlso?: Array<{ label: string; href: string }>;
}

const CATALOG: MetricExplainer[] = [

    // ── REVENUE & PIPELINE ────────────────────────────────────────────────

    {
        id: 'earnedRevenue',
        title: 'Earned Revenue',
        shortDef: 'Total amount billed to customers in the selected period.',
        formula: 'Σ (DevcoQuickBooks.income for projects whose startDate falls in the period)',
        inputs: [
            {
                label: 'Income per project',
                source: 'DevcoQuickBooks.income (synced from QuickBooks)',
                notes: 'Sum of all customer invoice amounts',
            },
            {
                label: 'Period filter',
                source: 'DevcoQuickBooks.startDate',
                notes: 'Only projects whose start date falls in the date range are included',
            },
        ],
        why: "Earned Revenue is the most direct measure of company throughput. Unlike Total Contract Value (which includes future work), this is money you've already invoiced. It's the top line on every income statement.",
        interpretation: {
            good: 'Trending up month-over-month at or above the company\'s annual growth target.',
            watch: 'Flat or down by less than 10% — could be seasonal.',
            bad: 'Down >10% YoY without a known cause (lost customer, market shift).',
        },
        relatedMetrics: ['totalContractValue', 'backlog', 'winRate'],
        faq: [
            {
                q: "Why doesn't this match my QB Income report?",
                a: 'QB reports often include all transaction types. This metric only counts Customer Invoice transactions on Project entities. Sales Receipts and unattributed payments are excluded.',
            },
        ],
    },

    {
        id: 'totalContractValue',
        title: 'Total Contract Value',
        shortDef: 'Original signed contract amount + approved Change Orders, summed across the period\'s projects.',
        formula: 'Σ (originalContract + changeOrders) where originalContract = manualOriginalContract OR Σ Estimate.grandTotal for the proposalNumber',
        inputs: [
            { label: 'originalContract', source: 'DevcoQuickBooks.manualOriginalContract OR Estimate.grandTotal' },
            { label: 'changeOrders', source: 'DevcoQuickBooks.manualChangeOrders OR Σ Estimate(isChangeOrder=true).grandTotal' },
        ],
        why: "Tells you the total $ value of work you've committed to deliver. Subtract Earned Revenue from this to get Backlog (what's left to bill).",
        interpretation: {
            good: 'Growing each quarter at or above your sales target.',
            watch: 'Flat — backlog won\'t grow.',
            bad: 'Shrinking — sales aren\'t replacing executed work fast enough.',
        },
        relatedMetrics: ['backlog', 'earnedRevenue', 'winRate'],
    },

    {
        id: 'backlog',
        title: 'Backlog',
        shortDef: "Contract value that's signed but not yet billed.",
        formula: 'Σ (totalContractValue - earnedRevenue) where the difference is positive',
        inputs: [
            { label: 'Total Contract Value', source: 'see Total Contract Value definition' },
            { label: 'Earned Revenue', source: 'DevcoQuickBooks.income' },
        ],
        why: 'Backlog is your runway. Express it in months: Backlog ÷ avg monthly revenue = months of work locked in. CFOs use this to plan hiring and equipment purchases.',
        interpretation: {
            good: 'Backlog covers 4–8 months of revenue at current run rate.',
            watch: '2–4 months — start the sales push.',
            bad: '< 2 months — high risk of revenue gap.',
        },
        relatedMetrics: ['totalContractValue', 'earnedRevenue', 'winRate'],
    },

    {
        id: 'pctComplete',
        title: '% Complete (weighted)',
        shortDef: 'How far along your portfolio is, weighted by project size.',
        formula: 'Σ Earned Revenue ÷ Σ Total Contract Value × 100',
        inputs: [
            { label: 'Earned Revenue', source: 'DevcoQuickBooks.income' },
            { label: 'Total Contract Value', source: 'originalContract + changeOrders' },
        ],
        why: 'On any single job, % Complete drives revenue recognition under POC accounting. Across the portfolio, it tells you how much remaining work is locked in vs delivered.',
        interpretation: {
            good: 'Stable 40–70% — you\'ve got both delivered AND remaining work in healthy proportion.',
            watch: '> 80% — backlog is thinning, prioritize sales.',
            bad: '< 20% — most work is still ahead of you, watch for execution risk.',
        },
        relatedMetrics: ['backlog', 'eac', 'overUnderBilling'],
    },

    {
        id: 'avgProjectSize',
        title: 'Average Project Size',
        shortDef: 'Mean contract value per project in the period.',
        formula: 'Σ totalContractValue ÷ project count',
        inputs: [
            { label: 'Total Contract Value', source: 'originalContract + changeOrders per project' },
            { label: 'Project count', source: 'Count of DevcoQuickBooks documents matching filter' },
        ],
        why: 'Shifts in average size signal a strategy change — bigger jobs usually mean better margins (overhead absorption) but more concentration risk. Smaller jobs mean more turnover but more PM coordination cost.',
        interpretation: {
            good: 'Stable or rising — economies of scale improving.',
            watch: 'Sudden drop — may be taking on too many small/unprofitable jobs.',
            bad: 'Dropping below your job-economic break-even (the size at which a project barely covers PM cost).',
        },
        relatedMetrics: ['winRate', 'grossMargin'],
    },

    {
        id: 'winRate',
        title: 'Win Rate',
        shortDef: 'Percentage of proposals submitted that became signed contracts.',
        formula: "Estimates with status='Won' ÷ (Won + Lost + Pending older than 30 days) × 100",
        inputs: [
            { label: 'Won estimates', source: "Estimate.status = 'Won'" },
            { label: 'Lost estimates', source: "Estimate.status = 'Lost'" },
            { label: 'Stale pending', source: "Estimate.status = 'Pending' AND createdAt > 30 days ago" },
        ],
        why: 'Industry benchmark for sales effectiveness. Low Win Rate with healthy revenue means you\'re spending too much on losing bids. High Win Rate may mean you\'re under-pricing.',
        interpretation: {
            good: '30–50% (industry typical for competitive bidding).',
            watch: '< 25% (qualifying problem) or > 60% (likely under-pricing).',
            bad: '< 15% — review the proposal-pricing process.',
        },
        relatedMetrics: ['avgProjectSize', 'earnedRevenue'],
    },

    // ── PROFITABILITY ─────────────────────────────────────────────────────

    {
        id: 'totalCost',
        title: 'Total Cost',
        shortDef: "All recorded costs to deliver the period's projects.",
        formula: 'Σ (qbCost + jobTicketCost) per project',
        inputs: [
            {
                label: 'qbCost',
                source: 'DevcoQuickBooks.qbCost (synced from QB Profit & Loss)',
                notes: 'Includes materials, subcontractors, equipment expenses booked in QB',
            },
            {
                label: 'jobTicketCost',
                source: 'DevcoQuickBooks.devcoCost (computed from Schedule timesheet × labor rates × overhead rate)',
                notes: "Captures internal labor cost not yet in QB",
            },
        ],
        why: 'Cost is the lever you control. QB cost reflects external spend; Job Ticket cost reflects your own crew\'s time.',
        interpretation: {
            good: 'Cost ratio (cost ÷ revenue) ≤ 75%.',
            watch: '75–85%.',
            bad: '> 85% — negative margin warning.',
        },
        relatedMetrics: ['grossProfit', 'grossMargin', 'costVariance'],
    },

    {
        id: 'grossProfit',
        title: 'Gross Profit',
        shortDef: 'Revenue left after all direct project costs.',
        formula: 'Earned Revenue − Total Cost',
        inputs: [
            { label: 'Earned Revenue', source: 'see Earned Revenue' },
            { label: 'Total Cost', source: 'see Total Cost' },
        ],
        why: "Gross Profit pays for everything else — overhead, sales, admin, taxes, and the owner's distribution. It's the most important single number on this dashboard.",
        interpretation: {
            good: 'Trending up; supports overhead with margin to spare.',
            watch: 'Flat while revenue grows — costs eating into delivery.',
            bad: 'Shrinking or negative.',
        },
        relatedMetrics: ['grossMargin', 'operatingMargin', 'totalCost'],
    },

    {
        id: 'grossMargin',
        title: 'Gross Margin %',
        shortDef: 'Gross Profit as a share of revenue.',
        formula: '(Earned Revenue − Total Cost) ÷ Earned Revenue × 100',
        inputs: [
            { label: 'Earned Revenue', source: 'DevcoQuickBooks.income' },
            { label: 'Total Cost', source: 'qbCost + devcoCost' },
        ],
        why: 'Margin is comparable across job sizes. Use it to compare service types, customers, and PMs without revenue masking the answer.',
        interpretation: {
            good: '≥ 25% (target for civil/electrical specialty contractors).',
            watch: '15–25%.',
            bad: '< 15% — pricing problem, cost overruns, or under-billing.',
        },
        relatedMetrics: ['grossProfit', 'operatingMargin', 'costVariance'],
    },

    {
        id: 'eac',
        title: 'Estimate at Completion (EAC)',
        shortDef: 'Forecast of total project cost when all work is done.',
        formula: 'Σ (totalCost ÷ pctComplete) per project — or use ETC formula: actual + (remaining work × current burn rate)',
        inputs: [
            { label: 'Total Cost to date', source: 'qbCost + devcoCost' },
            { label: '% Complete', source: 'Earned Revenue ÷ Contract Value' },
        ],
        why: 'EAC tells you if jobs are TRACKING to estimate. If EAC > original estimate, you\'ll lose money unless billing catches up via Change Orders.',
        interpretation: {
            good: 'EAC ≤ original estimated cost.',
            watch: 'EAC 5–10% over estimate.',
            bad: 'EAC > 10% over estimate — initiate change-order conversations.',
        },
        relatedMetrics: ['costVariance', 'overUnderBilling', 'grossMargin'],
    },

    {
        id: 'overUnderBilling',
        title: 'Over / (Under) Billing',
        shortDef: "Difference between what you've billed and what you've earned by % complete.",
        formula: 'Σ (Income − Total Contract Value × % Complete)',
        inputs: [
            { label: 'Income', source: 'DevcoQuickBooks.income' },
            { label: 'Earned by POC', source: 'Total Contract Value × % Complete' },
        ],
        why: "Positive = OVER-billed = customer paid for work you haven't delivered yet (good cash, but audit risk). Negative = UNDER-billed = you've done the work but haven't invoiced (cash flow leak).",
        interpretation: {
            good: 'Slightly positive (5–10% of revenue) — collected ahead, no audit risk.',
            watch: 'Significantly under-billed — submit pending invoices.',
            bad: '> 15% over-billed — audit / refund risk on contract close-out.',
        },
        relatedMetrics: ['pctComplete', 'earnedRevenue', 'dso'],
    },

    {
        id: 'costVariance',
        title: 'Cost Variance vs Estimate',
        shortDef: 'How much actual cost is over or under the bid estimate.',
        formula: '(actual cost − estimated cost) ÷ estimated cost × 100',
        inputs: [
            { label: 'Actual cost', source: 'qbCost + devcoCost' },
            { label: 'Estimated cost', source: 'Σ Estimate line items (material + labor + equipment + subs + overhead)' },
        ],
        why: 'Negative = under budget (good), positive = over budget. Trending positive means the estimating team is consistently under-bidding or the field is over-running.',
        interpretation: {
            good: '0% to −10% (slightly under budget).',
            watch: '+0% to +5%.',
            bad: '> +5%.',
        },
        relatedMetrics: ['eac', 'grossMargin', 'laborProductivity'],
    },

    // ── CASH & WORKING CAPITAL ────────────────────────────────────────────

    {
        id: 'paymentsReceived',
        title: 'Payments Received',
        shortDef: 'Customer payments collected in the period.',
        formula: "Σ |amount| where transactionType='Invoice' AND status='Paid'",
        inputs: [
            { label: 'Paid invoices', source: "DevcoQuickBooks.transactions[].amount where transactionType='Invoice' AND status='Paid'" },
        ],
        why: 'Cash actually in the bank from customers. Compare to Earned Revenue: a wide gap = high A/R.',
        interpretation: {
            good: '≥ 80% of Earned Revenue collected within 60 days.',
            watch: '60–80%.',
            bad: '< 60% — collection problem.',
        },
        relatedMetrics: ['arOutstanding', 'dso', 'arAging'],
    },

    {
        id: 'arOutstanding',
        title: 'A/R Outstanding',
        shortDef: 'Money owed to you by customers, not yet paid.',
        formula: 'Earned Revenue − Payments Received (per project, then summed)',
        inputs: [
            { label: 'Income', source: 'DevcoQuickBooks.income' },
            { label: 'Payments', source: 'Σ |payment transactions|' },
        ],
        why: 'A/R is your largest non-cash asset. Aging A/R is the leading indicator of bad debt.',
        interpretation: {
            good: '< 30% of Earned Revenue, mostly aged < 60 days.',
            watch: '30–50% with aging slipping toward 90+.',
            bad: '> 50% or any large balance > 90 days.',
        },
        relatedMetrics: ['paymentsReceived', 'dso', 'arAging'],
    },

    {
        id: 'dso',
        title: 'DSO (Days Sales Outstanding)',
        shortDef: 'Average number of days it takes customers to pay.',
        formula: '(Average A/R ÷ Earned Revenue) × Days in Period',
        inputs: [
            { label: 'Average A/R', source: 'Avg of (Income − Payments) across the period' },
            { label: 'Period days', source: 'End date − Start date' },
        ],
        why: 'Lower is better. DSO trending up = customers slowing down. Combine with the AR Aging chart to see WHICH customers are slowing.',
        interpretation: {
            good: '≤ 45 days (industry benchmark for specialty contractors).',
            watch: '45–60 days.',
            bad: '> 60 days — collections problem.',
        },
        relatedMetrics: ['arOutstanding', 'arAging', 'paymentsReceived'],
    },

    {
        id: 'payables',
        title: 'Payables (A/P)',
        shortDef: 'Money you owe vendors and subcontractors, not yet paid.',
        formula: "Σ |amount| of vendor-bill or expense transactions outstanding",
        inputs: [
            { label: 'Transactions', source: "DevcoQuickBooks.transactions where transactionType='Bill' or 'Vendor Credit'" },
        ],
        why: "Compare A/P to A/R for working capital health. Healthy: A/P < A/R (you're a net lender — bad). Healthier: A/P ≈ A/R (matched timing).",
        interpretation: {
            good: 'Aging < 60 days, manageable as a % of monthly revenue.',
            watch: 'Stretching beyond contractual payment terms.',
            bad: 'Late payables — supplier relationship damage.',
        },
        relatedMetrics: ['arOutstanding', 'dso'],
    },

    // ── OPERATIONS & PEOPLE ───────────────────────────────────────────────

    {
        id: 'laborProductivity',
        title: 'Labor Productivity',
        shortDef: 'Revenue generated per labor hour.',
        formula: 'Earned Revenue ÷ Total Labor Hours',
        inputs: [
            { label: 'Earned Revenue', source: 'DevcoQuickBooks.income' },
            { label: 'Total Labor Hours', source: "Σ Schedule.timesheet[].hours where type ≠ 'drive'" },
        ],
        why: "The single best operational efficiency metric. Rising productivity = better crews, better tools, or better job mix. Falling = wasted hours.",
        interpretation: {
            good: '$X / hour where X is at or above your industry segment benchmark.',
            watch: 'Trending down despite stable revenue — crew efficiency issue.',
            bad: 'Big drop coincides with new hires — onboarding/training gap.',
        },
        relatedMetrics: ['costVariance', 'grossMargin'],
    },

    {
        id: 'costBreakdown',
        title: 'Cost Breakdown',
        shortDef: 'How total cost is split between Labor, QB Cost, Equipment, Subs, Materials.',
        formula: 'Each component / Total Cost × 100',
        inputs: [
            { label: 'Labor cost', source: 'Σ devcoCost (timesheet × hourly rate)' },
            { label: 'QB Cost', source: 'DevcoQuickBooks.qbCost' },
            { label: 'Other categories', source: 'Estimate line items by category, summed for projects in period' },
        ],
        why: 'Knowing the mix tells you which lever to pull. Labor-heavy = focus on productivity. Subcontractor-heavy = focus on procurement.',
        interpretation: {
            good: "Stable mix with no single category > 60% (unless your business is purposely lopsided).",
            watch: 'One category creeping above target.',
            bad: 'Big shifts month-over-month — investigate the cause.',
        },
        relatedMetrics: ['totalCost', 'laborProductivity'],
    },

    // ── INSIGHTS ──────────────────────────────────────────────────────────

    {
        id: 'insight-slow-paying-customers',
        title: 'Slow-Paying Customers',
        shortDef: 'Customers whose payments routinely take longer than your DSO target.',
        formula: 'Customer-level avg DSO calculated from their last 12 months of paid invoices, filtered to those > the target threshold (default 60 days).',
        inputs: [
            { label: 'Customer transactions', source: 'DevcoQuickBooks.transactions filtered by customer' },
            { label: 'DSO threshold', source: 'Constant.AppSettings.financialThresholds.dsoTarget (default 60)' },
        ],
        why: 'Identifies the customers who tie up your working capital. Use this for collections priority and for deciding whether to require deposits or factoring.',
        interpretation: {
            good: 'Empty list or only first-time customers (still establishing payment cadence).',
            watch: 'Repeat customers slipping > 60 days.',
            bad: 'Multiple repeat customers > 90 days — start charging interest or stop extending credit.',
        },
        relatedMetrics: ['dso', 'arAging', 'arOutstanding'],
    },

    {
        id: 'insight-above-average-cost',
        title: 'Above-Average Cost',
        shortDef: 'Projects whose labor or material cost exceeds the org average by more than 50%.',
        formula: 'Project where (cost / revenue) > org average × 1.5',
        inputs: [
            { label: 'Project cost', source: 'qbCost + devcoCost' },
            { label: 'Org average cost ratio', source: "Σ all projects' (cost ÷ revenue)" },
        ],
        why: 'Outliers signal estimating bias, scope creep without a CO, or productivity issues. Investigate before they recur.',
        interpretation: {
            good: '0–2 outliers per period (statistical noise).',
            watch: '3–5 outliers, especially if same PM or service type.',
            bad: 'Trend: outlier count growing month over month.',
        },
        relatedMetrics: ['costVariance', 'laborProductivity'],
    },

    {
        id: 'insight-margin-erosion',
        title: 'Margin Erosion',
        shortDef: 'Trailing-3-month margin trending down vs trailing-12-month.',
        formula: 'TTM3 Margin − TTM12 Margin (alarm if difference < −3%)',
        inputs: [
            { label: 'Margin TTM3', source: 'Earned Revenue and Total Cost over last 3 months' },
            { label: 'Margin TTM12', source: 'Same over last 12 months' },
        ],
        why: 'Catches gradual margin slippage that month-over-month numbers miss.',
        interpretation: {
            good: 'TTM3 ≥ TTM12 (improving).',
            watch: 'TTM3 1–3 points below TTM12.',
            bad: 'TTM3 > 3 points below TTM12 — pricing or cost discipline failing.',
        },
        relatedMetrics: ['grossMargin', 'costVariance'],
    },

    // ── CHARTS ────────────────────────────────────────────────────────────

    {
        id: 'margin-trend',
        title: 'Margin Trend (Last 12 Months)',
        shortDef: 'Monthly Gross and Operating Margin %.',
        formula: 'Per month: (Earned Revenue − Total Cost) ÷ Earned Revenue × 100',
        inputs: [
            { label: 'Earned Revenue', source: "Σ DevcoQuickBooks.income for projects whose startDate falls in that month" },
            { label: 'Total Cost', source: 'Σ (qbCost + devcoCost) for those projects' },
        ],
        why: 'Shows whether your business is improving, plateauing, or eroding. Flag: 3 consecutive months of decline.',
        interpretation: {
            good: 'At or above the target margin band (the green dashed line).',
            watch: 'Inside the band but trending down.',
            bad: 'Below the band, especially for 2+ consecutive months.',
        },
        relatedMetrics: ['grossMargin', 'operatingMargin'],
    },

    {
        id: 'ar-aging',
        title: 'A/R Aging',
        shortDef: "Outstanding receivables grouped by how long they've been unpaid.",
        formula: 'For each unpaid invoice, days_unpaid = today − invoice_date. Bucket: 0–30, 31–60, 61–90, 91+.',
        inputs: [
            { label: 'Invoices', source: 'DevcoQuickBooks.transactions where transactionType matches invoice and not yet fully paid' },
        ],
        why: "The CFO's go-to chart. The 91+ bucket is where bad debt lives — anything in that column is at high risk of becoming uncollectible.",
        interpretation: {
            good: 'Most of A/R in 0–30 bucket; minimal 91+ balance.',
            watch: 'Growing 61–90 bucket (customers slipping).',
            bad: 'Significant 91+ balance — write-off risk.',
        },
        relatedMetrics: ['dso', 'arOutstanding'],
    },

    {
        id: 'customer-concentration',
        title: 'Customer Concentration',
        shortDef: 'Top 10 customers ranked by revenue, with cumulative % overlay.',
        formula: 'Sort customers by Σ Earned Revenue desc; show top 10 + Σ as % of total revenue.',
        inputs: [
            { label: 'Customer revenue', source: 'DevcoQuickBooks.income grouped by customer' },
        ],
        why: 'Single-customer concentration is the #1 hidden risk for specialty contractors. If your top customer = 50% of revenue and they leave, you\'re in trouble.',
        interpretation: {
            good: 'Top 1 ≤ 25%, top 5 ≤ 60%.',
            watch: 'Top 1 = 25–35%.',
            bad: 'Top 1 > 35% — diversify the book.',
        },
        relatedMetrics: ['earnedRevenue'],
    },

    {
        id: 'health-heatmap',
        title: 'Project Health Heatmap',
        shortDef: 'Every active project as a colored tile, sorted by composite Project Health Score.',
        formula: 'Project Health Score = 0.30·margin + 0.20·schedule + 0.20·cost + 0.15·cash + 0.10·compliance + 0.05·risk (each subscore 0–100).',
        inputs: [
            { label: 'Margin score', source: 'Project gross margin vs target margin band' },
            { label: 'Schedule score', source: '% complete vs % time elapsed (Schedule.fromDate to toDate)' },
            { label: 'Cost score', source: 'actual cost vs estimate (cost variance %)' },
            { label: 'Cash score', source: 'Payment received % + DSO age' },
            { label: 'Compliance score', source: 'Has JHA, has DJT, all timesheets clocked out' },
            { label: 'Risk score', source: 'Anomaly flags raised by the insights engine' },
        ],
        why: "One number per job that says 'is this OK?' Click any tile to drill into the project.",
        interpretation: {
            good: 'Most tiles green (80+) and yellow (60–79).',
            watch: 'Several orange tiles (40–59) — review them this week.',
            bad: 'Any red tiles (< 40) — intervene immediately.',
        },
        relatedMetrics: ['grossMargin', 'costVariance', 'dso', 'overUnderBilling'],
    },

    {
        id: 'cash-flow-forecast',
        title: 'Cash Flow Forecast (90 days)',
        shortDef: 'Projected inflow (expected payments) and outflow (payables due) for the next 90 days.',
        formula: 'Inflow = Σ A/R aging buckets × historical collection probability. Outflow = Σ A/P due dates.',
        inputs: [
            { label: 'A/R buckets', source: 'Aged invoices, multiplied by avg collection rate per bucket' },
            { label: 'A/P due dates', source: 'DevcoQuickBooks.transactions of type bill, with due dates' },
        ],
        why: 'Prevents surprises. If projected outflow > inflow on day 35, plan a draw or call your top customer for early payment.',
        interpretation: {
            good: 'Cumulative net positive across all 90 days.',
            watch: 'Net negative on individual days but cumulative still positive.',
            bad: 'Cumulative goes negative — cash gap.',
        },
        relatedMetrics: ['arOutstanding', 'payables', 'dso'],
    },
];

const CATALOG_MAP = new Map<string, MetricExplainer>(CATALOG.map(m => [m.id, m]));

export function getMetricExplainer(id: string): MetricExplainer | null {
    return CATALOG_MAP.get(id) ?? null;
}

export function getAllMetricIds(): string[] {
    return CATALOG.map(m => m.id);
}

export default CATALOG;
