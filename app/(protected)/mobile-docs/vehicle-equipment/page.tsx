'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, FileText, Loader2, Truck, Calendar, User, Download, Plus } from 'lucide-react';
import { Header, Modal, SearchInput, Button } from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { usePermissions } from '@/hooks/usePermissions';

export default function MobileVehicleEquipmentDocsPage() {
    const { error: showError } = useToast();
    const { user } = usePermissions();

    const [docs, setDocs] = useState<any[]>([]);
    const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
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

    const handleViewDocs = (doc: any) => {
        setSelectedVehicle(doc);
        setIsViewModalOpen(true);
    };

    const filteredDocs = docs.filter(doc => 
        doc.unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.unitNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.vinSerialNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            <Header 
                hideLogo={true}
                rightContent={
                    <div className="flex items-center gap-3">
                        <SearchInput 
                            placeholder="Search vehicle docs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                }
            />
            
            <div className="flex-1 overflow-y-auto p-4 pb-20">
                <div className="max-w-6xl mx-auto space-y-4">
                    {/* Mobile Card List View instead of Table */}
                    {loading ? (
                        <div className="text-center py-12 text-slate-400">
                            <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                            Loading vehicle docs...
                        </div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <Truck className="mx-auto mb-2 text-slate-300" size={32} />
                            No documents found
                        </div>
                    ) : (
                        filteredDocs.map((doc) => (
                            <div 
                                key={doc._id} 
                                onClick={() => handleViewDocs(doc)}
                                className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 active:scale-[0.98] transition-all cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-slate-900 text-lg">{doc.unit}</h3>
                                    <div className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1">
                                        <FileText size={12} />
                                        {doc.documents?.length || 0}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                                    <div>
                                        <span className="text-xs text-slate-400 block uppercase tracking-wider">Unit #</span>
                                        <span className="font-mono font-medium">{doc.unitNumber}</span>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-400 block uppercase tracking-wider">VIN</span>
                                        <span className="font-mono font-medium truncate">{doc.vinSerialNumber}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* View Documents Modal */}
            <Modal 
                isOpen={isViewModalOpen} 
                onClose={() => setIsViewModalOpen(false)} 
                title={selectedVehicle ? `${selectedVehicle.unit} #${selectedVehicle.unitNumber}` : 'Vehicle Documents'}
            >
                <div className="p-4 sm:p-6">
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
                                    <div className="p-2 text-slate-400 group-hover:text-blue-600 transition-colors">
                                        <ExternalLink size={20} />
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
