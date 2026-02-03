'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Trash2, Plus, FileText, Loader2 } from 'lucide-react';
import { Header, Modal, Button, Input, SearchInput } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';

export default function CompanyDocsPage() {
    const { success, error: showError } = useToast();
    const { user, can } = usePermissions();
    const userEmail = user?.email || '';

    const [companyDocs, setCompanyDocs] = useState<any[]>([]);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [docForm, setDocForm] = useState({ title: '', file: null as File | null });
    const [isSavingDoc, setIsSavingDoc] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/company-docs');
            const data = await res.json();
            if (data.success) {
                setCompanyDocs(data.docs || []);
            } else {
                showError('Failed to load documents');
            }
        } catch (error) {
            console.error('Error fetching docs:', error);
            showError('Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocs();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setDocForm({ ...docForm, file });
    };

    const handleSaveDoc = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docForm.title || !docForm.file) {
            showError('Please provide both title and file');
            return;
        }

        setIsSavingDoc(true);
        try {
            // Upload file to R2
            const formData = new FormData();
            formData.append('file', docForm.file);
            formData.append('folder', 'company-docs');

            const uploadRes = await fetch('/api/upload-r2', {
                method: 'POST',
                body: formData
            });
            const uploadData = await uploadRes.json();

            if (!uploadData.success) {
                throw new Error(uploadData.error || 'Upload failed');
            }

            // Save document record
            const res = await fetch('/api/company-docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: docForm.title,
                    url: uploadData.url,
                    r2Key: uploadData.key,
                    type: uploadData.type,
                    uploadedBy: userEmail
                })
            });
            const data = await res.json();
            
            if (data.success) {
                success('Document added successfully');
                setIsDocModalOpen(false);
                setDocForm({ title: '', file: null });
                fetchDocs();
            } else {
                showError(data.error || 'Failed to save document');
            }
        } catch (err: any) {
            showError(err.message || 'Error saving document');
        } finally {
            setIsSavingDoc(false);
        }
    };

    const handleDeleteDoc = async (id: string, title: string) => {
        if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
        
        try {
            const res = await fetch(`/api/company-docs?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            
            if (data.success) {
                setCompanyDocs(prev => prev.filter(d => d._id !== id));
                success('Document deleted');
            } else {
                showError(data.error || 'Failed to delete');
            }
        } catch (err) {
            showError('Error deleting document');
        }
    };

    const filteredDocs = companyDocs.filter(doc => 
        doc.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            <Header 
                rightContent={
                    <div className="flex items-center gap-3">
                        <SearchInput 
                            placeholder="Search documents..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {can(MODULES.COMPANY_DOCS, ACTIONS.CREATE) && (
                            <button
                                onClick={() => setIsDocModalOpen(true)}
                                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center shrink-0"
                                title="Add Document"
                            >
                                <Plus size={20} />
                            </button>
                        )}
                    </div>
                }
            />
            
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-5xl mx-auto">
                    {/* Simple Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">File Name</th>
                                    <th className="text-center px-4 py-4 text-sm font-semibold text-slate-700 w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={2} className="px-6 py-12 text-center text-slate-400">
                                            <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                                            Loading documents...
                                        </td>
                                    </tr>
                                ) : filteredDocs.length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="px-6 py-12 text-center text-slate-400">
                                            <FileText className="mx-auto mb-2 text-slate-300" size={32} />
                                            No documents found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDocs.map((doc) => (
                                        <tr key={doc._id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <a 
                                                    href={doc.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-3 group"
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-200 transition-colors">
                                                        <FileText size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">{doc.title}</p>
                                                        <p className="text-xs text-slate-500">
                                                            Added {new Date(doc.createdAt).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                </a>
                                            </td>
                                            <td className="px-4 py-4 text-center">
                                                {can(MODULES.COMPANY_DOCS, ACTIONS.DELETE) && (
                                                    <button 
                                                        onClick={() => handleDeleteDoc(doc._id, doc.title)}
                                                        className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add Doc Modal */}
            <Modal isOpen={isDocModalOpen} onClose={() => setIsDocModalOpen(false)} title="Add Company Document">
                <form onSubmit={handleSaveDoc} className="space-y-4 p-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Document Title</label>
                        <Input 
                            value={docForm.title}
                            onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                            placeholder="e.g., Safety Manual 2024"
                            autoFocus
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Upload File</label>
                        <input 
                            type="file"
                            onChange={handleFileChange}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp"
                        />
                        {docForm.file && (
                            <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
                                <FileText size={12} />
                                {docForm.file.name} ready to upload
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsDocModalOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSavingDoc || !docForm.file}>
                            {isSavingDoc ? (
                                <>
                                    <Loader2 className="animate-spin mr-2" size={16} />
                                    Uploading...
                                </>
                            ) : 'Save Document'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
