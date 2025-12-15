'use client';

import { useEffect, useState, useMemo } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Header, Button, AddButton, Card, SearchInput, Table, TableHead, TableBody, TableRow, TableHeader, TableCell, Pagination, EmptyState, Loading, Modal, ConfirmModal, ToastContainer, Badge, SkeletonTable } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface Template {
    _id: string;
    name: string;
    description?: string;
    category?: string;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
}

export default function TemplatesPage() {
    const { toasts, success, error: toastError, removeToast } = useToast();

    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editItem, setEditItem] = useState<Template | null>(null);
    const [formData, setFormData] = useState<Record<string, unknown>>({});
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const itemsPerPage = 15;

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        // Templates API - for now return empty until backend has templates action
        // In production, you'd call: /api/webhook/devcoBackend with action: 'getTemplates'
        setTemplates([]);
        setLoading(false);
    };

    const filteredTemplates = useMemo(() => {
        if (!search) return templates;
        const s = search.toLowerCase();
        return templates.filter((t) =>
            t.name.toLowerCase().includes(s) ||
            (t.description || '').toLowerCase().includes(s) ||
            (t.category || '').toLowerCase().includes(s)
        );
    }, [templates, search]);

    const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);
    const paginatedTemplates = filteredTemplates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const openAddModal = () => {
        setEditItem(null);
        setFormData({ name: '', description: '', category: '', status: 'draft' });
        setIsModalOpen(true);
    };

    const openEditModal = (item: Template) => {
        setEditItem(item);
        setFormData({ ...item });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        // Template save logic would go here
        success(editItem ? 'Template updated' : 'Template created');
        setIsModalOpen(false);
        fetchTemplates();
    };

    const confirmDelete = (id: string) => {
        setDeleteId(id);
        setIsConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        success('Template deleted');
        setIsConfirmOpen(false);
        setDeleteId(null);
        fetchTemplates();
    };

    return (
        <>
            <Header />
            <div className="p-4">
                <ToastContainer toasts={toasts} removeToast={removeToast} />

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
                        <p className="text-sm text-gray-500">Manage reusable proposal templates</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." />
                        <AddButton onClick={openAddModal} label="New Template" />
                    </div>
                </div>

                {/* Table */}
                <div>
                    {loading ? (
                        <SkeletonTable rows={10} columns={4} />
                    ) : (
                        <Table containerClassName="h-[calc(100vh-220px)] overflow-auto">
                            <TableHead>
                                <TableRow>
                                    <TableHeader>Name</TableHeader>
                                    <TableHeader>Description</TableHeader>
                                    <TableHeader>Category</TableHeader>
                                    <TableHeader>Status</TableHeader>
                                    <TableHeader className="text-right">Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedTemplates.length === 0 ? (
                                    <TableRow>
                                        <TableCell className="text-center py-8 text-gray-500" colSpan={5}>
                                            <div className="flex flex-col items-center justify-center">
                                                <p className="text-base font-medium text-gray-900">No templates found</p>
                                                <p className="text-sm text-gray-500 mt-1">Create your first template to streamline estimate creation.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedTemplates.map((item) => (
                                        <TableRow key={item._id}>
                                            <TableCell className="font-medium text-gray-900">{item.name}</TableCell>
                                            <TableCell>{item.description || '-'}</TableCell>
                                            <TableCell>{item.category || '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant={item.status === 'active' ? 'success' : 'warning'}>{item.status || 'draft'}</Badge>
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

                {/* Add/Edit Modal */}
                <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editItem ? 'Edit Template' : 'New Template'} footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save</Button>
                    </>
                }>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                            <input
                                type="text"
                                value={String(formData.name || '')}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <textarea
                                value={String(formData.description || '')}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                rows={3}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <input
                                    type="text"
                                    value={String(formData.category || '')}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select
                                    value={String(formData.status || 'draft')}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="active">Active</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </Modal>

                {/* Confirm Delete Modal */}
                <ConfirmModal
                    isOpen={isConfirmOpen}
                    onClose={() => setIsConfirmOpen(false)}
                    onConfirm={handleDelete}
                    title="Delete Template"
                    message="Are you sure you want to delete this template?"
                    confirmText="Delete"
                />
            </div>
        </>
    );
}
