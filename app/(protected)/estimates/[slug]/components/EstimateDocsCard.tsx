'use client';

import React, { useState, useMemo } from 'react';
import { FileText, Shield, ChevronRight, Loader2, Download, Layout, FileCheck, Receipt, Plus, Trash2, Calendar, DollarSign, Paperclip, X, Image as ImageIcon, Check, Pencil, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal, Input, Button, ConfirmModal, MyDropDown, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';
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
    const receiptsAndCosts = formData?.receiptsAndCosts || [];

    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [isReceiptDetailsModalOpen, setIsReceiptDetailsModalOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
    const [isReceiptUploading, setIsReceiptUploading] = useState(false);
    const [receiptToDelete, setReceiptToDelete] = useState<number | null>(null);
    const [editingReceiptIndex, setEditingReceiptIndex] = useState<number | null>(null);

    const [newReceipt, setNewReceipt] = useState({
        type: 'Receipt' as 'Invoice' | 'Receipt',
        vendor: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        dueDate: '',
        remarks: '',
        tag: [] as string[],
        approvalStatus: 'Not Approved' as 'Approved' | 'Not Approved',
        status: '' as 'Devco Paid' | '',
        paidBy: '',
        paymentDate: '',
        upload: [] as any[],
        createdBy: ''
    });

    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
    const [paymentContext, setPaymentContext] = useState<{ index: number | 'new', data: any } | null>(null);
    const [paymentDetails, setPaymentDetails] = useState({
        paidBy: '',
        paymentDate: format(new Date(), 'yyyy-MM-dd')
    });

    const getEmployeeData = (idOrEmail: string) => {
        if (!idOrEmail) return null;
        const lower = idOrEmail.toLowerCase();
        const found = employees.find(e => 
            String(e._id || '').toLowerCase() === lower || 
            String(e.email || '').toLowerCase() === lower ||
            String(e.value || '').toLowerCase() === lower
        );
        if (!found) return null;

        return {
            ...found,
            label: found.label || (found.firstName ? `${found.firstName} ${found.lastName || ''}`.trim() : idOrEmail),
            image: found.image || found.profilePicture
        };
    };

    const employeeOptions = useMemo(() => {
        return employees.map(emp => {
            const label = emp.label || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email || emp._id;
            return {
                id: emp._id,
                label: label,
                value: emp.email || emp._id || emp.value,
                profilePicture: emp.image || emp.profilePicture
            };
        }).sort((a, b) => a.label.localeCompare(b.label));
    }, [employees]);

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

    const handleReceiptFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsReceiptUploading(true);
        const uploadedAttachments = [...newReceipt.upload];

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
                            fileName: `receipt_${Date.now()}_${file.name}`,
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
                }
            } catch (err) {
                console.error('Upload Error:', err);
            }
        }

        setNewReceipt(prev => ({ ...prev, upload: uploadedAttachments }));
        setIsReceiptUploading(false);
    };

    const handleAddReceipt = () => {
        setEditingReceiptIndex(null);
        setNewReceipt({
            type: 'Receipt',
            vendor: '',
            amount: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            dueDate: '',
            remarks: '',
            tag: [],
            approvalStatus: 'Not Approved',
            status: '',
            paidBy: '',
            paymentDate: format(new Date(), 'yyyy-MM-dd'),
            upload: [],
            createdBy: ''
        });
        setIsReceiptModalOpen(true);
    };

    const handleSaveReceipt = () => {
        if (!onUpdate) return;
        
        let updated;
        if (editingReceiptIndex !== null) {
            // Update mode
            updated = receiptsAndCosts.map((item: any, idx: number) => 
                idx === editingReceiptIndex 
                    ? { ...item, ...newReceipt, amount: parseFloat(newReceipt.amount) || 0 }
                    : item
            );
        } else {
            // Add mode
            const receiptEntry = {
                ...newReceipt,
                _id: Math.random().toString(36).substr(2, 9),
                amount: parseFloat(newReceipt.amount) || 0,
                createdAt: new Date(),
                createdBy: formData?.proposalWriter || ''
            };
            updated = [...receiptsAndCosts, receiptEntry];
        }

        onUpdate('receiptsAndCosts', updated);
        setIsReceiptModalOpen(false);
        setEditingReceiptIndex(null);
        setNewReceipt({
            type: 'Receipt',
            vendor: '',
            amount: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            dueDate: '',
            remarks: '',
            tag: [],
            approvalStatus: 'Not Approved',
            status: '',
            paidBy: '',
            paymentDate: '',
            upload: [],
            createdBy: ''
        });
        toast.success(editingReceiptIndex !== null ? 'Receipt updated' : 'Receipt added');
    };

    const handleEditReceipt = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const receipt = receiptsAndCosts[index];
        setEditingReceiptIndex(index);
        setNewReceipt({
            type: receipt.type || 'Receipt',
            vendor: receipt.vendor || '',
            amount: String(receipt.amount || ''),
            date: receipt.date || format(new Date(), 'yyyy-MM-dd'),
            dueDate: receipt.dueDate || '',
            remarks: receipt.remarks || '',
            tag: receipt.tag || [],
            approvalStatus: receipt.approvalStatus || 'Not Approved',
            status: receipt.status || '',
            paidBy: receipt.paidBy || '',
            paymentDate: receipt.paymentDate || '',
            upload: receipt.upload || [],
            createdBy: receipt.createdBy || ''
        });
        setIsReceiptModalOpen(true);
    };

    const confirmRemoveReceipt = () => {
        if (!onUpdate || receiptToDelete === null) return;
        const updated = receiptsAndCosts.filter((_: any, i: number) => i !== receiptToDelete);
        onUpdate('receiptsAndCosts', updated);
        setReceiptToDelete(null);
        toast.success('Receipt removed');
    };

    const handleUpdateReceiptStatus = (index: number, field: string, value: string) => {
        if (!onUpdate) return;
        
        if (field === 'status' && value === 'Devco Paid') {
            setPaymentContext({ index, data: receiptsAndCosts[index] });
            setPaymentDetails({
                paidBy: receiptsAndCosts[index].paidBy || '',
                paymentDate: receiptsAndCosts[index].paymentDate || format(new Date(), 'yyyy-MM-dd')
            });
            setIsPaymentModalOpen(true);
            return;
        }

        const updated = receiptsAndCosts.map((r: any, i: number) => 
            i === index ? { ...r, [field]: value } : r
        );
        onUpdate('receiptsAndCosts', updated);
        if (selectedReceipt && receiptsAndCosts[index]._id === selectedReceipt._id) {
            setSelectedReceipt({ ...selectedReceipt, [field]: value });
        }
    };

    const handleConfirmPaymentDetails = () => {
        if (!onUpdate || !paymentContext) return;

        if (paymentContext.index === 'new') {
            setNewReceipt(prev => ({
                ...prev,
                status: 'Devco Paid',
                paidBy: paymentDetails.paidBy,
                paymentDate: paymentDetails.paymentDate
            }));
        } else {
            const index = paymentContext.index;
            const updated = receiptsAndCosts.map((r: any, i: number) => 
                i === index ? { 
                    ...r, 
                    status: 'Devco Paid',
                    paidBy: paymentDetails.paidBy,
                    paymentDate: paymentDetails.paymentDate
                } : r
            );
            onUpdate('receiptsAndCosts', updated);
            if (selectedReceipt && receiptsAndCosts[index]._id === selectedReceipt._id) {
                setSelectedReceipt({ 
                    ...selectedReceipt, 
                    status: 'Devco Paid',
                    paidBy: paymentDetails.paidBy,
                    paymentDate: paymentDetails.paymentDate
                });
            }
        }

        setIsPaymentModalOpen(false);
        setPaymentContext(null);
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
                            {receiptsAndCosts.length}
                        </span>
                        <button 
                            onClick={handleAddReceipt}
                            className="ml-auto p-1.5 bg-pink-100 text-pink-600 rounded-lg hover:bg-pink-200 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-white/50 p-2 rounded-xl border border-white/40 shadow-sm">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Receipts</p>
                            <p className="text-xs font-black text-pink-600">
                                ${receiptsAndCosts.filter((r: any) => r.type === 'Receipt').reduce((sum: number, r: any) => sum + (r.amount || 0), 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-white/50 p-2 rounded-xl border border-white/40 shadow-sm">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Invoices</p>
                            <p className="text-xs font-black text-indigo-600">
                                ${receiptsAndCosts.filter((r: any) => r.type === 'Invoice').reduce((sum: number, r: any) => sum + (r.amount || 0), 0).toLocaleString()}
                            </p>
                        </div>
                        <div className="bg-[#0F4C75] p-2 rounded-xl shadow-md">
                            <p className="text-[8px] font-black text-white/60 uppercase tracking-tighter">Total</p>
                            <p className="text-xs font-black text-white">
                                ${receiptsAndCosts.reduce((sum: number, r: any) => sum + (r.amount || 0), 0).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-full max-h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {receiptsAndCosts.length > 0 ? [...receiptsAndCosts]
                                .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                                .map((item: any) => {
                                    const originalIdx = receiptsAndCosts.findIndex((r: any) => r._id === item._id);
                                    return (
                                        <div 
                                            key={item._id || originalIdx}
                                            onClick={() => setSelectedReceipt(item)}
                                            className="bg-white/60 p-3 rounded-xl border border-white/40 shadow-sm relative group cursor-pointer hover:bg-white/80 hover:shadow-md transition-all duration-300"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-col gap-1 mb-1.5">
                                                        <span className={`w-fit text-[8px] font-black uppercase tracking-tighter px-1 rounded ${item.type === 'Invoice' ? 'bg-indigo-100 text-indigo-600' : 'bg-pink-100 text-pink-600'}`}>
                                                            {item.type}
                                                        </span>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                                                            {item.vendor || 'Unknown Vendor'}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-black text-slate-800">
                                                            ${(item.amount || 0).toLocaleString()}
                                                        </p>
                                                        {item.upload?.length > 0 && (
                                                            <span className="flex items-center gap-0.5 text-[8px] font-bold text-slate-400">
                                                                <Paperclip className="w-2 h-2" />
                                                                {item.upload.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={(e) => handleEditReceipt(originalIdx, e)}
                                                        className="p-1 text-slate-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setReceiptToDelete(originalIdx);
                                                        }}
                                                        className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                    
                                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full border ${item.approvalStatus === 'Approved' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                            {item.approvalStatus || 'Not Approved'}
                                        </span>
                                        {item.status === 'Devco Paid' && (
                                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                Devco Paid
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/50">
                                        <span className="text-[10px] text-slate-400 font-bold">{item.date}</span>
                                        <div className="flex items-center gap-2">
                                            {/* Creator & Tags */}
                                            <div className="flex -space-x-1.5">
                                                <TooltipProvider>
                                                    {/* Creator */}
                                                    {(() => {
                                                        const creator = getEmployeeData(item.createdBy);
                                                        return (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="w-5 h-5 rounded-full border border-white bg-slate-100 flex items-center justify-center text-[7px] font-bold text-slate-500 shadow-sm overflow-hidden">
                                                                        {creator?.image ? <img src={creator.image} className="w-full h-full object-cover" /> : (item.createdBy?.[0]?.toUpperCase() || 'U')}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>Created By: {creator?.label || item.createdBy}</p></TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })()}

                                                    {/* Tags */}
                                                    {(item.tag || []).slice(0, 2).map((tagMail: string, i: number) => {
                                                        const tagEmp = getEmployeeData(tagMail);
                                                        return (
                                                            <Tooltip key={i}>
                                                                <TooltipTrigger asChild>
                                                                    <div className="w-5 h-5 rounded-full border border-white bg-[#0F4C75] flex items-center justify-center text-[7px] font-bold text-white shadow-sm overflow-hidden">
                                                                        {tagEmp?.image ? <img src={tagEmp.image} className="w-full h-full object-cover" /> : (tagMail?.[0]?.toUpperCase() || 'T')}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>Tagged: {tagEmp?.label || tagMail}</p></TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })}
                                                    {(item.tag || []).length > 2 && (
                                                        <div className="w-5 h-5 rounded-full border border-white bg-slate-50 flex items-center justify-center text-[7px] font-bold text-slate-400 shadow-sm">
                                                            +{(item.tag || []).length - 2}
                                                        </div>
                                                    )}
                                                </TooltipProvider>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No records</p>
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

            {/* Add Receipt & Cost Modal */}
            <Modal
                isOpen={isReceiptModalOpen}
                onClose={() => {
                    setIsReceiptModalOpen(false);
                    setEditingReceiptIndex(null);
                }}
                title={editingReceiptIndex !== null ? "Edit Receipt / Cost" : "Add Receipt / Cost"}
                maxWidth="2xl"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setIsReceiptModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveReceipt} disabled={!newReceipt.vendor || !newReceipt.amount}>Save Entry</Button>
                    </div>
                }
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Type</label>
                                <select 
                                    value={newReceipt.type}
                                    onChange={e => setNewReceipt(prev => ({ ...prev, type: e.target.value as any }))}
                                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="Receipt">Receipt</option>
                                    <option value="Invoice">Invoice</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Amount ($)</label>
                                <Input 
                                    type="number"
                                    placeholder="0.00"
                                    value={newReceipt.amount}
                                    onChange={e => setNewReceipt(prev => ({ ...prev, amount: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Vendor</label>
                            <Input 
                                placeholder="Vendor Name"
                                value={newReceipt.vendor}
                                onChange={e => setNewReceipt(prev => ({ ...prev, vendor: e.target.value }))}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date</label>
                                <Input 
                                    type="date"
                                    value={newReceipt.date}
                                    onChange={e => setNewReceipt(prev => ({ ...prev, date: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Due Date</label>
                                <Input 
                                    type="date"
                                    value={newReceipt.dueDate}
                                    onChange={e => setNewReceipt(prev => ({ ...prev, dueDate: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Remarks</label>
                            <textarea 
                                className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20"
                                placeholder="..."
                                value={newReceipt.remarks}
                                onChange={e => setNewReceipt(prev => ({ ...prev, remarks: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Tags (Team Members)</label>
                            <div className="relative">
                                <button
                                    id="tag-dropdown-anchor"
                                    onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-100 transition-all outline-none"
                                >
                                    <span className="text-slate-400">Tag team members...</span>
                                    <Plus className={`w-4 h-4 transition-transform ${isTagDropdownOpen ? 'rotate-45' : ''}`} />
                                </button>
                                <MyDropDown 
                                    isOpen={isTagDropdownOpen}
                                    onClose={() => setIsTagDropdownOpen(false)}
                                    anchorId="tag-dropdown-anchor"
                                    options={employeeOptions}
                                    selectedValues={newReceipt.tag}
                                    onSelect={(val: string) => {
                                        setNewReceipt(prev => ({
                                            ...prev,
                                            tag: prev.tag.includes(val) 
                                                ? prev.tag.filter(t => t !== val)
                                                : [...prev.tag, val]
                                        }));
                                    }}
                                    multiSelect
                                    width="w-full"
                                />
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {(newReceipt.tag || []).map(t => {
                                        const emp = getEmployeeData(t);
                                        return (
                                            <span key={t} className="text-[10px] font-black bg-white text-[#0F4C75] pl-1 pr-2.5 py-1 rounded-full flex items-center gap-2 border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-200">
                                                <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-100 flex items-center justify-center bg-slate-50">
                                                    {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-slate-400" />}
                                                </div>
                                                {emp?.label || t}
                                                <X 
                                                    className="w-3 h-3 cursor-pointer hover:text-red-500 transition-colors ml-1" 
                                                    onClick={() => setNewReceipt(prev => ({ ...prev, tag: prev.tag.filter(tag => tag !== t) }))} 
                                                />
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Attachments</label>
                            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3 transition-colors hover:bg-slate-50 hover:border-slate-300 relative h-40">
                                <input 
                                    type="file" 
                                    multiple 
                                    onChange={handleReceiptFileUpload}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    disabled={isReceiptUploading}
                                />
                                {isReceiptUploading ? (
                                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                ) : (
                                    <Paperclip className="w-8 h-8 text-slate-300" />
                                )}
                                <div className="text-center">
                                    <p className="text-sm font-bold text-slate-600">Upload Files</p>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Receipts/Invoices</p>
                                </div>
                            </div>
                            {newReceipt.upload.length > 0 && (
                                <div className="grid grid-cols-1 gap-2 mt-2">
                                    {newReceipt.upload.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {file.type?.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> : <FileText className="w-3.5 h-3.5 text-blue-500" />}
                                                <span className="text-[10px] font-bold text-slate-600 truncate">{file.name}</span>
                                            </div>
                                            <button 
                                                onClick={() => setNewReceipt(prev => ({ ...prev, upload: prev.upload.filter((_, i) => i !== idx) }))}
                                                className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Devco Paid</label>
                                <div 
                                    onClick={() => {
                                        if (newReceipt.status === 'Devco Paid') {
                                            setNewReceipt(prev => ({ ...prev, status: '', paidBy: '', paymentDate: '' }));
                                        } else {
                                            setPaymentContext({ index: 'new', data: newReceipt });
                                            setPaymentDetails({
                                                paidBy: '',
                                                paymentDate: format(new Date(), 'yyyy-MM-dd')
                                            });
                                            setIsPaymentModalOpen(true);
                                        }
                                    }}
                                    className={`w-full flex items-center gap-2 border rounded-xl px-4 py-2 text-xs font-bold cursor-pointer transition-all ${newReceipt.status === 'Devco Paid' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${newReceipt.status === 'Devco Paid' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'}`}>
                                        {newReceipt.status === 'Devco Paid' && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    Devco Paid
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Approval</label>
                                <select 
                                    value={newReceipt.approvalStatus}
                                    onChange={e => setNewReceipt(prev => ({ ...prev, approvalStatus: e.target.value as any }))}
                                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="Not Approved">Not Approved</option>
                                    <option value="Approved">Approved</option>
                                </select>
                            </div>
                        </div>

                        {editingReceiptIndex !== null && (
                            <div className="flex items-center gap-2 px-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Created By:</label>
                                {(() => {
                                    const creator = getEmployeeData(newReceipt.createdBy);
                                    return (
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                                {creator?.image ? <img src={creator.image} className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-slate-400" />}
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-600">{creator?.label || newReceipt.createdBy}</span>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Receipt Details Modal */}
            <Modal
                isOpen={!!selectedReceipt}
                onClose={() => setSelectedReceipt(null)}
                title="Receipt / Cost Details"
                maxWidth="3xl"
            >
                {selectedReceipt && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                            <div>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-1 inline-block ${selectedReceipt.type === 'Invoice' ? 'bg-indigo-100 text-indigo-600' : 'bg-pink-100 text-pink-600'}`}>
                                    {selectedReceipt.type}
                                </span>
                                <h3 className="text-2xl font-black text-slate-900">{selectedReceipt.vendor}</h3>
                                <p className="text-sm font-bold text-slate-400">{selectedReceipt.date}</p>
                            </div>
                            <div className="text-right">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Amount</label>
                                <div className="flex items-center justify-end gap-1.5 text-3xl font-black text-blue-600">
                                    <DollarSign className="w-6 h-6" />
                                    <span>{(selectedReceipt.amount || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Status</label>
                                <div className="flex flex-col gap-2">
                                    <div 
                                        onClick={() => handleUpdateReceiptStatus(receiptsAndCosts.indexOf(selectedReceipt), 'status', selectedReceipt.status === 'Devco Paid' ? '' : 'Devco Paid')}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase cursor-pointer transition-all ${selectedReceipt.status === 'Devco Paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}
                                    >
                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${selectedReceipt.status === 'Devco Paid' ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                                            {selectedReceipt.status === 'Devco Paid' && <Check className="w-2.5 h-2.5 text-white" />}
                                        </div>
                                        Devco Paid
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Approval</label>
                                <div className="flex flex-col gap-2">
                                    <select 
                                        value={selectedReceipt.approvalStatus}
                                        onChange={(e) => handleUpdateReceiptStatus(receiptsAndCosts.indexOf(selectedReceipt), 'approvalStatus', e.target.value)}
                                        className="bg-transparent font-black text-slate-900 outline-none cursor-pointer hover:text-blue-600 transition-colors"
                                    >
                                        <option value="Not Approved">Not Approved</option>
                                        <option value="Approved">Approved</option>
                                    </select>
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full w-max ${selectedReceipt.approvalStatus === 'Approved' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                                        {selectedReceipt.approvalStatus}
                                    </span>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Due Date</label>
                                <p className="font-black text-slate-900">{selectedReceipt.dueDate || '-'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-white/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Metadata</label>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-500">Created By</span>
                                        {(() => {
                                            const creator = getEmployeeData(selectedReceipt.createdBy);
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-slate-900">{creator?.label || selectedReceipt.createdBy}</span>
                                                    <div className="w-6 h-6 rounded-full border border-white bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                                                        {creator?.image ? <img src={creator.image} className="w-full h-full object-cover" /> : <User className="w-3.5 h-3.5 text-slate-400" />}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex items-start justify-between">
                                        <span className="text-[10px] font-bold text-slate-500 mt-1">Tagged Members</span>
                                        <div className="flex flex-wrap justify-end gap-1.5 max-w-[70%]">
                                            {(selectedReceipt.tag || []).length > 0 ? selectedReceipt.tag.map((tagMail: string, i: number) => {
                                                const tagEmp = getEmployeeData(tagMail);
                                                return (
                                                    <div key={i} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-full border border-slate-100 shadow-sm">
                                                        <div className="w-4 h-4 rounded-full border border-blue-50 bg-[#0F4C75] flex items-center justify-center overflow-hidden">
                                                            {tagEmp?.image ? <img src={tagEmp.image} className="w-full h-full object-cover" /> : <User className="w-2.5 h-2.5 text-white/70" />}
                                                        </div>
                                                        <span className="text-[9px] font-black text-slate-700">{tagEmp?.label || tagMail}</span>
                                                    </div>
                                                );
                                            }) : <span className="text-[10px] font-bold text-slate-300">None</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {selectedReceipt.status === 'Devco Paid' && (
                                <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100/50 shadow-sm">
                                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 block">Payment Information</label>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-emerald-600/70">Paid By</span>
                                            {(() => {
                                                const payee = getEmployeeData(selectedReceipt.paidBy);
                                                return (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black text-slate-900">{payee?.label || selectedReceipt.paidBy}</span>
                                                        <div className="w-6 h-6 rounded-full border border-white bg-emerald-100 flex items-center justify-center overflow-hidden shadow-sm">
                                                            {payee?.image ? <img src={payee.image} className="w-full h-full object-cover" /> : <User className="w-3.5 h-3.5 text-emerald-600" />}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-emerald-600/70">Payment Date</span>
                                            <p className="text-[10px] font-black text-slate-900">{selectedReceipt.paymentDate || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {selectedReceipt.remarks && (
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Remarks</label>
                                <p className="text-sm text-slate-600 font-medium leading-relaxed">{selectedReceipt.remarks}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 block">Attachments ({selectedReceipt.upload?.length || 0})</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {selectedReceipt.upload?.map((file: any, idx: number) => (
                                    <a 
                                        key={idx}
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group relative flex flex-col items-center gap-3 p-4 bg-white rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-pink-200 transition-all duration-300 overflow-hidden"
                                    >
                                        <div className="w-full aspect-square rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-50 relative">
                                            {file.thumbnailUrl ? (
                                                <img 
                                                    src={file.thumbnailUrl} 
                                                    alt={file.name}
                                                    className="w-full h-full object-contain transition-all duration-500 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center mb-1">
                                                        <FileText className="w-6 h-6 text-pink-600" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-center w-full">
                                            <p className="text-xs font-bold text-slate-600 truncate px-1">{file.name}</p>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmModal
                isOpen={receiptToDelete !== null}
                onClose={() => setReceiptToDelete(null)}
                onConfirm={confirmRemoveReceipt}
                title="Remove Receipt Entry"
                message="Are you sure you want to remove this receipt/cost record? This cannot be undone."
                confirmText="Remove"
                variant="danger"
            />

            {/* Payment Details Modal */}
            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                title="Payment Details"
                maxWidth="md"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmPaymentDetails} disabled={!paymentDetails.paidBy || !paymentDetails.paymentDate}>Confirm Payment</Button>
                    </div>
                }
            >
                <div className="space-y-6 pt-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Paid By (Employee)</label>
                        <div className="relative">
                            <button
                                id="employee-dropdown-anchor"
                                onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-100 transition-all outline-none"
                            >
                                <span>{employeeOptions.find(o => o.value === paymentDetails.paidBy)?.label || 'Select Employee...'}</span>
                                <Plus className={`w-4 h-4 transition-transform ${isEmployeeDropdownOpen ? 'rotate-45' : ''}`} />
                            </button>
                            <MyDropDown 
                                isOpen={isEmployeeDropdownOpen}
                                onClose={() => setIsEmployeeDropdownOpen(false)}
                                anchorId="employee-dropdown-anchor"
                                options={employeeOptions}
                                selectedValues={paymentDetails.paidBy ? [paymentDetails.paidBy] : []}
                                onSelect={(val: string) => {
                                    setPaymentDetails(prev => ({ ...prev, paidBy: val }));
                                    setIsEmployeeDropdownOpen(false);
                                }}
                                width="w-full"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Payment Date</label>
                        <Input 
                            type="date"
                            value={paymentDetails.paymentDate}
                            onChange={(e) => setPaymentDetails(prev => ({ ...prev, paymentDate: e.target.value }))}
                        />
                    </div>
                </div>
            </Modal>
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
