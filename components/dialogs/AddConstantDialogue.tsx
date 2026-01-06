'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button } from '@/components/ui';
import { Upload, X, ChevronRight } from 'lucide-react';

interface AddConstantDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
    title?: string;
    typeOptions?: string[];
}

export function AddConstantDialogue({
    isOpen,
    onClose,
    onSave,
    initialData,
    title = 'Add Constant',
    typeOptions = ['services', 'fringe', 'status', 'certified payroll']
}: AddConstantDialogueProps) {
    const [formData, setFormData] = useState<any>({
        type: 'services',
        description: '',
        value: '',
        color: '#0F4C75'
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({ ...initialData });
            } else {
                setFormData({
                    type: 'services',
                    description: '',
                    value: '',
                    color: '#0F4C75'
                });
            }
        }
    }, [isOpen, initialData]);

    const handleSave = async () => {
        if (!formData.description) return;
        setIsSaving(true);
        try {
            // Ensure value defaults to description if empty
            const dataToSave = {
                ...formData,
                value: formData.value || formData.description
            };
            await onSave(dataToSave);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving || !formData.description}>
                        {isSaving ? 'Saving...' : 'Save Constant'}
                    </Button>
                </>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Description</label>
                        <input
                            autoFocus
                            type="text"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Enter service name..."
                            className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Type</label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all appearance-none"
                        >
                            {typeOptions.map(t => (
                                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Color</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={formData.color || '#0F4C75'}
                                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer p-0.5 bg-white"
                            />
                            <input
                                type="text"
                                value={formData.color || ''}
                                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                placeholder="#000000"
                                className="flex-1 h-12 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Value (Optional)</label>
                    <input
                        type="text"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        placeholder="Default is description"
                        className="w-full h-12 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Icon / Image</label>
                    <div className="flex items-center gap-4 p-4 rounded-3xl bg-slate-50 border border-dashed border-slate-200">
                        {formData.image ? (
                            <div className="relative w-16 h-16 group">
                                <img src={formData.image} alt="Preview" className="w-full h-full object-cover rounded-2xl border border-white shadow-sm" />
                                <button
                                    onClick={() => setFormData({ ...formData, image: '' })}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-300">
                                <Upload className="w-6 h-6" />
                            </div>
                        )}
                        <div className="flex-1">
                            <input
                                type="file"
                                accept="image/*"
                                id="constant-icon-upload"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            setFormData({ ...formData, image: reader.result });
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                            <label
                                htmlFor="constant-icon-upload"
                                className="inline-flex items-center px-4 py-2 bg-white border border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer shadow-sm transition-all"
                            >
                                <Upload className="w-3.5 h-3.5 mr-2" />
                                Upload
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
