'use client';

import React, { useState, useCallback } from 'react';
import { GenericCataloguePickerModal, PickerColumn } from './GenericCataloguePickerModal';
import { AddEquipmentCatalogueDialogue } from '@/app/(protected)/catalogue/components/AddEquipmentCatalogueDialogue';
import { useToast } from '@/hooks/useToast';

interface AddEquipmentEstimateDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    section: any;
    existingItems: any[];
    catalog: any[];
    onSave: (section: any, data: any, isManual: boolean) => Promise<void>;
    onCatalogUpdate?: () => void;
}

const EQUIPMENT_COLUMNS: PickerColumn[] = [
    { key: 'equipmentMachine', label: 'Equipment/Machine', type: 'text', editable: true },
    { key: 'classification', label: 'Classification', type: 'text', editable: true },
    { key: 'subClassification', label: 'Sub Classification', type: 'text', editable: true },
    { key: 'supplier', label: 'Supplier', type: 'text', editable: true },
    { key: 'uom', label: 'UOM', type: 'text', editable: true },
    { key: 'dailyCost', label: 'Daily Cost', type: 'number', editable: true, prefix: '$' },
    { key: 'weeklyCost', label: 'Weekly Cost', type: 'number', editable: true, prefix: '$' },
    { key: 'monthlyCost', label: 'Monthly Cost', type: 'number', editable: true, prefix: '$' },
    { key: 'tax', label: 'Tax %', type: 'number', editable: true, suffix: '%' },
];

export function AddEquipmentEstimateDialogue({
    isOpen,
    onClose,
    section,
    existingItems,
    catalog,
    onSave,
    onCatalogUpdate
}: AddEquipmentEstimateDialogueProps) {
    const [isAddNewCatalogue, setIsAddNewCatalogue] = useState(false);
    const { success, error: toastError } = useToast();

    const getIdentifier = useCallback((item: any): string => {
        const normalize = (val: unknown) => String(val || '').toLowerCase().trim();
        return `equip|${normalize(item.equipmentMachine)}|${normalize(item.classification)}`;
    }, []);

    const searchFilter = useCallback((item: any, searchStr: string) => {
        const name = String(item.equipmentMachine || '').toLowerCase();
        const classification = String(item.classification || '').toLowerCase();
        const supplier = String(item.supplier || '').toLowerCase();
        return name.includes(searchStr) || classification.includes(searchStr) || supplier.includes(searchStr);
    }, []);

    const customItemDefaults = useCallback((itemData: any) => ({
        ...itemData, quantity: 1, times: itemData.times || 1, deliveryPickup: itemData.deliveryPickup ?? 300
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
                body: JSON.stringify({ type: 'equipment', item: data })
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
                title="Add Equipment"
                type="equipment"
                catalog={catalog}
                existingItems={existingItems}
                columns={EQUIPMENT_COLUMNS}
                getIdentifier={getIdentifier}
                searchFilter={searchFilter}
                onSave={handleSaveSelection}
                onCatalogUpdate={onCatalogUpdate}
                onAddNew={() => setIsAddNewCatalogue(true)}
                customItemDefaults={customItemDefaults}
            />

            {isAddNewCatalogue && (
                <AddEquipmentCatalogueDialogue
                    isOpen={isAddNewCatalogue}
                    onClose={() => setIsAddNewCatalogue(false)}
                    onSave={handleCatalogueSave}
                    existingItems={catalog}
                />
            )}
        </>
    );
}
