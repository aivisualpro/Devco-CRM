'use client';

import React, { useMemo } from 'react';
import { Info } from 'lucide-react';
import { GenericLineItemsTable, LineItemColumnConfig } from '@/components/line-items/GenericLineItemsTable';
import { getFringeRate, type FringeConstant } from '@/lib/estimateCalculations';

interface LaborLineItemsTableProps {
    items: any[];
    onUpdateItem?: (item: any, field: string, value: string | number) => void;
    onExplain?: (item: any) => void;
    onDelete?: (item: any) => void;
    onDuplicate?: (item: any) => void;
    fringeRate?: number;
    fringeConstants?: FringeConstant[];
}

export function LaborLineItemsTable({
    items,
    onUpdateItem,
    onExplain,
    onDelete,
    onDuplicate,
    fringeRate = 0,
    fringeConstants = []
}: LaborLineItemsTableProps) {
    const columns = useMemo<LineItemColumnConfig[]>(() => [
        { key: 'labor', header: 'Labor', type: 'text', editable: true, width: '40%' },
        { key: 'basePay', header: 'Base Pay', type: 'number', editable: true, width: '7%' },
        { key: 'quantity', header: 'Qty', type: 'number', editable: true, width: '7%' },
        { key: 'days', header: 'Days', type: 'number', editable: true, width: '7%' },
        { key: 'otPd', header: 'OTPD', type: 'number', editable: true, width: '7%' },
        { key: 'dtPd', header: 'DTPD', type: 'number', editable: true, width: '7%' },
        { 
            key: 'fringe', 
            header: 'Fringe', 
            type: 'currency', 
            editable: false, 
            width: '7%',
            computed: (row) => {
                return (row.fringe && fringeConstants
                    ? getFringeRate(row.fringe as string, fringeConstants)
                    : fringeRate) || 0;
            }
        },
        { key: 'wCompPercent', header: 'W.Comp', type: 'percent', editable: false, width: '7%' },
        { key: 'payrollTaxesPercent', header: 'Payroll', type: 'percent', editable: false, width: '7%' },
        { 
            key: 'total', 
            header: 'Total', 
            type: 'currency', 
            editable: false, 
            align: 'right',
            width: '14%',
            render: (row, val) => (
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        onExplain?.(row);
                    }}
                    className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1 justify-end"
                    title="View Calculation Breakdown"
                >
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val)}
                    <Info className="w-2.5 h-2.5 opacity-50" />
                </div>
            ),
            computed: (row) => {
                const basePay = parseFloat(row.basePay) || 0;
                const qty = parseFloat(row.quantity) || 0;
                const days = parseFloat(row.days) || 0;
                const otPd = parseFloat(row.otPd) || 0;
                const dtPd = parseFloat(row.dtPd) || 0;
                const wCompPct = parseFloat(row.wCompPercent) || 0;
                const taxesPct = parseFloat(row.payrollTaxesPercent) || 0;

                const subClass = String(row.subClassification || '').toLowerCase();

                if (subClass === 'per diem' || subClass === 'hotel') {
                    return basePay * qty * days;
                }

                const totalHours = qty * days * 8;
                const totalOtHours = qty * days * otPd;

                const wCompTaxAmount = basePay * (wCompPct / 100);
                const otWCompTaxAmount = (basePay * 1.5) * (wCompPct / 100);
                const dtWCompTaxAmount = (basePay * 2) * (wCompPct / 100);

                const payrollTaxAmount = basePay * (taxesPct / 100);
                const otPayrollTaxAmount = basePay * 1.5 * (taxesPct / 100);
                const dtPayrollTaxAmount = basePay * 2 * (taxesPct / 100);

                let fringeAmount = fringeRate;
                if (row.fringe && fringeConstants) {
                    fringeAmount = getFringeRate(row.fringe as string, fringeConstants);
                }

                const baseRate = basePay + wCompTaxAmount + payrollTaxAmount + fringeAmount;
                const otRate = (basePay * 1.5) + otWCompTaxAmount + otPayrollTaxAmount + fringeAmount;
                const dtRate = (basePay * 2) + dtWCompTaxAmount + dtPayrollTaxAmount + fringeAmount;

                const dtHours = qty * days * dtPd;
                const total = (totalHours * baseRate) + (totalOtHours * otRate) + (dtHours * dtRate);

                return isNaN(total) ? 0 : total;
            }
        }
    ], [fringeRate, fringeConstants, onExplain]);

    return (
        <GenericLineItemsTable
            rows={items}
            columns={columns}
            onUpdateItem={onUpdateItem}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onAction={(item) => onExplain?.(item)}
            emptyMessage="No labor items found."
        />
    );
}
