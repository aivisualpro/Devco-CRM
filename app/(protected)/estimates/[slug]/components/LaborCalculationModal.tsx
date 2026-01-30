'use client';

import { Modal } from '@/components/ui';

interface LaborBreakdown {
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

interface LaborItem {
    classification?: string;
    subClassification?: string;
    [key: string]: unknown;
}

interface LaborCalculationModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: LaborItem | null;
    breakdown: LaborBreakdown | null;
}

export function LaborCalculationModal({
    isOpen,
    onClose,
    item,
    breakdown
}: LaborCalculationModalProps) {
    if (!isOpen || !item || !breakdown) return null;

    const formatMoney = (n: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

    const formatNum = (n: number) =>
        new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`${item.classification || 'Item'} - ${item.subClassification || 'Sub Classification'} Cost Calculation`}
            footer={
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors text-sm"
                >
                    Close
                </button>
            }
        >
            <div className="space-y-6">
                {/* Top Row: 3 Rate Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1. Base Rate */}
                    <section>
                        <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3 flex items-center gap-2">
                            <span className="bg-gray-100 text-gray-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                                1
                            </span>
                            Base Rate
                        </h4>
                        <div className="space-y-2 bg-gray-50/50 p-3 rounded-lg">
                            <div className="flex justify-between text-xs group">
                                <span className="text-gray-600">Base Pay</span>
                                <span className="font-mono font-bold text-slate-900">
                                    {formatMoney(breakdown.basePay)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs group">
                                <span className="text-gray-600">
                                    W.Comp ({breakdown.wCompPct}%)
                                </span>
                                <span className="font-mono text-slate-600">
                                    {formatMoney(breakdown.wCompTaxAmount)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs group">
                                <span className="text-gray-600">
                                    Payroll Tax ({breakdown.payrollPct}%)
                                </span>
                                <span className="font-mono text-slate-600">
                                    {formatMoney(breakdown.payrollTaxAmount)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs group">
                                <span className="text-gray-600">Fringes ({(item.fringe as string) || 'None'})</span>
                                <span className="font-mono text-slate-600">
                                    {formatMoney(breakdown.fringe)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm font-bold pt-2 mt-1 border-t border-gray-200">
                                <span className="text-gray-900">Base Rate</span>
                                <span className="font-mono text-blue-600">
                                    {formatMoney(breakdown.totalBaseRate)}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* 2. OT Rate */}
                    <section>
                        <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3 flex items-center gap-2">
                            <span className="bg-gray-100 text-gray-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                                2
                            </span>
                            OT Rate
                        </h4>
                        <div className="space-y-2 bg-gray-50/50 p-3 rounded-lg">
                            <div className="flex justify-between text-xs group">
                                <span className="text-gray-600">OT Pay (×1.5)</span>
                                <span className="font-mono font-bold text-slate-900">
                                    {formatMoney(breakdown.basePay * 1.5)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs group">
                                <span className="text-gray-600">W.Comp ({breakdown.wCompPct}%)</span>
                                <span className="font-mono text-slate-600">
                                    {formatMoney(breakdown.otWCompTaxAmount)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs group">
                                <span className="text-gray-600">OT Payroll Tax</span>
                                <span className="font-mono text-slate-600">
                                    {formatMoney(breakdown.otPayrollTaxAmount)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs group">
                                <span className="text-gray-600">Fringes ({(item.fringe as string) || 'None'})</span>
                                <span className="font-mono text-slate-600">
                                    {formatMoney(breakdown.fringe)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm font-bold pt-2 mt-1 border-t border-gray-200">
                                <span className="text-gray-900">OT Rate</span>
                                <span className="font-mono text-blue-600">
                                    {formatMoney(breakdown.totalOtRate)}
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* 2.5. DT Rate */}
                    <section>
                        <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3 flex items-center gap-2">
                            <span className="bg-gray-100 text-gray-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                                2.5
                            </span>
                            DT Rate
                        </h4>
                        <div className="space-y-2 bg-gray-50/50 p-3 rounded-lg">
                            <div className="flex justify-between text-xs group">
                                <span className="text-gray-600">DT Pay (×2)</span>
                                <span className="font-mono font-bold text-slate-900">
                                    {formatMoney(breakdown.basePay * 2)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs group">
                                <span className="text-gray-600">W.Comp ({breakdown.wCompPct}%)</span>
                                <span className="font-mono text-slate-600">
                                    {formatMoney(breakdown.dtWCompTaxAmount)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs group">
                                <span className="text-gray-600">DT Payroll Tax</span>
                                <span className="font-mono text-slate-600">
                                    {formatMoney(breakdown.dtPayrollTaxAmount)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs group">
                                <span className="text-gray-600">Fringes ({(item.fringe as string) || 'None'})</span>
                                <span className="font-mono text-slate-600">
                                    {formatMoney(breakdown.fringe)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm font-bold pt-2 mt-1 border-t border-gray-200">
                                <span className="text-gray-900">DT Rate</span>
                                <span className="font-mono text-blue-600">
                                    {formatMoney(breakdown.totalDtRate)}
                                </span>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Bottom Row: Hours & Total */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     {/* 3. Hours */}
                    <section className="md:col-span-1">
                        <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-3 flex items-center gap-2">
                            <span className="bg-gray-100 text-gray-600 w-5 h-5 rounded-full flex items-center justify-center text-[10px]">
                                3
                            </span>
                            Hours
                        </h4>
                        <div className="space-y-3 bg-gray-50/50 p-3 rounded-lg">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-600">Total Hours</span>
                                <span className="font-mono font-bold text-slate-900">
                                    {formatNum(breakdown.totalHours)}
                                </span>
                            </div>
                            <div className="text-[10px] text-gray-400 pl-2 font-mono">
                                = {breakdown.quantity} (qty) × {breakdown.days} (days) × 8
                            </div>
                            <div className="flex justify-between text-xs mt-2 border-t border-gray-100 pt-2">
                                <span className="text-gray-600">Total OT Hours</span>
                                <span className="font-mono font-bold text-slate-900">
                                    {formatNum(breakdown.totalOtHours)}
                                </span>
                            </div>
                            <div className="text-[10px] text-gray-400 pl-2 font-mono">
                                = {breakdown.quantity} (qty) × {breakdown.days} (days) × {breakdown.otPd} (ot/day)
                            </div>
                             <div className="flex justify-between text-xs mt-2 border-t border-gray-100 pt-2">
                                <span className="text-gray-600">Total DT Hours</span>
                                <span className="font-mono font-bold text-slate-900">
                                    {formatNum(breakdown.totalDtHours)}
                                </span>
                            </div>
                            <div className="text-[10px] text-gray-400 pl-2 font-mono">
                                = {breakdown.quantity} (qty) × {breakdown.days} (days) × {breakdown.dtPd} (dt/day)
                            </div>
                        </div>
                    </section>
                
                    {/* 4. Total Calculation */}
                    <div className="md:col-span-2">
                        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-5 text-white shadow-lg h-full flex flex-col justify-center">
                            <div className="space-y-2 font-mono text-xs text-blue-100 mb-6">
                                <div>
                                    <span className="opacity-75">
                                        ({formatNum(breakdown.totalHours)} hrs × {formatMoney(breakdown.totalBaseRate)}) +
                                    </span>
                                </div>
                                <div>
                                    <span className="opacity-75">
                                        ({formatNum(breakdown.totalOtHours)} hrs × {formatMoney(breakdown.totalOtRate)}) +
                                    </span>
                                </div>
                                <div>
                                    <span className="opacity-75">
                                        ({formatNum(breakdown.totalDtHours)} hrs × {formatMoney(breakdown.totalDtRate)})
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-end justify-between border-t border-blue-400/30 pt-4">
                                <span className="text-blue-100 text-xs font-bold tracking-widest uppercase mb-1">
                                    Total Cost
                                </span>
                                <span className="text-3xl font-black tracking-tight">
                                    {formatMoney(breakdown.grandTotal)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
