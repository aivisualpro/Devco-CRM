'use client';

import { cld } from '@/lib/cld';
import Image from 'next/image';
import React, { useState, useMemo } from 'react';
import { FileCheck, Plus, Trash2, Download, Paperclip, X, Loader2, Pencil, Image as ImageIcon, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal, Input, Button, ConfirmModal, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';
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

interface SignedContractsCardProps {
    signedContracts: any[];
    onUpdate?: (field: string, value: any) => void;
    formData?: Record<string, any>;
    employees?: Employee[];
    currentUserEmail?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const SignedContractsCard: React.FC<SignedContractsCardProps> = ({
    signedContracts = [],
    onUpdate,
    formData,
    employees = [],
    currentUserEmail
}) => {
    // ── State ─────────────────────────────────────────────────────────────────
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [newContract, setNewContract] = useState<{ date: string; amount: string; attachments: any[] }>({
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: '',
        attachments: []
    });
    const [selectedViewContract, setSelectedViewContract] = useState<any>(null);
    const [contractIndexToDelete, setContractIndexToDelete] = useState<number | null>(null);
    const [editingContractIndex, setEditingContractIndex] = useState<number | null>(null);

    const sortedContracts = useMemo(() => {
        return [...signedContracts]
            .map((contract, index) => ({ contract, originalIndex: index }))
            .sort((a, b) => {
                const dateA = new Date(a.contract.date || a.contract.createdAt || 0).getTime();
                const dateB = new Date(b.contract.date || b.contract.createdAt || 0).getTime();
                if (dateA !== dateB) return dateB - dateA;
                return b.originalIndex - a.originalIndex;
            });
    }, [signedContracts]);

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

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const uploadedAttachments = [...newContract.attachments];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('folder', `estimates/${formData?.estimate || 'general'}/contracts`);

                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                const data = await res.json();

                if (data.success && data.url) {
                    uploadedAttachments.push({
                        name: file.name,
                        url: data.url,
                        thumbnailUrl: data.thumbnailUrl || '',
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
        if (!newContract.date) { toast.error('Date is required'); return; }
        if (!newContract.amount) { toast.error('Amount is required'); return; }
        if (!newContract.attachments || newContract.attachments.length === 0) { toast.error('At least one file is required'); return; }

        let updatedContracts = [...signedContracts];
        if (editingContractIndex !== null) {
            updatedContracts[editingContractIndex] = {
                ...updatedContracts[editingContractIndex],
                ...newContract,
                amount: parseFloat(newContract.amount) || 0
            };
        } else {
            updatedContracts.push({
                ...newContract,
                amount: parseFloat(newContract.amount) || 0,
                createdAt: new Date().toISOString(),
                createdBy: currentUserEmail || ''
            });
        }

        onUpdate('signedContracts', updatedContracts);
        setIsModalOpen(false);
        setNewContract({ date: format(new Date(), 'yyyy-MM-dd'), amount: '', attachments: [] });
        setEditingContractIndex(null);
        toast.success(editingContractIndex !== null ? 'Signed contract updated' : 'Signed contract added');
    };

    const handleEditContract = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const contract = signedContracts[index];
        setEditingContractIndex(index);
        setNewContract({
            date: contract.date || format(new Date(), 'yyyy-MM-dd'),
            amount: String(contract.amount || ''),
            attachments: contract.attachments || []
        });
        setIsModalOpen(true);
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

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <>
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-1 mb-2 mt-0.5">
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-7 h-7 rounded-[10px] bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-sm">
                            <FileCheck className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-bold text-amber-700 tracking-tight">Signed Contracts</h4>
                            <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-black">
                                {signedContracts.length}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {(() => {
                            const total = signedContracts.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
                            return (
                                <div className="flex items-center gap-2.5 bg-white/90 px-2 py-1 rounded-lg shadow-sm border border-slate-100 shrink-0">
                                    <div className="text-center pl-0.5 pr-0.5">
                                        <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-[1px]">Total ({signedContracts.length})</p>
                                        <p className="text-[12px] font-black text-[#0F4C75] leading-none">${total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                    </div>
                                </div>
                            );
                        })()}
                        <button
                            onClick={() => {
                                setEditingContractIndex(null);
                                setNewContract({ date: format(new Date(), 'yyyy-MM-dd'), amount: '', attachments: [] });
                                setIsModalOpen(true);
                            }}
                            className="p-1.5 px-2 bg-amber-100 text-amber-600 rounded-[10px] hover:bg-amber-200 shadow-[inset_0_1px_2px_rgba(255,255,255,0.7)] transition-colors shrink-0 flex items-center justify-center ml-0.5"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">
                    <div className="grid grid-cols-1 gap-3">
                        {sortedContracts.length > 0 ? sortedContracts.map(({ contract, originalIndex }) => (
                            <div
                                key={originalIndex}
                                onClick={() => setSelectedViewContract(contract)}
                                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative group cursor-pointer hover:bg-slate-50 hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col gap-3"
                            >
                                {/* Row 1: Date & Amount */}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                        {safeFormatDate(contract.date, 'MM/dd/yyyy')}
                                    </span>
                                    <span className="text-xl font-black text-slate-900 tracking-tight">
                                        ${(contract.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    </span>
                                </div>

                                {/* Row 2: Attachments */}
                                {contract.attachments && contract.attachments.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        {contract.attachments.map((file: any, fIdx: number) => (
                                            <button
                                                key={fIdx}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleFileDownload(file.url, file.name);
                                                }}
                                                className="w-full flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all group/file shadow-sm focus:outline-none"
                                                title={`Download ${file.name}`}
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="relative shrink-0 w-8 h-8 rounded-lg bg-amber-100/50 flex items-center justify-center">
                                                        {file.type?.startsWith('image/') ? (
                                                            <ImageIcon className="w-4 h-4 text-amber-600" />
                                                        ) : (
                                                            <Paperclip className="w-4 h-4 text-amber-600" />
                                                        )}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-700 truncate text-left">
                                                        {file.name || `File ${fIdx + 1}`}
                                                    </span>
                                                </div>
                                                <div className="shrink-0 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover/file:text-blue-600 group-hover/file:border-blue-300 group-hover/file:shadow-md transition-all ml-2">
                                                    <Download className="w-3.5 h-3.5" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Row 3: createdBy, createdAt, actions */}
                                <div className="mt-1 pt-3 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            {contract.createdBy && contract.createdBy !== 'Unknown User' && contract.createdBy !== 'Unknown' && (
                                                <TooltipProvider>
                                                    {(() => {
                                                        const creator = getEmployeeData(contract.createdBy);
                                                        return (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="relative w-6 h-6 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm overflow-hidden">
                                                                        {creator?.image ? <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" alt="" src={cld(creator.image, { w: 128, q: 'auto' })} className="object-cover w-full h-full" /></div> : (creator?.label?.[0]?.toUpperCase() || contract.createdBy?.[0]?.toUpperCase() || 'U')}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>Created By: {creator?.label || contract.createdBy}</p></TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })()}
                                                </TooltipProvider>
                                            )}
                                            {contract.createdAt && (
                                                <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                                                    {fmtDate(contract.createdAt)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 transition-opacity duration-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                        <button
                                            onClick={(e) => handleEditContract(originalIndex, e)}
                                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center justify-center"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRemoveContract(originalIndex); }}
                                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-all flex items-center justify-center"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <p className="text-[10px] text-slate-400 font-bold text-center py-4">No contracts</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Modals ──────────────────────────────────────────────────────── */}

            {/* Add/Edit Signed Contract Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingContractIndex !== null ? "Edit Signed Contract" : "Add Signed Contract"}
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddContract} disabled={!newContract.date || !newContract.amount || !newContract.attachments || newContract.attachments.length === 0}>
                            {editingContractIndex !== null ? 'Save Changes' : 'Add Contract'}
                        </Button>
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
                                        <div className="relative flex items-center gap-2">
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
                                    {safeFormatDate(selectedViewContract.date, 'MM/dd/yyyy')}
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
                                    <div
                                        key={idx}
                                        onClick={() => handleFileDownload(file.url, file.name)}
                                        className="group relative flex flex-col items-center gap-3 p-4 bg-white rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-amber-200 transition-all duration-300 overflow-hidden cursor-pointer"
                                    >
                                        <div className="w-full aspect-square rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-50 relative">
                                            {file.thumbnailUrl ? (
                                                <div className="relative w-full h-full flex items-center justify-center p-2">
                                                    <Image fill sizes="(max-width: 768px) 100vw, 33vw"
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
                                                    </div>
                                                    {!file.type?.startsWith('image/') && (
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
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleFileDownload(file.url, file.name);
                                            }}
                                            className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-10"
                                            title="Download File"
                                        >
                                            <Download className="w-3.5 h-3.5 text-[#0F4C75]" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={contractIndexToDelete !== null}
                onClose={() => setContractIndexToDelete(null)}
                onConfirm={confirmRemoveContract}
                title="Delete Signed Contract"
                message="Are you sure you want to delete this signed contract? All associated files will also be removed."
                confirmText="Delete"
                variant="danger"
            />
        </>
    );
};
