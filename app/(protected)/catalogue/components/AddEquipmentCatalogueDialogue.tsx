'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { MyDropDown } from '@/components/ui/MyDropDown';
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
    const [activeField, setActiveField] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({ ...initialData });
            } else {
                setFormData({
                    classification: '-',
                    subClassification: '-',
                    supplier: '-',
                    tax: 8.75
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
        return ['-', ...uniqueValues];
    };

    const handleSave = async () => {
        setIsSaving(true);
        // Convert number fields
        const processedData = { ...formData };
        ['dailyCost', 'weeklyCost', 'monthlyCost', 'tax'].forEach(field => {
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
            'field-uom',
            'field-dailyCost',
            'field-weeklyCost',
            'field-monthlyCost',
            'field-tax' // Last field
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
            <div className="relative w-[75%] h-[96vh] bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal flex flex-col" >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
                    <h2 className="text-lg font-bold text-gray-900">
                        {isEditing ? 'Edit Equipment' : 'Add New Equipment'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-4 pb-4 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Equipment / Machine</label>
                            <input
                                id="field-equipment"
                                type="text"
                                value={formData.equipmentMachine || ''}
                                onChange={(e) => setFormData({ ...formData, equipmentMachine: e.target.value })}
                                placeholder="Enter equipment / machine"
                                className="w-full p-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50/50 hover:bg-white"
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
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                Classification
                            </label>
                            <div
                                id="field-classification"
                                className="w-full h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 cursor-pointer flex items-center justify-between"
                                onClick={() => setActiveField('classification')}
                            >
                                {formData.classification || '-'}
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </div>
                            <MyDropDown
                                isOpen={activeField === 'classification'}
                                onClose={() => setActiveField(null)}
                                options={getOptions('classification').map(opt => ({ id: opt, label: opt, value: opt }))}
                                selectedValues={formData.classification ? [formData.classification] : []}
                                onSelect={(val) => {
                                    setFormData({ ...formData, classification: val });
                                    setActiveField(null);
                                    focusNextField(1);
                                }}
                                onAdd={async (val) => {
                                    setFormData({ ...formData, classification: val });
                                    setActiveField(null);
                                    focusNextField(1);
                                }}
                                placeholder="Select or add classification..."
                                width="w-full"
                                anchorId="field-classification"
                                positionMode="overlay"
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                Sub Classification
                            </label>
                            <div
                                id="field-subClassification"
                                className="w-full h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 cursor-pointer flex items-center justify-between"
                                onClick={() => setActiveField('subClassification')}
                            >
                                {formData.subClassification || '-'}
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </div>
                            <MyDropDown
                                isOpen={activeField === 'subClassification'}
                                onClose={() => setActiveField(null)}
                                options={getOptions('subClassification').map(opt => ({ id: opt, label: opt, value: opt }))}
                                selectedValues={formData.subClassification ? [formData.subClassification] : []}
                                onSelect={(val) => {
                                    setFormData({ ...formData, subClassification: val });
                                    setActiveField(null);
                                    focusNextField(2);
                                }}
                                onAdd={async (val) => {
                                    setFormData({ ...formData, subClassification: val });
                                    setActiveField(null);
                                    focusNextField(2);
                                }}
                                placeholder="Select or add sub-classification..."
                                width="w-full"
                                anchorId="field-subClassification"
                                positionMode="overlay"
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                Supplier
                            </label>
                            <div
                                id="field-supplier"
                                className="w-full h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 cursor-pointer flex items-center justify-between"
                                onClick={() => setActiveField('supplier')}
                            >
                                {formData.supplier || '-'}
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </div>
                            <MyDropDown
                                isOpen={activeField === 'supplier'}
                                onClose={() => setActiveField(null)}
                                options={getOptions('supplier').map(opt => ({ id: opt, label: opt, value: opt }))}
                                selectedValues={formData.supplier ? [formData.supplier] : []}
                                onSelect={(val) => {
                                    setFormData({ ...formData, supplier: val });
                                    setActiveField(null);
                                    focusNextField(3);
                                }}
                                onAdd={async (val) => {
                                    setFormData({ ...formData, supplier: val });
                                    setActiveField(null);
                                    focusNextField(3);
                                }}
                                placeholder="Select or add supplier..."
                                width="w-full"
                                anchorId="field-supplier"
                                positionMode="overlay"
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                UOM
                            </label>
                            <div
                                id="field-uom"
                                className="w-full h-10 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 cursor-pointer flex items-center justify-between"
                                onClick={() => setActiveField('uom')}
                            >
                                {formData.uom || '-'}
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </div>
                            <MyDropDown
                                isOpen={activeField === 'uom'}
                                onClose={() => setActiveField(null)}
                                options={getOptions('uom').map(opt => ({ id: opt, label: opt, value: opt }))}
                                selectedValues={formData.uom ? [formData.uom] : []}
                                onSelect={(val) => {
                                    setFormData({ ...formData, uom: val });
                                    setActiveField(null);
                                    focusNextField(4);
                                }}
                                onAdd={async (val) => {
                                    setFormData({ ...formData, uom: val });
                                    setActiveField(null);
                                    focusNextField(4);
                                }}
                                placeholder="Select or add UOM..."
                                width="w-full"
                                anchorId="field-uom"
                                positionMode="overlay"
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

                        <div className="col-span-1">
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
                                        focusNextField(6);
                                    }
                                }}
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tax %</label>
                            <input
                                id="field-tax"
                                type="number"
                                value={formData.tax || ''}
                                onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                                placeholder="0%"
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
                <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
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
