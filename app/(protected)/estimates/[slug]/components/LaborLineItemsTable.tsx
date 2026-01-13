'use client';

import { Trash2, Info } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';

interface LineItem {
    _id?: string;
    [key: string]: unknown;
}

interface LaborLineItemsTableProps {
    items: LineItem[];
    onUpdateItem?: (item: LineItem, field: string, value: string | number) => void;
    onExplain?: (item: LineItem) => void;
    onDelete?: (item: LineItem) => void;
    fringeRate?: number; // Fringe rate value passed from parent
}

function LiveInput({
    value,
    inputType,
    onChange,
    onBlur,
    placeholder = "",
    inputId = ""
}: {
    value: string;
    inputType: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    placeholder?: string;
    inputId?: string;
}) {
    const isFocused = useRef(false);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
            
            const currentInput = e.currentTarget;
            const allInputs = Array.from(
                document.querySelectorAll('input[data-input-id], select')
            ).filter(el => !el.hasAttribute('disabled')) as HTMLElement[];
            
            const currentIndex = allInputs.indexOf(currentInput);
            
            if (e.shiftKey) {
                if (currentIndex > 0) {
                    setTimeout(() => allInputs[currentIndex - 1].focus(), 0);
                }
            } else {
                if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                    setTimeout(() => allInputs[currentIndex + 1].focus(), 0);
                }
            }
        }
    };

    const handleBlur = () => {
        isFocused.current = false;
        delete document.body.dataset.inputFocused;
        onBlur();
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        isFocused.current = true;
        e.target.select();
        document.body.dataset.inputFocused = 'true';
    };

    return (
        <input
            type={inputType}
            value={value}
            data-input-id={inputId}
            onChange={(e) => onChange(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder={placeholder}
            className="w-full bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left text-slate-600 shadow-sm"
        />
    );
}

function LaborRow({
    item,
    index,
    onUpdateItem,
    onExplain,
    onDelete,
    fringeRate = 0
}: {
    item: LineItem;
    index: number;
    onUpdateItem?: (item: LineItem, field: string, value: string | number) => void;
    onExplain?: (item: LineItem) => void;
    onDelete?: (item: LineItem) => void;
    fringeRate?: number;
}) {
    const [localValues, setLocalValues] = useState({
        labor: String(item.labor ?? ''),
        classification: String(item.classification ?? ''),
        subClassification: String(item.subClassification ?? ''),
        basePay: String(item.basePay ?? ''),
        quantity: String(item.quantity ?? ''),
        days: String(item.days ?? ''),
        otPd: String(item.otPd ?? ''),
        wCompPercent: String(item.wCompPercent ?? ''),
        payrollTaxesPercent: String(item.payrollTaxesPercent ?? '')
    });

    const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());

    useEffect(() => {
        setLocalValues(prev => ({
            labor: dirtyFields.has('labor') ? prev.labor : String(item.labor ?? ''),
            classification: dirtyFields.has('classification') ? prev.classification : String(item.classification ?? ''),
            subClassification: dirtyFields.has('subClassification') ? prev.subClassification : String(item.subClassification ?? ''),
            basePay: dirtyFields.has('basePay') ? prev.basePay : String(item.basePay ?? ''),
            quantity: dirtyFields.has('quantity') ? prev.quantity : String(item.quantity ?? ''),
            days: dirtyFields.has('days') ? prev.days : String(item.days ?? ''),
            otPd: dirtyFields.has('otPd') ? prev.otPd : String(item.otPd ?? ''),
            wCompPercent: dirtyFields.has('wCompPercent') ? prev.wCompPercent : String(item.wCompPercent ?? ''),
            payrollTaxesPercent: dirtyFields.has('payrollTaxesPercent') ? prev.payrollTaxesPercent : String(item.payrollTaxesPercent ?? '')
        }));
    }, [item.labor, item.classification, item.subClassification, item.basePay, item.quantity, item.days, item.otPd, item.wCompPercent, item.payrollTaxesPercent]);

    // Calculate labor total using the 10-step formula
    const liveTotal = useMemo(() => {
        const basePay = parseFloat(localValues.basePay) || 0;
        const qty = parseFloat(localValues.quantity) || 0;
        const days = parseFloat(localValues.days) || 0;
        const otPd = parseFloat(localValues.otPd) || 0;
        const wCompPct = parseFloat(localValues.wCompPercent) || 0;
        const taxesPct = parseFloat(localValues.payrollTaxesPercent) || 0;
        
        const subClass = String(item.subClassification || '').toLowerCase();
        
        // Per Diem or Hotel: simple calculation
        if (subClass === 'per diem' || subClass === 'hotel') {
            return basePay * qty * days;
        }
        
        // 10-step formula
        // 1. Total Hours = qty * days * 8
        const totalHours = qty * days * 8;
        
        // 2. Total OT Hours = qty * days * otPd
        const totalOtHours = qty * days * otPd;
        
        // 3. WComp Tax = basePay * (wCompPct / 100)
        const wCompTaxAmount = basePay * (wCompPct / 100);
        
        // 4. Payroll Taxes = basePay * (taxesPct / 100)
        const payrollTaxAmount = basePay * (taxesPct / 100);
        
        // 5 & 8. OT Payroll Taxes = basePay * 1.5 * (taxesPct / 100)
        const otPayrollTaxAmount = basePay * 1.5 * (taxesPct / 100);
        
        // 6. Fringe (value from constants)
        const fringeAmount = fringeRate;
        
        // 7. Base Rate = basePay + wCompTax + payrollTax + fringe
        const baseRate = basePay + wCompTaxAmount + payrollTaxAmount + fringeAmount;
        
        // 9. OT Rate = (basePay * 1.5) + wCompTax + otPayrollTax + fringe
        const otBasePay = basePay * 1.5;
        const otRate = otBasePay + wCompTaxAmount + otPayrollTaxAmount + fringeAmount;
        
        // 10. Total = (totalHours * baseRate) + (totalOtHours * otRate)
        const total = (totalHours * baseRate) + (totalOtHours * otRate);
        
        return isNaN(total) ? 0 : total;
    }, [localValues.basePay, localValues.quantity, localValues.days, localValues.otPd, localValues.wCompPercent, localValues.payrollTaxesPercent, item.subClassification, fringeRate]);

    const handleChange = (field: string, value: string) => {
        setLocalValues(prev => ({ ...prev, [field]: value }));
        setDirtyFields(prev => new Set(prev).add(field));
    };

    const handleBlur = (field: string) => {
        if (dirtyFields.has(field)) {
            const value = localValues[field as keyof typeof localValues];
            const numericFields = ['basePay', 'quantity', 'days', 'otPd', 'wCompPercent', 'payrollTaxesPercent'];
            const finalValue = numericFields.includes(field) ? (parseFloat(value) || 0) : value;
            onUpdateItem?.(item, field, finalValue);
            setDirtyFields(prev => {
                const newSet = new Set(prev);
                newSet.delete(field);
                return newSet;
            });
        }
    };

    const formatCurrency = (val: number): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(val);
    };

    const formatPercent = (val: string): string => {
        const num = parseFloat(val);
        if (isNaN(num)) return '--';
        return `${num}%`;
    };

    return (
        <tr className="hover:bg-gray-50/50 transition-colors group">
            <td className="p-1 text-xs text-gray-400 text-center font-medium">
                {index + 1}
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '20%' }}>
                <LiveInput
                    value={localValues.labor}
                    inputType="text"
                    onChange={(val) => handleChange('labor', val)}
                    onBlur={() => handleBlur('labor')}
                    placeholder="Labor"
                    inputId={`labor-${index}-0`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '20%' }}>
                <LiveInput
                    value={localValues.classification}
                    inputType="text"
                    onChange={(val) => handleChange('classification', val)}
                    onBlur={() => handleBlur('classification')}
                    placeholder="Classification"
                    inputId={`labor-${index}-1`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '20%' }}>
                <LiveInput
                    value={localValues.subClassification}
                    inputType="text"
                    onChange={(val) => handleChange('subClassification', val)}
                    onBlur={() => handleBlur('subClassification')}
                    placeholder="Sub"
                    inputId={`labor-${index}-2`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                <LiveInput
                    value={localValues.basePay}
                    inputType="number"
                    onChange={(val) => handleChange('basePay', val)}
                    onBlur={() => handleBlur('basePay')}
                    placeholder="Base Pay"
                    inputId={`labor-${index}-3`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                <LiveInput
                    value={localValues.quantity}
                    inputType="number"
                    onChange={(val) => handleChange('quantity', val)}
                    onBlur={() => handleBlur('quantity')}
                    placeholder="Qty"
                    inputId={`labor-${index}-4`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                <LiveInput
                    value={localValues.days}
                    inputType="number"
                    onChange={(val) => handleChange('days', val)}
                    onBlur={() => handleBlur('days')}
                    placeholder="Days"
                    inputId={`labor-${index}-5`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                <LiveInput
                    value={localValues.otPd}
                    inputType="number"
                    onChange={(val) => handleChange('otPd', val)}
                    onBlur={() => handleBlur('otPd')}
                    placeholder="OTPD"
                    inputId={`labor-${index}-6`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                <span className="text-xs text-gray-700">{formatPercent(localValues.wCompPercent)}</span>
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                <span className="text-xs text-gray-700">{formatPercent(localValues.payrollTaxesPercent)}</span>
            </td>
            <td className="p-1 text-xs whitespace-nowrap text-right" style={{ width: '10%' }}>
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        onExplain?.(item);
                    }}
                    className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1 justify-end"
                    title="View Calculation Breakdown"
                >
                    {formatCurrency(liveTotal)}
                    <Info className="w-2.5 h-2.5 opacity-50" />
                </div>
            </td>
            <td className="p-1 text-center">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(item);
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50"
                    title="Delete Item"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </td>
        </tr>
    );
}

export function LaborLineItemsTable({
    items,
    onUpdateItem,
    onExplain,
    onDelete,
    fringeRate = 0
}: LaborLineItemsTableProps) {
    if (!items || items.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400 text-sm italic">
                No labor items found.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto p-1">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap w-8">
                            #
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '20%' }}>
                            Labor
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '20%' }}>
                            Classification
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '20%' }}>
                            Sub
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '5%' }}>
                            Base Pay
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '5%' }}>
                            Qty
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '5%' }}>
                            Days
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '5%' }}>
                            OTPD
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '5%' }}>
                            W.Comp
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '5%' }}>
                            Payroll
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-right" style={{ width: '10%' }}>
                            Total
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap w-8" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {items.map((item, i) => (
                        <LaborRow
                            key={item._id || `item-${i}`}
                            item={item}
                            index={i}
                            onUpdateItem={onUpdateItem}
                            onExplain={onExplain}
                            onDelete={onDelete}
                            fringeRate={fringeRate}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
