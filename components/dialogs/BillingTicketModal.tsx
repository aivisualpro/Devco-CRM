'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
    FileText, Loader2, Paperclip, X, Image as ImageIcon, Check, User, Plus, ChevronDown 
} from 'lucide-react';
import { Modal, Input, Button, MyDropDown } from '@/components/ui';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface UploadedFile {
    name: string;
    url: string;
    type?: string;
    thumbnailUrl?: string; // Added to match generic upload response if needed
    uploadedAt?: string;
}

export interface BillingTicketData {
    _id?: string;
    date: string;
    billingTerms: string;
    otherBillingTerms?: string;
    lumpSum: string;
    titleDescriptions: { title: string; description: string }[];
    uploads: UploadedFile[];
    createdBy: string;
    // Helper
    estimateId?: string;
}

interface Employee {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    profilePicture?: string;
    [key: string]: any;
}

interface ReceiptModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Partial<BillingTicketData> | null;
    onSave: (data: BillingTicketData) => Promise<void>;
    employees: Employee[];
    children?: React.ReactNode; // For "Estimate Selector" or other injected UI
    currentUserEmail?: string; // For setting 'createdBy' default
    estimateId?: string; // For upload filename context
    canApprove?: boolean;
}

export const BillingTicketModal: React.FC<ReceiptModalProps> = ({ 
    isOpen, 
    onClose, 
    initialData, 
    onSave, 
    employees, 
    children,
    currentUserEmail,
    estimateId = 'doc',
    canApprove = false
}) => {
    // Default State
    const defaultState: BillingTicketData = {
        date: format(new Date(), 'yyyy-MM-dd'),
        billingTerms: '',
        otherBillingTerms: '',
        lumpSum: '',
        titleDescriptions: [{ title: '', description: '' }],
        uploads: [],
        createdBy: currentUserEmail || ''
    };

    const [ticket, setTicket] = useState<BillingTicketData>(defaultState);
    const [isUploading, setIsUploading] = useState(false);
    const [isBillingTermsOpen, setIsBillingTermsOpen] = useState(false);

    // Initialize state when modal opens or initialData changes
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Ensure array exists
                const merged = { ...defaultState, ...initialData };
                if (!merged.titleDescriptions || merged.titleDescriptions.length === 0) {
                    merged.titleDescriptions = [{ title: '', description: '' }];
                }
                setTicket(merged as BillingTicketData);
            } else {
                setTicket({ ...defaultState, createdBy: currentUserEmail || '' });
            }
        }
    }, [isOpen, initialData, currentUserEmail]);

    // Helpers
    const getEmployeeData = (idOrEmail: string) => {
        return employees.find(e => e._id === idOrEmail || e.email === idOrEmail) || { 
            _id: idOrEmail, 
            firstName: idOrEmail, 
            lastName: '',
            image: null 
        }; // Basic fallback
    };
    
    // Mapped options for Dropdown
    const employeeOptions = employees.map(e => ({
        id: e._id,
        label: `${e.firstName} ${e.lastName}`,
        value: e.email || e._id, 
        image: e.profilePicture,
        description: e.email
    }));

    const billingTermsOptions = ['COD', 'Net 30', 'Net 45', 'Net 60', 'Other'];

    // Handle Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setIsUploading(true);
        const uploaded = [...ticket.uploads];

        for (const file of files) {
            try {
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve) => {
                    reader.onload = (ev) => resolve(ev.target?.result as string);
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
                            fileName: `BillingTicket_${estimateId}_${Date.now()}_${file.name}`,
                            contentType: file.type
                        }
                    })
                });

                const data = await res.json();
                if (data.success && data.result) {
                    uploaded.push({
                        name: file.name,
                        url: data.result.url,
                        type: file.type,
                        thumbnailUrl: data.result.thumbnailUrl
                    });
                } else {
                    toast.error(`Failed to upload ${file.name}`);
                }
            } catch (err) {
                console.error('Upload Error:', err);
                toast.error(`Error uploading ${file.name}`);
            }
        }

        setTicket(prev => ({ ...prev, uploads: uploaded }));
        setIsUploading(false);
    };

    const addTitleDescription = () => {
        setTicket(prev => ({
            ...prev,
            titleDescriptions: [...prev.titleDescriptions, { title: '', description: '' }]
        }));
    };

    const updateTitleDescription = (index: number, field: 'title' | 'description', value: string) => {
        setTicket(prev => ({
            ...prev,
            titleDescriptions: prev.titleDescriptions.map((td, i) =>
                i === index ? { ...td, [field]: value } : td
            )
        }));
    };

    const removeTitleDescription = (index: number) => {
        setTicket(prev => ({
            ...prev,
            titleDescriptions: prev.titleDescriptions.filter((_, i) => i !== index)
        }));
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData && initialData._id ? "Edit Billing Ticket" : "Add Billing Ticket"}
            maxWidth="2xl"
            footer={
                <div className="flex gap-3 justify-end w-full">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button 
                        onClick={() => onSave(ticket)} 
                        disabled={!ticket.lumpSum}
                    >
                        Save Billing Ticket
                    </Button>
                </div>
            }
        >
            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
                {/* Inject Children (Estimate Selector) if any */}
                {children}

                {/* Row 1: Date, Billing Terms, Lump Sum */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date</label>
                        <Input 
                            type="date"
                            value={ticket.date}
                            onChange={e => setTicket(prev => ({ ...prev, date: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Billing Terms</label>
                        <div className="relative">
                            <button
                                id="modal-billing-terms-trigger"
                                onClick={() => setIsBillingTermsOpen(!isBillingTermsOpen)}
                                className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none flex items-center justify-between"
                            >
                                <span className={ticket.billingTerms ? "text-slate-700 font-medium" : "text-slate-400"}>
                                    {ticket.billingTerms || "Select Terms"}
                                </span>
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </button>
                            <MyDropDown 
                                isOpen={isBillingTermsOpen}
                                onClose={() => setIsBillingTermsOpen(false)}
                                anchorId="modal-billing-terms-trigger"
                                options={billingTermsOptions.map(t => ({ id: t, label: t, value: t }))}
                                selectedValues={ticket.billingTerms ? [ticket.billingTerms] : []}
                                onSelect={(val) => {
                                    setTicket(prev => ({ ...prev, billingTerms: val as string }));
                                    setIsBillingTermsOpen(false);
                                }}
                                width="w-full"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Lump Sum ($)</label>
                        <Input 
                            type="number"
                            placeholder="0.00"
                            value={ticket.lumpSum}
                            onChange={e => setTicket(prev => ({ ...prev, lumpSum: e.target.value }))}
                        />
                    </div>
                </div>

                {/* Other Billing Terms (visible only when Other is selected) */}
                {ticket.billingTerms === 'Other' && (
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Other Billing Terms</label>
                        <Input 
                            type="text"
                            placeholder="Specify billing terms"
                            value={ticket.otherBillingTerms}
                            onChange={e => setTicket(prev => ({ ...prev, otherBillingTerms: e.target.value }))}
                        />
                    </div>
                )}

                {/* Title & Descriptions */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                            Titles & Descriptions
                        </label>
                        <button 
                            onClick={addTitleDescription}
                            className="text-[10px] text-indigo-600 font-bold hover:underline"
                        >
                            + Add Title
                        </button>
                    </div>
                    {ticket.titleDescriptions.map((td, i) => (
                        <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2 relative group">
                            {ticket.titleDescriptions.length > 1 && (
                                <button 
                                    onClick={() => removeTitleDescription(i)}
                                    className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={14}/>
                                </button>
                            )}
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Title</label>
                                <Input 
                                    type="text"
                                    placeholder="Enter title"
                                    value={td.title}
                                    onChange={e => updateTitleDescription(i, 'title', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Description</label>
                                <textarea 
                                    placeholder="Enter description..."
                                    value={td.description}
                                    onChange={e => updateTitleDescription(i, 'description', e.target.value)}
                                    rows={6}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none min-h-[120px]"
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* File Uploads */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                            Uploads (Images/Documents)
                        </label>
                        <label className="text-[10px] text-indigo-600 font-bold cursor-pointer hover:underline">
                            + Add Files
                            <input 
                                type="file" 
                                multiple 
                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                                className="hidden" 
                                onChange={handleFileUpload} 
                            />
                        </label>
                    </div>
                    {isUploading && (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                        </div>
                    )}
                    {(ticket.uploads || []).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {ticket.uploads.map((file, i) => (
                                <div key={i} className="relative group">
                                    {file.type?.startsWith('image') ? (
                                        <img 
                                            src={file.thumbnailUrl || file.url} 
                                            alt={file.name}
                                            className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                                            <FileText className="w-6 h-6 text-slate-400" />
                                        </div>
                                    )}
                                    <button 
                                        onClick={() => setTicket(prev => ({ ...prev, uploads: prev.uploads.filter((_, idx) => idx !== i) }))}
                                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                    <span className="text-[8px] text-slate-500 truncate block max-w-[64px] text-center">{file.name}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[10px] text-slate-400 italic">No files uploaded</p>
                    )}
                </div>

                {(initialData || ticket.createdBy) && (
                    <div className="flex items-center gap-2 px-1 mt-4 pt-3 border-t border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Created By:</label>
                        {(() => {
                            const creator = getEmployeeData(ticket.createdBy);
                            const creatorImage = creator?.profilePicture || creator?.image;
                            const creatorName = `${creator?.firstName || ''} ${creator?.lastName || ''}`.trim() || ticket.createdBy;

                            return (
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                        {creatorImage ? <img src={creatorImage} className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-slate-400" />}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-600">{creatorName}</span>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </Modal>
    );
};
