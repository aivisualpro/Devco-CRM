/**
 * /lib/financials/cashFlow.ts
 * ─────────────────────────────────────────────────────────────────────
 * Cash-flow forecast helpers extracted from the summary API route.
 * Pure computation — no React, no side effects.
 */

export interface CashFlowBucket {
    inflow: number;
    outflow: number;
    net: number;
}

export interface CashFlowForecastPoint {
    date: string;
    inflow: number;
    outflow: number;
    cumulative: number;
}

export interface CashFlowResult {
    next30: CashFlowBucket;
    next60: CashFlowBucket;
    next90: CashFlowBucket;
    forecast: CashFlowForecastPoint[];
}

/**
 * Build a 90-day cash-flow forecast from annualised KPI values.
 * Uses a linear run-rate model (monthly inflow/outflow ÷ 30 × 7 for weekly points).
 * Replace with invoice-level data when available for higher accuracy.
 */
export function buildCashFlowForecast(
    annualEarnedRevenue: number,
    annualTotalCost: number,
): CashFlowResult {
    const mIn  = annualEarnedRevenue / 12;
    const mOut = annualTotalCost / 12;

    const bucket = (months: number): CashFlowBucket => ({
        inflow:  Math.round(mIn  * months),
        outflow: Math.round(mOut * months),
        net:     Math.round((mIn - mOut) * months),
    });

    const today = new Date();
    let cumulative = 0;
    const forecast: CashFlowForecastPoint[] = [];
    const dailyIn  = mIn  / 30;
    const dailyOut = mOut / 30;

    for (let day = 7; day <= 90; day += 7) {
        const d = new Date(today);
        d.setDate(today.getDate() + day);
        const weekIn  = dailyIn  * 7;
        const weekOut = dailyOut * 7;
        cumulative += weekIn - weekOut;
        forecast.push({
            date:        d.toISOString().slice(0, 10),
            inflow:      Math.round(weekIn),
            outflow:     Math.round(weekOut),
            cumulative:  Math.round(cumulative),
        });
    }

    return {
        next30:   bucket(1),
        next60:   bucket(2),
        next90:   bucket(3),
        forecast,
    };
}
