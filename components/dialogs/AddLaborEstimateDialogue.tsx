import React, { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
import { Modal, Button } from '@/components/ui';
import { Search, X, Loader2, Edit3, Check } from 'lucide-react';
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
    onCatalogUpdate?: () => void;
}

// Column configuration for Labor
const LABOR_COLUMNS = [
    { key: 'classification', label: 'Classification', type: 'text', editable: true },
    { key: 'subClassification', label: 'Sub Classification', type: 'text', editable: true },
    { key: 'fringe', label: 'Fringe', type: 'text', editable: true },
    { key: 'basePay', label: 'Base Pay', type: 'number', editable: true, prefix: '$' },
    { key: 'wCompPercent', label: 'W Comp %', type: 'number', editable: true, suffix: '%' },
    { key: 'payrollTaxesPercent', label: 'Payroll Tax %', type: 'number', editable: true, suffix: '%' },
];

interface LaborRowProps {
    item: CatalogItem;
    isAdded: boolean;
    isSelected: boolean;
    isSuggested: boolean;
    onToggle: (item: CatalogItem) => void;
    onInlineEdit: (item: CatalogItem, field: string, value: unknown) => void;
    editingCell: { itemId: string; field: string } | null;
    setEditingCell: (cell: { itemId: string; field: string } | null) => void;
    savingCell: { itemId: string; field: string } | null;
    columns: typeof LABOR_COLUMNS;
    quickEditId: string | null;
    onQuickEditToggle: (itemId: string | null) => void;
}

