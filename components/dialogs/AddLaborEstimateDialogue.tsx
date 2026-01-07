import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { Modal, Button } from '@/components/ui';
import { Search, X } from 'lucide-react';
import { AddLaborCatalogueDialogue } from '@/app/(protected)/catalogue/components/AddLaborCatalogueDialogue';
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

interface AddLaborEstimateDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    section: SectionConfig;
    existingItems: CatalogItem[];
    catalog: CatalogItem[];
    fringe?: string;
    onSave: (section: SectionConfig, data: Record<string, unknown>, isManual: boolean) => Promise<void>;
    fringeConstants?: Array<{ description: string; value: unknown }>;
}

const LaborRow = memo(({ 
    item, 
    isAdded, 
    isSelected, 
    isSuggested, 
    onToggle, 
    displayCols 
}: { 
    item: CatalogItem; 
    isAdded: boolean; 
    isSelected: boolean; 
    isSuggested: boolean;
    onToggle: (item: CatalogItem) => void;
    displayCols: string[];
}) => {
    return (
        <tr
            className={`cursor-pointer transition-colors ${isAdded ? 'bg-gray-100 opacity-60 cursor-not-allowed' : isSelected ? 'bg-indigo-100' : isSuggested ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            onClick={() => !isAdded && onToggle(item)}
        >
            <td className="p-3">
                <input 
                    type="checkbox" 
                    checked={isSelected || isAdded} 
                    readOnly
                    className="rounded border-gray-300 pointer-events-none" 
                />
            </td>
            {displayCols.map((col, cIdx) => (
                <td key={col} className="p-3 text-gray-700">
                    {col === 'classification' ? (
                        <span className="font-medium text-slate-700">{String(item.classification || '')}</span>
                    ) : col === 'basePay' ? (
                        `$${typeof item[col] === 'number' ? (item[col] as number).toFixed(2) : item[col]}`
                    ) : (
                        String(item[col] || '')
                    )}
                    {isSuggested && cIdx === 0 && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-200">
                            Suggested
                        </span>
                    )}
                </td>
            ))}
        </tr>
    );
});

LaborRow.displayName = 'LaborRow';

export function AddLaborEstimateDialogue({
    isOpen,
    onClose,
    section,
    existingItems,
    catalog,
    fringe,
    onSave,
    fringeConstants = []
}: AddLaborEstimateDialogueProps) {
    const [selectedItems, setSelectedItems] = useState<Set<CatalogItem>>(new Set());
    const [inputValue, setInputValue] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);
    const [isAddNewCatalogue, setIsAddNewCatalogue] = useState(false);
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
        }
    }, [isOpen]);

    const getIdentifier = useCallback((item: CatalogItem): string => {
        const normalize = (val: unknown) => String(val || '').toLowerCase().trim();
        const basePay = typeof item.basePay === 'number' ? item.basePay : parseFloat(String(item.basePay || 0).replace(/[^0-9.-]+/g, ""));
        return `labor|${normalize(item.classification)}|${normalize(item.subClassification)}|${normalize(item.fringe)}|${basePay}`;
    }, []);

    const existingIdentifiers = useMemo(() => new Set(existingItems.map(getIdentifier)), [existingItems, getIdentifier]);

    const filteredCatalog = useMemo(() => {
        const searchStr = searchTerm.toLowerCase().trim();
        let list = (catalog || []);
        
        if (searchStr) {
            list = list.filter(item => {
                const classification = String(item.classification || '').toLowerCase();
                const subClassification = String(item.subClassification || '').toLowerCase();
                const itemFringe = String(item.fringe || '').toLowerCase();
                return classification.includes(searchStr) || subClassification.includes(searchStr) || itemFringe.includes(searchStr);
            });
        }

        // Deduplicate and prioritize in one pass for performance
        const uniqueContent = new Set<string>();
        const filtered = list.filter(item => {
            const key = getIdentifier(item);
            if (uniqueContent.has(key)) return false;
            uniqueContent.add(key);
            return true;
        });

        if (fringe) {
            const normalizedFringe = String(fringe).trim().toLowerCase();
            filtered.sort((a, b) => {
                const aMatch = String(a.fringe || '').trim().toLowerCase() === normalizedFringe;
                const bMatch = String(b.fringe || '').trim().toLowerCase() === normalizedFringe;
                if (aMatch && !bMatch) return -1;
                if (!aMatch && bMatch) return 1;
                return 0;
            });
        }

        return filtered.slice(0, 80); // Slightly smaller batch for better rendering
    }, [catalog, searchTerm, fringe, getIdentifier]);

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
                await onSave(section, { ...itemData, quantity: 1, days: item.days || 1, hours: item.hours || 8, otPd: item.otPd || 2 }, false);
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
                    payload: { type: 'labor', item: data }
                })
            });
            const result = await res.json();

            if (result.success) {
                success('Added to catalogue');
                setIsAddNewCatalogue(false);
            } else {
                toastError('Failed to add to catalogue');
            }
        } catch (e) {
            toastError('Error saving to catalogue');
        }
    };

    const displayCols = useMemo(() => ['classification', 'subClassification', 'fringe', 'basePay'], []);

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Add Labor"
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
                            placeholder="Search labor catalog..."
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
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 w-10"><input type="checkbox" className="rounded border-gray-300" disabled /></th>
                                    {displayCols.map(col => <th key={col} className="p-3 capitalize">{col.replace(/([A-Z])/g, ' $1').trim()}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredCatalog.length > 0 ? (
                                    filteredCatalog.map((item) => {
                                        const isSuggested = fringe && String(item.fringe || '').trim().toLowerCase() === String(fringe).trim().toLowerCase();
                                        const identifier = getIdentifier(item);
                                        return (
                                            <LaborRow 
                                                key={item._id || identifier}
                                                item={item}
                                                isAdded={existingIdentifiers.has(identifier)}
                                                isSelected={selectedItems.has(item)}
                                                isSuggested={!!isSuggested}
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
                <AddLaborCatalogueDialogue
                    isOpen={isAddNewCatalogue}
                    onClose={() => setIsAddNewCatalogue(false)}
                    onSave={handleCatalogueSave}
                    fringeConstants={fringeConstants}
                    existingItems={catalog}
                    onAddFringe={async (name, val) => {
                        // Not fully supported in this view yet
                    }}
                />
            )}
        </>
    );
}
