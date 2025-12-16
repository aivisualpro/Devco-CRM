'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Button } from '@/components/ui/Button';

interface AddEquipmentCatalogueDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    isEditing?: boolean;
    existingItems?: any[];
}

export function AddEquipmentCatalogueDialogue({
    isOpen,
    onClose,
    onSave,
    initialData,
    isEditing,
    existingItems = []
}: AddEquipmentCatalogueDialogueProps) {
    const [formData, setFormData] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({ ...initialData });
            } else {
                setFormData({
                    classification: '-',
                    subClassification: '-',
                    supplier: '-'
                });
            }
        }
    }, [isOpen, initialData]);

    // Handle Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const getOptions = (field: string) => {
        const values = existingItems
            .map(item => item[field])
            .filter(val => val !== undefined && val !== null && val !== '');
        const uniqueValues = Array.from(new Set(values)).filter(v => v !== '-') as string[];
        uniqueValues.sort();
        return uniqueValues;
    };

    const handleSave = async () => {
        setIsSaving(true);
        // Convert number fields
        const processedData = { ...formData };
        ['dailyCost', 'weeklyCost', 'monthlyCost'].forEach(field => {
            if (processedData[field]) {
                processedData[field] = parseFloat(processedData[field]) || 0;
            }
        });

        await onSave(processedData);
        setIsSaving(false);
    };

    const focusNextField = (currentIndex: number) => {
        const fieldIds = [
            'field-equipment',
            'field-classification',
            'field-subClassification',
            'field-supplier',
            'field-dailyCost',
            'field-weeklyCost',
            'field-monthlyCost' // Last field
        ];

        if (currentIndex === fieldIds.length - 1) {
            handleSave();
        } else {
            const nextId = fieldIds[currentIndex + 1];
            const nextEl = document.getElementById(nextId);
            if (nextEl) {
                nextEl.focus();
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">
                        {isEditing ? 'Edit Equipment' : 'Add New Equipment'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-5">
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Equipment / Machine</label>
                            <input
                                id="field-equipment"
                                type="text"
                                value={formData.equipmentMachine || ''}
                                onChange={(e) => setFormData({ ...formData, equipmentMachine: e.target.value })}
                                placeholder="Enter equipment / machine"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50/50 hover:bg-white"
                                autoFocus={!isEditing}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        focusNextField(0);
                                    }
                                }}
                            />
                        </div>

                        <div className="col-span-1">
                            <SearchableSelect
                                id="field-classification"
                                label="Classification"
                                value={formData.classification || ''}
                                onChange={(val) => setFormData({ ...formData, classification: val })}
                                options={getOptions('classification')}
                                onNext={() => focusNextField(1)}
                            />
                        </div>

                        <div className="col-span-1">
                            <SearchableSelect
                                id="field-subClassification"
                                label="Sub Classification"
                                value={formData.subClassification || ''}
                                onChange={(val) => setFormData({ ...formData, subClassification: val })}
                                options={getOptions('subClassification')}
                                onNext={() => focusNextField(2)}
                            />
                        </div>

                        <div className="col-span-1">
                            <SearchableSelect
                                id="field-supplier"
                                label="Supplier"
                                value={formData.supplier || ''}
                                onChange={(val) => setFormData({ ...formData, supplier: val })}
                                options={getOptions('supplier')}
                                onNext={() => focusNextField(3)}
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Daily Cost</label>
                            <input
                                id="field-dailyCost"
                                type="number"
                                value={formData.dailyCost || ''}
                                onChange={(e) => setFormData({ ...formData, dailyCost: e.target.value })}
                                placeholder="Enter daily cost"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50/50 hover:bg-white"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        focusNextField(4);
                                    }
                                }}
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Weekly Cost</label>
                            <input
                                id="field-weeklyCost"
                                type="number"
                                value={formData.weeklyCost || ''}
                                onChange={(e) => setFormData({ ...formData, weeklyCost: e.target.value })}
                                placeholder="Enter weekly cost"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50/50 hover:bg-white"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        focusNextField(5);
                                    }
                                }}
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Monthly Cost</label>
                            <input
                                id="field-monthlyCost"
                                type="number"
                                value={formData.monthlyCost || ''}
                                onChange={(e) => setFormData({ ...formData, monthlyCost: e.target.value })}
                                placeholder="Enter monthly cost"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50/50 hover:bg-white"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSave(); // Last field saves
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-xl transition-colors shadow-sm shadow-green-500/30 flex items-center gap-2"
                    >
                        {isSaving ? 'Saving...' : (isEditing ? 'Update Cost' : 'Save the cost')}
                    </button>
                </div>
            </div>
        </div>
    );
}
