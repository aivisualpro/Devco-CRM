'use client';

import React, { useMemo } from 'react';
import { GenericLineItemsTable, LineItemColumnConfig } from '@/components/line-items/GenericLineItemsTable';

interface MaterialLineItemsTableProps {
    items: any[];
    onUpdateItem?: (item: any, field: string, value: string | number) => void;
    onDelete?: (item: any) => void;
    onDuplicate?: (item: any) => void;
}

export function MaterialLineItemsTable({ items, onUpdateItem, onDelete, onDuplicate }: MaterialLineItemsTableProps) {
    const columns = useMemo<LineItemColumnConfig[]>(() => [
        { key: 'material', header: 'Material', type: 'text', editable: true, width: '15%' },
        { key: 'classification', header: 'Classification', type: 'text', editable: true, width: '18%' },
        { key: 'subClassification', header: 'Sub', type: 'text', editable: true, width: '15%' },
        { key: 'supplier', header: 'Supplier', type: 'text', editable: true, width: '10%' },
        { key: 'quantity', header: 'Qty', type: 'number', editable: true, width: '7%' },
        { key: 'uom', header: 'UOM', type: 'text', editable: true, width: '9%' },
        { key: 'cost', header: 'Cost', type: 'currency', editable: true, width: '8%' },
        { key: 'taxes', header: 'Taxes', type: 'number', editable: true, width: '8%' },
        { key: 'deliveryPickup', header: 'Del & Pick', type: 'number', editable: true, width: '5%', placeholder: 'Del' },
        { 
            key: 'total', 
            header: 'Total', 
            type: 'currency', 
            editable: false, 
            align: 'right',
            width: '10%',
            computed: (row) => {
                const qty = parseFloat(row.quantity) || 1;
                const cost = parseFloat(row.cost) || 0;
                const taxes = parseFloat(row.taxes) || 0;
                const delivery = parseFloat(row.deliveryPickup) || 0;
                const subTotal = qty * cost;
                return (subTotal * (1 + taxes / 100)) + delivery;
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
            emptyMessage="No material items found."
        />
    );
}
