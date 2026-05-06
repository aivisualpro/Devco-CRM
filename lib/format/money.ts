/**
 * Compact currency formatter for financial dashboards.
 * Renders clean, abbreviated dollar amounts: $1.2M, $342.5K, $850
 */
export function fmtMoney(n: number): string {
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${Math.round(abs).toLocaleString()}`;
}

/**
 * Full currency formatter — $1,234,567.00
 */
export function fmtCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(n);
}
