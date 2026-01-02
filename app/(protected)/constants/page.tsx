'use client';

import { useEffect, useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Upload, X } from 'lucide-react';
import { Header, Button, AddButton, Card, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, BadgeTabs, Pagination, EmptyState, Loading, Modal, ConfirmModal, ToastContainer, Badge, SearchableSelect, SkeletonTable } from '@/components/ui';
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
    const itemsPerPage = 15;

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
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <div className="flex-none">
            <Header rightContent={
                <div className="flex items-center gap-3">
                    <SearchInput
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search constants..."
                        className="w-48 sm:w-64"
                    />
                    <AddButton onClick={openAddModal} label="Add Constant" />
                </div>
            } />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                <ToastContainer toasts={toasts} removeToast={removeToast} />

                {/* Tabs */}
                <div className="flex justify-center mb-4">
                    <BadgeTabs
                        tabs={tabs}
                        activeTab={activeType}
                        onChange={(id) => { setActiveType(id); setCurrentPage(1); }}
                    />
                </div>

                {/* Table */}
                <div>
                    {loading ? (
                        <SkeletonTable rows={10} columns={5} />
                    ) : (
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>Image</TableHeader>
                                    <TableHeader>Description</TableHeader>
                                    <TableHeader>Type</TableHeader>
                                    <TableHeader>Value</TableHeader>
                                    <TableHeader>Color</TableHeader>
                                    <TableHeader className="text-right">Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedConstants.length === 0 ? (
                                    <TableRow>
                                        <TableCell className="text-center py-8 text-gray-500" colSpan={6}>
                                            <div className="flex flex-col items-center justify-center">
                                                <p className="text-base font-medium text-gray-900">No constants found</p>
                                                <p className="text-sm text-gray-500 mt-1">Add system constants to get started.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedConstants.map((item) => (
                                        <TableRow key={item._id}>
                                            <TableCell>
                                                {item.image ? (
                                                    <img src={item.image} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                                                        {item.description?.slice(0, 2).toUpperCase() || '??'}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>{item.description || '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant="info">{item.type || '-'}</Badge>
                                            </TableCell>
                                            <TableCell className="font-medium font-mono">{item.value || '-'}</TableCell>
                                            <TableCell>
                                                {item.color ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded border border-gray-200 shadow-sm" style={{ backgroundColor: item.color }}></div>
                                                        <span className="font-mono text-xs text-gray-500">{item.color}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end whitespace-nowrap">
                                                    <button onClick={() => openEditModal(item)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-indigo-600">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => confirmDelete(item._id)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-600 ml-1">
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
