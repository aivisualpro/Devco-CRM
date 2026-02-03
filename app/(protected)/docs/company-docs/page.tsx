'use client';

import { useState, useEffect } from 'react';
import { 
    FileText, Eye, Trash2, Plus, Search, Filter, Download 
} from 'lucide-react';
import { toast } from 'sonner';
import { Header, Badge, Input, Modal, Button, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';
import { UploadButton } from '@/components/ui/UploadButton';
import { useToast } from '@/hooks/useToast';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';

export default function CompanyDocsPage() {
    const { success, error: showError } = useToast();
    const { user, can } = usePermissions();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const userEmail = user?.email || currentUser?.email || '';

    const [companyDocs, setCompanyDocs] = useState<any[]>([]);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [docForm, setDocForm] = useState({ title: '', url: '' });
    const [isSavingDoc, setIsSavingDoc] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [previewDoc, setPreviewDoc] = useState<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedUser = localStorage.getItem('devco_user');
            if (storedUser) {
                try {
                    setCurrentUser(JSON.parse(storedUser));
                } catch (e) {
                    console.error('Failed to parse user', e);
                }
            } else if (user) {
                setCurrentUser(user);
            }
        }
    }, [user]);

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

    const handleSaveDoc = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docForm.title || !docForm.url) {
            showError('Please provide both title and document');
            return;
        }

        setIsSavingDoc(true);
        try {
            const res = await fetch('/api/company-docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: docForm.title,
                    url: docForm.url,
                    uploadedBy: userEmail
                })
            });
            const data = await res.json();
            
            if (data.success) {
                success('Document added successfully');
                setIsDocModalOpen(false);
                setDocForm({ title: '', url: '' });
                fetchDocs();
            } else {
                showError(data.error || 'Failed to save document');
            }
        } catch (err) {
            showError('Error saving document');
        } finally {
            setIsSavingDoc(false);
        }
    };

    const handleDeleteDoc = async (id: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return;
        
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

    if (loading) {
        return <div className="p-8 flex items-center justify-center">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            <Header />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
                 <h1 className="text-2xl font-bold text-slate-900">Company Documents</h1>
                 <p className="text-slate-500">Manage and view company training materials and certifications</p>
            </div>
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                
                {/* Actions Bar */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="relative w-full sm:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input 
                            type="text"
                            placeholder="Search documents..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        />
                    </div>
                    
                    {can(MODULES.COMPANY_DOCS, ACTIONS.CREATE) && (
                        <button
                            onClick={() => setIsDocModalOpen(true)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95"
                        >
                            <Plus size={18} />
                            <span className="font-medium text-sm">Add Document</span>
                        </button>
                    )}
                </div>

                {/* Documents Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDocs.length > 0 ? (
                        filteredDocs.map(doc => (
                            <div key={doc._id} className="group relative flex flex-col p-4 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                        <FileText size={20} />
                                    </div>
                                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        {/* For images, open modal. For PDFs and others, open in new tab */}
                                        {doc.url?.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif)$/) ? (
                                            <button 
                                                onClick={() => setPreviewDoc(doc)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Preview"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        ) : (
                                            <a 
                                                href={doc.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="View in New Tab"
                                            >
                                                <Eye size={16} />
                                            </a>
                                        )}
                                        <a 
                                            href={doc.url.includes('/image/upload/') ? doc.url.replace('/image/upload/', '/image/upload/fl_attachment/') : doc.url}
                                            download
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                            title="Download"
                                        >
                                            <Download size={16} />
                                        </a>
                                        {can(MODULES.COMPANY_DOCS, ACTIONS.DELETE) && (
                                            <button 
                                                onClick={() => handleDeleteDoc(doc._id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                
                                {doc.url && (doc.url.toLowerCase().endsWith('.jpg') || doc.url.toLowerCase().endsWith('.jpeg') || doc.url.toLowerCase().endsWith('.png') || doc.url.toLowerCase().endsWith('.webp')) ? (
                                    <div className="mb-4 aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200 cursor-pointer" onClick={() => setPreviewDoc(doc)}>
                                        <img 
                                            src={doc.url} 
                                            alt={doc.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <a 
                                        href={doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mb-4 aspect-video rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-all block"
                                    >
                                        {doc.url?.toLowerCase().endsWith('.pdf') && doc.url.includes('/image/upload/') ? (
                                            <img 
                                                src={doc.url.replace('/image/upload/', '/image/upload/pg_1,w_400,h_300,c_fill,g_north/')}
                                                alt="PDF Preview"
                                                className="w-full h-full object-cover opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all rounded-xl"
                                                onError={(e) => {
                                                    (e.target as any).style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <>
                                                <FileText size={32} className="text-slate-300" />
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                    {doc.url?.split('.').pop() || 'File'} Document
                                                </span>
                                                <span className="text-[10px] text-blue-500">Click to open</span>
                                            </>
                                        )}
                                    </a>
                                )}
                                
                                <div className="mt-3">
                                    <h3 className="font-bold text-slate-900 truncate mb-1" title={doc.title}>{doc.title}</h3>
                                    <p className="text-xs text-slate-500">
                                        Added {new Date(doc.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <FileText className="text-slate-300" />
                            </div>
                            <p className="text-slate-400">No documents found</p>
                        </div>
                    )}
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
                        <div className="w-full">
                            <UploadButton 
                                onUpload={(url: string) => setDocForm({ ...docForm, url })}
                                className="w-full"
                            />
                        </div>
                        {docForm.url && (
                             <div className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
                                 <FileText size={12} />
                                 File uploaded ready to save
                             </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsDocModalOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSavingDoc || !docForm.url}>
                            {isSavingDoc ? 'Saving...' : 'Save Document'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Preview Modal */}
            <Modal 
                isOpen={!!previewDoc} 
                onClose={() => setPreviewDoc(null)} 
                title={previewDoc?.title || 'Document Preview'}
                maxWidth="5xl"
            >
                <div className="h-[80vh] flex flex-col">
                    <div className="flex-1 bg-slate-100 rounded-xl overflow-hidden relative">
                        {previewDoc?.url && (previewDoc.url.toLowerCase().endsWith('.jpg') || previewDoc.url.toLowerCase().endsWith('.jpeg') || previewDoc.url.toLowerCase().endsWith('.png') || previewDoc.url.toLowerCase().endsWith('.webp')) ? (
                            <img 
                                src={previewDoc.url} 
                                alt={previewDoc.title}
                                className="w-full h-full object-contain"
                            />
                        ) : previewDoc?.url?.toLowerCase().endsWith('.pdf') ? (
                            <div className="w-full h-full flex flex-col">
                                {/* Try native PDF embed first */}
                                <object 
                                    data={previewDoc.url} 
                                    type="application/pdf"
                                    className="w-full h-full"
                                >
                                    {/* Fallback if object doesn't work */}
                                    <div className="flex flex-col items-center justify-center h-full gap-6 text-slate-500 p-8">
                                        <FileText size={64} className="text-slate-300" />
                                        <div className="text-center space-y-2">
                                            <p className="font-semibold text-lg text-slate-700">PDF Preview Not Available</p>
                                            <p className="text-sm">Your browser cannot display this PDF inline.</p>
                                        </div>
                                        <a 
                                            href={previewDoc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-md"
                                        >
                                            Open PDF in New Tab
                                        </a>
                                    </div>
                                </object>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                                <FileText size={64} />
                                <p>Preview not available for this file type</p>
                            </div>
                        )}
                    </div>
                    <div className="flex justify-between items-center mt-4 px-2">
                        <div className="text-sm text-slate-500">
                            {previewDoc?.title}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setPreviewDoc(null)}>Close</Button>
                            <a 
                                href={previewDoc?.url?.includes('/image/upload/') ? previewDoc.url.replace('/image/upload/', '/image/upload/fl_attachment/') : previewDoc?.url}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Button>Download File</Button>
                            </a>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
