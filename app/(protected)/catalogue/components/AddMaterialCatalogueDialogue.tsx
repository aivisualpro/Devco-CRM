'use client';

import React from 'react';
import { EntityFormModal, FieldConfig } from '@/components/forms/EntityFormModal';

interface AddMaterialCatalogueDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    isEditing?: boolean;
    existingItems?: any[];
}

export const getMaterialFields = (existingItems: any[] = []): FieldConfig[] => {
    const getOptions = (field: string) => {
        const values = existingItems
            .map(item => item[field])
            .filter(val => val !== undefined && val !== null && val !== '');
        const uniqueValues = Array.from(new Set(values)).filter(v => v !== '-') as string[];
        uniqueValues.sort();
        return uniqueValues.map(v => ({ value: v, label: v }));
    };

    return [
        { name: 'material', label: 'Material Name', type: 'text', width: 'full', required: true, placeholder: 'Enter material name' },
        { name: 'classification', label: 'Classification', type: 'select', width: 'half', options: getOptions('classification') },
        { name: 'subClassification', label: 'Sub Classification', type: 'select', width: 'half', options: getOptions('subClassification') },
        { name: 'supplier', label: 'Supplier', type: 'select', width: 'half', options: getOptions('supplier') },
        { name: 'uom', label: 'UOM', type: 'select', width: 'half', options: getOptions('uom') },
        { name: 'cost', label: 'Cost', type: 'currency', width: 'half', required: true, placeholder: '0.00' },
        { name: 'taxes', label: 'Taxes (%)', type: 'number', width: 'half', defaultValue: 0 },
    ];
};

export function AddMaterialCatalogueDialogue({
    isOpen,
    onClose,
    onSave,
    initialData,
    isEditing,
    existingItems = []
}: AddMaterialCatalogueDialogueProps) {
    const fields = React.useMemo(() => getMaterialFields(existingItems), [existingItems]);

    return (
        <EntityFormModal
            open={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Material' : 'Add New Material'}
            fields={fields}
            initialData={initialData}
            onSubmit={onSave}
            submitLabel={isEditing ? 'Update Item' : 'Save Item'}
        />
    );
}
