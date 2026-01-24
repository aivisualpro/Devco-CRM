'use client';

import { useEffect, useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Upload, X, Filter } from 'lucide-react';
import { Header, Button, Card, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Pagination, EmptyState, Loading, Modal, ConfirmModal, ToastContainer, Badge, SearchableSelect, SkeletonTable, MyDropDown } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface ConstantItem {
    _id: string;
    type?: string;
    description?: string;
    value?: string;
    color?: string;
    image?: string;
}



export default function ConstantsPage() {
    const { toasts, success, error: toastError, removeToast } = useToast();

    const [constants, setConstants] = useState<ConstantItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeType, setActiveType] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<ConstantItem | null>(null);
    const [formData, setFormData] = useState<Record<string, unknown>>({});
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const itemsPerPage = 25;

    useEffect(() => {
        fetchConstants();
    }, []);

    const fetchConstants = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getConstants' })
            });
            const data = await res.json();
            if (data.success) {
                setConstants(data.result || []);
            }
        } catch (err) {
            console.error('Error fetching constants:', err);
        }
        setLoading(false);
    };

    // Compute unique types for dropdown (including defaults)
    const typeOptions = useMemo(() => {
        const defaults = ['Fringe', 'Markup', 'Status', 'PayrollTax', 'WComp'];
        const existing = constants.map(c => c.type).filter(Boolean) as string[];
        return [...new Set([...defaults, ...existing])].sort();
    }, [constants]);

    const typeCounts = useMemo(() => {
        const counts: Record<string, number> = { all: constants.length };
        // Count all types appearing in data
        constants.forEach(c => {
            if (c.type) {
                counts[c.type] = (counts[c.type] || 0) + 1;
            }
        });
        return counts;
    }, [constants]);

    const filteredConstants = useMemo(() => {
        let filtered = [...constants];

        if (activeType !== 'all') {
            filtered = filtered.filter((c) => c.type === activeType);
        }

        if (search) {
            const s = search.toLowerCase();
            filtered = filtered.filter((c) =>
                (c.description || '').toLowerCase().includes(s) ||
                (c.value || '').toLowerCase().includes(s)
            );
        }

        return filtered;
    }, [constants, activeType, search]);

    const totalPages = Math.ceil(filteredConstants.length / itemsPerPage);
    const paginatedConstants = filteredConstants.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const tabs = [
        { id: 'all', label: 'All', count: typeCounts.all },
        ...Object.keys(typeCounts)
            .filter(t => t !== 'all' && typeCounts[t] > 0)
            .sort()
            .map(t => ({
                id: t,
                label: t,
                count: typeCounts[t]
            }))
    ];

    const openAddModal = () => {
        setEditItem(null);
        setFormData({ type: 'Fringe', description: '', value: '', color: '' });
        setIsModalOpen(true);
    };

    const openEditModal = (item: ConstantItem) => {
        setEditItem(item);
        setFormData({ ...item });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const action = editItem ? 'updateConstant' : 'addConstant';
            const payload = editItem
                ? { id: editItem._id, item: formData }
                : { item: formData };

            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload })
            });
            const data = await res.json();

            if (data.success) {
                success(editItem ? 'Constant updated' : 'Constant added');
                fetchConstants();
                setIsModalOpen(false);
            } else {
                toastError('Failed to save');
            }
        } catch {
            toastError('Failed to save');
        }
    };

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
                body: JSON.stringify({ action: 'deleteConstant', payload: { id: deleteId } })
            });
            const data = await res.json();
            if (data.success) {
                success('Constant deleted');
                fetchConstants();
            } else {
                toastError('Failed to delete');
            }
        } catch {
            toastError('Failed to delete');
        }
        setIsConfirmOpen(false);
        setDeleteId(null);
    };

    return (
        <div className="flex flex-col min-h-full bg-[#f8fafc]">
            <div className="flex-none">
            <Header rightContent={
                <div className="flex items-center gap-3">
                    <SearchInput
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search constants..."
                        className="w-48 sm:w-64"
                    />
                    
                    <div className="relative">
                        <button
                            id="filter-trigger"
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`flex items-center gap-2 px-3 py-2 bg-white border ${activeType !== 'all' ? 'border-[#0F4C75] text-[#0F4C75] bg-blue-50' : 'border-slate-200 text-slate-600'} rounded-xl hover:border-[#0F4C75] transition-colors shadow-sm`}
                        >
                            <Filter size={18} />
                            <span className="text-sm font-bold hidden sm:inline">
                                {activeType === 'all' ? 'Filter' : activeType}
                            </span>
                            {activeType !== 'all' && (
                                <span className="flex items-center justify-center w-5 h-5 bg-[#0F4C75] text-white text-[10px] rounded-full">
                                    {typeCounts[activeType]}
                                </span>
                            )}
                        </button>

                        <MyDropDown
                            isOpen={isFilterOpen}
                            onClose={() => setIsFilterOpen(false)}
                            anchorId="filter-trigger"
                            width="w-[220px]"
                            options={tabs.map(t => ({
                                id: t.id,
                                label: t.label,
                                value: t.id,
                                badge: String(t.count)
                            }))}
                            selectedValues={[activeType]}
                            onSelect={(val) => {
                                setActiveType(val);
                                setCurrentPage(1);
                                setIsFilterOpen(false);
                            }}
                            placeholder="Search types..."
                        />
                    </div>

                    <button
                        onClick={openAddModal}
                        className="hidden sm:flex p-2.5 bg-[#0F4C75] text-white rounded-full hover:bg-[#0a3a5c] transition-all shadow-lg hover:shadow-[#0F4C75]/30 group"
                    >
                        <Plus className="w-6 h-6 transition-transform group-hover:rotate-90" />
                    </button>
                </div>
            } />
            </div>
            <div className="flex-1 pt-4 px-4 pb-8">
                <ToastContainer toasts={toasts} removeToast={removeToast} />

                {/* Table */}
                <div>
                    {loading ? (
                        <SkeletonTable rows={20} columns={5} />
                    ) : (
                        <Table containerClassName="h-[calc(100vh-140px)] shadow-sm rounded-[24px] border-none" className="text-sm">
                            <TableHead>
                                <TableRow>
                                    <TableHeader className="py-4 px-6">Image</TableHeader>
                                    <TableHeader className="py-4 px-6">Description</TableHeader>
                                    <TableHeader className="py-4 px-6">Type</TableHeader>
                                    <TableHeader className="py-4 px-6">Value</TableHeader>
                                    <TableHeader className="py-4 px-6">Color</TableHeader>
                                    <TableHeader className="py-4 px-6 text-right">Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedConstants.length === 0 ? (
                                    <TableRow>
                                        <TableCell className="text-center py-20 text-gray-500" colSpan={6}>
                                            <div className="flex flex-col items-center justify-center">
                                                <p className="text-base font-medium text-gray-900">No constants found</p>
                                                <p className="text-sm text-gray-500 mt-1">Add system constants to get started.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedConstants.map((item) => (
                                        <TableRow key={item._id}>
                                            <TableCell className="py-3 px-6">
                                                {item.image ? (
                                                    <img src={item.image} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                                                        {item.description?.slice(0, 2).toUpperCase() || '??'}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-3 px-6 font-bold text-slate-700">{item.description || '-'}</TableCell>
                                            <TableCell className="py-3 px-6">
                                                <Badge variant="info" className="px-3 py-1 rounded-full">{item.type || '-'}</Badge>
                                            </TableCell>
                                            <TableCell className="py-3 px-6 font-black text-[#0F4C75] font-mono text-sm">{item.value || '-'}</TableCell>
                                            <TableCell className="py-3 px-6">
                                                {item.color ? (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg border border-gray-200 shadow-sm" style={{ backgroundColor: item.color }}></div>
                                                        <span className="font-mono text-xs font-bold text-gray-500 uppercase">{item.color}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-3 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => openEditModal(item)} className="p-2 hover:bg-indigo-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => confirmDelete(item._id)} className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors ml-1">
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
                    <div className="mt-4">
                        <Pagination currentPage={currentPage} totalPages={totalPages || 1} onPageChange={setCurrentPage} />
                    </div>
                </div>

            </div>

            {/* Add/Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editItem ? 'Edit Constant' : 'Add Constant'} footer={
                <>
                    <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save</Button>
                </>
            }>
                <div className="space-y-4">
                    {/* Row 1: Description and Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <input
                                id="constDesc"
                                autoFocus
                                type="text"
                                value={String(formData.description || '')}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('constType')?.focus(); } }}
                                className="w-full h-[46px] bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <SearchableSelect
                                id="constType"
                                value={String(formData.type || '')}
                                onChange={(val) => setFormData({ ...formData, type: val })}
                                onAddNew={(val) => setFormData({ ...formData, type: val })}
                                onNext={() => document.getElementById('constValue')?.focus()}
                                options={typeOptions}
                                placeholder="Select or type type..."
                            />
                        </div>
                    </div>

                    {/* Row 2: Value and Color */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                            <input
                                id="constValue"
                                type="text"
                                value={String(formData.value || '')}
                                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('constColor')?.focus(); } }}
                                className="w-full h-[46px] bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Color (Optional)</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={String(formData.color || '#000000')}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    className="w-14 h-[46px] rounded-xl border border-slate-200 cursor-pointer p-0.5"
                                />
                                <input
                                    id="constColor"
                                    type="text"
                                    value={String(formData.color || '')}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    placeholder="#000000"
                                    className="flex-1 h-[46px] bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all font-mono"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 3: Image */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                        <div className="flex items-center gap-4">
                            {formData.image ? (
                                <div className="relative w-16 h-16 group">
                                    <img src={formData.image as string} alt="Preview" className="w-full h-full object-cover rounded-lg border border-gray-200" />
                                    <button
                                        onClick={() => setFormData({ ...formData, image: '' })}
                                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <div className="w-16 h-16 rounded-lg bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                                    <Upload className="w-6 h-6" />
                                </div>
                            )}
                            <div className="flex-1">
                                <input
                                    type="file"
                                    accept="image/*"
                                    id="icon-upload"
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
                                    htmlFor="icon-upload"
                                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer"
                                >
                                    <Upload className="w-4 h-4 mr-2" />
                                    Upload Image
                                </label>
                                <p className="mt-1 text-xs text-gray-500">PNG, JPG, GIF up to 2MB</p>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleDelete}
                title="Delete Constant"
                message="Are you sure you want to delete this constant?"
                confirmText="Delete"
            />
        </div>
    );
}
