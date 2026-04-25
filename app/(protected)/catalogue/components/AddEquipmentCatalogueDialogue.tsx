'use client';

import React from 'react';
import { EntityFormModal, FieldConfig } from '@/components/forms/EntityFormModal';

interface AddEquipmentCatalogueDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    isEditing?: boolean;
    existingItems?: any[];
}

export const getEquipmentFields = (existingItems: any[] = []): FieldConfig[] => {
    const getOptions = (field: string) => {
        const values = existingItems.map(item => item[field]).filter(Boolean);
        const uniqueValues = Array.from(new Set(values)).filter(v => v !== '-').sort();
        return uniqueValues.map(v => ({ value: v, label: v }));
    };

    return [
        { name: 'equipmentMachine', label: 'Equipment / Machine', type: 'text', width: 'full', required: true, placeholder: 'e.g. Excavator 305' },
        { name: 'classification', label: 'Classification', type: 'select', width: 'half', options: getOptions('classification') },
        { name: 'subClassification', label: 'Sub Classification', type: 'select', width: 'half', options: getOptions('subClassification') },
        { name: 'supplier', label: 'Supplier', type: 'select', width: 'half', options: getOptions('supplier') },
        { name: 'uom', label: 'UOM', type: 'select', width: 'half', options: getOptions('uom') },
        { name: 'dailyCost', label: 'Daily Cost ($)', type: 'currency', width: 'half' },
        { name: 'weeklyCost', label: 'Weekly Cost ($)', type: 'currency', width: 'half' },
        { name: 'monthlyCost', label: 'Monthly Cost ($)', type: 'currency', width: 'half' },
        { name: 'tax', label: 'Tax (%)', type: 'number', width: 'half', defaultValue: 8.75 },
    ];
};

export function AddEquipmentCatalogueDialogue({
    isOpen,
    onClose,
    onSave,
    initialData,
    isEditing,
    existingItems = []
}: AddEquipmentCatalogueDialogueProps) {
    const fields = React.useMemo(() => getEquipmentFields(existingItems), [existingItems]);

    return (
        <EntityFormModal
            open={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Equipment' : 'Add New Equipment'}
            fields={fields}
            initialData={initialData}
            onSubmit={onSave}
            submitLabel={isEditing ? 'Update Item' : 'Add Item'}
        />
    );
}
