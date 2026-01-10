'use client';

import { Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface LineItem {
    _id?: string;
    [key: string]: unknown;
}

interface EquipmentLineItemsTableProps {
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

export function EquipmentLineItemsTable({
    items,
    onUpdateItem,
    onDelete
}: EquipmentLineItemsTableProps) {
    if (!items || items.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400 text-sm italic">
                No equipment items found.
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
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '12%' }}>
                            Equipment / Machine
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '15%' }}>
                            Classification
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '15%' }}>
                            Sub
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '10%' }}>
                            Supplier
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '5%' }}>
                            Qty
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '5%' }}>
                            Times
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '8%' }}>
                            UOM
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '5%' }}>
                            Daily $
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '5%' }}>
                            Weekly $
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '5%' }}>
                            Monthly $
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '5%' }}>
                            Fuel
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '5%' }}>
                            Del & Pick
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-right" style={{ width: '8%' }}>
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
                                <td className="p-1 text-xs text-gray-700" style={{ width: '12%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.equipmentMachine !== undefined && item.equipmentMachine !== null ? String(item.equipmentMachine) : ''}
                                        inputType="text"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'equipmentMachine', newVal)}
                                        placeholder="Equipment"
                                        inputId={`equipment-${i}-0`}
                                    />
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '15%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.classification !== undefined && item.classification !== null ? String(item.classification) : ''}
                                        inputType="text"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'classification', newVal)}
                                        placeholder="Classification"
                                        inputId={`equipment-${i}-1`}
                                    />
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '15%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.subClassification !== undefined && item.subClassification !== null ? String(item.subClassification) : ''}
                                        inputType="text"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'subClassification', newVal)}
                                        placeholder="Sub"
                                        inputId={`equipment-${i}-2`}
                                    />
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '10%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.supplier !== undefined && item.supplier !== null ? String(item.supplier) : ''}
                                        inputType="text"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'supplier', newVal)}
                                        placeholder="Supplier"
                                        inputId={`equipment-${i}-3`}
                                    />
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.quantity !== undefined && item.quantity !== null ? String(item.quantity) : ''}
                                        inputType="number"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'quantity', newVal)}
                                        placeholder="Qty"
                                        inputId={`equipment-${i}-4`}
                                    />
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.times !== undefined && item.times !== null ? String(item.times) : ''}
                                        inputType="number"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'times', newVal)}
                                        placeholder="Times"
                                        inputId={`equipment-${i}-5`}
                                    />
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                                    <select
                                        value={String(item.uom || 'Daily')}
                                        onChange={(e) => onUpdateItem?.(item, 'uom', e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-left"
                                    >
                                        <option value="Daily">Daily</option>
                                        <option value="Weekly">Weekly</option>
                                        <option value="Monthly">Monthly</option>
                                    </select>
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.dailyCost !== undefined && item.dailyCost !== null ? String(item.dailyCost) : ''}
                                        inputType="number"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'dailyCost', newVal)}
                                        placeholder="Daily"
                                        inputId={`equipment-${i}-7`}
                                    />
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.weeklyCost !== undefined && item.weeklyCost !== null ? String(item.weeklyCost) : ''}
                                        inputType="number"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'weeklyCost', newVal)}
                                        placeholder="Weekly"
                                        inputId={`equipment-${i}-8`}
                                    />
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.monthlyCost !== undefined && item.monthlyCost !== null ? String(item.monthlyCost) : ''}
                                        inputType="number"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'monthlyCost', newVal)}
                                        placeholder="Monthly"
                                        inputId={`equipment-${i}-9`}
                                    />
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.fuelAdditiveCost !== undefined && item.fuelAdditiveCost !== null ? String(item.fuelAdditiveCost) : ''}
                                        inputType="number"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'fuelAdditiveCost', newVal)}
                                        placeholder="Fuel"
                                        inputId={`equipment-${i}-10`}
                                    />
                                </td>
                                <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                                    <AutoWidthInput
                                        defaultValue={item.deliveryPickup !== undefined && item.deliveryPickup !== null ? String(item.deliveryPickup) : ''}
                                        inputType="number"
                                        onBlur={(newVal) => onUpdateItem?.(item, 'deliveryPickup', newVal)}
                                        placeholder="Del"
                                        inputId={`equipment-${i}-11`}
                                    />
                                </td>
                                <td className="p-1 text-xs whitespace-nowrap text-right font-bold text-gray-700" style={{ width: '8%' }}>
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
