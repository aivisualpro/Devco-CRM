'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
    const containerRef = useRef<HTMLDivElement>(null);

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
        <div ref={containerRef} className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                            {isEditing ? 'Edit Equipment' : 'Add New Equipment'}
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">Manage equipment details and costs.</p>
                    </div>
                    <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="col-span-1 md:col-span-2">
                            <Input
                                label="Equipment / Machine"
                                value={formData.equipmentMachine || ''}
                                onChange={(e) => setFormData({ ...formData, equipmentMachine: e.target.value })}
                                placeholder="e.g. Excavator 305"
                                autoFocus={!isEditing}
                                id="field-equipment"
                                className="w-full"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        focusNextField(0);
                                    }
                                }}
                            />
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Classification</label>
                            <Select
                                value={formData.classification || '-'}
                                onValueChange={(val) => {
                                    setFormData({ ...formData, classification: val });
                                    focusNextField(1);
                                }}
                            >
                                <SelectTrigger id="field-classification" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 hover:bg-white transition-colors focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-auto">
                                    <SelectValue placeholder="Select classification..." />
                                </SelectTrigger>
                                <SelectContent className="z-[10001]">
                                    {getOptions('classification').map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Sub Classification</label>
                            <Select
                                value={formData.subClassification || '-'}
                                onValueChange={(val) => {
                                    setFormData({ ...formData, subClassification: val });
                                    focusNextField(2);
                                }}
                            >
                                <SelectTrigger id="field-subClassification" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 hover:bg-white transition-colors focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-auto">
                                    <SelectValue placeholder="Select sub-class..." />
                                </SelectTrigger>
                                <SelectContent className="z-[10001]">
                                    {getOptions('subClassification').map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier</label>
                            <Select
                                value={formData.supplier || '-'}
                                onValueChange={(val) => {
                                    setFormData({ ...formData, supplier: val });
                                    focusNextField(3);
                                }}
                            >
                                <SelectTrigger id="field-supplier" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 hover:bg-white transition-colors focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-auto">
                                    <SelectValue placeholder="Select supplier..." />
                                </SelectTrigger>
                                <SelectContent className="z-[10001]">
                                    {getOptions('supplier').map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">UOM</label>
                            <Select
                                value={formData.uom || '-'}
                                onValueChange={(val) => {
                                    setFormData({ ...formData, uom: val });
                                    focusNextField(4);
                                }}
                            >
                                <SelectTrigger id="field-uom" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 hover:bg-white transition-colors focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 h-auto">
                                    <SelectValue placeholder="Select UOM..." />
                                </SelectTrigger>
                                <SelectContent className="z-[10001]">
                                    {getOptions('uom').map(opt => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="col-span-1">
                            <Input
                                label="Daily Cost"
                                type="number"
                                value={formData.dailyCost || ''}
                                onChange={(e) => setFormData({ ...formData, dailyCost: e.target.value })}
                                id="field-dailyCost"
                                placeholder="0.00"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        focusNextField(4);
                                    }
                                }}
                            />
                        </div>

                        <div className="col-span-1">
                            <Input
                                label="Weekly Cost"
                                type="number"
                                value={formData.weeklyCost || ''}
                                onChange={(e) => setFormData({ ...formData, weeklyCost: e.target.value })}
                                id="field-weeklyCost"
                                placeholder="0.00"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        focusNextField(5);
                                    }
                                }}
                            />
                        </div>

                        <div className="col-span-1">
                            <Input
                                label="Monthly Cost"
                                type="number"
                                value={formData.monthlyCost || ''}
                                onChange={(e) => setFormData({ ...formData, monthlyCost: e.target.value })}
                                id="field-monthlyCost"
                                placeholder="0.00"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        focusNextField(6);
                                    }
                                }}
                            />
                        </div>

                        <div className="col-span-1">
                            <Input
                                label="Tax (%)"
                                type="number"
                                value={formData.tax || ''}
                                onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                                id="field-tax"
                                placeholder="0"
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
                        disabled={isSaving}
                        className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-sans ${
                            isSaving 
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
    );
}
