'use client';

import React from 'react';
import { EntityFormModal, FieldConfig } from '@/components/forms/EntityFormModal';

interface AddSubcontractorCatalogueDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    isEditing?: boolean;
    existingItems?: any[];
}

export const getSubcontractorFields = (existingItems: any[] = []): FieldConfig[] => {
    const getOptions = (field: string) => {
        const values = existingItems.map(item => item[field]).filter(Boolean);
        const uniqueValues = Array.from(new Set(values)).filter(v => v !== '-').sort();
        return uniqueValues.map(v => ({ value: v, label: v }));
    };

    return [
        { name: 'subcontractor', label: 'Subcontractor Name', type: 'text', width: 'full', required: true, placeholder: 'Enter subcontractor name' },
        { name: 'classification', label: 'Classification', type: 'select', width: 'half', options: getOptions('classification') },
        { name: 'subClassification', label: 'Sub Classification', type: 'select', width: 'half', options: getOptions('subClassification') },
        { name: 'uom', label: 'UOM', type: 'select', width: 'half', options: getOptions('uom') },
        { name: 'cost', label: 'Cost ($)', type: 'currency', width: 'half', required: true, placeholder: '0.00' },
    ];
};

export function AddSubcontractorCatalogueDialogue({
    isOpen,
    onClose,
    onSave,
    initialData,
    isEditing,
    existingItems = []
}: AddSubcontractorCatalogueDialogueProps) {
    const fields = React.useMemo(() => getSubcontractorFields(existingItems), [existingItems]);

    return (
        <EntityFormModal
            open={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Subcontractor' : 'Add New Subcontractor'}
            fields={fields}
            initialData={initialData}
            onSubmit={onSave}
            submitLabel={isEditing ? 'Update Item' : 'Save Item'}
        />
    );
}
