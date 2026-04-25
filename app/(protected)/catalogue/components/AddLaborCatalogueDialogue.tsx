'use client';

import React from 'react';
import { EntityFormModal, FieldConfig } from '@/components/forms/EntityFormModal';

interface AddLaborCatalogueDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    isEditing?: boolean;
    existingItems?: any[];
}

export const LABOR_FIELDS: FieldConfig[] = [
    { name: 'classification', label: 'Labor Classification', type: 'text', width: 'full', required: true, placeholder: 'e.g. Journeyman Electrician' },
    { name: 'basePay', label: 'Base Pay ($/hr)', type: 'currency', width: 'half', required: true, placeholder: '0.00' },
    { name: 'otPd', label: 'OT Multiplier', type: 'number', width: 'half', defaultValue: 2 },
    { name: 'wCompPercent', label: 'Workers Comp (%)', type: 'number', width: 'half', defaultValue: 12 },
    { name: 'payrollTaxesPercent', label: 'Payroll Taxes (%)', type: 'number', width: 'half', defaultValue: 16 },
];

export function AddLaborCatalogueDialogue({
    isOpen,
    onClose,
    onSave,
    initialData,
    isEditing
}: AddLaborCatalogueDialogueProps) {
    return (
        <EntityFormModal
            open={isOpen}
            onClose={onClose}
            title={isEditing ? 'Edit Labor Item' : 'Add New Labor Item'}
            fields={LABOR_FIELDS}
            initialData={initialData}
            onSubmit={onSave}
            submitLabel={isEditing ? 'Update Item' : 'Add Item'}
        />
    );
}
