import React, { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
import { Modal, Button } from '@/components/ui';
import { Search, X, Loader2, Edit3, Check } from 'lucide-react';
import { AddToolsCatalogueDialogue } from '@/app/(protected)/catalogue/components/AddToolsCatalogueDialogue';
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

interface AddToolsEstimateDialogueProps {
    isOpen: boolean;
    onClose: () => void;
    section: SectionConfig;
    existingItems: CatalogItem[];
    catalog: CatalogItem[];
    onSave: (section: SectionConfig, data: Record<string, unknown>, isManual: boolean) => Promise<void>;
    onCatalogUpdate?: () => void;
}

// Column configuration for Tools
const TOOLS_COLUMNS = [
    { key: 'tool', label: 'Tool', type: 'text', editable: true },
    { key: 'classification', label: 'Classification', type: 'text', editable: true },
    { key: 'subClassification', label: 'Sub Classification', type: 'text', editable: true },
    { key: 'supplier', label: 'Supplier', type: 'text', editable: true },
    { key: 'uom', label: 'UOM', type: 'text', editable: true },
    { key: 'cost', label: 'Cost', type: 'number', editable: true, prefix: '$' },
    { key: 'taxes', label: 'Taxes %', type: 'number', editable: true, suffix: '%' },
];

interface ToolRowProps {
    item: CatalogItem;
    isAdded: boolean;
    isSelected: boolean;
    onToggle: (item: CatalogItem) => void;
    onInlineEdit: (item: CatalogItem, field: string, value: unknown) => void;
    editingCell: { itemId: string; field: string } | null;
    setEditingCell: (cell: { itemId: string; field: string } | null) => void;
    savingCell: { itemId: string; field: string } | null;
    columns: typeof TOOLS_COLUMNS;
    quickEditId: string | null;
    onQuickEditToggle: (itemId: string | null) => void;
}

const ToolRow = memo(({ 
    item, 
    isAdded, 
    isSelected, 
    onToggle, 
    onInlineEdit,
    editingCell,
    setEditingCell,
    savingCell,
    columns,
    quickEditId,
    onQuickEditToggle
}: ToolRowProps) => {
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

    const formatValue = (col: typeof TOOLS_COLUMNS[0], value: unknown): string => {
        if (value === null || value === undefined || value === '') return '-';
        if (col.type === 'number') {
            const num = Number(value);
            if (col.prefix === '$') return `$${num.toLocaleString()}`;
            if (col.suffix === '%') return `${num}%`;
            return num.toLocaleString();
        }
        return String(value);
    };

    return (
        <tr
            className={`cursor-pointer transition-colors group ${isAdded ? 'bg-gray-100 opacity-60 cursor-not-allowed' : isQuickEditing ? 'bg-amber-50' : isSelected ? 'bg-indigo-100' : 'hover:bg-gray-50'}`}
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
            {columns.map((col) => {
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
                                    <span className="truncate">{formatValue(col, value)}</span>
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

ToolRow.displayName = 'ToolRow';

export function AddToolsEstimateDialogue({
    isOpen,
    onClose,
    section,
    existingItems,
    catalog,
    onSave,
    onCatalogUpdate
}: AddToolsEstimateDialogueProps) {
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
        return `tool|${normalize(item.tool)}|${normalize(item.classification)}`;
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
        let list = [...(catalog || []), ...localNewItems].map(item => getDisplayItem(item));

        if (searchStr) {
            list = list.filter(item => {
                const name = String(item.tool || '').toLowerCase();
                const classification = String(item.classification || '').toLowerCase();
                const supplier = String(item.supplier || '').toLowerCase();
                return name.includes(searchStr) || classification.includes(searchStr) || supplier.includes(searchStr);
            });
        }

        const uniqueContent = new Set<string>();
        const filtered = list.filter(item => {
            const key = getIdentifier(item);
            if (uniqueContent.has(key)) return false;
            uniqueContent.add(key);
            return true;
        });

        return filtered.slice(0, 100);
    }, [catalog, searchTerm, getIdentifier, localNewItems, getDisplayItem]);

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
                    payload: { type: 'tools', item: data }
                })
            });
            const result = await res.json();

            if (result.success) {
                const newItem = {
                    ...data,
                    _id: result.result?._id || `temp-${Date.now()}`
                };
                setLocalNewItems(prev => [...prev, newItem]);
                setSelectedItems(prev => {
                    const newSet = new Set(prev);
                    newSet.add(newItem);
                    return newSet;
                });
                success('Added to catalogue');
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
                    payload: { type: 'tools', id: item._id, item: updatedData }
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
                title="Add Tools"
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
                            placeholder="Search tools catalog..."
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
                                    {TOOLS_COLUMNS.map(col => (
                                        <th key={col.key} className="p-2 whitespace-nowrap">{col.label}</th>
                                    ))}
                                    <th className="p-2 w-16"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredCatalog.length > 0 ? (
                                    filteredCatalog.map((item) => {
                                        const identifier = getIdentifier(item);
                                        return (
                                            <ToolRow 
                                                key={item._id || identifier}
                                                item={item}
                                                isAdded={existingIdentifiers.has(identifier)}
                                                isSelected={selectedItems.has(item)}
                                                onToggle={toggleSelection}
                                                onInlineEdit={handleInlineEdit}
                                                editingCell={editingCell}
                                                setEditingCell={setEditingCell}
                                                savingCell={savingCell}
                                                columns={TOOLS_COLUMNS}
                                                quickEditId={quickEditId}
                                                onQuickEditToggle={setQuickEditId}
                                            />
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={TOOLS_COLUMNS.length + 2} className="p-8 text-center text-gray-400 italic">
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
                <AddToolsCatalogueDialogue
                    isOpen={isAddNewCatalogue}
                    onClose={() => setIsAddNewCatalogue(false)}
                    onSave={handleCatalogueSave}
                    existingItems={catalog}
                />
            )}
        </>
    );
}
