// Estimate calculation utilities

export interface LaborBreakdown {
    basePay: number;
    quantity: number;
    days: number;
    otPd: number;
    wCompPct: number;
    payrollPct: number;
    fringe: number;
    totalHours: number;
    totalOtHours: number;
    wCompTaxAmount: number;
    payrollTaxAmount: number;
    otPayrollTaxAmount: number;
    totalBaseRate: number;
    totalOtRate: number;
    totalDtRate: number;
    grandTotal: number;
    dtPd: number;
    totalDtHours: number;
    dtPayrollTaxAmount: number;
    otWCompTaxAmount: number;
    dtWCompTaxAmount: number;
}

export interface FringeConstant {
    description: string;
    value: unknown;
    color?: string;
}

/**
 * Get fringe rate from constants
 */
export function getFringeRate(fringeDescription: string | undefined, fringeConstants: FringeConstant[]): number {
    if (!fringeDescription) return 0;
    if (!Array.isArray(fringeConstants)) return 0;

    const constant = fringeConstants.find(c => c.description === fringeDescription);
    if (!constant || !constant.value) return 0;

    const val = parseFloat(String(constant.value).replace(/[^0-9.-]+/g, ""));
    return isNaN(val) ? 0 : val;
}

/**
 * Parse numeric value from various formats
 */
