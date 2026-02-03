'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/Input';

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
    const containerRef = useRef<HTMLDivElement>(null);

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
                // 1. Check if there's anything with a higher z-index (e.g. nested Selects or ConfirmModals)
                const allFixed = Array.from(document.querySelectorAll('.fixed'));
                const hasHigherZ = allFixed.some(el => {
                    if (el === containerRef.current) return false;
                    const style = window.getComputedStyle(el);
                    const z = parseInt(style.zIndex) || 0;
                    return z > 10000 && style.display !== 'none' && style.visibility !== 'hidden';
                });
                if (hasHigherZ) return;

                // 2. Check if this is the topmost among same-level modals
                const modals = Array.from(document.querySelectorAll('.z-\\[10000\\]'));
                if (modals.length > 0 && modals[modals.length - 1] === containerRef.current) {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

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
            <div ref={containerRef} className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
                <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                                {isEditing ? 'Edit Labor Item' : 'Add New Labor Item'}
                            </h2>
                            <p className="text-sm text-gray-500 mt-0.5">Define labor rates and tax information.</p>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Classification (Full Width) */}
                            <div className="md:col-span-2">
                                <Input
                                    label="Labor Classification"
                                    value={formData.classification === '-' ? '' : formData.classification || ''}
                                    onChange={(e) => setFormData({ ...formData, classification: e.target.value })}
                                    placeholder="e.g. Journeyman Electrician"
                                    autoFocus
                                    id="labor-modal-classification"
                                    className="w-full"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            focusNextField(0);
                                        }
                                    }}
                                />
                            </div>

                            {/* Base Pay */}
                            <div className="col-span-1">
                                <Input
                                    label="Base Pay ($/hr)"
                                    type="number"
                                    value={formData.basePay || ''}
                                    onChange={(e) => setFormData({ ...formData, basePay: e.target.value })}
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    id="field-basePay"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            focusNextField(1);
                                        }
                                    }}
                                />
                            </div>

                            {/* Empty spacer or additional field if needed */}
                            <div className="hidden md:block col-span-1"></div>

                            {/* Workers Comp */}
                            <div className="col-span-1">
                                <Input
                                    label="Workers Comp (%)"
                                    type="number"
                                    value={formData.wCompPercent || ''}
                                    onChange={(e) => setFormData({ ...formData, wCompPercent: e.target.value })}
                                    placeholder="0"
                                    min="0"
                                    step="0.1"
                                    id="field-wComp"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            focusNextField(2);
                                        }
                                    }}
                                />
                            </div>

                            {/* Payroll Taxes */}
                            <div className="col-span-1">
                                <Input
                                    label="Payroll Taxes (%)"
                                    type="number"
                                    value={formData.payrollTaxesPercent || ''}
                                    onChange={(e) => setFormData({ ...formData, payrollTaxesPercent: e.target.value })}
                                    placeholder="0"
                                    min="0"
                                    step="0.1"
                                    id="field-payrollTax"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSave();
                                    }}
                                />
                            </div>

                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all font-sans"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !formData.classification}
                            className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-sans ${
                                isSaving || !formData.classification 
                                ? 'bg-gray-300 cursor-not-allowed' 
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                            }`}
                        >
                            {isSaving ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"/>
                                    Saving...
                                </span>
                            ) : (
                                isEditing ? 'Update Item' : 'Add Item'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
