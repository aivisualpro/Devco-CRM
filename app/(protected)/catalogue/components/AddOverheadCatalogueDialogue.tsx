'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface AddOverheadCatalogueDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    isEditing?: boolean;
    existingItems?: any[];
}

export function AddOverheadCatalogueDialogue({
    isOpen,
    onClose,
    onSave,
    initialData,
    isEditing,
    existingItems = []
}: AddOverheadCatalogueDialogueProps) {
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
        if (processedData.hourlyRate) processedData.hourlyRate = parseFloat(processedData.hourlyRate) || 0;
        if (processedData.dailyRate) processedData.dailyRate = parseFloat(processedData.dailyRate) || 0;
        if (processedData.payrollTaxesPercent) processedData.payrollTaxesPercent = parseFloat(processedData.payrollTaxesPercent) || 0;
        if (processedData.wCompPercent) processedData.wCompPercent = parseFloat(processedData.wCompPercent) || 0;

        await onSave(processedData);
        setIsSaving(false);
    };

    const focusNextField = (currentIndex: number) => {
        const fieldIds = [
            'field-overhead',
            'field-classification',
            'field-subClassification',
            'field-hourlyRate',
            'field-dailyRate',
            'field-payrollTax',
            'field-wComp'
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
                        {isEditing ? 'Edit Overhead' : 'Add New Overhead'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 max-h-[85vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-40 md:pb-0">
                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Overhead Description</label>
                            <input
                                id="field-overhead"
                                type="text"
                                value={formData.overhead || ''}
                                onChange={(e) => setFormData({ ...formData, overhead: e.target.value })}
                                placeholder="Enter overhead description"
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
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Hourly Rate</label>
                            <input
                                id="field-hourlyRate"
                                type="number"
                                value={formData.hourlyRate || ''}
                                onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                                placeholder="0.00"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50/50 hover:bg-white"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        focusNextField(3);
                                    }
                                }}
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Daily Rate</label>
                            <input
                                id="field-dailyRate"
                                type="number"
                                value={formData.dailyRate || ''}
                                onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                                placeholder="0.00"
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
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payroll Taxes %</label>
                            <input
                                id="field-payrollTax"
                                type="number"
                                value={formData.payrollTaxesPercent || ''}
                                onChange={(e) => setFormData({ ...formData, payrollTaxesPercent: e.target.value })}
                                placeholder="0"
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
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Workers Comp %</label>
                            <input
                                id="field-wComp"
                                type="number"
                                value={formData.wCompPercent || ''}
                                onChange={(e) => setFormData({ ...formData, wCompPercent: e.target.value })}
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
