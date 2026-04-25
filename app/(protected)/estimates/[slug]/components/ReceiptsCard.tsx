'use client';

import { cld } from '@/lib/cld';
import Image from 'next/image';
import React, { useState, useMemo } from 'react';
import { Receipt, Plus, Trash2, Download, Paperclip, X, Loader2, Pencil, Image as ImageIcon, FileText, DollarSign, Check, User, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal, Input, Button, ConfirmModal, MyDropDown, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';
import { format } from 'date-fns';

// ── Shared Utilities ──────────────────────────────────────────────────────────

const toLocalDate = (dateStr: string | undefined | null): Date | null => {
    if (!dateStr || String(dateStr).trim() === '') return null;
    let finalStr = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(finalStr)) {
        finalStr = `${finalStr}T00:00:00`;
    }
    const d = new Date(finalStr);
    if (isNaN(d.getTime())) return null;
    return d;
};

const safeFormatDate = (dateStr: string | undefined | null, formatStr: string = 'MM/dd/yy') => {
    if (!dateStr || String(dateStr).trim() === '') return '-';
    try {
        const d = toLocalDate(dateStr);
        if (!d) return String(dateStr) || '-';
        return format(d, formatStr);
    } catch {
        return String(dateStr) || '-';
    }
};

const fmtDate = (dateStr: any) => {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    try {
        const normalizedDate = String(dateStr).includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00:00Z');
        if (isNaN(normalizedDate.getTime())) return dateStr;
        const mm = String(normalizedDate.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(normalizedDate.getUTCDate()).padStart(2, '0');
        const yy = String(normalizedDate.getUTCFullYear()).slice(-2);
        return `${mm}/${dd}/${yy}`;
    } catch { return dateStr; }
};

const handleFileDownload = (url: string, fileName: string) => {
    if (!url) {
        toast.error('File URL is not available');
        return;
    }
    if (url.includes('res.cloudinary.com')) {
        const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fileName || 'download')}`;
        window.open(proxyUrl, '_blank');
        return;
    }
    window.open(url, '_blank');
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface Employee {
    _id: string;
    firstName?: string;
    lastName?: string;
    [key: string]: any;
}

interface ReceiptsCardProps {
    receiptsAndCosts: any[];
    onUpdate?: (field: string, value: any) => void;
    formData?: Record<string, any>;
    employees?: Employee[];
    currentUserEmail?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ReceiptsCard: React.FC<ReceiptsCardProps> = ({
    receiptsAndCosts = [],
    onUpdate,
    formData,
    employees = [],
    currentUserEmail = ''
}) => {
    // ── State ─────────────────────────────────────────────────────────────────
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
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

    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
    const [paymentContext, setPaymentContext] = useState<{ index: number | 'new', data: any } | null>(null);
    const [paymentDetails, setPaymentDetails] = useState({
        paidBy: '',
        paymentDate: format(new Date(), 'yyyy-MM-dd')
    });

    // ── Helpers ───────────────────────────────────────────────────────────────
    const getEmployeeData = (idOrEmail: any) => {
        if (!idOrEmail) return null;
        const raw = Array.isArray(idOrEmail) ? idOrEmail[0] : idOrEmail;
        if (!raw) return null;
        const lower = String(raw).toLowerCase();
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
        }).sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));
    }, [employees]);

    const adminEmployeeOptions = useMemo(() => {
        return employees
            .filter(emp => emp.appRole === 'Admin' || emp.appRole === 'Super Admin')
            .map(emp => {
                const label = emp.label || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email || emp._id;
                return {
                    id: emp._id,
                    label: label,
                    value: emp.email || emp._id || emp.value,
                    profilePicture: emp.image || emp.profilePicture
                };
            }).sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));
    }, [employees]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleReceiptFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsReceiptUploading(true);
        const uploadedAttachments = [...newReceipt.upload];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('folder', `estimates/${formData?.estimate || 'general'}/receipts`);

                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                const data = await res.json();

                if (data.success && data.url) {
                    uploadedAttachments.push({
                        name: file.name,
                        url: data.url,
                        thumbnailUrl: data.thumbnailUrl || '',
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
            updated = receiptsAndCosts.map((item: any, idx: number) =>
                idx === editingReceiptIndex
                    ? { ...item, ...newReceipt, amount: parseFloat(newReceipt.amount) || 0 }
                    : item
            );
        } else {
            const receiptEntry = {
                ...newReceipt,
                _id: Math.random().toString(36).substr(2, 9),
                amount: parseFloat(newReceipt.amount) || 0,
                createdAt: new Date(),
                createdBy: currentUserEmail || ''
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

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-1 mb-2 mt-0.5">
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-7 h-7 rounded-[10px] bg-gradient-to-br from-pink-500 to-pink-600 text-white flex items-center justify-center shadow-sm">
                            <Receipt className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-bold text-pink-700 tracking-tight">Receipts</h4>
                            <span className="text-[9px] bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-full font-black">
                                {receiptsAndCosts.length}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {(() => {
                            const receiptsArr = receiptsAndCosts.filter((r: any) => r.type === 'Receipt');
                            const invoicesArr = receiptsAndCosts.filter((r: any) => r.type === 'Invoice');
                            const rects = receiptsArr.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
                            const invs = invoicesArr.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
                            const total = rects + invs;
                            return (
                                <div className="flex items-center gap-2.5 bg-white/90 px-2 py-1 rounded-lg shadow-sm border border-slate-100 shrink-0">
                                    <div className="text-center pr-2.5 border-r border-slate-200/60">
                                        <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-[1px]">Receipts ({receiptsArr.length})</p>
                                        <p className="text-[11px] font-black text-pink-600 leading-none">${rects.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                    </div>
                                    <div className="text-center pr-2.5 border-r border-slate-200/60">
                                        <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-[1px]">Invoices ({invoicesArr.length})</p>
                                        <p className="text-[11px] font-black text-indigo-600 leading-none">${invs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                    </div>
                                    <div className="text-center pl-0.5">
                                        <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-[1px]">Total ({receiptsAndCosts.length})</p>
                                        <p className="text-[12px] font-black text-[#0F4C75] leading-none">${total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                    </div>
                                </div>
                            );
                        })()}
                        <button
                            onClick={handleAddReceipt}
                            className="p-1.5 px-2 bg-pink-100 text-pink-600 rounded-[10px] hover:bg-pink-200 shadow-[inset_0_1px_2px_rgba(255,255,255,0.7)] transition-colors shrink-0 flex items-center justify-center ml-0.5"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto pt-4">
                    <div className="grid grid-cols-1 gap-3">
                        {receiptsAndCosts.length > 0 ? [...receiptsAndCosts]
                            .map((item: any, idx: number) => ({ item, originalIdx: idx }))
                            .sort((a: any, b: any) => {
                                const dateA = new Date(a.item.createdAt || a.item.date || 0).getTime();
                                const dateB = new Date(b.item.createdAt || b.item.date || 0).getTime();
                                if (dateA !== dateB) return dateB - dateA;
                                return b.originalIdx - a.originalIdx;
                            })
                            .map(({ item, originalIdx }: any, mapIdx: number) => {
                                return (
                                    <div
                                        key={`receipt-${mapIdx}`}
                                        onClick={() => setSelectedReceipt(item)}
                                        className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative group cursor-pointer hover:bg-slate-50 hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col gap-3"
                                    >
                                        {/* Row 1: type, amount, vendor */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex flex-col gap-1.5 max-w-[70%]">
                                                <span className={`w-fit text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm ${item.type === 'Invoice' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200/50' : 'bg-pink-100 text-pink-700 border border-pink-200/50'}`}>
                                                    {item.type || 'Receipt'}
                                                </span>
                                                <span className="text-sm font-bold text-slate-500 uppercase tracking-widest truncate">
                                                    {item.vendor || 'UNKNOWN VENDOR'}
                                                </span>
                                            </div>
                                            <span className="shrink-0 text-2xl font-black text-slate-900 tracking-tight">
                                                ${(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>

                                        {/* Row 2: date, dueDate, paymentDate */}
                                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-600 mt-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Date:</span>
                                                <span>{fmtDate(item.date)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Due:</span>
                                                <span>{fmtDate(item.dueDate || item.due)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black">Paid:</span>
                                                <span className={item.paymentDate || item.dateOfPayment ? 'text-emerald-600' : ''}>{fmtDate(item.paymentDate || item.dateOfPayment)}</span>
                                            </div>
                                        </div>

                                        {/* Row 3: remarks */}
                                        <div className="text-sm text-slate-700 italic bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/50 line-clamp-3">
                                            {item.remarks ? `"${item.remarks}"` : "No remarks provided"}
                                        </div>

                                        {/* Row 4: approvalStatus, status */}
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${item.approvalStatus === 'Approved' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                                {item.approvalStatus || 'Not Approved'}
                                            </span>
                                            <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${item.status === 'Devco Paid' || item.status === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : item.status ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                                {item.status || 'No Status'}
                                            </span>
                                        </div>

                                        {/* Row 6: tag */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tags:</span>
                                            {item.tag && item.tag.length > 0 ? (
                                                <div className="flex -space-x-2">
                                                    <TooltipProvider>
                                                        {(item.tag || []).slice(0, 5).map((tagMail: string, i: number) => {
                                                            const tagEmp = getEmployeeData(tagMail);
                                                            return (
                                                                <Tooltip key={i}>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="w-8 h-8 rounded-full border-2 border-white bg-[#0F4C75] flex items-center justify-center text-xs font-bold text-white shadow-sm overflow-hidden z-10 hover:z-20 relative transition-transform hover:scale-110">
                                                                            {tagEmp?.image ? <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" alt="" src={cld(tagEmp.image, { w: 128, q: 'auto' })} className="object-cover w-full h-full" /></div> : (tagMail?.[0]?.toUpperCase() || 'T')}
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent><p>Tagged: {tagEmp?.label || tagMail}</p></TooltipContent>
                                                                </Tooltip>
                                                            );
                                                        })}
                                                        {(item.tag || []).length > 5 && (
                                                            <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shadow-sm z-10 relative">
                                                                +{(item.tag || []).length - 5}
                                                            </div>
                                                        )}
                                                    </TooltipProvider>
                                                </div>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-400 italic">No Tags</span>
                                            )}
                                        </div>

                                        {/* Row 7: upload (list items) */}
                                        <div className="flex flex-col gap-2 mt-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left pt-1">
                                                Attachments {item.upload && `(${item.upload.length})`}
                                            </span>
                                            {item.upload && item.upload.length > 0 ? (
                                                <div className="flex flex-col gap-2 pb-1">
                                                    {item.upload.map((fileUrl: any, i: number) => {
                                                        const url = typeof fileUrl === 'string' ? fileUrl : (fileUrl.url || fileUrl.preview || '');
                                                        let name = typeof fileUrl === 'string' ? 'Download' : (fileUrl.name || 'Attachment');
                                                        if (!url) return null;
                                                        const isPdf = url.toLowerCase().endsWith('.pdf') || url.startsWith('data:application/pdf');
                                                        const isImg = url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i) || url.startsWith('data:image/');
                                                        if (name === 'Download' && isPdf) {
                                                            const parts = url.split('/');
                                                            name = parts[parts.length - 1] || 'Document.pdf';
                                                        }
                                                        return (
                                                            <button
                                                                key={i}
                                                                onClick={(e) => { e.stopPropagation(); handleFileDownload(url, name); }}
                                                                className="w-full flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all group shadow-sm focus:outline-none"
                                                            >
                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                    <div className="relative shrink-0 w-8 h-8 rounded-lg bg-pink-100/50 flex items-center justify-center">
                                                                        {isImg ? (
                                                                            <ImageIcon className="w-4 h-4 text-pink-600" />
                                                                        ) : (
                                                                            <FileText className="w-4 h-4 text-pink-600" />
                                                                        )}
                                                                    </div>
                                                                    <span className="text-xs font-bold text-slate-700 truncate text-left">
                                                                        {name}
                                                                    </span>
                                                                </div>
                                                                <div className="shrink-0 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:border-blue-300 group-hover:shadow-md transition-all ml-2">
                                                                    <Download className="w-3.5 h-3.5" />
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-400 italic pb-2">No files attached</span>
                                            )}
                                        </div>

                                        {/* Row 8: createdBy & createdAt */}
                                        <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <TooltipProvider>
                                                    {(() => {
                                                        const creator = getEmployeeData(item.createdBy);
                                                        return (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="relative w-6 h-6 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm overflow-hidden">
                                                                        {creator?.image ? <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" alt="" src={cld(creator.image, { w: 128, q: 'auto' })} className="object-cover w-full h-full" /></div> : (item.createdBy?.[0]?.toUpperCase() || 'U')}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>Created By: {creator?.label || item.createdBy}</p></TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })()}
                                                </TooltipProvider>
                                                <span className="text-xs font-bold text-slate-500 tracking-wide">{getEmployeeData(item.createdBy)?.label || item.createdBy || 'Unknown'}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                                                    {fmtDate(item.createdAt)}
                                                </span>
                                                <div className="flex gap-2 transition-opacity duration-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                                    <button onClick={(e) => handleEditReceipt(originalIdx, e)} className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center justify-center">
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); setReceiptToDelete(originalIdx); }} className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-all flex items-center justify-center">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }) : (
                            <p className="text-[10px] text-slate-400 font-bold text-center py-4">No records</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Modals ──────────────────────────────────────────────────────── */}

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={receiptToDelete !== null}
                onClose={() => setReceiptToDelete(null)}
                onConfirm={confirmRemoveReceipt}
                title="Delete Receipt / Cost"
                message="Are you sure you want to remove this receipt/cost entry?"
                confirmText="Delete"
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
                                                <div className="relative w-5 h-5 rounded-full overflow-hidden border border-slate-100 flex items-center justify-center bg-slate-50">
                                                    {emp?.image ? <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" alt="" src={cld(emp.image, { w: 128, q: 'auto' })} className="object-cover w-full h-full" /></div> : <User className="w-3 h-3 text-slate-400" />}
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
                                            <div className="relative flex items-center gap-2 overflow-hidden">
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
                                            <div className="relative w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                                {creator?.image ? <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" alt="" src={cld(creator.image, { w: 128, q: 'auto' })} className="object-cover w-full h-full" /></div> : <User className="w-3 h-3 text-slate-400" />}
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
                                                    <div className="relative w-6 h-6 rounded-full border border-white bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                                                        {creator?.image ? <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" alt="" src={cld(creator.image, { w: 128, q: 'auto' })} className="object-cover w-full h-full" /></div> : <User className="w-3.5 h-3.5 text-slate-400" />}
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
                                                        <div className="relative w-4 h-4 rounded-full border border-blue-50 bg-[#0F4C75] flex items-center justify-center overflow-hidden">
                                                            {tagEmp?.image ? <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" alt="" src={cld(tagEmp.image, { w: 128, q: 'auto' })} className="object-cover w-full h-full" /></div> : <User className="w-2.5 h-2.5 text-white/70" />}
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
                                                        <div className="relative w-6 h-6 rounded-full border border-white bg-emerald-100 flex items-center justify-center overflow-hidden shadow-sm">
                                                            {payee?.image ? <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" alt="" src={cld(payee.image, { w: 128, q: 'auto' })} className="object-cover w-full h-full" /></div> : <User className="w-3.5 h-3.5 text-emerald-600" />}
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
                                    <div
                                        key={idx}
                                        onClick={() => handleFileDownload(file.url, file.name)}
                                        className="group relative flex flex-col items-center gap-3 p-4 bg-white rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-pink-200 transition-all duration-300 overflow-hidden cursor-pointer"
                                    >
                                        <div className="w-full aspect-square rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-50 relative">
                                            {file.thumbnailUrl ? (
                                                <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw"
                                                    src={file.thumbnailUrl}
                                                    alt={file.name}
                                                    className="object-contain transition-all duration-500 group-hover:scale-105 w-full h-full"
                                                /></div>
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
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleFileDownload(file.url, file.name);
                                            }}
                                            className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-10"
                                            title="Download File"
                                        >
                                            <Download className="w-3.5 h-3.5 text-pink-600" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

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
                                id="receipt-employee-dropdown-anchor"
                                onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-100 transition-all outline-none"
                            >
                                <span>{adminEmployeeOptions.find(o => o.value === paymentDetails.paidBy)?.label || 'Select Employee...'}</span>
                                <Plus className={`w-4 h-4 transition-transform ${isEmployeeDropdownOpen ? 'rotate-45' : ''}`} />
                            </button>
                            <MyDropDown
                                isOpen={isEmployeeDropdownOpen}
                                onClose={() => setIsEmployeeDropdownOpen(false)}
                                anchorId="receipt-employee-dropdown-anchor"
                                options={adminEmployeeOptions}
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
