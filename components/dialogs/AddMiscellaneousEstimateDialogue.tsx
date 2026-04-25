'use client';

import React, { useState, useCallback } from 'react';
import { GenericCataloguePickerModal, PickerColumn } from './GenericCataloguePickerModal';
import { AddMiscellaneousCatalogueDialogue } from '@/app/(protected)/catalogue/components/AddMiscellaneousCatalogueDialogue';
import { useToast } from '@/hooks/useToast';

interface AddMiscellaneousEstimateDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    section: any;
    existingItems: any[];
    catalog: any[];
    onSave: (section: any, data: any, isManual: boolean) => Promise<void>;
    onCatalogUpdate?: () => void;
}

const MISCELLANEOUS_COLUMNS: PickerColumn[] = [
    { key: 'item', label: 'Item', type: 'text', editable: true },
    { key: 'classification', label: 'Classification', type: 'text', editable: true },
    { key: 'uom', label: 'UOM', type: 'text', editable: true },
    { key: 'cost', label: 'Cost', type: 'number', editable: true, prefix: '$' },
    { key: 'quantity', label: 'Quantity', type: 'number', editable: true },
];

export function AddMiscellaneousEstimateDialogue({
    isOpen,
    onClose,
    section,
    existingItems,
    catalog,
    onSave,
    onCatalogUpdate
}: AddMiscellaneousEstimateDialogueProps) {
    const [isAddNewCatalogue, setIsAddNewCatalogue] = useState(false);
    const { success, error: toastError } = useToast();

    const getIdentifier = useCallback((item: any): string => {
        const normalize = (val: unknown) => String(val || '').toLowerCase().trim();
        return `misc|${normalize(item.item)}|${normalize(item.classification)}`;
    }, []);

    const searchFilter = useCallback((item: any, searchStr: string) => {
        const name = String(item.item || '').toLowerCase();
        const classification = String(item.classification || '').toLowerCase();
        return name.includes(searchStr) || classification.includes(searchStr);
    }, []);

    const customItemDefaults = useCallback((itemData: any) => ({
        miscellaneous: itemData.item || '',  // Map 'item' from catalogue to 'miscellaneous' for estimate
        classification: itemData.classification || '',
        uom: itemData.uom || '',
        cost: itemData.cost || 0,
        quantity: itemData.quantity || 1,
        days: 1,  // Include days field for the estimate
    }), []);

    const handleSaveSelection = async (selectedItems: any[]) => {
        for (const itemData of selectedItems) {
            await onSave(section, itemData, false);
        }
    };

    const handleCatalogueSave = async (data: any) => {
        try {
            const res = await fetch('/api/catalogue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'miscellaneous', item: data })
            });
            const result = await res.json();

            if (result.success) {
                success('Added to catalogue');
                setIsAddNewCatalogue(false);
                onCatalogUpdate?.();
                const newItem = { ...data, _id: result.result?._id || `temp-${Date.now()}` };
                await handleSaveSelection([customItemDefaults(newItem)]);
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
                title="Add Miscellaneous"
                type="miscellaneous"
                catalog={catalog}
                existingItems={existingItems}
                columns={MISCELLANEOUS_COLUMNS}
                getIdentifier={getIdentifier}
                searchFilter={searchFilter}
                onSave={handleSaveSelection}
                onCatalogUpdate={onCatalogUpdate}
                onAddNew={() => setIsAddNewCatalogue(true)}
                customItemDefaults={customItemDefaults}
            />

            {isAddNewCatalogue && (
                <AddMiscellaneousCatalogueDialogue
                    isOpen={isAddNewCatalogue}
                    onClose={() => setIsAddNewCatalogue(false)}
                    onSave={handleCatalogueSave}
                    existingItems={catalog}
                />
            )}
        </>
    );
}
