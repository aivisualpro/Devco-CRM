'use client';

import React, { useState, useCallback } from 'react';
import { GenericCataloguePickerModal, PickerColumn } from './GenericCataloguePickerModal';
import { AddDisposalCatalogueDialogue } from '@/app/(protected)/catalogue/components/AddDisposalCatalogueDialogue';
import { useToast } from '@/hooks/useToast';

interface AddDisposalEstimateDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    section: any;
    existingItems: any[];
    catalog: any[];
    onSave: (section: any, data: any, isManual: boolean) => Promise<void>;
    onCatalogUpdate?: () => void;
}

const DISPOSAL_COLUMNS: PickerColumn[] = [
    { key: 'disposalAndHaulOff', label: 'Disposal & Haul Off', type: 'text', editable: true },
    { key: 'classification', label: 'Classification', type: 'text', editable: true },
    { key: 'subClassification', label: 'Sub Classification', type: 'text', editable: true },
    { key: 'uom', label: 'UOM', type: 'text', editable: true },
    { key: 'cost', label: 'Cost', type: 'number', editable: true, prefix: '$' },
];

export function AddDisposalEstimateDialogue({
    isOpen,
    onClose,
    section,
    existingItems,
    catalog,
    onSave,
    onCatalogUpdate
}: AddDisposalEstimateDialogueProps) {
    const [isAddNewCatalogue, setIsAddNewCatalogue] = useState(false);
    const { success, error: toastError } = useToast();

    const getIdentifier = useCallback((item: any): string => {
        const normalize = (val: unknown) => String(val || '').toLowerCase().trim();
        return `disp|${normalize(item.disposalAndHaulOff)}|${normalize(item.classification)}`;
    }, []);

    const searchFilter = useCallback((item: any, searchStr: string) => {
        const name = String(item.disposalAndHaulOff || '').toLowerCase();
        const classification = String(item.classification || '').toLowerCase();
        return name.includes(searchStr) || classification.includes(searchStr);
    }, []);

    const customItemDefaults = useCallback((itemData: any) => ({
        ...itemData, quantity: 1
    }), []);

    const handleSaveSelection = async (selectedItems: any[]) => {
        for (const itemData of selectedItems) {
            await onSave(section, itemData, false);
        }
    };

    const handleCatalogueSave = async (data: any) => {
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'addCatalogueItem',
                    payload: { type: 'disposal', item: data }
                })
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
                title="Add Disposal & Haul Off"
                type="disposal"
                catalog={catalog}
                existingItems={existingItems}
                columns={DISPOSAL_COLUMNS}
                getIdentifier={getIdentifier}
                searchFilter={searchFilter}
                onSave={handleSaveSelection}
                onCatalogUpdate={onCatalogUpdate}
                onAddNew={() => setIsAddNewCatalogue(true)}
                customItemDefaults={customItemDefaults}
            />

            {isAddNewCatalogue && (
                <AddDisposalCatalogueDialogue
                    isOpen={isAddNewCatalogue}
                    onClose={() => setIsAddNewCatalogue(false)}
                    onSave={handleCatalogueSave}
                    existingItems={catalog}
                />
            )}
        </>
    );
}
