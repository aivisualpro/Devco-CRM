'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, LayoutTemplate, Calendar } from 'lucide-react';
import { Header, AddButton, SearchInput, Pagination, ConfirmModal, ToastContainer } from '@/components/ui';
import { useToast } from '@/hooks/useToast';

interface Template {
    _id: string;
    title: string;
    subTitle?: string;
    subTitleDescription?: string;
    content?: string;
    pages?: { content: string }[];
    status?: string;
    createdAt?: string;
    updatedAt?: string;
}

export default function TemplatesPage() {
    const router = useRouter();
    const { toasts, success, error: toastError, removeToast } = useToast();

    // Data
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    // UI State
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const itemsPerPage = 15;

    const apiCall = async (action: string, payload: Record<string, unknown> = {}) => {
        try {
            const res = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, payload })
            });
            return await res.json();
        } catch (err) {
            console.error('API Error:', err);
            return { success: false, error: String(err) };
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        const result = await apiCall('getTemplates');
        if (result.success && result.result) {
            setTemplates(result.result);
        } else {
            toastError('Failed to load templates');
        }
        setLoading(false);
    };

    const handleCreate = () => {
        router.push('/templates/new');
    };

    const handleEdit = (item: Template) => {
        router.push(`/templates/${item._id}`);
    };

    const confirmDelete = (id: string) => {
        setDeleteId(id);
        setIsConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        const result = await apiCall('deleteTemplate', { id: deleteId });
        if (result.success) {
            success('Template deleted');
            setIsConfirmOpen(false);
            setDeleteId(null);
            fetchTemplates();
        } else {
            toastError('Failed to delete template');
        }
    };

    // Pagination Logic
    const filteredTemplates = useMemo(() => {
        if (!search) return templates;
        const s = search.toLowerCase();
        return templates.filter((t) =>
            t.title.toLowerCase().includes(s) ||
            (t.subTitle || '').toLowerCase().includes(s)
        );
    }, [templates, search]);

    const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);
    const paginatedTemplates = filteredTemplates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <>
            <Header
                rightContent={
                    <div className="flex items-center gap-3">
                        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." />
                        <AddButton onClick={handleCreate} label="New Template" />
                    </div>
                }
            />
            <div className="p-6 bg-[#e0e5ec] min-h-screen">
                <ToastContainer toasts={toasts} removeToast={removeToast} />

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3].map(i => (
                            <div
                                key={i}
                                className="h-72 rounded-[30px] animate-pulse"
                                style={{ background: '#e0e5ec', boxShadow: '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)' }}
                            />
                        ))}
                    </div>
                ) : paginatedTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                        <div
                            className="w-24 h-24 rounded-full flex items-center justify-center mb-6 text-blue-500"
                            style={{ background: '#e0e5ec', boxShadow: 'inset 8px 8px 16px #b8b9be, inset -8px -8px 16px #ffffff' }}
                        >
                            <LayoutTemplate className="w-12 h-12" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-700 mb-3">No templates found</h3>
                        <p className="text-gray-500 max-w-md mb-8">Create your first template to get started with reusable proposals.</p>
                        <button
                            onClick={handleCreate}
                            className="px-8 py-4 rounded-full font-bold text-white flex items-center gap-3 transition-all active:scale-[0.98]"
                            style={{ background: 'linear-gradient(145deg, #5a9cf5, #4a8ce5)', boxShadow: '6px 6px 12px #b8b9be, -6px -6px 12px #ffffff' }}
                        >
                            <Plus className="w-5 h-5" />
                            Create Template
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {paginatedTemplates.map((item) => (
                                <div
                                    key={item._id}
                                    className="group relative flex flex-col rounded-[30px] p-8 transition-all duration-300"
                                    style={{
                                        background: '#e0e5ec',
                                        boxShadow: '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)'
                                    }}
                                >
                                    {/* Delete Button */}
                                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); confirmDelete(item._id); }}
                                            className="p-3 text-red-500 rounded-full transition-all active:scale-95"
                                            style={{ background: '#e0e5ec', boxShadow: '5px 5px 10px #bebebe, -5px -5px 10px #ffffff' }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* Icon */}
                                    <div className="mb-6 flex justify-start">
                                        <div
                                            className="w-16 h-16 rounded-full flex items-center justify-center text-blue-600"
                                            style={{ background: '#e0e5ec', boxShadow: 'inset 6px 6px 12px #b8b9be, inset -6px -6px 12px #ffffff' }}
                                        >
                                            <LayoutTemplate className="w-8 h-8" />
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 mb-6">
                                        <h3 className="text-xl font-bold text-gray-700 mb-2 truncate">{item.title}</h3>
                                        <div
                                            className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-4 px-3 py-1.5 rounded-full w-fit"
                                            style={{ boxShadow: 'inset 3px 3px 6px #b8b9be, inset -3px -3px 6px #ffffff' }}
                                        >
                                            <Calendar className="w-3 h-3" />
                                            <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Unknown Date'}</span>
                                        </div>
                                        <p className="text-gray-500 text-sm leading-relaxed line-clamp-3">
                                            {item.subTitleDescription || 'No description provided.'}
                                        </p>
                                    </div>

                                    {/* Edit Button */}
                                    <button
                                        onClick={() => handleEdit(item)}
                                        className="w-full py-4 rounded-xl font-bold text-gray-600 hover:text-blue-600 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                        style={{ background: '#e0e5ec', boxShadow: '6px 6px 12px #b8b9be, -6px -6px 12px #ffffff' }}
                                    >
                                        <Pencil className="w-4 h-4" /> Edit Template
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        <div className="mt-10 flex justify-center">
                            <div
                                className="rounded-full px-2 py-2"
                                style={{ background: '#e0e5ec', boxShadow: '6px 6px 12px #b8b9be, -6px -6px 12px #ffffff' }}
                            >
                                <Pagination currentPage={currentPage} totalPages={totalPages || 1} onPageChange={setCurrentPage} />
                            </div>
                        </div>
                    </>
                )}
            </div>

            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleDelete}
                title="Delete Template"
                message="Are you sure you want to delete this template?"
                confirmText="Delete"
            />
        </>
    );
}
