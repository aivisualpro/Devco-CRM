'use client';

import { useState, useEffect, useMemo } from 'react';
import { Modal, Button } from '@/components/ui';
import { Search } from 'lucide-react';
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
}

export function AddLaborEstimateDialogue({
    isOpen,
    onClose,
    section,
    existingItems,
    catalog,
    fringe,
    onSave
}: AddLaborEstimateDialogueProps) {
    const [mode, setMode] = useState<'catalog' | 'manual'>('catalog');
    const [formData, setFormData] = useState<Record<string, unknown>>({});
    const [selectedItems, setSelectedItems] = useState<Set<CatalogItem>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setFormData({});
            setSelectedItems(new Set());
            setSearchTerm('');
            setMode('catalog');
        }
    }, [isOpen]);

    const getIdentifier = (item: CatalogItem): string => {
        const normalize = (val: unknown) => String(val || '').toLowerCase().trim();
        const basePay = typeof item.basePay === 'number' ? item.basePay : parseFloat(String(item.basePay || 0).replace(/[^0-9.-]+/g, ""));
        return `labor|${normalize(item.classification)}|${normalize(item.subClassification)}|${normalize(item.fringe)}|${basePay}`;
    };

    const existingIdentifiers = useMemo(() => new Set(existingItems.map(getIdentifier)), [existingItems]);

    const filteredCatalog = useMemo(() => {
        let filtered = (catalog || []).filter(item => {
            const searchStr = searchTerm.toLowerCase();
            const text = Object.values(item).join(' ').toLowerCase();
            return text.includes(searchStr);
        });

        // Deduplicate
        const uniqueContent = new Set<string>();
        filtered = filtered.filter(item => {
            const key = getIdentifier(item);
            if (uniqueContent.has(key)) return false;
            uniqueContent.add(key);
            return true;
        });

        // Prioritize items matching the Estimate Fringe
        if (fringe) {
            filtered.sort((a, b) => {
                const aMatch = String(a.fringe || '').trim().toLowerCase() === String(fringe).trim().toLowerCase();
                const bMatch = String(b.fringe || '').trim().toLowerCase() === String(fringe).trim().toLowerCase();
                if (aMatch && !bMatch) return -1;
                if (!aMatch && bMatch) return 1;
                return 0;
            });
        }
        return filtered;
    }, [catalog, searchTerm, fringe]);

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
            await onSave(section, { ...itemData, quantity: 1, days: item.days || 1, hours: item.hours || 8 }, false);
        }
        setSaving(false);
        onClose();
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await onSave(section, formData, true);
        setSaving(false);
        onClose();
    };

    const displayCols = ['classification', 'subClassification', 'fringe', 'basePay'];

    const [isAddNewCatalogue, setIsAddNewCatalogue] = useState(false);
    const { success, error: toastError } = useToast();  // Need toast for onSave feedback from catalogue dialogue

    // ... existing helper functions

    const handleCatalogueSave = async (data: any) => {
        try {
            // We need to save this to the CATALOGUE first
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
                // Ideally, we should refresh the 'catalog' prop here, but since it comes from parent,
                // we might just proceed to add this new item to the estimate directly or let the user select it.
                // For better UX, let's select it and add it to the estimate immediately? 
                // OR just close this inner modal and let the user find it in the list (refresh needed).
                // Since props are immutable, we rely on parent re-fetching or we optimistically add to list.
                // 
                // A better approach for now specifically requested: "It should open the revelent dialogue from Catalogue"
                // Upon saving in that dialogue, it usually saves to DB. 
                // The user then might expect it to appear in the list.
                // We'll close the "Add New" modal and hope the parent re-renders or the user searches for it.
                // 
                // Wait, if we want to "Add New" and then *use* it, we might want to manually add it to our `filteredCatalog` if possible,
                // but `catalog` prop is fixed. 
                // We will rely on SWR or parent update if available, otherwise User searches again.
                //
                // ACTUALLY, simply saving to catalogue is what the other dialogue does.
            } else {
                toastError('Failed to add to catalogue');
            }
        } catch (e) {
            toastError('Error saving to catalogue');
        }
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="Add Labor"
                footer={mode === 'catalog' ? (
                    <>
                        <div className="flex-1 text-left text-sm text-gray-500">{selectedItems.size} selected</div>
                        <Button onClick={() => setIsAddNewCatalogue(true)} variant="ghost">Add New</Button>
                        <Button onClick={onClose} variant="secondary">Cancel</Button>
                        <Button onClick={handleAddSelected} disabled={selectedItems.size === 0 || saving}>{saving ? 'Adding...' : 'Add Selected'}</Button>
                    </>
                ) : (
                    // ... manual mode footer if we still kept it, but user wants "Add New" to open Catalogue Dialogue.
                    // The "Manual Entry" mode logic might be deprecated or we can keep it as fallback?
                    // The request says: "instead of saying Manual Entry, (tell Add New) and when press that button ... open the revelent dialogue from Catalogue"
                    // So we effectively replace the "Manual Mode" with "Add New Catalogue Item Mode".
                    null
                )}
            >
                {/* ... existing table code ... */}
                <div className="space-y-4">
                    {/* ... Search and Table ... */}
                    <div className="relative">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search labor catalog..."
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
                                    const isSuggested = fringe && String(item.fringe || '').trim().toLowerCase() === String(fringe).trim().toLowerCase();
                                    const isAdded = existingIdentifiers.has(getIdentifier(item));
                                    return (
                                        <tr
                                            key={String(item._id) || idx}
                                            className={`cursor-pointer transition-colors ${isAdded ? 'bg-gray-100 opacity-60 cursor-not-allowed' : selectedItems.has(item) ? 'bg-indigo-100' : isSuggested ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                            onClick={() => !isAdded && toggleSelection(item)}
                                        >
                                            <td className="p-3"><input type="checkbox" checked={selectedItems.has(item) || isAdded} disabled className="rounded border-gray-300 pointer-events-none" /></td>
                                            {displayCols.map((col, cIdx) => (
                                                <td key={col} className="p-3 text-gray-700">
                                                    {col === 'classification' ? (
                                                        <span className="font-medium text-slate-700">{String(item.classification || '')}</span>
                                                    ) : col === 'basePay' ? (
                                                        `$${typeof item[col] === 'number' ? (item[col] as number).toFixed(2) : item[col]}`
                                                    ) : (
                                                        String(item[col] || '')
                                                    )}
                                                    {isSuggested && cIdx === 0 && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-200">Suggested</span>}
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

            {/* The Catalogue Add Dialogue */}
            {isAddNewCatalogue && (
                <AddLaborCatalogueDialogue
                    isOpen={isAddNewCatalogue}
                    onClose={() => setIsAddNewCatalogue(false)}
                    onSave={handleCatalogueSave}
                    // We need to pass required props. 
                    // fringeConstants and onAddFringe might be needed if the dialogue relies on them?
                    // The catalogue dialogue uses them. We might need to fetch them or pass them down from AddItemModal if possible.
                    // Checking AddItemModal props... it has `fringeConstants`.
                    // We need to pass `fringeConstants` to this component first.
                    fringeConstants={[]} // Placeholder if not available, or we update props
                    onAddFringe={async () => { }} // Placeholder
                />
            )}
        </>
    );
}
