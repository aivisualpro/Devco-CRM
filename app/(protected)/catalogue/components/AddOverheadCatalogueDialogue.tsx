'use client';

import React from 'react';
import { EntityFormModal, FieldConfig } from '@/components/forms/EntityFormModal';

interface AddOverheadCatalogueDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    isEditing?: boolean;
    existingItems?: any[];
}

export const getOverheadFields = (existingItems: any[] = []): FieldConfig[] => {
    const getOptions = (field: string) => {
        const values = existingItems.map(item => item[field]).filter(Boolean);
        const uniqueValues = Array.from(new Set(values)).filter(v => v !== '-').sort();
        return uniqueValues.map(v => ({ value: v, label: v }));
    };

    return [
        { name: 'overhead', label: 'Overhead Description', type: 'text', width: 'full', required: true, placeholder: 'e.g. Project Management Fees' },
        { name: 'classification', label: 'Classification', type: 'select', width: 'half', options: getOptions('classification') },
        { name: 'subClassification', label: 'Sub Classification', type: 'select', width: 'half', options: getOptions('subClassification') },
        { name: 'hourlyRate', label: 'Hourly Rate ($)', type: 'currency', width: 'half' },
        { name: 'dailyRate', label: 'Daily Rate ($)', type: 'currency', width: 'half' },
        { name: 'payrollTaxesPercent', label: 'Payroll Taxes (%)', type: 'number', width: 'half' },
        { name: 'wCompPercent', label: 'Workers Comp (%)', type: 'number', width: 'half' },
    ];
};

export function AddOverheadCatalogueDialogue({
    isOpen,
    onClose,
    onSave,
    initialData,
    isEditing,
    existingItems = []
}: AddOverheadCatalogueDialogueProps) {
    const fields = React.useMemo(() => getOverheadFields(existingItems), [existingItems]);

    return (
        <EntityFormModal
            open={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Overhead' : 'Add New Overhead'}
            fields={fields}
            initialData={initialData}
            onSubmit={onSave}
            submitLabel={isEditing ? 'Update Item' : 'Save Item'}
        />
    );
}
