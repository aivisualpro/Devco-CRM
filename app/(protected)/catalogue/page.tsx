'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Plus, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Header, Button, AddButton, Card, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, BadgeTabs, Pagination, EmptyState, Loading, Modal, ConfirmModal, SkeletonTable } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useAddShortcut } from '@/hooks/useAddShortcut';

// Category configurations
const categoryConfig: Record<string, { headers: string[]; fields: string[] }> = {
    equipment: {
        headers: ['S.NO', 'Equipment/Machine', 'Classification', 'Sub Classification', 'Supplier', 'UOM', 'Daily Cost', 'Weekly Cost', 'Monthly Cost', 'Tax'],
        fields: ['sno', 'equipmentMachine', 'classification', 'subClassification', 'supplier', 'uom', 'dailyCost', 'weeklyCost', 'monthlyCost', 'tax']
    },
    labor: {
        headers: ['S.NO', 'Labor', 'Classification', 'Sub Classification', 'Fringe', 'Base Pay', 'W Comp %', 'Payroll Tax %'],
        fields: ['sno', 'labor', 'classification', 'subClassification', 'fringe', 'basePay', 'wCompPercent', 'payrollTaxesPercent']
    },
    material: {
        headers: ['S.NO', 'Material', 'Classification', 'Sub Classification', 'Supplier', 'UOM', 'Cost', 'Taxes %'],
        fields: ['sno', 'material', 'classification', 'subClassification', 'supplier', 'uom', 'cost', 'taxes']
    },
    overhead: {
        headers: ['S.NO', 'Overhead', 'Classification', 'Sub Classification', 'Hourly Rate', 'Daily Rate'],
        fields: ['sno', 'overhead', 'classification', 'subClassification', 'hourlyRate', 'dailyRate']
    },
    subcontractor: {
        headers: ['S.NO', 'Subcontractor', 'Classification', 'Sub Classification', 'UOM', 'Cost'],
        fields: ['sno', 'subcontractor', 'classification', 'subClassification', 'uom', 'cost']
    },
    disposal: {
        headers: ['S.NO', 'Disposal & Haul Off', 'Classification', 'Sub Classification', 'UOM', 'Cost'],
        fields: ['sno', 'disposalAndHaulOff', 'classification', 'subClassification', 'uom', 'cost']
    },
    miscellaneous: {
        headers: ['S.NO', 'Item', 'Classification', 'UOM', 'Cost', 'Quantity'],
        fields: ['sno', 'item', 'classification', 'uom', 'cost', 'quantity']
    },
    tools: {
        headers: ['S.NO', 'Tool', 'Classification', 'Sub Classification', 'Supplier', 'UOM', 'Cost', 'Taxes %'],
        fields: ['sno', 'tool', 'classification', 'subClassification', 'supplier', 'uom', 'cost', 'taxes']
    }
};

const categories = ['labor', 'equipment', 'material', 'tools', 'overhead', 'subcontractor', 'disposal', 'miscellaneous'];

interface CatalogItem {
    _id: string;
    [key: string]: unknown;
}

import { AddEquipmentCatalogueDialogue } from './components/AddEquipmentCatalogueDialogue';
import { AddLaborCatalogueDialogue } from './components/AddLaborCatalogueDialogue';
import { AddMaterialCatalogueDialogue } from './components/AddMaterialCatalogueDialogue';
import { AddToolsCatalogueDialogue } from './components/AddToolsCatalogueDialogue';
import { AddOverheadCatalogueDialogue } from './components/AddOverheadCatalogueDialogue';
import { AddSubcontractorCatalogueDialogue } from './components/AddSubcontractorCatalogueDialogue';
import { AddDisposalCatalogueDialogue } from './components/AddDisposalCatalogueDialogue';
import { AddMiscellaneousCatalogueDialogue } from './components/AddMiscellaneousCatalogueDialogue';

// ... existing imports

