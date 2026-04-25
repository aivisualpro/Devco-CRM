'use client';

import React, { useState, useCallback } from 'react';
import { GenericCataloguePickerModal, PickerColumn } from './GenericCataloguePickerModal';
import { AddLaborCatalogueDialogue } from '@/app/(protected)/catalogue/components/AddLaborCatalogueDialogue';
import { useToast } from '@/hooks/useToast';

interface AddLaborEstimateDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    section: any;
    existingItems: any[];
    catalog: any[];
    fringe?: string;
    onSave: (section: any, data: any, isManual: boolean) => Promise<void>;
    fringeConstants?: Array<{ description: string; value: unknown }>;
    onCatalogUpdate?: () => void;
}

const LABOR_COLUMNS: PickerColumn[] = [
    { key: 'classification', label: 'Labor', type: 'text', editable: true },
    { key: 'basePay', label: 'Base Pay', type: 'number', editable: true, prefix: '$' },
    { key: 'wCompPercent', label: 'W Comp %', type: 'number', editable: true, suffix: '%' },
    { key: 'payrollTaxesPercent', label: 'Payroll Tax %', type: 'number', editable: true, suffix: '%' },
];

export function AddLaborEstimateDialogue({
    isOpen,
    onClose,
    section,
    existingItems,
    catalog,
    onSave,
    onCatalogUpdate
}: AddLaborEstimateDialogueProps) {
    const [isAddNewCatalogue, setIsAddNewCatalogue] = useState(false);
    const { success, error: toastError } = useToast();

    const getIdentifier = useCallback((item: any): string => {
        const normalize = (val: unknown) => String(val || '').toLowerCase().trim();
        const basePay = typeof item.basePay === 'number' ? item.basePay : parseFloat(String(item.basePay || 0).replace(/[^0-9.-]+/g, ""));
        return `labor|${normalize(item.classification)}|${basePay}`;
    }, []);

    const searchFilter = useCallback((item: any, searchStr: string) => {
        return String(item.classification || '').toLowerCase().includes(searchStr);
    }, []);

    const handleSaveSelection = async (selectedItems: any[]) => {
        for (const itemData of selectedItems) {
            await onSave(section, { ...itemData, quantity: 1, days: itemData.days || 1, hours: itemData.hours || 8, otPd: itemData.otPd || 2 }, false);
        }
    };

    const handleCatalogueSave = async (data: any) => {
        try {
            const res = await fetch('/api/catalogue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'labor', item: data })
            });
            const result = await res.json();

            if (result.success) {
                success('Added to catalogue');
                setIsAddNewCatalogue(false);
                onCatalogUpdate?.();
                // Immediately add to estimate as well
                const newItem = { ...data, _id: result.result?._id || `temp_${Date.now()}` };
                await handleSaveSelection([newItem]);
                onClose();
            } else {
                toastError('Failed to add to catalogue');
            }
        } catch (e) {
            toastError('Error saving to catalogue');
        }
    };

    return (
        <>
            <GenericCataloguePickerModal
                isOpen={isOpen && !isAddNewCatalogue}
                onClose={onClose}
                title="Add Labor"
                type="labor"
                catalog={catalog}
                existingItems={existingItems}
                columns={LABOR_COLUMNS}
                getIdentifier={getIdentifier}
                searchFilter={searchFilter}
                onSave={handleSaveSelection}
                onCatalogUpdate={onCatalogUpdate}
                onAddNew={() => setIsAddNewCatalogue(true)}
            />

            {isAddNewCatalogue && (
                <AddLaborCatalogueDialogue
                    isOpen={isAddNewCatalogue}
                    onClose={() => setIsAddNewCatalogue(false)}
                    onSave={handleCatalogueSave}
                    existingItems={catalog}
                />
            )}
        </>
    );
}
