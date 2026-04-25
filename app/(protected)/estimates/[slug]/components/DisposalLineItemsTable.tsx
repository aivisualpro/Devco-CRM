'use client';

import React, { useMemo } from 'react';
import { GenericLineItemsTable, LineItemColumnConfig } from '@/components/line-items/GenericLineItemsTable';

interface DisposalLineItemsTableProps {
    items: any[];
    onUpdateItem?: (item: any, field: string, value: string | number) => void;
    onDelete?: (item: any) => void;
    onDuplicate?: (item: any) => void;
}

export function DisposalLineItemsTable({ items, onUpdateItem, onDelete, onDuplicate }: DisposalLineItemsTableProps) {
    const columns = useMemo<LineItemColumnConfig[]>(() => [
        { key: 'disposal', header: 'Disposal & Haul Off', type: 'text', editable: true, width: '25%' },
        { key: 'classification', header: 'Classifications', type: 'text', editable: true, width: '20%' },
        { key: 'subClassification', header: 'Sub', type: 'text', editable: true, width: '20%' },
        { key: 'quantity', header: 'Qty', type: 'number', editable: true, width: '10%' },
        { key: 'uom', header: 'UOM', type: 'text', editable: true, width: '10%' },
        { key: 'cost', header: 'Cost', type: 'number', editable: true, width: '10%' },
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
                return qty * cost;
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
            emptyMessage="No disposal items found."
        />
    );
}
