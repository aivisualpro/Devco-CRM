'use client';

import React, { useMemo } from 'react';
import { GenericLineItemsTable, LineItemColumnConfig } from '@/components/line-items/GenericLineItemsTable';

interface OverheadLineItemsTableProps {
    items: any[];
    onUpdateItem?: (item: any, field: string, value: string | number) => void;
    onDelete?: (item: any) => void;
    onDuplicate?: (item: any) => void;
}

export function OverheadLineItemsTable({ items, onUpdateItem, onDelete, onDuplicate }: OverheadLineItemsTableProps) {
    const columns = useMemo<LineItemColumnConfig[]>(() => [
        { key: 'overhead', header: 'Overhead', type: 'text', editable: true, width: '20%' },
        { key: 'classification', header: 'Classification', type: 'text', editable: true, width: '20%' },
        { key: 'subClassification', header: 'Sub', type: 'text', editable: true, width: '20%' },
        { key: 'days', header: 'Days', type: 'number', editable: true, width: '15%' },
        { key: 'dailyRate', header: 'Daily Rate', type: 'number', editable: true, width: '15%' },
        { 
            key: 'total', 
            header: 'Total', 
            type: 'currency', 
            editable: false, 
            align: 'right',
            width: '10%',
            computed: (row) => {
                const days = parseFloat(row.days) || 0;
                const dailyRate = parseFloat(row.dailyRate) || 0;
                return days * dailyRate;
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
            emptyMessage="No overhead items found."
        />
    );
}
