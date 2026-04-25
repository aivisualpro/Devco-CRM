'use client';

import React, { useState, useCallback } from 'react';
import { GenericCataloguePickerModal, PickerColumn } from './GenericCataloguePickerModal';
import { AddToolsCatalogueDialogue } from '@/app/(protected)/catalogue/components/AddToolsCatalogueDialogue';
import { useToast } from '@/hooks/useToast';

interface AddToolsEstimateDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    section: any;
    existingItems: any[];
    catalog: any[];
    onSave: (section: any, data: any, isManual: boolean) => Promise<void>;
    onCatalogUpdate?: () => void;
}

const TOOLS_COLUMNS: PickerColumn[] = [
    { key: 'tool', label: 'Tool', type: 'text', editable: true },
    { key: 'classification', label: 'Classification', type: 'text', editable: true },
    { key: 'subClassification', label: 'Sub Classification', type: 'text', editable: true },
    { key: 'supplier', label: 'Supplier', type: 'text', editable: true },
    { key: 'uom', label: 'UOM', type: 'text', editable: true },
    { key: 'cost', label: 'Cost', type: 'number', editable: true, prefix: '$' },
    { key: 'taxes', label: 'Taxes %', type: 'number', editable: true, suffix: '%' },
];

export function AddToolsEstimateDialogue({
    isOpen,
    onClose,
    section,
    existingItems,
    catalog,
    onSave,
    onCatalogUpdate
}: AddToolsEstimateDialogueProps) {
    const [isAddNewCatalogue, setIsAddNewCatalogue] = useState(false);
    const { success, error: toastError } = useToast();

    const getIdentifier = useCallback((item: any): string => {
        const normalize = (val: unknown) => String(val || '').toLowerCase().trim();
        return `tool|${normalize(item.tool)}|${normalize(item.classification)}`;
    }, []);

    const searchFilter = useCallback((item: any, searchStr: string) => {
        const name = String(item.tool || '').toLowerCase();
        const classification = String(item.classification || '').toLowerCase();
        const supplier = String(item.supplier || '').toLowerCase();
        return name.includes(searchStr) || classification.includes(searchStr) || supplier.includes(searchStr);
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
            const res = await fetch('/api/catalogue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'tools', item: data })
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
                title="Add Tools"
                type="tools"
                catalog={catalog}
                existingItems={existingItems}
                columns={TOOLS_COLUMNS}
                getIdentifier={getIdentifier}
                searchFilter={searchFilter}
                onSave={handleSaveSelection}
                onCatalogUpdate={onCatalogUpdate}
                onAddNew={() => setIsAddNewCatalogue(true)}
                customItemDefaults={customItemDefaults}
            />

            {isAddNewCatalogue && (
                <AddToolsCatalogueDialogue
                    isOpen={isAddNewCatalogue}
                    onClose={() => setIsAddNewCatalogue(false)}
                    onSave={handleCatalogueSave}
                    existingItems={catalog}
                />
            )}
        </>
    );
}
