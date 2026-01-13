'use client';

import { Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface LineItem {
    _id?: string;
    [key: string]: unknown;
}

interface OverheadLineItemsTableProps {
    items: LineItem[];
    onUpdateItem?: (item: LineItem, field: string, value: string | number) => void;
    onDelete?: (item: LineItem) => void;
}

function AutoWidthInput({
    defaultValue,
    inputType,
    onBlur,
    placeholder = "",
    inputId = ""
}: {
    defaultValue: string | number;
    inputType: string;
    onBlur: (value: string | number) => void;
    placeholder?: string;
    inputId?: string;
}) {
    const [val, setVal] = useState(String(defaultValue ?? ''));
    const [hasChanged, setHasChanged] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isFocused = useRef(false);

    useEffect(() => {
        if (!isFocused.current) {
            setVal(String(defaultValue ?? ''));
            setHasChanged(false);
        }
    }, [defaultValue]);

    const saveValue = () => {
        if (hasChanged) {
            const result = inputType === 'number' ? parseFloat(val) || 0 : val;
            const originalValue = inputType === 'number' ? parseFloat(String(defaultValue)) || 0 : String(defaultValue);
            
            if (result !== originalValue) {
                onBlur(result);
            }
            setHasChanged(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setVal(e.target.value);
        setHasChanged(true);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Tab' || e.key === 'Enter') {
            e.preventDefault();
            
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            
            saveValue();
            
            const currentInput = e.currentTarget;
            const allInputs = Array.from(
                document.querySelectorAll('input[data-input-id], select')
            ).filter(el => !el.hasAttribute('disabled')) as HTMLElement[];
            
            const currentIndex = allInputs.indexOf(currentInput);
            
            if (currentIndex !== -1 && currentIndex < allInputs.length - 1) {
                allInputs[currentIndex + 1].focus();
            }
        }
    };

    const handleBlur = () => {
        isFocused.current = false;
        delete document.body.dataset.inputFocused;
        
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveValue();
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        isFocused.current = true;
        e.target.select();
        document.body.dataset.inputFocused = 'true';
    };

    return (
        <input
            type={inputType}
            value={val}
            data-input-id={inputId}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder={placeholder}
            className="w-full bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left text-slate-600 shadow-sm"
        />
    );
}

export function OverheadLineItemsTable({
    items,
    onUpdateItem,
    onDelete
}: OverheadLineItemsTableProps) {
    if (!items || items.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400 text-sm italic">
                No overhead items found.
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

    return (
        <div className="overflow-x-auto p-1">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap w-8">
                            #
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '20%' }}>
                            Overhead
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '20%' }}>
                            Classification
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '20%' }}>
                            Sub
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '15%' }}>
                            Days
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '15%' }}>
                            Daily Rate
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-right" style={{ width: '10%' }}>
                            Total
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap w-8" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {items.map((item, i) => {
                        const itemKey = item._id || `item-${i}`;

                        return (
                            <tr key={itemKey} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="p-1 text-xs text-gray-400 text-center font-medium">
                                    {i + 1}
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '20%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.overhead !== undefined && item.overhead !== null ? String(item.overhead) : ''}
                                        inputType="text"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'overhead', newVal)}
                                        placeholder="Overhead"
                                        inputId={`overhead-${i}-0`}
                                    />
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '20%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.classification !== undefined && item.classification !== null ? String(item.classification) : ''}
                                        inputType="text"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'classification', newVal)}
                                        placeholder="Classification"
                                        inputId={`overhead-${i}-1`}
                                    />
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '20%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.subClassification !== undefined && item.subClassification !== null ? String(item.subClassification) : ''}
                                        inputType="text"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'subClassification', newVal)}
                                        placeholder="Sub"
                                        inputId={`overhead-${i}-2`}
                                    />
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '15%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.days !== undefined && item.days !== null ? String(item.days) : ''}
                                        inputType="number"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'days', newVal)}
                                        placeholder="Days"
                                        inputId={`overhead-${i}-3`}
                                    />
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '15%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.dailyRate !== undefined && item.dailyRate !== null ? String(item.dailyRate) : ''}
                                        inputType="number"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'dailyRate', newVal)}
                                        placeholder="Daily"
                                        inputId={`overhead-${i}-6`}
                                    />
                                </td>
                                <td className="p-1 text-xs whitespace-nowrap text-right font-bold text-gray-700" style={{ width: '10%' }}>
                                    {formatValue(item.total, 'total')}
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
                    })}
                </tbody>
            </table>
        </div>
    );
}
