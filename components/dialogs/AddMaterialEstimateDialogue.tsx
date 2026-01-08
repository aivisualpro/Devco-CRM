import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { Modal, Button } from '@/components/ui';
import { Search, X } from 'lucide-react';
import { AddMaterialCatalogueDialogue } from '@/app/(protected)/catalogue/components/AddMaterialCatalogueDialogue';
import { useToast } from '@/hooks/useToast';

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

interface AddMaterialEstimateDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    section: SectionConfig;
    existingItems: CatalogItem[];
    catalog: CatalogItem[];
    onSave: (section: SectionConfig, data: Record<string, unknown>, isManual: boolean) => Promise<void>;
}

const MaterialRow = memo(({ 
    item, 
    isAdded, 
    isSelected, 
    onToggle, 
    displayCols 
}: { 
    item: CatalogItem; 
    isAdded: boolean; 
    isSelected: boolean; 
    onToggle: (item: CatalogItem) => void;
    displayCols: string[];
}) => {
    return (
        <tr
            className={`cursor-pointer transition-colors ${isAdded ? 'bg-gray-100 opacity-60 cursor-not-allowed' : isSelected ? 'bg-indigo-100' : 'hover:bg-gray-50'}`}
            onClick={() => !isAdded && onToggle(item)}
        >
            <td className="p-2">
                <input 
                    type="checkbox" 
                    checked={isSelected || isAdded} 
                    readOnly
                    className="rounded border-gray-300 pointer-events-none" 
                />
            </td>
            {displayCols.map((col) => (
                <td key={col} className="p-2 text-gray-700">
                    {['cost'].includes(col) ? `$${Number(item[col] || 0).toLocaleString()}` : String(item[col] || '')}
                </td>
            ))}
        </tr>
    );
});

MaterialRow.displayName = 'MaterialRow';

export function AddMaterialEstimateDialogue({
    isOpen,
    onClose,
    section,
    existingItems,
    catalog,
    onSave
}: AddMaterialEstimateDialogueProps) {
    const [selectedItems, setSelectedItems] = useState<Set<CatalogItem>>(new Set());
    const [inputValue, setInputValue] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);
    const [isAddNewCatalogue, setIsAddNewCatalogue] = useState(false);
    const [localNewItems, setLocalNewItems] = useState<CatalogItem[]>([]);
    const { success, error: toastError } = useToast();

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchTerm(inputValue);
        }, 300);
        return () => clearTimeout(timer);
    }, [inputValue]);

    useEffect(() => {
        if (isOpen) {
            setSelectedItems(new Set());
            setInputValue('');
            setSearchTerm('');
            setLocalNewItems([]);
        }
    }, [isOpen]);

    const getIdentifier = useCallback((item: CatalogItem): string => {
        const normalize = (val: unknown) => String(val || '').toLowerCase().trim();
        return `mat|${normalize(item.material)}|${normalize(item.classification)}`;
    }, []);

    const existingIdentifiers = useMemo(() => new Set(existingItems.map(getIdentifier)), [existingItems, getIdentifier]);

    const filteredCatalog = useMemo(() => {
        const searchStr = searchTerm.toLowerCase().trim();
        let list = [...(catalog || []), ...localNewItems];
        
        if (searchStr) {
            list = list.filter(item => {
                const material = String(item.material || '').toLowerCase();
                const classification = String(item.classification || '').toLowerCase();
                const supplier = String(item.supplier || '').toLowerCase();
                return material.includes(searchStr) || classification.includes(searchStr) || supplier.includes(searchStr);
            });
        }

        const uniqueContent = new Set<string>();
        const filtered = list.filter(item => {
            const key = getIdentifier(item);
            if (uniqueContent.has(key)) return false;
            uniqueContent.add(key);
            return true;
        });

        return filtered.slice(0, 80);
    }, [catalog, searchTerm, getIdentifier, localNewItems]);

    const toggleSelection = useCallback((item: CatalogItem) => {
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(item)) newSet.delete(item);
            else newSet.add(item);
            return newSet;
        });
    }, []);

    const handleAddSelected = async () => {
        if (selectedItems.size === 0) return;
        setSaving(true);
        try {
            for (const item of Array.from(selectedItems)) {
                if (existingIdentifiers.has(getIdentifier(item))) continue;
                const { _id, ...itemData } = item;
                await onSave(section, { ...itemData, quantity: 1 }, false);
            }
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const handleCatalogueSave = async (data: any) => {
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'addCatalogueItem',
                    payload: { type: 'material', item: data }
                })
            });
            const result = await res.json();

            if (result.success) {
                const newItem = {
                    ...data,
                    _id: result.data?._id || `temp-${Date.now()}`
                };
                setLocalNewItems(prev => [...prev, newItem]);
                setSelectedItems(prev => {
                    const newSet = new Set(prev);
                    newSet.add(newItem);
                    return newSet;
                });
                success('Added to catalogue');
                setIsAddNewCatalogue(false);
            } else {
                toastError('Failed to add to catalogue');
            }
        } catch (e) {
            toastError('Error saving to catalogue');
        }
    };

    const displayCols = useMemo(() => ['material', 'classification', 'subClassification', 'supplier', 'uom', 'cost'], []);

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Add Material"
                footer={(
                    <>
                        <div className="flex-1 text-left text-sm text-gray-500">{selectedItems.size} selected</div>
                        <Button onClick={() => setIsAddNewCatalogue(true)} variant="ghost">Add New</Button>
                        <Button onClick={onClose} variant="secondary">Cancel</Button>
                        <Button onClick={handleAddSelected} disabled={selectedItems.size === 0 || saving}>{saving ? 'Adding...' : 'Add Selected'}</Button>
                    </>
                )}
            >
                <div className="space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            autoFocus
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            placeholder="Search material catalog..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        {inputValue && (
                            <button 
                                onClick={() => setInputValue('')}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <div className="max-h-[50vh] overflow-y-auto border border-gray-100 rounded-xl scrollbar-thin overflow-x-hidden">
                        <table className="w-full text-[10px] text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-2 w-10"><input type="checkbox" className="rounded border-gray-300" disabled /></th>
                                    {displayCols.map(col => <th key={col} className="p-2 capitalize">{col.replace(/([A-Z])/g, ' $1').trim()}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredCatalog.length > 0 ? (
                                    filteredCatalog.map((item) => {
                                        const identifier = getIdentifier(item);
                                        return (
                                            <MaterialRow 
                                                key={item._id || identifier}
                                                item={item}
                                                isAdded={existingIdentifiers.has(identifier)}
                                                isSelected={selectedItems.has(item)}
                                                onToggle={toggleSelection}
                                                displayCols={displayCols}
                                            />
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={displayCols.length + 1} className="p-8 text-center text-gray-400 italic">
                                            {inputValue ? 'No results found' : 'Start typing to search...'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>

            {isAddNewCatalogue && (
                <AddMaterialCatalogueDialogue
                    isOpen={isAddNewCatalogue}
                    onClose={() => setIsAddNewCatalogue(false)}
                    onSave={handleCatalogueSave}
                    existingItems={catalog}
                />
            )}
        </>
    );
}