export default function CataloguePage() {
    const router = useRouter();
    const pathname = usePathname();
    const { toasts, success, error: toastError, removeToast } = useToast();

    const [activeCategory, setActiveCategory] = useState('labor');
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [allCounts, setAllCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Modal states
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<CatalogItem | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Generic form data for fallback generic modal
    const [formData, setFormData] = useState<Record<string, unknown>>({});
    const [isGenericModalOpen, setIsGenericModalOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Fringe Constants
    const [fringeConstants, setFringeConstants] = useState<CatalogItem[]>([]);

    // Init active category from Hash & Listen for changes
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '').toLowerCase();
            if (hash && categories.includes(hash)) {
                setActiveCategory(hash);
            }
        };

        // Initial check
        handleHashChange();

        // Listen for hash changes (browser back/forward)
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Fetch items on category change
    useEffect(() => {
        fetchItems();
        fetchAllCounts();
        if (activeCategory === 'labor') {
            loadFringeConstants();
        }
        setSortConfig(null); // Reset sort on category change
    }, [activeCategory]);

    const loadFringeConstants = async () => {
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getCatalogueItems', payload: { type: 'constant' } })
            });
            const data = await res.json();
            if (data.success && data.result) {
                setFringeConstants(data.result.filter((c: any) => c.type === 'Fringe'));
            }
        } catch (err) {
            console.error('Error loading fringes:', err);
        }
    };

    const handleAddFringe = async (name: string, value: number) => {
        try {
            // Format value as string currency if needed by backend, or number
            // Backend model for Constant usually expects 'value' as string based on backup
            // Backup logic: value: formattedValue (e.g. "$12.50")
            const formattedValue = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
            }).format(value);

            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'addCatalogueItem',
                    payload: {
                        type: 'constant',
                        item: {
                            description: name,
                            type: 'Fringe',
                            value: formattedValue
                        }
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                await loadFringeConstants();
                success('New fringe constant saved');
            } else {
                toastError('Failed to save fringe');
            }
        } catch (e) {
            console.error(e);
            toastError('Error saving fringe');
        }
    };

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getCatalogueItems', payload: { type: activeCategory } })
            });
            const data = await res.json();
            if (data.success) {
                setItems(data.result || []);
            }
        } catch (err) {
            console.error('Error fetching items:', err);
        }
        setLoading(false);
    };

    const fetchAllCounts = async () => {
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getCatalogueCounts' })
            });
            const data = await res.json();

            if (data.success && data.result) {
                const counts: Record<string, number> = {};
                categories.forEach(cat => {
                    const resultKey = cat === 'constant' ? 'constant' : cat;
                    const value = data.result[resultKey];
                    if (typeof value === 'number') {
                        counts[cat] = value;
                    } else if (Array.isArray(value)) {
                        counts[cat] = value.length;
                    } else {
                        counts[cat] = 0;
                    }
                });
                setAllCounts(counts);
            }
        } catch (err) {
            console.error('Error fetching counts:', err);
        }
    };

    const handleCategoryChange = (cat: string) => {
        setActiveCategory(cat);
        setCurrentPage(1);
        setSearch('');
        router.push(`/catalogue#${cat}`);
    };

    // Filter and paginate
    const filteredItems = useMemo(() => {
        if (!search) return items;
        const s = search.toLowerCase();
        return items.filter((item) =>
            Object.values(item).some((v) => String(v).toLowerCase().includes(s))
        );
    }, [items, search]);

    const sortedItems = useMemo(() => {
        const moveableItems = [...filteredItems];
        if (sortConfig !== null) {
            moveableItems.sort((a, b) => {
                const key = sortConfig.key;
                let aValue = (a as any)[key];
                let bValue = (b as any)[key];

                // Special handling for S.NO (treat as createdAt or _id sort)
                if (key === 'sno') {
                    // Fallback to _id if createdAt not available
                    aValue = (a as any).createdAt || (a as any)._id;
                    bValue = (b as any).createdAt || (b as any)._id;
                }

                // Handle numbers disguised as strings or undefined
                if (typeof aValue === 'string' && !isNaN(Number(aValue)) && key !== 'sno' && key !== '_id') {
                    aValue = Number(aValue);
                    bValue = Number(bValue);
                }

                if (!aValue) aValue = '';
                if (!bValue) bValue = '';

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return moveableItems;
    }, [filteredItems, sortConfig]);

    const totalPages = Math.ceil(sortedItems.length / itemsPerPage);
    const paginatedItems = sortedItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const formatValue = (val: unknown, field: string) => {
        if (val === undefined || val === null) return '-';
        if (typeof val === 'number') {
            if (field.includes('Cost') || field.includes('Pay') || field.includes('Rate') || field === 'cost' || field === 'dailyCost' || field === 'weeklyCost' || field === 'monthlyCost') {
                return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
            if (field.includes('Percent') || field === 'taxes') {
                return `${val}%`;
            }
            return val.toLocaleString();
        }
        return String(val);
    };

    // CRUD handlers
    const openAddModal = () => {
        setEditItem(null);
        setFormData({});
        setIsAddModalOpen(true);
    };

    useAddShortcut(openAddModal);

    const openEditModal = (item: CatalogItem) => {
        setEditItem(item);
        setFormData({ ...item });
        setIsAddModalOpen(true);
    };

    const handleSave = async (dataToSave?: any) => {
        // Use passed data (from specific dialogs) or fallback to formData state (generic modal)
        const finalData = dataToSave || formData;

        try {
            const action = editItem ? 'updateCatalogueItem' : 'addCatalogueItem';
            const payload = editItem
                ? { type: activeCategory, id: editItem._id, item: finalData }
                : { type: activeCategory, item: finalData };

            // Note: Checked API route previously, it accepts `payload.data` for `addCatalogueItem`.
            // For `updateCatalogueItem`, it accepts `payload.data` as well.
            // Wait, previous `catalogue/page.tsx` used `payload: { type: ..., item: formData }`.
            // I should verify `route.ts`...
            // Step 279 view of route.ts showed: const { type, data } = payload;
            // So it SHOULD be `data`. The previous implementation might have been using `item` incorrectly OR the API handles both?
            // Let's stick to `data` as per my backup reading.

            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload })
            });
            const data = await res.json();

            if (data.success) {
                success(editItem ? 'Item updated' : 'Item added');
                fetchItems();
                fetchAllCounts();
                setIsAddModalOpen(false);
                setIsGenericModalOpen(false);
            } else {
                toastError('Failed to save item: ' + (data.error || 'Unknown error'));
            }
        } catch (err) {
            console.error(err);
            toastError('Failed to save item');
        }
    };

    // Wrapper for Generic Modal Save
    const handleGenericSave = () => handleSave(formData);

    const confirmDelete = (id: string) => {
        setDeleteId(id);
        setIsConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deleteCatalogueItem', payload: { type: activeCategory, id: deleteId } })
            });
            const data = await res.json();
            if (data.success) {
                success('Item deleted');
                fetchItems();
                fetchAllCounts();
            } else {
                toastError('Failed to delete');
            }
        } catch (err) {
            toastError('Failed to delete');
        }
        setIsConfirmOpen(false);
        setDeleteId(null);
    };

    const config = categoryConfig[activeCategory];

    return (
        <>
            <Header
                rightContent={
                    <div className="flex items-center gap-3">
                        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search for ..." className="w-64" />
                        <AddButton
                            onClick={openAddModal}
                            label={`Add ${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}`}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        />
                    </div>
                }
            />
            <div className="p-4">

                {/* Tabs */}
                <div className="flex justify-center mb-4">
                    <BadgeTabs
                        tabs={categories.map((c) => ({ id: c, label: c.charAt(0).toUpperCase() + c.slice(1), count: allCounts[c] || 0 }))}
                        activeTab={activeCategory}
                        onChange={handleCategoryChange}
                    />
                </div>

                {/* Table */}
                <div>
                    {loading ? (
                        <SkeletonTable rows={10} columns={9} />
                    ) : (
                        <Table>
                            <TableHead>
                                <TableRow>
                                    {config.headers.map((h, index) => {
                                        const fieldKey = config.fields[index];
                                        const isSorted = sortConfig?.key === fieldKey;
                                        const isSortable = fieldKey !== 'sno'; // Disable sort for S.NO

                                        return (
                                            <TableHeader
                                                key={h}
                                                onClick={() => isSortable && handleSort(fieldKey)}
                                                className={`whitespace-nowrap group ${isSortable ? 'cursor-pointer' : ''}`}
                                            >
                                                <div className="flex items-center gap-1">
                                                    {h}
                                                    {isSortable && (
                                                        <span className="text-gray-400">
                                                            {isSorted ? (
                                                                sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                                                            ) : (
                                                                <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                                                            )}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableHeader>
                                        );
                                    })}
                                    <TableHeader className="text-right">Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedItems.length === 0 ? (
                                    <TableRow>
                                        <TableCell className="text-center py-8 text-gray-500" colSpan={config.headers.length + 1}>
                                            <div className="flex flex-col items-center justify-center">
                                                <p className="text-base font-medium text-gray-900">No items found</p>
                                                <p className="text-sm text-gray-500 mt-1">Get started by adding a new {activeCategory} item.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedItems.map((item, rowIndex) => (
                                        <TableRow key={item._id}>
                                            {config.fields.map((f) => (
                                                <TableCell key={f} className={f === 'sno' ? "text-gray-400 font-medium w-16" : ""}>
                                                    {f === 'sno'
                                                        ? (currentPage - 1) * itemsPerPage + rowIndex + 1
                                                        : f === 'labor' && activeCategory === 'labor'
                                                            ? `${item.classification || ''}${item.classification && item.fringe ? '-' : ''}${item.fringe || ''}`
                                                            : formatValue(item[f], f)
                                                    }
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => openEditModal(item)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200 transition-all">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => confirmDelete(item._id)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200 transition-all">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                    <Pagination currentPage={currentPage} totalPages={totalPages || 1} onPageChange={setCurrentPage} />
                </div>

                {/* Modals */}
                {isAddModalOpen && activeCategory === 'equipment' && (
                    <AddEquipmentCatalogueDialogue
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                        onSave={handleSave}
                        initialData={editItem}
                        isEditing={!!editItem}
                        existingItems={items}
                    />
                )}

                {isAddModalOpen && activeCategory === 'labor' && (
                    <AddLaborCatalogueDialogue
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                        onSave={handleSave}
                        initialData={editItem}
                        isEditing={!!editItem}
                        existingItems={items}
                        fringeConstants={fringeConstants}
                        onAddFringe={handleAddFringe}
                    />
                )}

                {isAddModalOpen && activeCategory === 'material' && (
                    <AddMaterialCatalogueDialogue
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                        onSave={handleSave}
                        initialData={editItem}
                        isEditing={!!editItem}
                        existingItems={items}
                    />
                )}

                {isAddModalOpen && activeCategory === 'tools' && (
                    <AddToolsCatalogueDialogue
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                        onSave={handleSave}
                        initialData={editItem}
                        isEditing={!!editItem}
                        existingItems={items}
                    />
                )}

                {isAddModalOpen && activeCategory === 'overhead' && (
                    <AddOverheadCatalogueDialogue
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                        onSave={handleSave}
                        initialData={editItem}
                        isEditing={!!editItem}
                        existingItems={items}
                    />
                )}

                {isAddModalOpen && activeCategory === 'subcontractor' && (
                    <AddSubcontractorCatalogueDialogue
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                        onSave={handleSave}
                        initialData={editItem}
                        isEditing={!!editItem}
                        existingItems={items}
                    />
                )}

                {isAddModalOpen && activeCategory === 'disposal' && (
                    <AddDisposalCatalogueDialogue
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                        onSave={handleSave}
                        initialData={editItem}
                        isEditing={!!editItem}
                        existingItems={items}
                    />
                )}

                {isAddModalOpen && activeCategory === 'miscellaneous' && (
                    <AddMiscellaneousCatalogueDialogue
                        isOpen={isAddModalOpen}
                        onClose={() => setIsAddModalOpen(false)}
                        onSave={handleSave}
                        initialData={editItem}
                        isEditing={!!editItem}
                        existingItems={items}
                    />
                )}

                {/* Generic Fallback Modal for other categories */}
                <Modal isOpen={isGenericModalOpen} onClose={() => setIsGenericModalOpen(false)} title={editItem ? 'Edit Item' : 'Add New Item'} footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsGenericModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleGenericSave}>Save</Button>
                    </>
                }>
                    <div className="grid grid-cols-2 gap-4">
                        {config.fields.map((f) => {
                            if (f === 'sno') return null;
                            return (
                                <div key={f}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</label>
                                    <input
                                        type={['dailyCost', 'weeklyCost', 'monthlyCost', 'basePay', 'cost', 'hourlyRate', 'dailyRate', 'wCompPercent', 'payrollTaxesPercent', 'taxes', 'quantity'].includes(f) ? 'number' : 'text'}
                                        value={String(formData[f] || '')}
                                        onChange={(e) => setFormData({ ...formData, [f]: e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            );
                        })}
                    </div>
                </Modal>

                {/* Confirm Delete Modal */}
                <ConfirmModal
                    isOpen={isConfirmOpen}
                    onClose={() => setIsConfirmOpen(false)}
                    onConfirm={handleDelete}
                    title="Delete Item"
                    message="Are you sure you want to delete this item? This action cannot be undone."
                    confirmText="Delete"
                />
            </div>
        </>
    );
}