export function parseNum(val: unknown): number {
    if (val === undefined || val === null || val === '') return 0;
    const parsed = parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Calculate labor breakdown using 10-step formula
 */
export function getLaborBreakdown(
    item: Record<string, unknown>,
    fringeConstants: FringeConstant[]
): LaborBreakdown {
    const basePay = parseNum(item.basePay);
    const qty = parseNum(item.quantity);
    const days = parseNum(item.days);
    const otPd = parseNum(item.otPd);
    const dtPd = parseNum(item.dtPd);
    const wCompPct = parseNum(item.wCompPercent);
    const taxesPct = parseNum(item.payrollTaxesPercent);
    const fringeRate = getFringeRate(item.fringe as string, fringeConstants);

    // 1. Total Hours
    const totalHours = qty * days * 8;

    // 2. Total OT Hours
    const totalOtHours = qty * days * otPd;

    // 2.5 Total DT Hours
    const totalDtHours = qty * days * dtPd;

    // 3. WComp Tax
    const wCompTaxAmount = basePay * (wCompPct / 100);
    const otWCompTaxAmount = (basePay * 1.5) * (wCompPct / 100);
    const dtWCompTaxAmount = (basePay * 2) * (wCompPct / 100);

    // 4. Payroll Taxes
    const payrollTaxAmount = basePay * (taxesPct / 100);

    // 5 & 8. OT Payroll Taxes
    const otPayrollTaxAmount = basePay * 1.5 * (taxesPct / 100);
    const dtPayrollTaxAmount = basePay * 2 * (taxesPct / 100);

    // 6. Fringes (Value from constants)
    const fringeAmount = fringeRate;

    // 7. Base Rate
    const baseRate = basePay + wCompTaxAmount + payrollTaxAmount + fringeAmount;

    // 9. OT Rate = (Base Pay * 1.5) + WComp + OT Payroll Tax + Fringe
    const otBasePay = basePay * 1.5;
    const otRate = otBasePay + otWCompTaxAmount + otPayrollTaxAmount + fringeAmount;

    // DT Rate = (Base Pay * 2) + WComp + DT Payroll Tax + Fringe
    const dtBasePay = basePay * 2;
    const dtRate = dtBasePay + dtWCompTaxAmount + dtPayrollTaxAmount + fringeAmount;

    // 10. Total
    const total = (totalHours * baseRate) + (totalOtHours * otRate) + (totalDtHours * dtRate);
    const safeTotal = isNaN(total) ? 0 : total;

    return {
        basePay,
        quantity: qty,
        days,
        otPd,
        wCompPct,
        payrollPct: taxesPct,
        fringe: fringeAmount,
        totalHours,
        totalOtHours,
        wCompTaxAmount,
        payrollTaxAmount,
        otPayrollTaxAmount,
        totalBaseRate: baseRate,
        totalOtRate: otRate,
        totalDtRate: dtRate,
        grandTotal: safeTotal,
        dtPd,
        totalDtHours,
        dtPayrollTaxAmount,
        otWCompTaxAmount,
        dtWCompTaxAmount
    };
}

/**
 * Calculate labor total (simplified for Per Diem/Hotel)
 */
export function calculateLaborTotal(
    item: Record<string, unknown>,
    fringeConstants: FringeConstant[]
): number {
    const subClass = String(item.subClassification || '').toLowerCase();

    // Per Diem or Hotel: simple calculation
    if (subClass === 'per diem' || subClass === 'hotel') {
        const basePay = parseNum(item.basePay);
        const qty = parseNum(item.quantity);
        const days = parseNum(item.days);
        return basePay * qty * days;
    }

    // Use complex breakdown
    return getLaborBreakdown(item, fringeConstants).grandTotal;
}

/**
 * Calculate equipment total
 */
export function calculateEquipmentTotal(item: Record<string, unknown>): number {
    const qty = parseNum(item.quantity);
    const times = parseNum(item.times) || 1;
    const uom = String(item.uom || 'Daily');

    let cost = 0;
    if (uom === 'Daily') cost = parseNum(item.dailyCost);
    else if (uom === 'Weekly') cost = parseNum(item.weeklyCost);
    else if (uom === 'Monthly') cost = parseNum(item.monthlyCost);
    else cost = parseNum(item.dailyCost);

    const fuel = parseNum(item.fuelAdditiveCost);
    const delivery = parseNum(item.deliveryPickup);

    const baseTotal = cost * qty * times;
    const fuelTotal = qty * fuel;
    const deliveryTotal = qty * delivery;

    return baseTotal + fuelTotal + deliveryTotal;
}

/**
 * Calculate material total
 */
export function calculateMaterialTotal(item: Record<string, unknown>): number {
    const qty = parseNum(item.quantity);
    const cost = parseNum(item.cost);
    const taxes = parseNum(item.taxes);
    const delivery = parseNum(item.deliveryPickup);
    const subTotal = qty * cost;
    const taxedTotal = subTotal * (1 + taxes / 100);
    return taxedTotal + delivery;
}

/**
 * Calculate simple quantity * days * cost total (for Miscellaneous etc.)
 */
export function calculateSimpleTotal(item: Record<string, unknown>): number {
    const qty = parseNum(item.quantity) || 1;
    const days = parseNum(item.days) || 1; // Default to 1 if not provided
    const cost = parseNum(item.cost);
    return qty * days * cost;
}

/**
 * Calculate overhead total
 */
export function calculateOverheadTotal(item: Record<string, unknown>): number {
    const days = parseNum(item.days);
    const dailyRate = parseNum(item.dailyRate);
    return days * dailyRate;
}

/**
 * Section colors
 */
export const sectionColors: Record<string, string> = {
    Labor: '#4F7E17',
    Equipment: '#0000FF',
    Material: '#F88702',
    Tools: '#800080',
    Overhead: '#F0C400',
    Subcontractor: '#7B4019',
    Disposal: '#000000',
    Miscellaneous: '#CD0302'
};

/**
 * Get section color
 */
export function getSectionColor(
    sectionName: string,
    fringeConstants: FringeConstant[]
): string {
    if (!Array.isArray(fringeConstants)) return sectionColors[sectionName] || '#cbd5e1';

    // Normalize name for search
    const norm = (s: string) => s.toLowerCase().trim();
    const target = norm(sectionName);

    // Handle specific mappings (e.g. Tools -> Tool)
    const variations = [target, `${target} color`];
    if (target === 'tools') {
        variations.push('tool');
        variations.push('tool color');
    }

    const constant = fringeConstants.find(c => {
        const desc = norm(c.description || '');
        return variations.includes(desc);
    });

    if (constant) {
        // Prefer 'color' field if available (from Catalogue type constants)
        if (constant.color && constant.color.trim()) return constant.color.trim();
        // Fallback to value field if it looks like a color
        if (constant.value && String(constant.value).trim()) return String(constant.value).trim();
    }

    return sectionColors[sectionName] || '#cbd5e1';
}
