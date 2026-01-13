'use client';

import { Trash2 } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';

interface LineItem {
    _id?: string;
    [key: string]: unknown;
}

interface EquipmentLineItemsTableProps {
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

function EquipmentRow({
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
        equipmentMachine: String(item.equipmentMachine ?? ''),
        classification: String(item.classification ?? ''),
        subClassification: String(item.subClassification ?? ''),
        supplier: String(item.supplier ?? ''),
        quantity: String(item.quantity ?? ''),
        times: String(item.times ?? '1'),
        uom: String(item.uom ?? 'Daily'),
        dailyCost: String(item.dailyCost ?? ''),
        weeklyCost: String(item.weeklyCost ?? ''),
        monthlyCost: String(item.monthlyCost ?? ''),
        fuelAdditiveCost: String(item.fuelAdditiveCost ?? ''),
        deliveryPickup: String(item.deliveryPickup ?? '')
    });

    const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());

    useEffect(() => {
        setLocalValues(prev => ({
            equipmentMachine: dirtyFields.has('equipmentMachine') ? prev.equipmentMachine : String(item.equipmentMachine ?? ''),
            classification: dirtyFields.has('classification') ? prev.classification : String(item.classification ?? ''),
            subClassification: dirtyFields.has('subClassification') ? prev.subClassification : String(item.subClassification ?? ''),
            supplier: dirtyFields.has('supplier') ? prev.supplier : String(item.supplier ?? ''),
            quantity: dirtyFields.has('quantity') ? prev.quantity : String(item.quantity ?? ''),
            times: dirtyFields.has('times') ? prev.times : String(item.times ?? '1'),
            uom: dirtyFields.has('uom') ? prev.uom : String(item.uom ?? 'Daily'),
            dailyCost: dirtyFields.has('dailyCost') ? prev.dailyCost : String(item.dailyCost ?? ''),
            weeklyCost: dirtyFields.has('weeklyCost') ? prev.weeklyCost : String(item.weeklyCost ?? ''),
            monthlyCost: dirtyFields.has('monthlyCost') ? prev.monthlyCost : String(item.monthlyCost ?? ''),
            fuelAdditiveCost: dirtyFields.has('fuelAdditiveCost') ? prev.fuelAdditiveCost : String(item.fuelAdditiveCost ?? ''),
            deliveryPickup: dirtyFields.has('deliveryPickup') ? prev.deliveryPickup : String(item.deliveryPickup ?? '')
        }));
    }, [item.equipmentMachine, item.classification, item.subClassification, item.supplier, item.quantity, item.times, item.uom, item.dailyCost, item.weeklyCost, item.monthlyCost, item.fuelAdditiveCost, item.deliveryPickup]);

    // Calculate total: (cost based on UOM) × qty × times + fuel × qty + delivery × qty
    const liveTotal = useMemo(() => {
        const qty = parseFloat(localValues.quantity) || 1;
        const times = parseFloat(localValues.times) || 1;
        const uom = localValues.uom || 'Daily';
        
        let cost = 0;
        if (uom === 'Daily') cost = parseFloat(localValues.dailyCost) || 0;
        else if (uom === 'Weekly') cost = parseFloat(localValues.weeklyCost) || 0;
        else if (uom === 'Monthly') cost = parseFloat(localValues.monthlyCost) || 0;
        else cost = parseFloat(localValues.dailyCost) || 0;
        
        const fuel = parseFloat(localValues.fuelAdditiveCost) || 0;
        const delivery = parseFloat(localValues.deliveryPickup) || 0;
        
        const baseTotal = cost * qty * times;
        const fuelTotal = qty * fuel;
        const deliveryTotal = qty * delivery;
        
        return baseTotal + fuelTotal + deliveryTotal;
    }, [localValues.quantity, localValues.times, localValues.uom, localValues.dailyCost, localValues.weeklyCost, localValues.monthlyCost, localValues.fuelAdditiveCost, localValues.deliveryPickup]);

    const handleChange = (field: string, value: string) => {
        setLocalValues(prev => ({ ...prev, [field]: value }));
        setDirtyFields(prev => new Set(prev).add(field));
    };

    const handleBlur = (field: string) => {
        if (dirtyFields.has(field)) {
            const value = localValues[field as keyof typeof localValues];
            const numericFields = ['quantity', 'times', 'dailyCost', 'weeklyCost', 'monthlyCost', 'fuelAdditiveCost', 'deliveryPickup'];
            const finalValue = numericFields.includes(field) ? (parseFloat(value) || 0) : value;
            onUpdateItem?.(item, field, finalValue);
            setDirtyFields(prev => {
                const newSet = new Set(prev);
                newSet.delete(field);
                return newSet;
            });
        }
    };

    const handleUomChange = (value: string) => {
        setLocalValues(prev => ({ ...prev, uom: value }));
        onUpdateItem?.(item, 'uom', value);
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
            <td className="p-1 text-xs text-gray-700" style={{ width: '12%' }}>
                <LiveInput
                    value={localValues.equipmentMachine}
                    inputType="text"
                    onChange={(val) => handleChange('equipmentMachine', val)}
                    onBlur={() => handleBlur('equipmentMachine')}
                    placeholder="Equipment"
                    inputId={`equipment-${index}-0`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '15%' }}>
                <LiveInput
                    value={localValues.classification}
                    inputType="text"
                    onChange={(val) => handleChange('classification', val)}
                    onBlur={() => handleBlur('classification')}
                    placeholder="Classification"
                    inputId={`equipment-${index}-1`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '15%' }}>
                <LiveInput
                    value={localValues.subClassification}
                    inputType="text"
                    onChange={(val) => handleChange('subClassification', val)}
                    onBlur={() => handleBlur('subClassification')}
                    placeholder="Sub"
                    inputId={`equipment-${index}-2`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '10%' }}>
                <LiveInput
                    value={localValues.supplier}
                    inputType="text"
                    onChange={(val) => handleChange('supplier', val)}
                    onBlur={() => handleBlur('supplier')}
                    placeholder="Supplier"
                    inputId={`equipment-${index}-3`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                <LiveInput
                    value={localValues.quantity}
                    inputType="number"
                    onChange={(val) => handleChange('quantity', val)}
                    onBlur={() => handleBlur('quantity')}
                    placeholder="Qty"
                    inputId={`equipment-${index}-4`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                <LiveInput
                    value={localValues.times}
                    inputType="number"
                    onChange={(val) => handleChange('times', val)}
                    onBlur={() => handleBlur('times')}
                    placeholder="Times"
                    inputId={`equipment-${index}-5`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '8%' }}>
                <select
                    value={localValues.uom}
                    onChange={(e) => handleUomChange(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[11px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-left"
                >
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                </select>
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                <LiveInput
                    value={localValues.dailyCost}
                    inputType="number"
                    onChange={(val) => handleChange('dailyCost', val)}
                    onBlur={() => handleBlur('dailyCost')}
                    placeholder="Daily"
                    inputId={`equipment-${index}-7`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                <LiveInput
                    value={localValues.weeklyCost}
                    inputType="number"
                    onChange={(val) => handleChange('weeklyCost', val)}
                    onBlur={() => handleBlur('weeklyCost')}
                    placeholder="Weekly"
                    inputId={`equipment-${index}-8`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                <LiveInput
                    value={localValues.monthlyCost}
                    inputType="number"
                    onChange={(val) => handleChange('monthlyCost', val)}
                    onBlur={() => handleBlur('monthlyCost')}
                    placeholder="Monthly"
                    inputId={`equipment-${index}-9`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                <LiveInput
                    value={localValues.fuelAdditiveCost}
                    inputType="number"
                    onChange={(val) => handleChange('fuelAdditiveCost', val)}
                    onBlur={() => handleBlur('fuelAdditiveCost')}
                    placeholder="Fuel"
                    inputId={`equipment-${index}-10`}
                />
            </td>
            <td className="p-1 text-xs text-gray-700" style={{ width: '5%' }}>
                <LiveInput
                    value={localValues.deliveryPickup}
                    inputType="number"
                    onChange={(val) => handleChange('deliveryPickup', val)}
                    onBlur={() => handleBlur('deliveryPickup')}
                    placeholder="Del"
                    inputId={`equipment-${index}-11`}
                />
            </td>
            <td className="p-1 text-xs whitespace-nowrap text-right font-bold text-gray-700" style={{ width: '8%' }}>
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
                    {items.map((item, i) => (
                        <EquipmentRow
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
