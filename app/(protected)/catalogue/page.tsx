'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Plus, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Search, Package, Briefcase, Layers, Settings, Wrench, Truck, DollarSign, User, ShieldCheck, Mail, Phone, MapPin, MessageSquare } from 'lucide-react';
import { Header, Button, AddButton, Card, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, BadgeTabs, Pagination, EmptyState, Loading, Modal, ConfirmModal, SkeletonTable, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { useAddShortcut } from '@/hooks/useAddShortcut';
import { useRef, useCallback } from 'react';

// Category configurations
const categoryConfig: Record<string, { headers: string[]; fields: string[] }> = {
    equipment: {
        headers: ['S.NO', 'Equipment/Machine', 'Classification', 'Sub Classification', 'Supplier', 'UOM', 'Daily Cost', 'Weekly Cost', 'Monthly Cost', 'Tax'],
        fields: ['sno', 'equipmentMachine', 'classification', 'subClassification', 'supplier', 'uom', 'dailyCost', 'weeklyCost', 'monthlyCost', 'tax']
    },
    labor: {
        headers: ['S.NO', 'Labor', 'Base Pay', 'W Comp %', 'Payroll Tax %'],
        fields: ['sno', 'classification', 'basePay', 'wCompPercent', 'payrollTaxesPercent']
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

function CatalogueContent() {
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

    // Mobile specific
    const [mobileItems, setMobileItems] = useState<CatalogItem[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const observerTarget = useRef<HTMLDivElement>(null);
    const [actionSheetItem, setActionSheetItem] = useState<CatalogItem | null>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const isLongPressActive = useRef(false);

    const handleTouchStart = (item: CatalogItem) => {
        isLongPressActive.current = false;
        longPressTimer.current = setTimeout(() => {
            isLongPressActive.current = true;
            setActionSheetItem(item);
            if (window.navigator?.vibrate) window.navigator.vibrate(50);
        }, 600);
    };

    const handleTouchEnd = (item: CatalogItem) => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    const handleTouchMove = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    // Fringe Constants
    // const [fringeConstants, setFringeConstants] = useState<CatalogItem[]>([]); // Removed

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
            // loadFringeConstants(); // Removed
        }
        setSortConfig(null); // Reset sort on category change
        setCurrentPage(1);
    }, [activeCategory]);



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

    // Reset mobile items when sorted items or category changes
    useEffect(() => {
        setMobileItems(sortedItems.slice(0, 20));
        setHasMore(sortedItems.length > 20);
    }, [sortedItems, activeCategory]);

    const getColumnWidthStyle = (field: string, category: string) => {
        if (category === 'labor') {
            if (field === 'sno') return { width: '5%' };
            if (field === 'classification') return { width: '70%' };
            if (field === 'basePay') return { width: '5%' };
            if (field === 'wCompPercent') return { width: '5%' };
            if (field === 'payrollTaxesPercent') return { width: '5%' };
        }
        return {};
    };

    const loadMoreMobile = useCallback(() => {
        if (!hasMore) return;
        setMobileItems(prev => {
            const nextBatch = sortedItems.slice(prev.length, prev.length + 20);
            if (nextBatch.length === 0) setHasMore(false);
            return [...prev, ...nextBatch];
        });
    }, [hasMore, sortedItems]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMoreMobile();
                }
            },
            { threshold: 1.0 }
        );

        const currentTarget = observerTarget.current;
        if (currentTarget) observer.observe(currentTarget);
        return () => {
            if (currentTarget) observer.unobserve(currentTarget);
        };
    }, [loadMoreMobile, hasMore]);



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
        <div className="flex flex-col h-full">
            <div className="flex-none">
            <Header
                hideLogo={false}
                rightContent={
                    <div className="flex items-center gap-2 md:gap-3 flex-1 justify-end md:flex-initial">
                        <SearchInput
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={`Search ${activeCategory}...`}
                        />

                        <div className="hidden md:block">
                            <AddButton
                                onClick={openAddModal}
                                label={`New ${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}`}
                            />
                        </div>
                    </div>
                }
            />
            </div>
            <div className="flex-1 flex flex-col min-h-0 pt-4 px-4">

                {/* Tabs - Scrollable on mobile */}
                <div className="flex justify-start md:justify-center mb-4 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
                    <BadgeTabs
                        tabs={categories.map((c) => ({ id: c, label: c.charAt(0).toUpperCase() + c.slice(1), count: allCounts[c] || 0 }))}
                        activeTab={activeCategory}
                        onChange={handleCategoryChange}
                        className="shrink-0"
                    />
                </div>

                {/* Main Content Container */}
                <div className="flex-1 min-h-0 pb-4">
                    {loading ? (
                        <>
                            <div className="md:hidden grid grid-cols-2 gap-2">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="h-40 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                                ))}
                            </div>
                            <div className="hidden md:block">
                                <SkeletonTable rows={10} columns={config.headers.length + 1} className="h-full" />
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Mobile Card View */}
                            <div className="md:hidden grid grid-cols-2 gap-2">
                                {mobileItems.length === 0 ? (
                                    <div className="col-span-2 text-center py-12 bg-white rounded-3xl border border-dashed border-slate-200">
                                        <p className="text-slate-500 font-medium">No {activeCategory} found</p>
                                    </div>
                                ) : (
                                    mobileItems.map((item, index) => {
                                        if (activeCategory === 'labor') {
                                            return (
                                                <div
                                                    key={item._id}
                                                    className="bg-white rounded-2xl p-3 shadow-sm border border-slate-50 active:scale-[0.98] transition-all flex flex-col min-h-[110px] touch-pan-y select-none"
                                                    style={{ WebkitTouchCallout: 'none' }}
                                                    onTouchStart={() => handleTouchStart(item)}
                                                    onTouchEnd={() => handleTouchEnd(item)}
                                                    onTouchMove={handleTouchMove}
                                                >
                                                    <div className="flex-1 flex flex-col gap-1">
                                                        <h3 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-tight line-clamp-1 leading-tight">
                                                            {String(item.classification || '-')}
                                                        </h3>
                                                        <p className="text-[10px] text-slate-500 font-semibold line-clamp-1">
                                                            {String(item.subClassification || '-')}
                                                        </p>
                                                    </div>
                                                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                                                        <span className="text-[11px] font-extrabold text-[#0F4C75] shrink-0">
                                                            {formatValue(item.basePay, 'cost')}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        const mainTitle = (item.equipmentMachine || item.material || item.tool || item.overhead || item.subcontractor || item.disposalAndHaulOff || item.item) as string;
                                        const cost = formatValue(item.cost || item.dailyCost || item.basePay || item.hourlyRate || item.rate, 'cost');
                                        const subTitle = [item.classification, item.subClassification].filter(Boolean).join(' • ');

                                        return (
                                            <div
                                                key={item._id}
                                                className="bg-white rounded-2xl p-3 shadow-sm border border-slate-50 active:scale-[0.98] transition-all flex flex-col min-h-[110px] touch-pan-y select-none"
                                                style={{ WebkitTouchCallout: 'none' }}
                                                onTouchStart={() => handleTouchStart(item)}
                                                onTouchEnd={() => handleTouchEnd(item)}
                                                onTouchMove={handleTouchMove}
                                            >
                                                <div className="mb-1.5 flex-1">
                                                    <h3 className="font-extrabold text-slate-800 text-[11px] line-clamp-2 leading-tight uppercase tracking-tight">
                                                        {mainTitle || 'Untitled'}
                                                    </h3>
                                                    {subTitle && (
                                                        <p className="text-[10px] text-slate-400 mt-1 font-medium italic">{subTitle}</p>
                                                    )}
                                                </div>

                                                <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-extrabold text-[#0F4C75]">{cost}</span>
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase">
                                                            {String(item.uom || 'Unit')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={observerTarget} className="h-4 col-span-2" />
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden md:block">
                                <Table
                                    containerClassName="h-full"
                                    footer={
                                        <Pagination currentPage={currentPage} totalPages={totalPages || 1} onPageChange={setCurrentPage} />
                                    }
                                >
                                    <TableHead>
                                        <TableRow>
                                            {config.headers.map((h, index) => {
                                                const fieldKey = config.fields[index];
                                                const isSortable = fieldKey !== 'sno';
                                                const isSorted = sortConfig?.key === fieldKey;
                                                
                                                const widthStyle = getColumnWidthStyle(fieldKey, activeCategory);

                                                return (
                                                    <TableHeader 
                                                        key={h}
                                                        onClick={() => isSortable && handleSort(fieldKey)}
                                                        className={`whitespace-nowrap group ${isSortable ? 'cursor-pointer' : ''}`}
                                                        style={widthStyle}
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
                                            <TableHeader className={activeCategory === 'labor' ? "text-center" : "text-right"} style={activeCategory === 'labor' ? { width: '10%' } : {}}>Actions</TableHeader>
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
                                                    {config.fields.map((f) => {
                                                        const widthStyle = getColumnWidthStyle(f, activeCategory);
                                                        return (
                                                            <TableCell key={f} className={f === 'sno' ? "text-gray-400 font-medium w-16" : ""} style={widthStyle}>
                                                                {f === 'sno'
                                                                    ? (currentPage - 1) * itemsPerPage + rowIndex + 1
                                                                    : formatValue(item[f], f)
                                                                }
                                                            </TableCell>
                                                        );
                                                    })}
                                                    <TableCell className={activeCategory === 'labor' ? "text-center" : "text-right"} style={activeCategory === 'labor' ? { width: '10%' } : {}}>
                                                        <div className={`flex items-center gap-2 ${activeCategory === 'labor' ? 'justify-center' : 'justify-end'}`}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button onClick={() => openEditModal(item)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200 transition-all">
                                                                        <Pencil className="w-4 h-4" />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>Edit Item</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button onClick={() => confirmDelete(item._id)} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-transparent hover:border-gray-200 transition-all">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>Delete Item</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                <button
                    onClick={openAddModal}
                    className="md:hidden fixed bottom-24 right-6 w-14 h-14 bg-[#0F4C75] text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform z-30 border-4 border-white"
                >
                    <Plus size={24} />
                </button>

                {/* Mobile Action Sheet */}
                {actionSheetItem && (
                    <div
                        className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-20 md:pb-4 transition-all animate-in fade-in duration-200"
                        onClick={() => setActionSheetItem(null)}
                    >
                        <div
                            className="w-full max-w-lg bg-white rounded-[32px] p-4 pb-6 shadow-2xl animate-in slide-in-from-bottom-10 duration-300 select-none"
                            style={{ WebkitTouchCallout: 'none' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />

                            <div className="mb-6 px-2">
                                <h3 className="text-xl font-extrabold text-slate-900 leading-tight">
                                    {(actionSheetItem.labor || actionSheetItem.equipmentMachine || actionSheetItem.material || actionSheetItem.tool || actionSheetItem.overhead || actionSheetItem.item || 'Catalogue Item') as string}
                                </h3>
                                <p className="text-slate-500 text-sm font-medium mt-1">Select an action for this item</p>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        openEditModal(actionSheetItem);
                                        setActionSheetItem(null);
                                    }}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 active:scale-[0.98] active:bg-slate-100 transition-all border border-slate-100/50"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-blue-100 rounded-xl">
                                            <Pencil className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="text-left">
                                            <span className="block font-bold text-slate-800 text-sm">Edit Details</span>
                                            <span className="block text-slate-500 text-[11px]">Modify item information</span>
                                        </div>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                </button>

                                <button
                                    onClick={() => {
                                        confirmDelete(actionSheetItem._id);
                                        setActionSheetItem(null);
                                    }}
                                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-red-50 active:scale-[0.98] active:bg-red-100 transition-all border border-red-100/50"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 bg-red-100 rounded-xl">
                                            <Trash2 className="w-5 h-5 text-red-600" />
                                        </div>
                                        <div className="text-left">
                                            <span className="block font-bold text-red-700 text-sm">Delete Item</span>
                                            <span className="block text-red-500 text-[11px]">Permanently remove item</span>
                                        </div>
                                    </div>
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                </button>

                                <button
                                    onClick={() => setActionSheetItem(null)}
                                    className="w-full p-4 mt-2 text-slate-400 font-bold text-sm text-center active:scale-95 transition-transform"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function CataloguePage() {
    return (
        <Suspense fallback={<Loading />}>
            <CatalogueContent />
        </Suspense>
    );
}
