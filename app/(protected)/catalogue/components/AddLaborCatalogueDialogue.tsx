'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface AddLaborCatalogueDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    isEditing?: boolean;
    existingItems?: any[];
    fringeConstants?: any[];
    onAddFringe: (name: string, value: number) => Promise<void>;
}

export function AddLaborCatalogueDialogue({
    isOpen,
    onClose,
    onSave,
    initialData,
    isEditing,
    existingItems = [],
    fringeConstants = [],
    onAddFringe
}: AddLaborCatalogueDialogueProps) {
    const [formData, setFormData] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);

    // Fringe Prompt State
    const [showFringePrompt, setShowFringePrompt] = useState(false);
    const [pendingFringeName, setPendingFringeName] = useState('');
    const [newFringeValue, setNewFringeValue] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({ ...initialData });
            } else {
                setFormData({
                    classification: '-',
                    subClassification: '-',
                    fringe: '-',
                    wCompPercent: 12,
                    payrollTaxesPercent: 16
                });
            }
        }
    }, [isOpen, initialData]);

    // Handle Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                // If fringe prompt is open, it handles its own escape
                if (!showFringePrompt) {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, showFringePrompt, onClose]);

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
        if (processedData.basePay) processedData.basePay = parseFloat(processedData.basePay) || 0;
        if (processedData.wCompPercent) processedData.wCompPercent = parseFloat(processedData.wCompPercent) || 0;
        if (processedData.payrollTaxesPercent) processedData.payrollTaxesPercent = parseFloat(processedData.payrollTaxesPercent) || 0;

        await onSave(processedData);
        setIsSaving(false);
    };

    const handleFringeChange = (val: string) => {
        // Check if existing constant
        const existing = fringeConstants.find(c => c.description === val);
        if (existing || val === '-') {
            setFormData({ ...formData, fringe: val });
        } else {
            // New Fringe - prompt for value
            setPendingFringeName(val);
            setNewFringeValue('');
            setShowFringePrompt(true);
        }
    };

    const confirmNewFringe = async () => {
        if (!newFringeValue) return;
        const numVal = parseFloat(newFringeValue);
        if (isNaN(numVal)) return;

        await onAddFringe(pendingFringeName, numVal);
        setFormData({ ...formData, fringe: pendingFringeName });
        setShowFringePrompt(false);
    };

    const focusNextField = (currentIndex: number) => {
        const fieldIds = [
            'field-classification',
            'field-subClassification',
            'field-fringe',
            'field-basePay',
            'field-wComp',
            'field-payrollTax'
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
        <>
            <div className="fixed inset-0 z-[200] flex items-start md:items-center justify-center p-2 md:p-4 overflow-hidden pt-4 md:pt-0">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose}></div>
                <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal" >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-900">
                            {isEditing ? 'Edit Labor' : 'Add New Labor'}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 max-h-[85vh] overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-40 md:pb-0">
                            <div className="col-span-1">
                                <SearchableSelect
                                    id="field-classification"
                                    label="Classification"
                                    value={formData.classification || ''}
                                    onChange={(val) => setFormData({ ...formData, classification: val })}
                                    options={getOptions('classification')}
                                    autoFocus={!isEditing}
                                    onNext={() => focusNextField(0)}
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
                                    onNext={() => focusNextField(1)}
                                    onAddNew={(val) => setFormData({ ...formData, subClassification: val })}
                                />
                            </div>

                            <div className="col-span-1">
                                <SearchableSelect
                                    id="field-fringe"
                                    label="Fringe Benefits"
                                    value={formData.fringe || ''}
                                    onChange={handleFringeChange}
                                    options={['-', ...fringeConstants.map(c => c.description)]}
                                    placeholder="Select or add fringe..."
                                    onNext={() => focusNextField(2)}
                                    onAddNew={handleFringeChange}
                                />
                            </div>

                            <div className="col-span-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Base Pay</label>
                                <input
                                    id="field-basePay"
                                    type="number"
                                    value={formData.basePay || ''}
                                    onChange={(e) => setFormData({ ...formData, basePay: e.target.value })}
                                    placeholder="Enter base pay"
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
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Workers Comp %</label>
                                <input
                                    id="field-wComp"
                                    type="number"
                                    value={formData.wCompPercent || ''}
                                    onChange={(e) => setFormData({ ...formData, wCompPercent: e.target.value })}
                                    placeholder="e.g. 12"
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
                                    placeholder="e.g. 16"
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
                            {isSaving ? 'Saving...' : (isEditing ? 'Update Cost' : 'Save the cost')}
                        </button>
                    </div>
                </div>
            </div>

            {/* Fringe Prompt Modal */}
            {showFringePrompt && (
                <div className="fixed inset-0 z-[60] fixed inset-0 z-[200] flex items-start md:items-center justify-center p-2 md:p-4 overflow-hidden pt-4 md:pt-0">
                    <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setShowFringePrompt(false)}></div>
                    <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl p-6 animate-in zoom-in-95">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">New Fringe Constant</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Set the value for <strong>{pendingFringeName}</strong>.
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Value (e.g. 15.50)</label>
                            <input
                                autoFocus
                                type="number"
                                value={newFringeValue}
                                onChange={(e) => setNewFringeValue(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-xl"
                                placeholder="0.00"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') confirmNewFringe();
                                    if (e.key === 'Escape') setShowFringePrompt(false);
                                }}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowFringePrompt(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={confirmNewFringe} className="px-3 py-1.5 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
