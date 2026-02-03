'use client';

import { Trash2, Copy } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';

interface LineItem {
    _id?: string;
    [key: string]: unknown;
}

interface MiscellaneousLineItemsTableProps {
    items: LineItem[];
    onUpdateItem?: (item: LineItem, field: string, value: string | number) => void;
    onDelete?: (item: LineItem) => void;
    onDuplicate?: (item: LineItem) => void;
}

// Input component that updates on change but only saves on blur
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
            
            // Trigger blur to save
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

// Row component that manages its own local state for real-time total calculation
function MiscellaneousRow({
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
    // Local state for real-time updates
    const [localValues, setLocalValues] = useState({
        miscellaneous: String(item.miscellaneous ?? ''),
        classification: String(item.classification ?? ''),
        quantity: String(item.quantity ?? ''),
        days: String(item.days ?? '1'),
        uom: String(item.uom ?? ''),
        cost: String(item.cost ?? '')
    });

    // Track which fields have been modified locally (not yet saved)
    const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());

    // Sync with prop changes (but only for fields that aren't currently being edited)
    useEffect(() => {
        setLocalValues(prev => ({
            miscellaneous: dirtyFields.has('miscellaneous') ? prev.miscellaneous : String(item.miscellaneous ?? ''),
            classification: dirtyFields.has('classification') ? prev.classification : String(item.classification ?? ''),
            quantity: dirtyFields.has('quantity') ? prev.quantity : String(item.quantity ?? ''),
            days: dirtyFields.has('days') ? prev.days : String(item.days ?? '1'),
            uom: dirtyFields.has('uom') ? prev.uom : String(item.uom ?? ''),
            cost: dirtyFields.has('cost') ? prev.cost : String(item.cost ?? '')
        }));
    }, [item.miscellaneous, item.classification, item.quantity, item.days, item.uom, item.cost]);

    // Calculate total in real-time based on local values
    const liveTotal = useMemo(() => {
        const qty = parseFloat(localValues.quantity) || 1;
        const days = parseFloat(localValues.days) || 1;
        const cost = parseFloat(localValues.cost) || 0;
        return qty * days * cost;
    }, [localValues.quantity, localValues.days, localValues.cost]);

    const handleChange = (field: string, value: string) => {
        setLocalValues(prev => ({ ...prev, [field]: value }));
        setDirtyFields(prev => new Set(prev).add(field));
    };

    const handleBlur = (field: string) => {
        if (dirtyFields.has(field)) {
            const value = localValues[field as keyof typeof localValues];
            const numericFields = ['quantity', 'days', 'cost'];
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
            <td className="p-1 text-xs text-gray-700" style={{ width: '30%' }}>
                <LiveInput
                    value={localValues.miscellaneous}
                    inputType="text"
                    onChange={(val) => handleChange('miscellaneous', val)}
                    onBlur={() => handleBlur('miscellaneous')}
                    placeholder="Item"
                    inputId={`miscellaneous-${index}-0`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '25%' }}>
                <LiveInput
                    value={localValues.classification}
                    inputType="text"
                    onChange={(val) => handleChange('classification', val)}
                    onBlur={() => handleBlur('classification')}
                    placeholder="Classifications"
                    inputId={`miscellaneous-${index}-1`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '8%' }}>
                <LiveInput
                    value={localValues.quantity}
                    inputType="number"
                    onChange={(val) => handleChange('quantity', val)}
                    onBlur={() => handleBlur('quantity')}
                    placeholder="Qty"
                    inputId={`miscellaneous-${index}-2`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '8%' }}>
                <LiveInput
                    value={localValues.days}
                    inputType="number"
                    onChange={(val) => handleChange('days', val)}
                    onBlur={() => handleBlur('days')}
                    placeholder="Days"
                    inputId={`miscellaneous-${index}-3`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '8%' }}>
                <LiveInput
                    value={localValues.uom}
                    inputType="text"
                    onChange={(val) => handleChange('uom', val)}
                    onBlur={() => handleBlur('uom')}
                    placeholder="UOM"
                    inputId={`miscellaneous-${index}-4`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '10%' }}>
                <LiveInput
                    value={localValues.cost}
                    inputType="number"
                    onChange={(val) => handleChange('cost', val)}
                    onBlur={() => handleBlur('cost')}
                    placeholder="Cost"
                    inputId={`miscellaneous-${index}-5`}
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

export function MiscellaneousLineItemsTable({
    items,
    onUpdateItem,
    onDelete,
    onDuplicate
}: MiscellaneousLineItemsTableProps) {
    if (!items || items.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400 text-sm italic">
                No miscellaneous items found.
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
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '30%' }}>
                            Item
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '25%' }}>
                            Classifications
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '8%' }}>
                            Qty
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '8%' }}>
                            Days
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '8%' }}>
                            UOM
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '10%' }}>
                            Cost
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-right" style={{ width: '10%' }}>
                            Total
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap w-8" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {items.map((item, i) => (
                        <MiscellaneousRow
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
