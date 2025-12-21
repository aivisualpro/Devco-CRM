'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface AddMaterialCatalogueDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    isEditing?: boolean;
    existingItems?: any[];
}

export function AddMaterialCatalogueDialogue({
    isOpen,
    onClose,
    onSave,
    initialData,
    isEditing,
    existingItems = []
}: AddMaterialCatalogueDialogueProps) {
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
                    supplier: '-',
                    uom: '-'
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
        const processedData = { ...formData };
        if (processedData.cost) processedData.cost = parseFloat(processedData.cost) || 0;
        if (processedData.taxes) processedData.taxes = parseFloat(processedData.taxes) || 0;

        await onSave(processedData);
        setIsSaving(false);
    };

    const focusNextField = (currentIndex: number) => {
        const fieldIds = [
            'field-material',
            'field-classification',
            'field-subClassification',
            'field-supplier',
            'field-uom',
            'field-cost',
            'field-taxes'
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
        <div className="fixed inset-0 z-[200] flex items-start md:items-center justify-center p-2 md:p-4 overflow-hidden pt-4 md:pt-0">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal" >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">
                        {isEditing ? 'Edit Material' : 'Add New Material'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 max-h-[85vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-40 md:pb-0">
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Material Name</label>
                            <input
                                id="field-material"
                                type="text"
                                value={formData.material || ''}
                                onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                                placeholder="Enter material name"
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
                                onAddNew={(val) => setFormData({ ...formData, classification: val })}
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
                                onAddNew={(val) => setFormData({ ...formData, subClassification: val })}
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
                                onAddNew={(val) => setFormData({ ...formData, supplier: val })}
                            />
                        </div>

                        <div className="col-span-1">
                            <SearchableSelect
                                id="field-uom"
                                label="UOM"
                                value={formData.uom || ''}
                                onChange={(val) => setFormData({ ...formData, uom: val })}
                                options={getOptions('uom')}
                                onNext={() => focusNextField(4)}
                                onAddNew={(val) => setFormData({ ...formData, uom: val })}
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cost</label>
                            <input
                                id="field-cost"
                                type="number"
                                value={formData.cost || ''}
                                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                                placeholder="0.00"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50/50 hover:bg-white"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        focusNextField(5);
                                    }
                                }}
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Taxes %</label>
                            <input
                                id="field-taxes"
                                type="number"
                                value={formData.taxes || ''}
                                onChange={(e) => setFormData({ ...formData, taxes: e.target.value })}
                                placeholder="0"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50/50 hover:bg-white"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSave();
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
                        {isSaving ? 'Saving...' : (isEditing ? 'Update Item' : 'Save Item')}
                    </button>
                </div>
            </div>
        </div>
    );
}
