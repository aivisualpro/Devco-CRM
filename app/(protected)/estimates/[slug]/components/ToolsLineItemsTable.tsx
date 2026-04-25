'use client';

import React, { useMemo } from 'react';
import { GenericLineItemsTable, LineItemColumnConfig } from '@/components/line-items/GenericLineItemsTable';

interface ToolsLineItemsTableProps {
    items: any[];
    onUpdateItem?: (item: any, field: string, value: string | number) => void;
    onDelete?: (item: any) => void;
    onDuplicate?: (item: any) => void;
}

export function ToolsLineItemsTable({ items, onUpdateItem, onDelete, onDuplicate }: ToolsLineItemsTableProps) {
    const columns = useMemo<LineItemColumnConfig[]>(() => [
        { key: 'tool', header: 'Tool', type: 'text', editable: true, width: '15%' },
        { key: 'classification', header: 'Classification', type: 'text', editable: true, width: '20%' },
        { key: 'subClassification', header: 'Sub', type: 'text', editable: true, width: '15%' },
        { key: 'supplier', header: 'Supplier', type: 'text', editable: true, width: '10%' },
        { key: 'quantity', header: 'Qty', type: 'number', editable: true, width: '8%' },
        { key: 'uom', header: 'UOM', type: 'text', editable: true, width: '8%' },
        { key: 'cost', header: 'Cost', type: 'number', editable: true, width: '8%' },
        { key: 'taxes', header: 'Taxes', type: 'number', editable: true, width: '8%' },
        { 
            key: 'total', 
            header: 'Total', 
            type: 'currency', 
            editable: false, 
            align: 'right',
            width: '8%',
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
            emptyMessage="No tools items found."
        />
    );
}
