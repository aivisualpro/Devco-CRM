'use client';

import React from 'react';
import { EntityFormModal, FieldConfig } from '@/components/forms/EntityFormModal';

interface AddMiscellaneousCatalogueDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    isEditing?: boolean;
    existingItems?: any[];
}

export const getMiscellaneousFields = (existingItems: any[] = []): FieldConfig[] => {
    const getOptions = (field: string) => {
        const values = existingItems.map(item => item[field]).filter(Boolean);
        const uniqueValues = Array.from(new Set(values)).filter(v => v !== '-').sort();
        return uniqueValues.map(v => ({ value: v, label: v }));
    };

    return [
        { name: 'item', label: 'Item Name', type: 'text', width: 'full', required: true, placeholder: 'Enter item name' },
        { name: 'classification', label: 'Classification', type: 'select', width: 'half', options: getOptions('classification') },
        { name: 'uom', label: 'UOM', type: 'select', width: 'half', options: getOptions('uom') },
        { name: 'cost', label: 'Cost ($)', type: 'currency', width: 'half', required: true, placeholder: '0.00' },
        { name: 'quantity', label: 'Quantity', type: 'number', width: 'half', defaultValue: 1 },
    ];
};

export function AddMiscellaneousCatalogueDialogue({
    isOpen,
    onClose,
    onSave,
    initialData,
    isEditing,
    existingItems = []
}: AddMiscellaneousCatalogueDialogueProps) {
    const fields = React.useMemo(() => getMiscellaneousFields(existingItems), [existingItems]);

    return (
        <EntityFormModal
            open={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Miscellaneous' : 'Add New Miscellaneous'}
            fields={fields}
            initialData={initialData}
            onSubmit={onSave}
            submitLabel={isEditing ? 'Update Item' : 'Save Item'}
        />
    );
}
