'use client';

import { Trash2, Info } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface LineItem {
    _id?: string;
    [key: string]: unknown;
}

interface LineItemsTableProps {
    sectionId: string;
    headers: string[];
    items: LineItem[];
    fields: string[];
    editableFields?: string[];
    onUpdateItem?: (item: LineItem, field: string, value: string | number) => void;
    onExplain?: (item: LineItem) => void;
    onDelete?: (item: LineItem) => void;
    onEdit?: (item: LineItem) => void;
    // Datalist options
    suppliers?: string[];
    uoms?: string[];
    classifications?: string[];
    subClassifications?: string[];
}

export function LineItemsTable({
    sectionId,
    headers,
    items,
    fields,
    editableFields = [],
    onUpdateItem,
    onExplain,
    onDelete,
    suppliers = [],
    uoms = [],
    classifications = [],
    subClassifications = []
}: LineItemsTableProps) {
    if (!items || items.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400 text-sm italic">
                No line items found for this category.
            </div>
        );
    }

    const formatValue = (val: unknown, field: string): string => {
        if (val === undefined || val === null) return '--';
        if (val === 0) return '0';

        if (typeof val === 'number') {
            const lowerField = field.toLowerCase();
            if (lowerField.includes('percent')) {
                return `${val}%`;
            }
            if (
                lowerField.includes('cost') ||
                lowerField.includes('pay') ||
                lowerField.includes('rate') ||
                field === 'total'
            ) {
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                }).format(val);
            }
        }

        return String(val);
    };

    const getInputType = (field: string): string => {
        const numericFields = [
            'quantity', 'days', 'otPd', 'basePay', 'dailyCost', 'weeklyCost',
            'monthlyCost', 'fuelAdditiveCost', 'cost', 'wCompPercent',
            'payrollTaxesPercent', 'taxes', 'hourlyRate', 'dailyRate', 'times', 'hours'
        ];
        return numericFields.includes(field) ? 'number' : 'text';
    };

    const getDatalistId = (field: string, sectionId: string): string | undefined => {
        if (field === 'supplier') return `${sectionId}-suppliers`;
        if (field === 'uom') return `${sectionId}-uoms`;
        if (field === 'classification') return `${sectionId}-classifications`;
        if (field === 'subClassification') return `${sectionId}-subclassifications`;
        return undefined;
    };

    // Determine if a field should be compact (numeric) or expanded (text)
    const isNumericField = (field: string): boolean => {
        const numericFields = [
            'quantity', 'days', 'otPd', 'basePay', 'dailyCost', 'weeklyCost',
            'monthlyCost', 'fuelAdditiveCost', 'cost', 'wCompPercent',
            'payrollTaxesPercent', 'taxes', 'hourlyRate', 'dailyRate', 'times', 'hours',
            'qty', 'fuel'
        ];
        return numericFields.includes(field);
    };

    function AutoWidthInput({
        defaultValue,
        inputType,
        datalistId,
        onBlur,
        placeholder = "",
        inputId = ""
    }: {
        defaultValue: string | number;
        inputType: string;
        datalistId?: string;
        onBlur: (value: string | number) => void;
        placeholder?: string;
        inputId?: string;
    }) {
        const [val, setVal] = useState(String(defaultValue ?? ''));
        const [hasChanged, setHasChanged] = useState(false);
        const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

        useEffect(() => {

            setVal(String(defaultValue ?? ''));
            setHasChanged(false);
        }, [defaultValue]);

        const saveValue = () => {
            if (hasChanged) {
                const result = inputType === 'number' ? parseFloat(val) || 0 : val;
                const originalValue = inputType === 'number' ? parseFloat(String(defaultValue)) || 0 : String(defaultValue);
                
                // Only save if value actually changed
                if (result !== originalValue) {
                    onBlur(result);
                }
                setHasChanged(false);
            }
        };

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setVal(e.target.value);
            setHasChanged(true);
            
            // Clear existing timeout
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            
            // Set new timeout for auto-save after 1 second
            saveTimeoutRef.current = setTimeout(() => {
                saveValue();
            }, 1000);
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                
                // Clear any pending auto-save
                if (saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current);
                }
                
                // Save immediately
                saveValue();
                
                // Find next focusable input
                const currentInput = e.currentTarget;
                const allInputs = Array.from(
                    document.querySelectorAll('input[data-input-id], select')
                ).filter(el => !el.hasAttribute('disabled')) as HTMLElement[];
                
                const currentIndex = allInputs.indexOf(currentInput);
                
                if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                    // Move to next input
                    allInputs[currentIndex + 1].focus();
                }
            }
        };

        const handleBlur = () => {
            // Clear any pending auto-save
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            saveValue();
        };

        return (
            <input
                type={inputType}
                list={datalistId}
                value={val}
                data-input-id={inputId}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onFocus={(e) => e.target.select()}
                placeholder={placeholder}
                className="w-full bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left text-slate-600 shadow-sm"
            />
        );
    }

    return (
        <div className="overflow-x-auto p-2">
            {/* Datalists */}
            {suppliers.length > 0 && (
                <datalist id={`${sectionId}-suppliers`}>
                    {suppliers.map(s => <option key={s} value={s} />)}
                </datalist>
            )}
            {uoms.length > 0 && (
                <datalist id={`${sectionId}-uoms`}>
                    {uoms.map(u => <option key={u} value={u} />)}
                </datalist>
            )}
            {classifications.length > 0 && (
                <datalist id={`${sectionId}-classifications`}>
                    {classifications.map(c => <option key={c} value={c} />)}
                </datalist>
            )}
            {subClassifications.length > 0 && (
                <datalist id={`${sectionId}-subclassifications`}>
                    {subClassifications.map(c => <option key={c} value={c} />)}
                </datalist>
            )}

            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">
                            #
                        </th>
                        {headers.map((header, i) => {
                            const field = fields[i] || '';
                            const isCompact = isNumericField(field);
                            return (
                                <th
                                    key={i}
                                    className={`px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap ${isCompact ? 'w-20' : ''} ${field === 'total' ? 'text-right' : ''}`}
                                >
                                    {header}
                                </th>
                            );
                        })}
                        <th className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap w-px" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {items.map((item, i) => {
                        const itemKey = `${item._id || i}-${item.updatedAt || ''}-${item.quantity || 0}-${item.cost || 0}-${item.labor || ''}-${item.classification || ''}`;

                        return (
                            <tr key={itemKey} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="px-2 py-1 text-xs text-gray-400 text-center font-medium">
                                    {i + 1}
                                </td>
                                {fields.map((field, j) => {
                                    const isEditable = editableFields.includes(field);
                                    const val = item[field];
                                    const displayVal = formatValue(val, field);

                                    // Clickable total for Labor
                                    if (field === 'total' && onExplain && sectionId === 'Labor') {
                                        return (
                                            <td key={j} className="px-2 py-1 text-xs whitespace-nowrap text-right">
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onExplain(item);
                                                    }}
                                                    className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1 justify-end"
                                                    title="View Calculation Breakdown"
                                                >
                                                    {displayVal}
                                                    <Info className="w-2.5 h-2.5 opacity-50" />
                                                </div>
                                            </td>
                                        );
                                    }

                                    // Equipment UOM dropdown
                                    if (isEditable && field === 'uom' && sectionId === 'Equipment') {
                                        return (
                                            <td key={j} className="px-2 py-1 text-xs text-gray-700 whitespace-nowrap">
                                                <select
                                                    value={String(val || 'Daily')}
                                                    onChange={(e) => onUpdateItem?.(item, field, e.target.value)}
                                                    className="w-20 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-left"
                                                >
                                                    <option value="Daily">Daily</option>
                                                    <option value="Weekly">Weekly</option>
                                                    <option value="Monthly">Monthly</option>
                                                </select>
                                            </td>
                                        );
                                    }

                                    // Editable field
                                    if (isEditable) {
                                        const datalistId = getDatalistId(field, sectionId);
                                        const inputType = getInputType(field);

                                        return (
                                            <td key={j} className="px-2 py-1 text-xs text-gray-700">
                                                <AutoWidthInput
                                                    defaultValue={val !== undefined && val !== null ? String(val) : ''}
                                                    inputType={inputType}
                                                    datalistId={datalistId}
                                                    onBlur={(newVal) => onUpdateItem?.(item, field, newVal)}
                                                    placeholder={headers[j]}
                                                    inputId={`${sectionId}-${i}-${j}`}
                                                />
                                            </td>
                                        );
                                    }

                                    // Read-only display
                                    return (
                                        <td key={j} className={`px-2 py-1 text-xs text-gray-700 whitespace-nowrap ${field === 'total' ? 'text-right' : ''}`}>
                                            <span>{displayVal}</span>
                                        </td>
                                    );
                                })}
                                <td className="px-2 py-1 text-center w-px">
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
                    })}
                </tbody>
            </table>
        </div>
    );
}
