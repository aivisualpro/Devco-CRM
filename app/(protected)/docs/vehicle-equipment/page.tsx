'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Trash2, Plus, FileText, Loader2, Truck, Edit, X, Download, Calendar, User } from 'lucide-react';
import { Header, Modal, Button, Input, SearchInput } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { usePermissions } from '@/hooks/usePermissions';
// Using proper VEHICLE_EQUIPMENT permissions
import { MODULES, ACTIONS } from '@/lib/permissions/types';

export default function VehicleEquipmentDocsPage() {
    const { success, error: showError } = useToast();
    const { user, can } = usePermissions();
    const userEmail = user?.email || '';

    const [docs, setDocs] = useState<any[]>([]);
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [docForm, setDocForm] = useState({ 
        unit: '', 
        unitNumber: '', 
        vinSerialNumber: '',
        files: null as FileList | null 
    });
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isSavingDoc, setIsSavingDoc] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchDocs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/vehicle-docs');
            const data = await res.json();
            if (data.success) {
                setDocs(data.docs || []);
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
        if (e.target.files && e.target.files.length > 0) {
            setDocForm({ ...docForm, files: e.target.files });
        }
    };

    const handleSaveDoc = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docForm.files || !docForm.unit || !docForm.unitNumber || !docForm.vinSerialNumber) {
            showError('Please provide all required fields');
            return;
        }

        setIsSavingDoc(true);
        try {
            const uploadedDocs = [];

            // Upload all files to R2
            for (let i = 0; i < docForm.files.length; i++) {
                const file = docForm.files[i];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('folder', 'vehicle-docs');

                const uploadRes = await fetch('/api/upload-r2', {
                    method: 'POST',
                    body: formData
                });
                const uploadData = await uploadRes.json();

                if (!uploadData.success) {
                    throw new Error(`Failed to upload ${file.name}`);
                }

                uploadedDocs.push({
                    url: uploadData.url,
                    r2Key: uploadData.key,
                    type: uploadData.type,
                    fileName: file.name,
                    uploadedBy: userEmail
                });
            }

            // Save document record (or update existing)
            const res = await fetch('/api/vehicle-docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unit: docForm.unit,
                    unitNumber: docForm.unitNumber,
                    vinSerialNumber: docForm.vinSerialNumber,
                    documents: uploadedDocs
                })
            });
            const data = await res.json();
            
            if (data.success) {
                success('Documents added successfully');
                setIsDocModalOpen(false);
                setDocForm({ unit: '', unitNumber: '', vinSerialNumber: '', files: null });
                fetchDocs();
            } else {
                showError(data.error || 'Failed to save documents');
            }
        } catch (err: any) {
            showError(err.message || 'Error saving documents');
        } finally {
            setIsSavingDoc(false);
        }
    };

    const handleDeleteDoc = async (id: string, unit: string) => {
        if (!confirm(`Are you sure you want to delete all documents for ${unit}?`)) return;
        
        try {
            const res = await fetch(`/api/vehicle-docs?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            
            if (data.success) {
                setDocs(prev => prev.filter(d => d._id !== id));
                success('Entry deleted');
            } else {
                showError(data.error || 'Failed to delete');
            }
        } catch (err) {
            showError('Error deleting entry');
        }
    };

    const handleEditDoc = (doc: any) => {
        setDocForm({
            unit: doc.unit,
            unitNumber: doc.unitNumber,
            vinSerialNumber: doc.vinSerialNumber,
            files: null
        });
        setIsDocModalOpen(true);
    };

    const handleViewDocs = (doc: any) => {
        setSelectedVehicle(doc);
        setIsViewModalOpen(true);
    };

    const handleDeleteFile = async (e: React.MouseEvent, vehicleId: string, fileId: string, fileName: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;

        try {
            const res = await fetch(`/api/vehicle-docs?id=${vehicleId}&fileId=${fileId}`, { 
                method: 'DELETE' 
            });
            const data = await res.json();

            if (data.success) {
                // Update local state
                if (data.doc) {
                    // Update the selected vehicle in the modal
                    setSelectedVehicle(data.doc);
                    // Update the main docs list
                    setDocs(prev => prev.map(d => d._id === vehicleId ? data.doc : d));
                } else {
                    // If no doc returned (e.g. somehow entire doc deleted), close modal
                     setIsViewModalOpen(false);
                     fetchDocs();
                }
                success('Document deleted');
            } else {
                showError(data.error || 'Failed to delete file');
            }
        } catch (err) {
            console.error(err);
            showError('Error deleting file');
        }
    };

    const filteredDocs = docs.filter(doc => 
        doc.unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.vinSerialNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            <Header 
                rightContent={
                    <div className="flex items-center gap-3">
                        <SearchInput 
                            placeholder="Search vehicle docs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {/* Proper Vehicle Equipment permissions */}
                        {can(MODULES.VEHICLE_EQUIPMENT, ACTIONS.CREATE) && (
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
                <div className="max-w-6xl mx-auto">
                    {/* Simple Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">UNIT</th>
                                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">DEVCO UNIT NUMBER</th>
                                    <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">VIN / SERIAL #</th>
                                    <th className="text-center px-6 py-4 text-sm font-semibold text-slate-700">Documents</th>
                                    <th className="text-center px-4 py-4 text-sm font-semibold text-slate-700 w-24">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                            <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                                            Loading vehicle docs...
                                        </td>
                                    </tr>
                                ) : filteredDocs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                            <Truck className="mx-auto mb-2 text-slate-300" size={32} />
                                            No documents found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDocs.map((doc) => (
                                        <tr 
                                            key={doc._id} 
                                            className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer"
                                            onClick={() => handleViewDocs(doc)}
                                        >
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-slate-900">{doc.unit}</p>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {doc.unitNumber}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-sm text-slate-600">
                                                {doc.vinSerialNumber}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                                                    <FileText size={14} />
                                                    {doc.documents?.length || 0}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-center gap-2">
                                                    {/* Edit Action */}
                                                    {can(MODULES.VEHICLE_EQUIPMENT, ACTIONS.EDIT) && (
                                                        <button 
                                                            onClick={() => handleEditDoc(doc)}
                                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                            title="Edit / Add Files"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                    )}
                                                    {/* Delete Action */}
                                                    {can(MODULES.VEHICLE_EQUIPMENT, ACTIONS.DELETE) && (
                                                        <button 
                                                            onClick={() => handleDeleteDoc(doc._id, doc.unit)}
                                                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
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
            <Modal isOpen={isDocModalOpen} onClose={() => setIsDocModalOpen(false)} title="Add Vehicle/Equipment Doc">
                <form onSubmit={handleSaveDoc} className="space-y-4 p-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Unit Name</label>
                            <Input 
                                value={docForm.unit}
                                onChange={(e) => setDocForm({ ...docForm, unit: e.target.value })}
                                placeholder="e.g. Ford F-150"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Unit Number</label>
                            <Input 
                                value={docForm.unitNumber}
                                onChange={(e) => setDocForm({ ...docForm, unitNumber: e.target.value })}
                                placeholder="e.g. T-101"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">VIN / Serial Number</label>
                        <Input 
                            value={docForm.vinSerialNumber}
                            onChange={(e) => setDocForm({ ...docForm, vinSerialNumber: e.target.value })}
                            placeholder="Enter VIN or Serial Number"
                        />
                    </div>

                    {/* Title field removed as requested */}
                    
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Upload File(s)</label>
                        <input 
                            type="file"
                            multiple
                            onChange={handleFileChange}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-slate-50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp"
                        />
                        {docForm.files && docForm.files.length > 0 && (
                            <div className="mt-2 flex flex-col gap-1">
                                {Array.from(docForm.files).map((file, idx) => (
                                    <p key={idx} className="text-xs text-emerald-600 flex items-center gap-1">
                                        <FileText size={12} />
                                        {file.name} ready to upload
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsDocModalOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={isSavingDoc || !docForm.files}>
                            {isSavingDoc ? (
                                <>
                                    <Loader2 className="animate-spin mr-2" size={16} />
                                    Uploading...
                                </>
                            ) : 'Save Document(s)'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* View Documents Modal */}
            <Modal 
                isOpen={isViewModalOpen} 
                onClose={() => setIsViewModalOpen(false)} 
                title={selectedVehicle ? `${selectedVehicle.unit} #${selectedVehicle.unitNumber}` : 'Vehicle Documents'}
            >
                <div className="p-6">
                     <div className="mb-6 pb-4 border-b border-slate-100">
                        <div className="flex items-center justify-between text-sm text-slate-500 mb-2">
                            <span>VIN / Serial Number</span>
                            <span className="font-mono bg-slate-100 px-2 py-1 rounded">{selectedVehicle?.vinSerialNumber}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-500">
                            <span>Total Documents</span>
                            <span className="font-semibold text-slate-700">{selectedVehicle?.documents?.length || 0}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {selectedVehicle?.documents?.length > 0 ? (
                            selectedVehicle.documents.map((file: any, index: number) => (
                                <a 
                                    key={index} 
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all group cursor-pointer"
                                >
                                    <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                        <FileText size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-900 truncate" title={file.fileName}>{file.fileName}</p>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar size={12} />
                                                {file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : 'Unknown date'}
                                            </span>
                                            {file.uploadedBy && (
                                                <span className="flex items-center gap-1">
                                                    <User size={12} />
                                                    {file.uploadedBy.split('@')[0]}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 text-slate-400 group-hover:text-blue-600 transition-colors">
                                            <ExternalLink size={20} />
                                        </div>
                                        {can(MODULES.VEHICLE_EQUIPMENT, ACTIONS.DELETE) && (
                                            <button
                                                onClick={(e) => handleDeleteFile(e, selectedVehicle._id, file._id, file.fileName)}
                                                className="p-2 rounded-lg text-slate-400 hover:bg-red-100 hover:text-red-600 transition-colors z-10"
                                                title="Delete File"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        )}
                                    </div>
                                </a>
                            ))
                        ) : (
                            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <FileText className="mx-auto mb-2 opacity-50" size={32} />
                                <p>No documents uploaded</p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-6 mt-4 border-t border-slate-50">
                        <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>Close</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
