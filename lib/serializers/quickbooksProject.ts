/**
 * QuickBooks Project Serializers
 * Utility functions for computing derived financial metrics from raw QB data.
 */

/**
 * Compute Accounts Receivable from a project's transaction history.
 * A/R = Income (billed via Invoices) − Payments Received
 */
export function computeAR(project: any) {
    const payments = (project.transactions || [])
        .filter((t: any) => /payment/i.test(t.transactionType))
        .reduce((s: number, t: any) => s + Math.abs(Number(t.amount) || 0), 0);
    const income = Number(project.income) || 0;
    return {
        paymentsReceived: payments,
        outstanding: Math.max(0, income - payments),
        collectedPct: income > 0 ? (payments / income) * 100 : 0,
    };
}

/**
 * Compute the current contract value (Original + Approved Change Orders)
 */
export function computeContractValue(project: any) {
    const original = Number(project.originalContract) || 0;
    const changeOrders = Number(project.changeOrders) || 0;
    return original + changeOrders;
}

/**
 * Compute Backlog — the remaining un-earned portion of the contract.
 * Backlog = Contract Value − Revenue Earned to Date
 */
export function computeBacklog(project: any) {
    const contractValue = computeContractValue(project);
    const income = Number(project.income) || 0;
    return Math.max(0, contractValue - income);
}

/**
 * Compute % Complete based on revenue earned vs contract value.
 * Uses cost-ratio method: Revenue / Contract Value
 */
export function computePercentComplete(project: any) {
    const contractValue = computeContractValue(project);
    const income = Number(project.income) || 0;
    if (contractValue <= 0) return 0;
    return Math.min(100, (income / contractValue) * 100);
}