const LaborRow = memo(({ 
    item, 
    isAdded, 
    isSelected, 
    isSuggested,
    onToggle, 
    onInlineEdit,
    editingCell,
    setEditingCell,
    savingCell,
    columns,
    quickEditId,
    onQuickEditToggle
}: LaborRowProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [editValue, setEditValue] = useState<string>('');
    const itemId = item._id || '';
    const isQuickEditing = quickEditId === itemId;

    useEffect(() => {
        if (editingCell?.itemId === itemId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingCell, itemId]);

    const handleCellClick = (e: React.MouseEvent, field: string, currentValue: unknown) => {
        e.stopPropagation();
        if (isAdded || !isQuickEditing) return;
        const col = columns.find(c => c.key === field);
        if (!col?.editable) return;
        setEditValue(String(currentValue || ''));
        setEditingCell({ itemId, field });
    };

    const handleSave = (field: string) => {
        const col = columns.find(c => c.key === field);
        let value: unknown = editValue;
        if (col?.type === 'number') {
            value = parseFloat(editValue) || 0;
        }
        onInlineEdit(item, field, value);
    };

    const handleKeyDown = (e: React.KeyboardEvent, field: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave(field);
        } else if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };

    const formatValue = (col: typeof LABOR_COLUMNS[0], value: unknown): string => {
        if (value === null || value === undefined || value === '') return '-';
        if (col.type === 'number') {
            const num = Number(value);
            if (col.prefix === '$') return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            if (col.suffix === '%') return `${num}%`;
            return num.toLocaleString();
        }
        return String(value);
    };

    return (
        <tr
            className={`cursor-pointer transition-colors group ${isAdded ? 'bg-gray-100 opacity-60 cursor-not-allowed' : isQuickEditing ? 'bg-amber-50' : isSelected ? 'bg-indigo-100' : isSuggested ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            onClick={() => !isAdded && !isQuickEditing && onToggle(item)}
        >
            <td className="p-2">
                <input 
                    type="checkbox" 
                    checked={isSelected || isAdded} 
                    readOnly
                    className="rounded border-gray-300 pointer-events-none" 
                />
            </td>
            {columns.map((col, cIdx) => {
                const isEditing = editingCell?.itemId === itemId && editingCell?.field === col.key;
                const isSaving = savingCell?.itemId === itemId && savingCell?.field === col.key;
                const value = item[col.key];

                return (
                    <td 
                        key={col.key} 
                        className={`p-1 text-gray-700 ${isQuickEditing && col.editable && !isAdded ? 'hover:bg-amber-100 cursor-text' : ''}`}
                        onClick={(e) => isQuickEditing && col.editable && handleCellClick(e, col.key, value)}
                    >
                        {isEditing ? (
                            <div className="flex items-center gap-1">
                                <input
                                    ref={inputRef}
                                    type={col.type === 'number' ? 'number' : 'text'}
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, col.key)}
                                    onBlur={() => handleSave(col.key)}
                                    className="w-full px-1.5 py-0.5 text-[10px] border border-amber-400 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 min-h-[24px] px-1">
                                {isSaving ? (
                                    <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                                ) : (
                                    <>
                                        <span className="truncate">{formatValue(col, value)}</span>
                                        {isSuggested && cIdx === 0 && (
                                            <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[8px] font-medium bg-blue-100 text-blue-700 border border-blue-200">
                                                Suggested
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </td>
                );
            })}
            <td className="p-1 text-right">
                {isQuickEditing ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); onQuickEditToggle(null); }}
                        className="px-2 py-1 bg-green-500 text-white rounded text-[9px] font-bold hover:bg-green-600 shadow-sm transition-all flex items-center gap-1"
                    >
                        <Check className="w-3 h-3" /> Done
                    </button>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); onQuickEditToggle(itemId); }}
                        className="px-2 py-1 bg-amber-50 text-amber-600 rounded text-[9px] font-bold hover:bg-amber-100 shadow-sm transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1"
                    >
                        <Edit3 className="w-3 h-3" /> Quick
                    </button>
                )}
            </td>
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
    fringeConstants = [],
    onCatalogUpdate
}: AddLaborEstimateDialogueProps) {
    const [selectedItems, setSelectedItems] = useState<Set<CatalogItem>>(new Set());
    const [inputValue, setInputValue] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);
    const [isAddNewCatalogue, setIsAddNewCatalogue] = useState(false);
    const [localNewItems, setLocalNewItems] = useState<CatalogItem[]>([]);
    const [localUpdatedItems, setLocalUpdatedItems] = useState<Record<string, CatalogItem>>({});
    const [editingCell, setEditingCell] = useState<{ itemId: string; field: string } | null>(null);
    const [savingCell, setSavingCell] = useState<{ itemId: string; field: string } | null>(null);
    const [quickEditId, setQuickEditId] = useState<string | null>(null);
    const { success, error: toastError } = useToast();

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
            setLocalUpdatedItems({});
            setEditingCell(null);
            setQuickEditId(null);
        }
    }, [isOpen]);

    const getIdentifier = useCallback((item: CatalogItem): string => {
        const normalize = (val: unknown) => String(val || '').toLowerCase().trim();
        const basePay = typeof item.basePay === 'number' ? item.basePay : parseFloat(String(item.basePay || 0).replace(/[^0-9.-]+/g, ""));
        return `labor|${normalize(item.classification)}|${normalize(item.subClassification)}|${normalize(item.fringe)}|${basePay}`;
    }, []);

    const existingIdentifiers = useMemo(() => new Set(existingItems.map(getIdentifier)), [existingItems, getIdentifier]);

    const getDisplayItem = useCallback((item: CatalogItem): CatalogItem => {
        if (item._id && localUpdatedItems[item._id]) {
            return { ...item, ...localUpdatedItems[item._id] };
        }
        return item;
    }, [localUpdatedItems]);

    const filteredCatalog = useMemo(() => {
        const searchStr = searchTerm.toLowerCase().trim();
        let list = (catalog || []).concat(localNewItems).map(item => getDisplayItem(item));
        
        if (searchStr) {
            list = list.filter(item => {
                const classification = String(item.classification || '').toLowerCase();
                const subClassification = String(item.subClassification || '').toLowerCase();
                const itemFringe = String(item.fringe || '').toLowerCase();
                return classification.includes(searchStr) || subClassification.includes(searchStr) || itemFringe.includes(searchStr);
            });
        }

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

        return filtered.slice(0, 100);
    }, [catalog, searchTerm, fringe, getIdentifier, localNewItems, getDisplayItem]);

    const toggleSelection = useCallback((item: CatalogItem) => {
        if (editingCell || quickEditId) return;
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(item)) newSet.delete(item);
            else newSet.add(item);
            return newSet;
        });
    }, [editingCell, quickEditId]);

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
                const newItem = { ...data, _id: result.result?._id || `temp_${Date.now()}` };
                setLocalNewItems(prev => [newItem, ...prev]);
                
                setSelectedItems(prev => {
                    const newSet = new Set(prev);
                    newSet.add(newItem);
                    return newSet;
                });

                setIsAddNewCatalogue(false);
                onCatalogUpdate?.();
            } else {
                toastError('Failed to add to catalogue');
            }
        } catch (e) {
            toastError('Error saving to catalogue');
        }
    };

    const handleInlineEdit = async (item: CatalogItem, field: string, value: unknown) => {
        if (!item._id) return;
        
        const currentValue = item[field];
        if (currentValue === value) {
            setEditingCell(null);
            return;
        }

        setSavingCell({ itemId: item._id, field });
        setEditingCell(null);
        
        try {
            const updatedData = { ...item, [field]: value };
            delete updatedData._id;
            
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateCatalogueItem',
                    payload: { type: 'labor', id: item._id, item: updatedData }
                })
            });
            const result = await res.json();

            if (result.success) {
                setLocalUpdatedItems(prev => ({
                    ...prev,
                    [item._id as string]: { ...prev[item._id as string], [field]: value }
                }));
                success('Updated');
                onCatalogUpdate?.();
            } else {
                toastError('Failed to update');
            }
        } catch (e) {
            toastError('Error updating');
        } finally {
            setSavingCell(null);
        }
    };

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
                    <div className="text-[9px] text-gray-400 italic">Click row to select. Hover and click "Quick" to edit catalogue values.</div>
                    <div className="max-h-[50vh] overflow-auto border border-gray-100 rounded-xl scrollbar-thin">
                        <table className="w-full text-[10px] text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-2 w-10"><input type="checkbox" className="rounded border-gray-300" disabled /></th>
                                    {LABOR_COLUMNS.map(col => (
                                        <th key={col.key} className="p-2 whitespace-nowrap">{col.label}</th>
                                    ))}
                                    <th className="p-2 w-16"></th>
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
                                                onInlineEdit={handleInlineEdit}
                                                editingCell={editingCell}
                                                setEditingCell={setEditingCell}
                                                savingCell={savingCell}
                                                columns={LABOR_COLUMNS}
                                                quickEditId={quickEditId}
                                                onQuickEditToggle={setQuickEditId}
                                            />
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={LABOR_COLUMNS.length + 2} className="p-8 text-center text-gray-400 italic">
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
