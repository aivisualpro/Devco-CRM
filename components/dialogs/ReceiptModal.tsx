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

export interface ReceiptData {
    _id?: string; // Optional for new
    type: 'Invoice' | 'Receipt';
    vendor: string;
    amount: string;
    date: string;
    dueDate: string;
    remarks: string;
    tag: string[];
    approvalStatus: 'Approved' | 'Not Approved';
    status: 'Devco Paid' | '';
    paidBy: string;
    paymentDate: string;
    upload: UploadedFile[];
    createdBy: string;
    // Any extra fields
    [key: string]: any;
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
    initialData?: Partial<ReceiptData> | null;
    onSave: (data: ReceiptData) => Promise<void>;
    employees: Employee[];
    children?: React.ReactNode; // For "Estimate Selector" or other injected UI
    currentUserEmail?: string; // For setting 'createdBy' default
    estimateId?: string; // For upload filename context
    canApprove?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ 
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
    const defaultState: ReceiptData = {
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
        createdBy: currentUserEmail || ''
    };

    const [receipt, setReceipt] = useState<ReceiptData>(defaultState);
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
    const [isReceiptUploading, setIsReceiptUploading] = useState(false);
    
    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentDetails, setPaymentDetails] = useState({
        paidBy: '',
        paymentDate: format(new Date(), 'yyyy-MM-dd')
    });
    const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);

    // Initialize state when modal opens or initialData changes
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setReceipt({ ...defaultState, ...initialData } as ReceiptData);
            } else {
                setReceipt({ ...defaultState, createdBy: currentUserEmail || '' });
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

        setIsReceiptUploading(true);
        const uploaded = [...receipt.upload];

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
                            fileName: `Receipt_${estimateId}_${Date.now()}_${file.name}`,
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

        setReceipt(prev => ({ ...prev, upload: uploaded }));
        setIsReceiptUploading(false);
    };

    // Confirm Payment Details
    const handleConfirmPaymentDetails = () => {
        setReceipt(prev => ({
            ...prev,
            status: 'Devco Paid',
            paidBy: paymentDetails.paidBy,
            paymentDate: paymentDetails.paymentDate
        }));
        setIsPaymentModalOpen(false);
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={initialData && initialData._id ? "Edit Receipt / Cost" : "Add Receipt / Cost"}
                maxWidth="2xl"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button 
                            onClick={() => onSave(receipt)} 
                            disabled={!receipt.vendor || !receipt.amount}
                        >
                            Save Entry
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
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Type</label>
                                <select 
                                    value={receipt.type}
                                    onChange={e => setReceipt(prev => ({ ...prev, type: e.target.value as any }))}
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
                                    value={receipt.amount}
                                    onChange={e => setReceipt(prev => ({ ...prev, amount: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Vendor</label>
                            <Input 
                                placeholder="Vendor Name"
                                value={receipt.vendor}
                                onChange={e => setReceipt(prev => ({ ...prev, vendor: e.target.value }))}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date</label>
                                <Input 
                                    type="date"
                                    value={receipt.date}
                                    onChange={e => setReceipt(prev => ({ ...prev, date: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Due Date</label>
                                <Input 
                                    type="date"
                                    value={receipt.dueDate}
                                    onChange={e => setReceipt(prev => ({ ...prev, dueDate: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Remarks</label>
                            <textarea 
                                className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20"
                                placeholder="..."
                                value={receipt.remarks}
                                onChange={e => setReceipt(prev => ({ ...prev, remarks: e.target.value }))}
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
                                    selectedValues={receipt.tag}
                                    onSelect={(val: string) => {
                                        setReceipt(prev => ({
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
                                    {(receipt.tag || []).map(t => {
                                        const emp = getEmployeeData(t);
                                        const empImage = emp?.profilePicture || emp?.image; // Handle possible key diffs
                                        const empName = `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || t;

                                        return (
                                            <span key={t} className="text-[10px] font-black bg-white text-[#0F4C75] pl-1 pr-2.5 py-1 rounded-full flex items-center gap-2 border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-200">
                                                <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-100 flex items-center justify-center bg-slate-50">
                                                    {empImage ? <img src={empImage} className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-slate-400" />}
                                                </div>
                                                {empName}
                                                <X 
                                                    className="w-3 h-3 cursor-pointer hover:text-red-500 transition-colors ml-1" 
                                                    onClick={() => setReceipt(prev => ({ ...prev, tag: prev.tag.filter(tag => tag !== t) }))} 
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
                                    onChange={handleFileUpload}
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
                            {receipt.upload.length > 0 && (
                                <div className="grid grid-cols-1 gap-2 mt-2">
                                    {receipt.upload.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {file.type?.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> : <FileText className="w-3.5 h-3.5 text-blue-500" />}
                                                <span className="text-[10px] font-bold text-slate-600 truncate">{file.name}</span>
                                            </div>
                                            <button 
                                                onClick={() => setReceipt(prev => ({ ...prev, upload: prev.upload.filter((_, i) => i !== idx) }))}
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
                                        if (receipt.status === 'Devco Paid') {
                                            setReceipt(prev => ({ ...prev, status: '', paidBy: '', paymentDate: '' }));
                                        } else {
                                            setPaymentDetails({
                                                paidBy: '',
                                                paymentDate: format(new Date(), 'yyyy-MM-dd')
                                            });
                                            setIsPaymentModalOpen(true);
                                        }
                                    }}
                                    className={`w-full flex items-center gap-2 border rounded-xl px-4 py-2 text-xs font-bold cursor-pointer transition-all ${receipt.status === 'Devco Paid' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${receipt.status === 'Devco Paid' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'}`}>
                                        {receipt.status === 'Devco Paid' && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    Devco Paid
                                </div>
                            </div>
                            {canApprove && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Approval</label>
                                    <select 
                                        value={receipt.approvalStatus}
                                        onChange={e => setReceipt(prev => ({ ...prev, approvalStatus: e.target.value as any }))}
                                        className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="Not Approved">Not Approved</option>
                                        <option value="Approved">Approved</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        {(initialData || receipt.createdBy) && (
                            <div className="flex items-center gap-2 px-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Created By:</label>
                                {(() => {
                                    const creator = getEmployeeData(receipt.createdBy);
                                    const creatorImage = creator?.profilePicture || creator?.image;
                                    const creatorName = `${creator?.firstName || ''} ${creator?.lastName || ''}`.trim() || receipt.createdBy;

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

            {/* Payment Details Modal (Nested) */}
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
                                id="payment-employee-dropdown-anchor"
                                onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-100 transition-all outline-none"
                            >
                                <span>{employeeOptions.find(o => o.value === paymentDetails.paidBy)?.label || 'Select Employee...'}</span>
                                <Plus className={`w-4 h-4 transition-transform ${isEmployeeDropdownOpen ? 'rotate-45' : ''}`} />
                            </button>
                            <MyDropDown 
                                isOpen={isEmployeeDropdownOpen}
                                onClose={() => setIsEmployeeDropdownOpen(false)}
                                anchorId="payment-employee-dropdown-anchor"
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
        </>
    );
};
