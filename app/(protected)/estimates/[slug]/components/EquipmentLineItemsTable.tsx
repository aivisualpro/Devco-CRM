'use client';

import React, { useMemo } from 'react';
import { GenericLineItemsTable, LineItemColumnConfig } from '@/components/line-items/GenericLineItemsTable';

interface EquipmentLineItemsTableProps {
    items: any[];
    onUpdateItem?: (item: any, field: string, value: string | number) => void;
    onDelete?: (item: any) => void;
    onDuplicate?: (item: any) => void;
}

export function EquipmentLineItemsTable({ items, onUpdateItem, onDelete, onDuplicate }: EquipmentLineItemsTableProps) {
    const columns = useMemo<LineItemColumnConfig[]>(() => [
        { key: 'equipmentMachine', header: 'Equipment / Machine', type: 'text', editable: true, width: '12%' },
        { key: 'classification', header: 'Classification', type: 'text', editable: true, width: '15%' },
        { key: 'subClassification', header: 'Sub', type: 'text', editable: true, width: '15%' },
        { key: 'supplier', header: 'Supplier', type: 'text', editable: true, width: '10%' },
        { key: 'quantity', header: 'Qty', type: 'number', editable: true, width: '5%' },
        { key: 'times', header: 'Times', type: 'number', editable: true, width: '5%' },
        { key: 'uom', header: 'UOM', type: 'select', editable: true, width: '8%', options: ['Daily', 'Weekly', 'Monthly'] },
        { key: 'dailyCost', header: 'Daily $', type: 'number', editable: true, width: '5%' },
        { key: 'weeklyCost', header: 'Weekly $', type: 'number', editable: true, width: '5%' },
        { key: 'monthlyCost', header: 'Monthly $', type: 'number', editable: true, width: '5%' },
        { key: 'fuelAdditiveCost', header: 'Fuel', type: 'number', editable: true, width: '5%' },
        { key: 'deliveryPickup', header: 'Del & Pick', type: 'number', editable: true, width: '5%' },
        { 
            key: 'total', 
            header: 'Total', 
            type: 'currency', 
            editable: false, 
            align: 'right',
            width: '8%',
            computed: (row) => {
                const qty = parseFloat(row.quantity) || 1;
                const times = parseFloat(row.times) || 1;
                const uom = row.uom || 'Daily';

                let cost = 0;
                if (uom === 'Daily') cost = parseFloat(row.dailyCost) || 0;
                else if (uom === 'Weekly') cost = parseFloat(row.weeklyCost) || 0;
                else if (uom === 'Monthly') cost = parseFloat(row.monthlyCost) || 0;
                else cost = parseFloat(row.dailyCost) || 0;

                const fuel = parseFloat(row.fuelAdditiveCost) || 0;
                const delivery = parseFloat(row.deliveryPickup) || 0;

                const baseTotal = cost * qty * times;
                const fuelTotal = qty * fuel;
                const deliveryTotal = qty * delivery;

                return baseTotal + fuelTotal + deliveryTotal;
            }
        }
    ], []);

    return (
        <GenericLineItemsTable
            rows={items}
            columns={columns}
            onUpdateItem={onUpdateItem}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            emptyMessage="No equipment items found."
        />
    );
}
