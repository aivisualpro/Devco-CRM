'use client';

import { Trash2 } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';

interface LineItem {
    _id?: string;
    [key: string]: unknown;
}

interface MaterialLineItemsTableProps {
    items: LineItem[];
    onUpdateItem?: (item: LineItem, field: string, value: string | number) => void;
    onDelete?: (item: LineItem) => void;
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

function MaterialRow({
    item,
    index,
    onUpdateItem,
    onDelete
}: {
    item: LineItem;
    index: number;
    onUpdateItem?: (item: LineItem, field: string, value: string | number) => void;
    onDelete?: (item: LineItem) => void;
}) {
    const [localValues, setLocalValues] = useState({
        material: String(item.material ?? ''),
        classification: String(item.classification ?? ''),
        subClassification: String(item.subClassification ?? ''),
        supplier: String(item.supplier ?? ''),
        quantity: String(item.quantity ?? ''),
        uom: String(item.uom ?? ''),
        cost: String(item.cost ?? ''),
        taxes: String(item.taxes ?? ''),
        deliveryPickup: String(item.deliveryPickup ?? '')
    });

    const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());

    useEffect(() => {
        setLocalValues(prev => ({
            material: dirtyFields.has('material') ? prev.material : String(item.material ?? ''),
            classification: dirtyFields.has('classification') ? prev.classification : String(item.classification ?? ''),
            subClassification: dirtyFields.has('subClassification') ? prev.subClassification : String(item.subClassification ?? ''),
            supplier: dirtyFields.has('supplier') ? prev.supplier : String(item.supplier ?? ''),
            quantity: dirtyFields.has('quantity') ? prev.quantity : String(item.quantity ?? ''),
            uom: dirtyFields.has('uom') ? prev.uom : String(item.uom ?? ''),
            cost: dirtyFields.has('cost') ? prev.cost : String(item.cost ?? ''),
            taxes: dirtyFields.has('taxes') ? prev.taxes : String(item.taxes ?? ''),
            deliveryPickup: dirtyFields.has('deliveryPickup') ? prev.deliveryPickup : String(item.deliveryPickup ?? '')
        }));
    }, [item.material, item.classification, item.subClassification, item.supplier, item.quantity, item.uom, item.cost, item.taxes, item.deliveryPickup]);

    // Calculate total: (Qty × Cost) × (1 + Taxes/100) + Delivery
    const liveTotal = useMemo(() => {
        const qty = parseFloat(localValues.quantity) || 1;
        const cost = parseFloat(localValues.cost) || 0;
        const taxes = parseFloat(localValues.taxes) || 0;
        const delivery = parseFloat(localValues.deliveryPickup) || 0;
        const subTotal = qty * cost;
        const taxedTotal = subTotal * (1 + taxes / 100);
        return taxedTotal + delivery;
    }, [localValues.quantity, localValues.cost, localValues.taxes, localValues.deliveryPickup]);

    const handleChange = (field: string, value: string) => {
        setLocalValues(prev => ({ ...prev, [field]: value }));
        setDirtyFields(prev => new Set(prev).add(field));
    };

    const handleBlur = (field: string) => {
        if (dirtyFields.has(field)) {
            const value = localValues[field as keyof typeof localValues];
            const numericFields = ['quantity', 'cost', 'taxes', 'deliveryPickup'];
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
            <td className="p-1 text-xs text-gray-700" style={{ width: '15%' }}>
                <LiveInput
                    value={localValues.material}
                    inputType="text"
                    onChange={(val) => handleChange('material', val)}
                    onBlur={() => handleBlur('material')}
                    placeholder="Material"
                    inputId={`material-${index}-0`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '18%' }}>
                <LiveInput
                    value={localValues.classification}
                    inputType="text"
                    onChange={(val) => handleChange('classification', val)}
                    onBlur={() => handleBlur('classification')}
                    placeholder="Classification"
                    inputId={`material-${index}-1`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '15%' }}>
                <LiveInput
                    value={localValues.subClassification}
                    inputType="text"
                    onChange={(val) => handleChange('subClassification', val)}
                    onBlur={() => handleBlur('subClassification')}
                    placeholder="Sub"
                    inputId={`material-${index}-2`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '10%' }}>
                <LiveInput
                    value={localValues.supplier}
                    inputType="text"
                    onChange={(val) => handleChange('supplier', val)}
                    onBlur={() => handleBlur('supplier')}
                    placeholder="Supplier"
                    inputId={`material-${index}-3`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '7%' }}>
                <LiveInput
                    value={localValues.quantity}
                    inputType="number"
                    onChange={(val) => handleChange('quantity', val)}
                    onBlur={() => handleBlur('quantity')}
                    placeholder="Qty"
                    inputId={`material-${index}-4`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '9%' }}>
                <LiveInput
                    value={localValues.uom}
                    inputType="text"
                    onChange={(val) => handleChange('uom', val)}
                    onBlur={() => handleBlur('uom')}
                    placeholder="UOM"
                    inputId={`material-${index}-5`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '8%' }}>
                <LiveInput
                    value={localValues.cost}
                    inputType="number"
                    onChange={(val) => handleChange('cost', val)}
                    onBlur={() => handleBlur('cost')}
                    placeholder="Cost"
                    inputId={`material-${index}-6`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '8%' }}>
                <LiveInput
                    value={localValues.taxes}
                    inputType="number"
                    onChange={(val) => handleChange('taxes', val)}
                    onBlur={() => handleBlur('taxes')}
                    placeholder="Taxes"
                    inputId={`material-${index}-7`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                <LiveInput
                    value={localValues.deliveryPickup}
                    inputType="number"
                    onChange={(val) => handleChange('deliveryPickup', val)}
                    onBlur={() => handleBlur('deliveryPickup')}
                    placeholder="Del"
                    inputId={`material-${index}-8`}
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

export function MaterialLineItemsTable({
    items,
    onUpdateItem,
    onDelete
}: MaterialLineItemsTableProps) {
    if (!items || items.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400 text-sm italic">
                No material items found.
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
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '15%' }}>
                            Material
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '18%' }}>
                            Classification
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '15%' }}>
                            Sub
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '10%' }}>
                            Supplier
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '7%' }}>
                            Qty
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '9%' }}>
                            UOM
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '8%' }}>
                            Cost
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '8%' }}>
                            Taxes
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap" style={{ width: '5%' }}>
                            Del & Pick
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap text-right" style={{ width: '10%' }}>
                            Total
                        </th>
                        <th className="p-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center whitespace-nowrap w-8" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {items.map((item, i) => (
                        <MaterialRow
                            key={item._id || `item-${i}`}
                            item={item}
                            index={i}
                            onUpdateItem={onUpdateItem}
                            onDelete={onDelete}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
