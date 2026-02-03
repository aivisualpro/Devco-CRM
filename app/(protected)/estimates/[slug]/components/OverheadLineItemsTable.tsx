'use client';

import { Trash2, Copy } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';

interface LineItem {
    _id?: string;
    [key: string]: unknown;
}

interface OverheadLineItemsTableProps {
    items: LineItem[];
    onUpdateItem?: (item: LineItem, field: string, value: string | number) => void;
    onDelete?: (item: LineItem) => void;
    onDuplicate?: (item: LineItem) => void;
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

function OverheadRow({
    item,
    index,
    onUpdateItem,
    onDelete,
    onDuplicate
}: {
    item: LineItem;
    index: number;
    onUpdateItem?: (item: LineItem, field: string, value: string | number) => void;
    onDelete?: (item: LineItem) => void;
    onDuplicate?: (item: LineItem) => void;
}) {
    const [localValues, setLocalValues] = useState({
        overhead: String(item.overhead ?? ''),
        classification: String(item.classification ?? ''),
        subClassification: String(item.subClassification ?? ''),
        days: String(item.days ?? ''),
        dailyRate: String(item.dailyRate ?? '')
    });

    const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());

    useEffect(() => {
        setLocalValues(prev => ({
            overhead: dirtyFields.has('overhead') ? prev.overhead : String(item.overhead ?? ''),
            classification: dirtyFields.has('classification') ? prev.classification : String(item.classification ?? ''),
            subClassification: dirtyFields.has('subClassification') ? prev.subClassification : String(item.subClassification ?? ''),
            days: dirtyFields.has('days') ? prev.days : String(item.days ?? ''),
            dailyRate: dirtyFields.has('dailyRate') ? prev.dailyRate : String(item.dailyRate ?? '')
        }));
    }, [item.overhead, item.classification, item.subClassification, item.days, item.dailyRate]);

    // Calculate total: Days × Daily Rate
    const liveTotal = useMemo(() => {
        const days = parseFloat(localValues.days) || 0;
        const dailyRate = parseFloat(localValues.dailyRate) || 0;
        return days * dailyRate;
    }, [localValues.days, localValues.dailyRate]);

    const handleChange = (field: string, value: string) => {
        setLocalValues(prev => ({ ...prev, [field]: value }));
        setDirtyFields(prev => new Set(prev).add(field));
    };

    const handleBlur = (field: string) => {
        if (dirtyFields.has(field)) {
            const value = localValues[field as keyof typeof localValues];
            const numericFields = ['days', 'dailyRate'];
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

    return (
        <tr className="hover:bg-gray-50/50 transition-colors group">
            <td className="p-1 text-xs text-gray-400 text-center font-medium">
                {index + 1}
            </td>
            <td className="p-0.5 w-4">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDuplicate?.(item);
                    }}
                    className="text-gray-300 hover:text-blue-600 transition-colors p-1"
                    title="Duplicate Row"
                >
                    <Copy className="w-3 h-3" />
                </button>
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '20%' }}>
                <LiveInput
                    value={localValues.overhead}
                    inputType="text"
                    onChange={(val) => handleChange('overhead', val)}
                    onBlur={() => handleBlur('overhead')}
                    placeholder="Overhead"
                    inputId={`overhead-${index}-0`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '20%' }}>
                <LiveInput
                    value={localValues.classification}
                    inputType="text"
                    onChange={(val) => handleChange('classification', val)}
                    onBlur={() => handleBlur('classification')}
                    placeholder="Classification"
                    inputId={`overhead-${index}-1`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '20%' }}>
                <LiveInput
                    value={localValues.subClassification}
                    inputType="text"
                    onChange={(val) => handleChange('subClassification', val)}
                    onBlur={() => handleBlur('subClassification')}
                    placeholder="Sub"
                    inputId={`overhead-${index}-2`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '15%' }}>
                <LiveInput
                    value={localValues.days}
                    inputType="number"
                    onChange={(val) => handleChange('days', val)}
                    onBlur={() => handleBlur('days')}
                    placeholder="Days"
                    inputId={`overhead-${index}-3`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '15%' }}>
                <LiveInput
                    value={localValues.dailyRate}
                    inputType="number"
                    onChange={(val) => handleChange('dailyRate', val)}
                    onBlur={() => handleBlur('dailyRate')}
                    placeholder="Daily"
                    inputId={`overhead-${index}-4`}
                />
            </td>
            <td className="p-1 text-xs whitespace-nowrap text-right font-bold text-gray-700" style={{ width: '10%' }}>
                {formatCurrency(liveTotal)}
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

export function OverheadLineItemsTable({
    items,
    onUpdateItem,
    onDelete,
    onDuplicate
}: OverheadLineItemsTableProps) {
    if (!items || items.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400 text-sm italic">
                No overhead items found.
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
                        <th className="p-1 w-4" />
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
                    {items.map((item, i) => (
                        <OverheadRow
                            key={item._id || `item-${i}`}
                            item={item}
                            index={i}
                            onUpdateItem={onUpdateItem}
                            onDelete={onDelete}
                            onDuplicate={onDuplicate}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
