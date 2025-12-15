'use client';

import { useState, useEffect, useMemo } from 'react';
import { Modal, Button } from '@/components/ui';
import { Search } from 'lucide-react';
import { AddToolsCatalogueDialogue } from '@/app/(protected)/catalogue/components/AddToolsCatalogueDialogue';

interface SectionConfig {
    id: string;
    title: string;
    key: string;
    fields: string[];
    headers: string[];
    formFields?: string[];
    formHeaders?: string[];
    editableFields: string[];
    color: string;
    items: Array<Record<string, unknown>>;
    [key: string]: unknown;
}

interface CatalogItem {
    _id?: string;
    [key: string]: unknown;
}

interface AddToolsEstimateDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    section: SectionConfig;
    existingItems: CatalogItem[];
    catalog: CatalogItem[];
    onSave: (section: SectionConfig, data: Record<string, unknown>, isManual: boolean) => Promise<void>;
}

export function AddToolsEstimateDialogue({
    isOpen,
    onClose,
    section,
    existingItems,
    catalog,
    onSave
}: AddToolsEstimateDialogueProps) {
    const [mode, setMode] = useState<'catalog' | 'manual'>('catalog');
    const [selectedItems, setSelectedItems] = useState<Set<CatalogItem>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedItems(new Set());
            setSearchTerm('');
            setMode('catalog');
        }
    }, [isOpen]);

    const getIdentifier = (item: CatalogItem): string => {
        const normalize = (val: unknown) => String(val || '').toLowerCase().trim();
        return `tool|${normalize(item.tool)}|${normalize(item.classification)}`;
    };

    const existingIdentifiers = useMemo(() => new Set(existingItems.map(getIdentifier)), [existingItems]);

    const filteredCatalog = useMemo(() => {
        let filtered = (catalog || []).filter(item => {
            const searchStr = searchTerm.toLowerCase();
            const text = Object.values(item).join(' ').toLowerCase();
            return text.includes(searchStr);
        });

        const uniqueContent = new Set<string>();
        filtered = filtered.filter(item => {
            const key = getIdentifier(item);
            if (uniqueContent.has(key)) return false;
            uniqueContent.add(key);
            return true;
        });

        return filtered;
    }, [catalog, searchTerm]);

    const toggleSelection = (item: CatalogItem) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(item)) newSet.delete(item);
        else newSet.add(item);
        setSelectedItems(newSet);
    };

    const handleAddSelected = async () => {
        if (selectedItems.size === 0) return;
        setSaving(true);
        for (const item of Array.from(selectedItems)) {
            if (existingIdentifiers.has(getIdentifier(item))) continue;
            const { _id, ...itemData } = item;
            await onSave(section, { ...itemData, quantity: 1 }, false);
        }
        setSaving(false);
        onClose();
    };

    const handleManualSave = async (data: any) => {
        await onSave(section, data, true);
        setMode('catalog');
    };

    const displayCols = ['tool', 'classification', 'subClassification', 'uom', 'supplier', 'cost'];

    // Show catalogue dialogue in manual mode
    if (mode === 'manual') {
        return (
            <AddToolsCatalogueDialogue
                isOpen={isOpen}
                onClose={() => {
                    setMode('catalog');
                }}
                onSave={handleManualSave}
                existingItems={catalog}
            />
        );
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Add Tools"
            footer={(
                <>
                    <div className="flex-1 text-left text-sm text-gray-500">{selectedItems.size} selected</div>
                    <Button onClick={() => setMode('manual')} variant="ghost">Manual Entry</Button>
                    <Button onClick={onClose} variant="secondary">Cancel</Button>
                    <Button onClick={handleAddSelected} disabled={selectedItems.size === 0 || saving}>{saving ? 'Adding...' : 'Add Selected'}</Button>
                </>
            )}
        >
            <div className="space-y-4">
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search tools catalog..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
                <div className="max-h-[50vh] overflow-y-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10">
                            <tr>
                                <th className="p-3 w-10"><input type="checkbox" className="rounded border-gray-300" disabled /></th>
                                {displayCols.map(col => <th key={col} className="p-3 capitalize">{col.replace(/([A-Z])/g, ' $1').trim()}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredCatalog.map((item, idx) => {
                                const isAdded = existingIdentifiers.has(getIdentifier(item));
                                return (
                                    <tr
                                        key={String(item._id) || idx}
                                        className={`cursor-pointer transition-colors ${isAdded ? 'bg-gray-100 opacity-60 cursor-not-allowed' : selectedItems.has(item) ? 'bg-indigo-100' : 'hover:bg-gray-50'}`}
                                        onClick={() => !isAdded && toggleSelection(item)}
                                    >
                                        <td className="p-3"><input type="checkbox" checked={selectedItems.has(item) || isAdded} disabled className="rounded border-gray-300 pointer-events-none" /></td>
                                        {displayCols.map((col) => (
                                            <td key={col} className="p-3 text-gray-700">
                                                {['cost'].includes(col) ? `$${Number(item[col] || 0).toLocaleString()}` : String(item[col] || '')}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </Modal>
    );
}
