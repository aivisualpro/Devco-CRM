'use client';

import React, { useState, useCallback } from 'react';
import { GenericCataloguePickerModal, PickerColumn } from './GenericCataloguePickerModal';
import { AddOverheadCatalogueDialogue } from '@/app/(protected)/catalogue/components/AddOverheadCatalogueDialogue';
import { useToast } from '@/hooks/useToast';

interface AddOverheadEstimateDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    section: any;
    existingItems: any[];
    catalog: any[];
    onSave: (section: any, data: any, isManual: boolean) => Promise<void>;
    onCatalogUpdate?: () => void;
}

const OVERHEAD_COLUMNS: PickerColumn[] = [
    { key: 'overhead', label: 'Overhead', type: 'text', editable: true },
    { key: 'classification', label: 'Classification', type: 'text', editable: true },
    { key: 'subClassification', label: 'Sub Classification', type: 'text', editable: true },
    { key: 'hourlyRate', label: 'Hourly Rate', type: 'number', editable: true, prefix: '$' },
    { key: 'dailyRate', label: 'Daily Rate', type: 'number', editable: true, prefix: '$' },
];

export function AddOverheadEstimateDialogue({
    isOpen,
    onClose,
    section,
    existingItems,
    catalog,
    onSave,
    onCatalogUpdate
}: AddOverheadEstimateDialogueProps) {
    const [isAddNewCatalogue, setIsAddNewCatalogue] = useState(false);
    const { success, error: toastError } = useToast();

    const getIdentifier = useCallback((item: any): string => {
        const normalize = (val: unknown) => String(val || '').toLowerCase().trim();
        return `over|${normalize(item.overhead)}|${normalize(item.classification)}`;
    }, []);

    const searchFilter = useCallback((item: any, searchStr: string) => {
        const name = String(item.overhead || '').toLowerCase();
        const classification = String(item.classification || '').toLowerCase();
        const subClassification = String(item.subClassification || '').toLowerCase();
        return name.includes(searchStr) || classification.includes(searchStr) || subClassification.includes(searchStr);
    }, []);

    const customItemDefaults = useCallback((itemData: any) => ({
        ...itemData, days: 1
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
                    payload: { type: 'overhead', item: data }
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
                title="Add Overhead"
                type="overhead"
                catalog={catalog}
                existingItems={existingItems}
                columns={OVERHEAD_COLUMNS}
                getIdentifier={getIdentifier}
                searchFilter={searchFilter}
                onSave={handleSaveSelection}
                onCatalogUpdate={onCatalogUpdate}
                onAddNew={() => setIsAddNewCatalogue(true)}
                customItemDefaults={customItemDefaults}
            />

            {isAddNewCatalogue && (
                <AddOverheadCatalogueDialogue
                    isOpen={isAddNewCatalogue}
                    onClose={() => setIsAddNewCatalogue(false)}
                    onSave={handleCatalogueSave}
                    existingItems={catalog}
                />
            )}
        </>
    );
}
