'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { MyDropDown } from '@/components/ui/MyDropDown';

interface AddLaborCatalogueDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    isEditing?: boolean;
    existingItems?: any[];
}

export function AddLaborCatalogueDialogue({
    isOpen,
    onClose,
    onSave,
    initialData,
    isEditing,
    existingItems = []
}: AddLaborCatalogueDialogueProps) {
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
                    otPd: 2,
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
        const processedData = { ...formData };
        if (processedData.basePay) processedData.basePay = parseFloat(processedData.basePay) || 0;
        if (processedData.wCompPercent) processedData.wCompPercent = parseFloat(processedData.wCompPercent) || 0;
        if (processedData.payrollTaxesPercent) processedData.payrollTaxesPercent = parseFloat(processedData.payrollTaxesPercent) || 0;

        await onSave(processedData);
        setIsSaving(false);
    };

    const focusNextField = (currentIndex: number) => {
        const fieldIds = [
            'labor-modal-classification',
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
                <div className="relative w-[75%] h-[96vh] bg-white rounded-3xl shadow-2xl overflow-hidden animate-modal flex flex-col" >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
                        <h2 className="text-lg font-bold text-gray-900">
                            {isEditing ? 'Edit Labor' : 'Add New Labor'}
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-4 pb-4 flex-1 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                                    Labor
                                </label>
                                <div
                                    id="labor-modal-classification"
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
                                        focusNextField(0);
                                    }}
                                    onAdd={async (val) => {
                                        setFormData({ ...formData, classification: val });
                                        setActiveField(null);
                                        focusNextField(0);
                                    }}
                                    placeholder="Select or add labor..."
                                    width="w-full"
                                    anchorId="labor-modal-classification"
                                    positionMode="overlay"
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
                                    className="w-full p-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-gray-50/50 hover:bg-white"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            focusNextField(1);
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
                                            focusNextField(2);
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


        </>
    );
}
