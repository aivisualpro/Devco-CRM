'use client';

import React, { useMemo } from 'react';
import { GenericLineItemsTable, LineItemColumnConfig } from '@/components/line-items/GenericLineItemsTable';

interface SubcontractorLineItemsTableProps {
    items: any[];
    onUpdateItem?: (item: any, field: string, value: string | number) => void;
    onDelete?: (item: any) => void;
    onDuplicate?: (item: any) => void;
}

export function SubcontractorLineItemsTable({ items, onUpdateItem, onDelete, onDuplicate }: SubcontractorLineItemsTableProps) {
    const columns = useMemo<LineItemColumnConfig[]>(() => [
        { key: 'classification', header: 'Classification', type: 'text', editable: true, width: '20%' },
        { key: 'subClassification', header: 'Sub', type: 'text', editable: true, width: '20%' },
        { key: 'contractor', header: 'Contractor', type: 'text', editable: true, width: '25%' },
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
            emptyMessage="No subcontractor items found."
        />
    );
}
