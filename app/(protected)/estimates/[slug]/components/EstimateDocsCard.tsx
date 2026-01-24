'use client';

import React, { useState } from 'react';
import { FileText, Shield, ChevronRight, Loader2, Download, Layout, FileCheck, Receipt, Plus, Trash2, Calendar, DollarSign, Paperclip, X, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal, Input, Button, ConfirmModal } from '@/components/ui';
import { format } from 'date-fns';

// Google Doc Template IDs
const DOC_TEMPLATES: Record<string, string> = {
    '20 Day Prelim': '1tkVNaR45XBFatu7WSn7LUpmsLS8G5aqy9IO5xtlQcAA',
    'CP - Conditional Release (Progress)': '1HER_h4JAsp-WOB6VGOK8eq9UAr9mib58RcTWt1gwC70',
    'COI - Certificate of Insurance': '',
    'CF - Conditional Release (Final)': '1NXMwX1PAmYFjdzSBwXbPq3jRgFjgUE00zFfpZWrSi5Y',
    'UP - Unconditional Release (Progress)': '1UDSOXcvBirMqQGN1v6Q1lJOBFfO6p2V0r-KRF8OGs-A',
    'UF - Unconditional Release (Final)': '',
    'Mechanics Lien': '',
    'Intent to Lien': '',
    'Fringe Benefit Statement': '',
    'DAS 140': '',
    'Certified Payroll Report': '',
    'PW Docs & PLA Agreement': '',
    'DAS 142': '',
    'Fringe Benefits Report': '',
    'Union Status Letter': '',
    // Add more templates here as needed
};

interface Employee {
    _id: string;
    firstName?: string;
    lastName?: string;
    companyPosition?: string;
    signature?: string;
    [key: string]: any;
}

interface EstimateDocsCardProps {
    className?: string;
    formData?: Record<string, any>;
    employees?: Employee[];
    onUpdate?: (field: string, value: any) => void;
}

