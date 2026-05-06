/** Financial threshold defaults + types — shared between settings UI, insights engine, and API */

export interface FinancialThresholds {
    targetGrossMarginPct: number;
    customerConcentrationPct: number;
    dsoWarningDays: number;
    underBillingTolerancePct: number;
    overBillingTolerancePct: number;
}

export const DEFAULT_THRESHOLDS: FinancialThresholds = {
    targetGrossMarginPct: 20,
    customerConcentrationPct: 35,
    dsoWarningDays: 60,
    underBillingTolerancePct: 10,
    overBillingTolerancePct: 10,
};

export const THRESHOLD_LABELS: Record<keyof FinancialThresholds, { label: string; suffix: string; description: string }> = {
    targetGrossMarginPct: { label: 'Target Gross Margin', suffix: '%', description: 'Dashed reference line on the Margin Trend chart. Insights flag erosion below this.' },
    customerConcentrationPct: { label: 'Customer Concentration Warning', suffix: '%', description: 'Alert when a single customer exceeds this share of total revenue.' },
    dsoWarningDays: { label: 'DSO Warning Threshold', suffix: ' days', description: 'Flag customers whose average Days Sales Outstanding exceeds this.' },
    underBillingTolerancePct: { label: 'Under-billing Tolerance', suffix: '%', description: 'Allow this gap between earned-by-%-complete and billed before flagging.' },
    overBillingTolerancePct: { label: 'Over-billing Tolerance', suffix: '%', description: 'Allow this excess between billed and earned before flagging audit risk.' },
};
