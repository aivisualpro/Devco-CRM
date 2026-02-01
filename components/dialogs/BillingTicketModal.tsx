'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
    FileText, Loader2, Paperclip, X, Image as ImageIcon, Check, User, Plus 
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

        setTicket(prev => ({ ...prev, uploads: uploaded }));
        setIsUploading(false);
    };



    return (
        <>
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
                            Save Ticket
                        </Button>
                    </div>
                }
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        {/* Inject any additional children (e.g. Estimate Selector) first */}
                        {children}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date</label>
                                <Input 
                                    type="date"
                                    value={ticket.date}
                                    onChange={e => setTicket(prev => ({ ...prev, date: e.target.value }))}
                                />
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

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Billing Terms</label>
                            <select 
                                value={ticket.billingTerms}
                                onChange={e => setTicket(prev => ({ ...prev, billingTerms: e.target.value }))}
                                className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">Select Terms...</option>
                                <option value="COD">COD</option>
                                <option value="Net 30">Net 30</option>
                                <option value="Net 45">Net 45</option>
                                <option value="Net 60">Net 60</option>
                                <option value="Other">Other</option>
                            </select>
                            {ticket.billingTerms === 'Other' && (
                                <Input 
                                    placeholder="Specify terms..."
                                    value={ticket.otherBillingTerms}
                                    onChange={e => setTicket(prev => ({ ...prev, otherBillingTerms: e.target.value }))}
                                    className="mt-2"
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Title & Descriptions</label>
                            {(ticket.titleDescriptions || []).map((item, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative group">
                                    <Input 
                                        placeholder="Title"
                                        value={item.title}
                                        onChange={e => {
                                            const newTD = [...ticket.titleDescriptions];
                                            newTD[idx].title = e.target.value;
                                            setTicket(prev => ({ ...prev, titleDescriptions: newTD }));
                                        }}
                                        className="font-bold text-xs"
                                    />
                                    <textarea 
                                        placeholder="Description..."
                                        value={item.description}
                                        onChange={e => {
                                            const newTD = [...ticket.titleDescriptions];
                                            newTD[idx].description = e.target.value;
                                            setTicket(prev => ({ ...prev, titleDescriptions: newTD }));
                                        }}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none h-16"
                                    />
                                    <button 
                                        onClick={() => {
                                            const newTD = ticket.titleDescriptions.filter((_, i) => i !== idx);
                                            setTicket(prev => ({ ...prev, titleDescriptions: newTD }));
                                        }}
                                        className="absolute top-1 right-1 p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setTicket(prev => ({ ...prev, titleDescriptions: [...prev.titleDescriptions, { title: '', description: '' }] }))}
                                className="w-full text-xs"
                            >
                                <Plus size={12} className="mr-1" /> Add Section
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Attachments</label>
                            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3 transition-colors hover:bg-slate-50 hover:border-slate-300 relative h-40">
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
                                    <p className="text-sm font-bold text-slate-600">Upload Files</p>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Docs / Images</p>
                                </div>
                            </div>
                            {(ticket.uploads || []).length > 0 && (
                                <div className="grid grid-cols-1 gap-2 mt-2">
                                    {ticket.uploads.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {file.type?.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> : <FileText className="w-3.5 h-3.5 text-blue-500" />}
                                                <span className="text-[10px] font-bold text-slate-600 truncate">{file.name}</span>
                                            </div>
                                            <button 
                                                onClick={() => setTicket(prev => ({ ...prev, uploads: prev.uploads.filter((_, i) => i !== idx) }))}
                                                className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                         {(initialData || ticket.createdBy) && (
                            <div className="flex items-center gap-2 px-1 mt-4">
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
                </div>
            </Modal>
        </>
    );
};