export const EstimateDocsCard: React.FC<EstimateDocsCardProps> = ({ className, formData, employees = [], onUpdate }) => {
    const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);
    const [isSignedContractModalOpen, setIsSignedContractModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [newContract, setNewContract] = useState<{ date: string; amount: string; attachments: any[] }>({
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: '',
        attachments: []
    });
    const [selectedViewContract, setSelectedViewContract] = useState<any>(null);
    const [contractIndexToDelete, setContractIndexToDelete] = useState<number | null>(null);

    const prelimDocs = [
        '20 Day Prelim',
        'CP - Conditional Release (Progress)',
        'COI - Certificate of Insurance',
        'CF - Conditional Release (Final)',
        'UP - Unconditional Release (Progress)',
        'UF - Unconditional Release (Final)',
        'Mechanics Lien',
        'Intent to Lien'
    ];

    const certifiedPayrollDocs = [
        'Fringe Benefit Statement',
        'DAS 140',
        'Certified Payroll Report',
        'PW Docs & PLA Agreement',
        'DAS 142',
        'Fringe Benefits Report',
        'Union Status Letter',
        'Proof of DAS 140 & 142 Sent',
        'Checklist of Labor Law Requirements',
        'Certificate of Compliance',
        'DIR Registration',
        'List of Subcontractors',
        'Subcontractor CPR',
        'Authorized Signatory',
        'Skilled & Trained Reporting',
        'Fringe Benefits Proof of Payment'
    ];

    const planningDocs: string[] = [];
    const signedContracts = formData?.signedContracts || [];
    const receiptsAndCostsDocs: string[] = [];

    const handleDocClick = async (docName: string) => {
        const templateId = DOC_TEMPLATES[docName];
        
        if (!templateId) {
            toast.error(`Template not configured for "${docName}"`);
            return;
        }

        if (!formData) {
            toast.error('No estimate data available');
            return;
        }

        setGeneratingDoc(docName);

        try {
            // Build variables from formData
            const variables: Record<string, string> = {
                // Job Info
                jobAddress: formData.jobAddress || '',
                projectDescription: formData.projectDescription || '',
                prelimAmount: formData.prelimAmount || '',
                date: formData.date || new Date().toLocaleDateString(),
                
                // Property Owner / Public Agency
                poName: formData.poName || '',
                PoAddress: formData.PoAddress || '',
                PoPhone: formData.PoPhone || '',
                
                // Original Contractor
                ocName: formData.ocName || '',
                ocAddress: formData.ocAddress || '',
                ocPhone: formData.ocPhone || '',
                
                // Sub-Contractor
                subCName: formData.subCName || '',
                subCAddress: formData.subCAddress || '',
                subCPhone: formData.subCPhone || '',
                
                // Lending Institution
                liName: formData.liName || '',
                liAddress: formData.liAddress || '',
                liPhone: formData.liPhone || '',
                
                // Surety Company
                scName: formData.scName || '',
                scAddress: formData.scAddress || '',
                scPhone: formData.scPhone || '',
                bondNumber: formData.bondNumber || '',
                
                // Fringe Benefits Trust
                fbName: formData.fbName || '',
                fbAddress: formData.fbAddress || '',
                
                // Certified Payroll
                certifiedPayroll: formData.certifiedPayroll || '',
                
                // Customer Info
                customerName: formData.customerName || '',
                contactName: formData.contactName || '',
                contactEmail: formData.contactEmail || '',
                contactPhone: formData.contactPhone || '',
                
                // Project
                projectName: formData.projectName || '',
                estimate: formData.estimate || '',
                usaNumber: formData.usaNumber || '',
                
                // Get proposalWriter employee details
                createdBy: (() => {
                    const proposalWriterEmail = formData.proposalWriter;
                    if (proposalWriterEmail && employees.length > 0) {
                        const emp = employees.find(e => e._id === proposalWriterEmail);
                        if (emp) {
                            return `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
                        }
                    }
                    return formData.proposalWriter || '';
                })(),
                position: (() => {
                    const proposalWriterEmail = formData.proposalWriter;
                    if (proposalWriterEmail && employees.length > 0) {
                        const emp = employees.find(e => e._id === proposalWriterEmail);
                        return emp?.companyPosition || '';
                    }
                    return '';
                })(),
                signature: (() => {
                    const proposalWriterEmail = formData.proposalWriter;
                    if (proposalWriterEmail && employees.length > 0) {
                        const emp = employees.find(e => e._id === proposalWriterEmail);
                        return emp?.signature || '';
                    }
                    return '';
                })(),
            };

            const response = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate PDF');
            }

            // Download the PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${docName.replace(/\s+/g, '_')}_${formData.estimate || 'doc'}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            toast.success(`${docName} downloaded successfully!`);
        } catch (error: any) {
            console.error('PDF Generation Error:', error);
            toast.error(error.message || 'Failed to generate PDF');
        } finally {
            setGeneratingDoc(null);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const uploadedAttachments = [...newContract.attachments];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve) => {
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.readAsDataURL(file);
                });
                const base64 = await base64Promise;

                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'uploadRawToCloudinary',
                        payload: {
                            file: base64,
                            fileName: `contract_${Date.now()}_${file.name}`,
                            contentType: file.type
                        }
                    })
                });

                const data = await res.json();

                if (data.success && data.result) {
                    uploadedAttachments.push({
                        name: file.name,
                        url: data.result.url,
                        thumbnailUrl: data.result.thumbnailUrl,
                        type: file.type
                    });
                } else {
                    toast.error(`Failed to upload ${file.name}`);
                }
            } catch (err) {
                console.error('Upload Error:', err);
                toast.error(`Error uploading ${file.name}`);
            }
        }

        setNewContract(prev => ({ ...prev, attachments: uploadedAttachments }));
        setIsUploading(false);
    };

    const handleAddContract = () => {
        if (!onUpdate) return;
        const updatedContracts = [...signedContracts, {
            ...newContract,
            amount: parseFloat(newContract.amount) || 0
        }];
        onUpdate('signedContracts', updatedContracts);
        setIsSignedContractModalOpen(false);
        setNewContract({
            date: format(new Date(), 'yyyy-MM-dd'),
            amount: '',
            attachments: []
        });
        toast.success('Signed contract added');
    };

    const handleRemoveContract = (idx: number) => {
        setContractIndexToDelete(idx);
    };

    const confirmRemoveContract = async () => {
        if (!onUpdate || contractIndexToDelete === null) return;
        
        const contractToDelete = signedContracts[contractIndexToDelete];
        const urlsToDelete = contractToDelete.attachments?.map((a: any) => a.url).filter(Boolean) || [];

        if (urlsToDelete.length > 0) {
            try {
                await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'deleteCloudinaryFiles',
                        payload: { urls: urlsToDelete }
                    })
                });
            } catch (err) {
                console.error('Error deleting files from Cloudinary:', err);
            }
        }

        const updatedContracts = signedContracts.filter((_: any, i: number) => i !== contractIndexToDelete);
        onUpdate('signedContracts', updatedContracts);
        setContractIndexToDelete(null);
        toast.success('Contract removed');
    };

    return (
        <div className={`bg-[#eef2f6] rounded-[40px] p-4 ${className || ''}`}>


            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {/* Column 1: Prelims */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md">
                            <FileText className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-[#0F4C75]">Prelims</h4>
                        <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                            {prelimDocs.length}
                        </span>
                    </div>
                    
                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-full max-h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {prelimDocs.length > 0 ? prelimDocs.map((docName, idx) => (
                                <DocCard 
                                    key={idx} 
                                    label={docName}
                                    isLoading={generatingDoc === docName}
                                    hasTemplate={!!DOC_TEMPLATES[docName]}
                                    onClick={() => handleDocClick(docName)}
                                />
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No documents</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 2: Certified Payroll */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-md">
                            <Shield className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-emerald-700">Certified Payroll</h4>
                        <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
                            {certifiedPayrollDocs.length}
                        </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-full max-h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {certifiedPayrollDocs.length > 0 ? certifiedPayrollDocs.map((docName, idx) => (
                                <DocCard 
                                    key={idx} 
                                    label={docName}
                                    isPayroll={true}
                                    isLoading={generatingDoc === docName}
                                    hasTemplate={!!DOC_TEMPLATES[docName]}
                                    onClick={() => handleDocClick(docName)}
                                />
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No documents</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 3: Planning */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white flex items-center justify-center shadow-md">
                            <Layout className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-violet-700">Planning</h4>
                        <span className="text-[10px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-bold">
                            {planningDocs.length}
                        </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-full max-h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {planningDocs.length > 0 ? planningDocs.map((docName, idx) => (
                                <DocCard 
                                    key={idx} 
                                    label={docName}
                                    isLoading={generatingDoc === docName}
                                    hasTemplate={!!DOC_TEMPLATES[docName]}
                                    onClick={() => handleDocClick(docName)}
                                />
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No documents</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 4: Signed Contracts */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md">
                            <FileCheck className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-amber-700">Signed Contracts</h4>
                        <span className="text-[10px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold">
                            {signedContracts.length}
                        </span>
                        <button 
                            onClick={() => setIsSignedContractModalOpen(true)}
                            className="ml-auto p-1.5 bg-amber-100 text-amber-600 rounded-lg hover:bg-amber-200 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-full max-h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {signedContracts.length > 0 ? signedContracts.map((contract: any, idx: number) => (
                                <div 
                                    key={idx}
                                    onClick={() => setSelectedViewContract(contract)}
                                    className="bg-white/60 p-3 rounded-xl border border-white/40 shadow-sm relative group cursor-pointer hover:bg-white/80 hover:shadow-md transition-all duration-300"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {(() => {
                                                    try {
                                                        const d = contract.date?.includes('-') ? new Date(contract.date + 'T00:00:00') : new Date(contract.date);
                                                        return format(d, 'MM/dd/yyyy');
                                                    } catch (e) {
                                                        return contract.date || '-';
                                                    }
                                                })()}
                                            </p>
                                            <p className="text-sm font-black text-slate-800">
                                                ${(contract.amount || 0).toLocaleString()}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveContract(idx);
                                            }}
                                            className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    
                                    {contract.attachments && contract.attachments.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {contract.attachments.slice(0, 4).map((file: any, fIdx: number) => (
                                                <div 
                                                    key={fIdx}
                                                    className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200"
                                                >
                                                    {file.type.startsWith('image/') ? (
                                                        <ImageIcon className="w-4 h-4 text-amber-600" />
                                                    ) : (
                                                        <Paperclip className="w-4 h-4 text-amber-600" />
                                                    )}
                                                </div>
                                            ))}
                                            {contract.attachments.length > 4 && (
                                                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center border border-amber-200 text-[10px] font-bold text-amber-600">
                                                    +{contract.attachments.length - 4}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No contracts</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 5: Receipts & Costs */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 text-white flex items-center justify-center shadow-md">
                            <Receipt className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-pink-700">Receipts & Costs</h4>
                        <span className="text-[10px] bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full font-bold">
                            {receiptsAndCostsDocs.length}
                        </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-full max-h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {receiptsAndCostsDocs.length > 0 ? receiptsAndCostsDocs.map((docName, idx) => (
                                <DocCard 
                                    key={idx} 
                                    label={docName}
                                    isLoading={generatingDoc === docName}
                                    hasTemplate={!!DOC_TEMPLATES[docName]}
                                    onClick={() => handleDocClick(docName)}
                                />
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No documents</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Signed Contract Modal */}
            <Modal
                isOpen={isSignedContractModalOpen}
                onClose={() => setIsSignedContractModalOpen(false)}
                title="Add Signed Contract"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setIsSignedContractModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddContract} disabled={!newContract.date || !newContract.amount}>Add Contract</Button>
                    </div>
                }
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date</label>
                            <Input 
                                type="date"
                                value={newContract.date}
                                onChange={e => setNewContract(prev => ({ ...prev, date: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Amount ($)</label>
                            <Input 
                                type="number"
                                placeholder="0.00"
                                value={newContract.amount}
                                onChange={e => setNewContract(prev => ({ ...prev, amount: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Attachments</label>
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3 transition-colors hover:bg-slate-50 hover:border-slate-300 relative">
                            <input 
                                type="file" 
                                multiple 
                                onChange={handleFileUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                disabled={isUploading}
                            />
                            {isUploading ? (
                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            ) : (
                                <Paperclip className="w-8 h-8 text-slate-300" />
                            )}
                            <div className="text-center">
                                <p className="text-sm font-bold text-slate-600">Click to upload or drag and drop</p>
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Images or Documents</p>
                            </div>
                        </div>

                        {newContract.attachments.length > 0 && (
                            <div className="grid grid-cols-1 gap-2 mt-4">
                                {newContract.attachments.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            {file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-blue-500" />}
                                            <span className="text-xs font-bold text-slate-600 truncate max-w-[200px]">{file.name}</span>
                                        </div>
                                        <button 
                                            onClick={() => setNewContract(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))}
                                            className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Contract Detail View Modal */}
            <Modal
                isOpen={!!selectedViewContract}
                onClose={() => setSelectedViewContract(null)}
                title="Contract Details"
            >
                {selectedViewContract && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-end bg-[#F4F7FA] p-6 rounded-[32px] border border-white/60 shadow-inner">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">Contract Date</label>
                                <p className="text-2xl font-black text-[#0F4C75]">
                                    {(() => {
                                        try {
                                            const d = selectedViewContract.date?.includes('-') ? new Date(selectedViewContract.date + 'T00:00:00') : new Date(selectedViewContract.date);
                                            return format(d, 'MM/dd/yyyy');
                                        } catch (e) {
                                            return selectedViewContract.date;
                                        }
                                    })()}
                                </p>
                            </div>
                            <div className="text-right">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">Total Amount</label>
                                <p className="text-3xl font-black text-emerald-600">
                                    ${(selectedViewContract.amount || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 block">Project Files & Images</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {selectedViewContract.attachments?.map((file: any, idx: number) => (
                                    <a 
                                        key={idx}
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group relative flex flex-col items-center gap-3 p-4 bg-white rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-amber-200 transition-all duration-300 overflow-hidden"
                                    >
                                        <div className="w-full aspect-square rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-50 relative">
                                            {file.thumbnailUrl ? (
                                                <div className="relative w-full h-full flex items-center justify-center p-2">
                                                    <img 
                                                        src={file.thumbnailUrl} 
                                                        alt={file.name}
                                                        className="w-full h-full object-contain transition-all duration-500 group-hover:scale-105"
                                                        onError={(e) => {
                                                            const img = e.target as HTMLImageElement;
                                                            img.style.display = 'none';
                                                            const fallback = img.nextElementSibling as HTMLElement;
                                                            if (fallback) fallback.classList.remove('hidden');
                                                        }}
                                                    />
                                                    <div className="hidden flex-col items-center gap-2">
                                                        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-1">
                                                            <FileText className="w-6 h-6 text-amber-600" />
                                                        </div>
                                                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest bg-amber-100/50 px-2 py-0.5 rounded-full">
                                                            {file.name?.split('.').pop() || 'FILE'}
                                                        </span>
                                                    </div>
                                                    {!file.type.startsWith('image/') && (
                                                        <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-black text-[#0F4C75] border border-slate-100 uppercase tracking-tighter">
                                                            {file.name?.split('.').pop()}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-1">
                                                        <FileText className="w-6 h-6 text-amber-600" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest bg-amber-100/50 px-2 py-0.5 rounded-full">
                                                        {file.name?.split('.').pop() || 'FILE'}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                                        </div>
                                        <div className="text-center w-full">
                                            <p className="text-xs font-bold text-slate-600 truncate px-1">{file.name}</p>
                                        </div>
                                        <div className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                                            <Download className="w-3.5 h-3.5 text-[#0F4C75]" />
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmModal
                isOpen={contractIndexToDelete !== null}
                onClose={() => setContractIndexToDelete(null)}
                onConfirm={confirmRemoveContract}
                title="Remove Contract"
                message="Are you sure you want to remove this signed contract? This action cannot be undone."
                confirmText="Remove"
                variant="danger"
            />
        </div>
    );
};

interface DocCardProps {
    label: string;
    isPayroll?: boolean;
    isLoading?: boolean;
    hasTemplate?: boolean;
    onClick?: () => void;
}

const DocCard: React.FC<DocCardProps> = ({ label, isPayroll, isLoading, hasTemplate, onClick }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
            className={`
                group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-300
                ${isLoading 
                    ? 'bg-blue-50 shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff]'
                    : isHovered 
                        ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff]' 
                        : 'bg-white/60 shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff]'
                }
            `}
        >
            {/* Content */}
            <p className={`flex-1 text-xs font-bold leading-snug transition-colors ${isHovered || isLoading ? 'text-[#0F4C75]' : 'text-slate-600'}`}>
                {label}
            </p>

            {/* Status Icon */}
            {isLoading ? (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
            ) : hasTemplate ? (
                <Download className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${isHovered ? 'text-[#0F4C75]' : 'text-slate-300'}`} />
            ) : (
                <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${isHovered ? 'text-[#0F4C75] translate-x-1' : 'text-slate-300'}`} />
            )}
        </div>
    );
};
