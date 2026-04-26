'use client';

import { cld } from '@/lib/cld';
import Image from 'next/image';
import React, { useState, useMemo } from 'react';
import { Layout, Plus, Trash2, Download, Paperclip, X, Loader2, Pencil, Image as ImageIcon, FileText, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal, Input, Button, ConfirmModal, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';
import { MyDropDown } from '@/components/ui/MyDropDown';
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

interface PlanningCardProps {
    planningDocs: any[];
    onUpdate?: (field: string, value: any) => void;
    formData?: Record<string, any>;
    employees?: Employee[];
    currentUserEmail?: string;
    planningOptions?: { id: string; label: string; value: string; color?: string }[];
}

export const PlanningCard: React.FC<PlanningCardProps> = ({
    planningDocs = [],
    onUpdate,
    formData,
    employees = [],
    currentUserEmail,
    planningOptions = []
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedViewItem, setSelectedViewItem] = useState<any>(null);
    const [itemIndexToDelete, setItemIndexToDelete] = useState<number | null>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

    const [newItem, setNewItem] = useState({
        planningType: '',
        documentName: '',
        usaTicketNo: '',
        dateSubmitted: '',
        activationDate: '',
        expirationDate: '',
        documents: [] as any[]
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

    const sortedDocs = useMemo(() => {
        return [...planningDocs]
            .map((doc, index) => ({ doc, originalIndex: index }))
            .sort((a, b) => {
                const dateA = new Date(a.doc.createdAt || a.doc.dateSubmitted || 0).getTime();
                const dateB = new Date(b.doc.createdAt || b.doc.dateSubmitted || 0).getTime();
                if (dateA !== dateB) return dateB - dateA;
                return b.originalIndex - a.originalIndex;
            });
    }, [planningDocs]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const uploaded = [...newItem.documents];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('folder', `estimates/${formData?.estimate || 'general'}/planning`);

                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                const data = await res.json();

                if (data.success && data.url) {
                    uploaded.push({
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

        setNewItem(prev => ({ ...prev, documents: uploaded }));
        setIsUploading(false);
    };

    const handleAddClick = () => {
        setEditingIndex(null);
        setNewItem({
            planningType: '',
            documentName: '',
            usaTicketNo: '',
            dateSubmitted: '',
            activationDate: '',
            expirationDate: '',
            documents: []
        });
        setIsModalOpen(true);
    };

    const handleEditClick = (index: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const item = planningDocs[index];
        setNewItem({
            planningType: item.planningType || '',
            documentName: item.documentName || '',
            usaTicketNo: item.usaTicketNo || '',
            dateSubmitted: item.dateSubmitted ? item.dateSubmitted.split('T')[0] : '',
            activationDate: item.activationDate ? item.activationDate.split('T')[0] : '',
            expirationDate: item.expirationDate ? item.expirationDate.split('T')[0] : '',
            documents: item.documents || []
        });
        setEditingIndex(index);
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!newItem.planningType) { toast.error('Planning Type is required'); return; }
        if (!newItem.documentName) { toast.error('Document Name is required'); return; }
        if (!onUpdate) return;

        const updatedDocs = [...planningDocs];

        if (editingIndex !== null) {
            updatedDocs[editingIndex] = {
                ...updatedDocs[editingIndex],
                ...newItem
            };
        } else {
            updatedDocs.push({
                ...newItem,
                createdAt: new Date().toISOString(),
                createdBy: currentUserEmail || ''
            });
        }

        onUpdate('jobPlanningDocs', updatedDocs);
        setIsModalOpen(false);
        toast.success(editingIndex !== null ? 'Planning document updated' : 'Planning document added');
    };

    const confirmRemove = async () => {
        if (itemIndexToDelete === null || !onUpdate) return;

        const docToDelete = planningDocs[itemIndexToDelete];
        const urlsToDelete = docToDelete.documents?.map((a: any) => a.url).filter(Boolean) || [];

        if (urlsToDelete.length > 0) {
            try {
                await fetch('/api/misc', {
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

        const updated = planningDocs.filter((_: any, i: number) => i !== itemIndexToDelete);
        onUpdate('jobPlanningDocs', updated);
        setItemIndexToDelete(null);
        toast.success('Planning document removed');
    };

    return (
        <>
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-1 mb-2 mt-0.5">
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-7 h-7 rounded-[10px] bg-gradient-to-br from-violet-500 to-violet-600 text-white flex items-center justify-center shadow-sm">
                            <Layout className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-bold text-violet-700 tracking-tight">Planning</h4>
                            <span className="text-[9px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full font-black">
                                {planningDocs.length}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={handleAddClick}
                        className="p-1.5 px-2 bg-violet-100 text-violet-600 rounded-[10px] hover:bg-violet-200 shadow-[inset_0_1px_2px_rgba(255,255,255,0.7)] transition-colors shrink-0 flex items-center justify-center ml-auto"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>

                {/* List */}
                <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">
                    <div className="grid grid-cols-1 gap-3">
                        {sortedDocs.length > 0 ? sortedDocs.map(({ doc, originalIndex }) => (
                            <div
                                key={originalIndex}
                                onClick={() => {
                                    setSelectedViewItem(doc);
                                    setIsDetailsModalOpen(true);
                                }}
                                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative group cursor-pointer hover:bg-slate-50 hover:shadow-md hover:border-slate-300 transition-all duration-300 flex flex-col gap-3"
                            >
                                {/* Row 1: planningType */}
                                <div className="flex items-center justify-between">
                                    <span className="w-fit text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm bg-violet-100 text-violet-700 border border-violet-200/50">
                                        {doc.planningType || 'UNSPECIFIED'}
                                    </span>
                                </div>

                                {/* Row 2: dateSubmitted, activationDate, expirationDate */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Submitted</p>
                                        <p className="text-xs font-black text-slate-700 leading-none">
                                            {safeFormatDate(doc.dateSubmitted, 'MM/dd/yy')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Active</p>
                                        <p className="text-xs font-black text-slate-700 leading-none">
                                            {safeFormatDate(doc.activationDate, 'MM/dd/yy')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Expires</p>
                                        <p className={`text-xs font-black leading-none ${(() => {
                                            if (!doc.expirationDate) return 'text-slate-700';
                                            try {
                                                const d = new Date(doc.expirationDate);
                                                return !isNaN(d.getTime()) && d < new Date() ? 'text-red-500' : 'text-slate-700';
                                            } catch (e) { return 'text-slate-700'; }
                                        })()}`}>
                                            {safeFormatDate(doc.expirationDate, 'MM/dd/yy')}
                                        </p>
                                    </div>
                                </div>

                                {/* Row 3: documentName */}
                                <div>
                                    <h5 className="text-sm font-black text-slate-900 tracking-tight leading-tight">
                                        {doc.documentName || '-'}
                                    </h5>
                                </div>

                                {/* Row 4: usaTicketNo */}
                                {doc.usaTicketNo && (
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">USA Ticket No</p>
                                        <p className="text-xs font-bold text-slate-600">
                                            {doc.usaTicketNo}
                                        </p>
                                    </div>
                                )}

                                {/* Main Attachments Preview (Optional, consistent with others) */}
                                {doc.documents && doc.documents.length > 0 && (
                                    <div className="flex flex-col gap-2 pt-2">
                                        {doc.documents.map((file: any, fIdx: number) => (
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
                                                    <div className="relative shrink-0 w-8 h-8 rounded-lg bg-violet-100/50 flex items-center justify-center">
                                                        {file.type?.startsWith('image/') ? (
                                                            <ImageIcon className="w-4 h-4 text-violet-600" />
                                                        ) : (
                                                            <Paperclip className="w-4 h-4 text-violet-600" />
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

                                {/* Row 5: createdBy, createdAt, actions */}
                                <div className="mt-1 pt-3 border-t border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            {doc.createdBy && doc.createdBy !== 'Unknown User' && doc.createdBy !== 'Unknown' && (
                                                <TooltipProvider>
                                                    {(() => {
                                                        const creator = getEmployeeData(doc.createdBy);
                                                        return (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="relative w-6 h-6 rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm overflow-hidden">
                                                                        {creator?.image ? <div className="relative w-full h-full"><Image fill sizes="(max-width: 768px) 100vw, 33vw" alt="" src={cld(creator.image, { w: 128, q: 'auto' })} className="object-cover w-full h-full" /></div> : (creator?.label?.[0]?.toUpperCase() || doc.createdBy?.[0]?.toUpperCase() || 'U')}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>Created By: {creator?.label || doc.createdBy}</p></TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })()}
                                                </TooltipProvider>
                                            )}
                                            {doc.createdAt && (
                                                <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                                                    {fmtDate(doc.createdAt)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 transition-opacity duration-300 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                        <button
                                            onClick={(e) => handleEditClick(originalIndex, e)}
                                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-violet-600 hover:border-violet-300 hover:bg-violet-50 transition-all flex items-center justify-center"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setItemIndexToDelete(originalIndex); }}
                                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-all flex items-center justify-center"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <p className="text-[10px] text-slate-400 font-bold text-center py-4">No planning documents</p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Modals ──────────────────────────────────────────────────────── */}

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingIndex !== null ? "Edit Planning Document" : "Add Planning Document"}
                maxWidth="3xl"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!newItem.planningType || !newItem.documentName}>
                            {editingIndex !== null ? 'Save Changes' : 'Add Document'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-6">
                    {/* First Row: Planning Type & USA Ticket No */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Planning Type</label>
                            <div className="relative">
                                <button
                                    id="planning-type-trigger-[[NEW]]"
                                    onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none flex items-center justify-between"
                                >
                                    <span className={newItem.planningType ? "text-slate-700 font-medium" : "text-slate-400"}>
                                        {newItem.planningType || "Select Type"}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                </button>
                                <MyDropDown
                                    isOpen={isTypeDropdownOpen}
                                    onClose={() => setIsTypeDropdownOpen(false)}
                                    anchorId="planning-type-trigger-[[NEW]]"
                                    options={planningOptions.map(p => ({
                                        id: p.id,
                                        label: p.label,
                                        value: p.value
                                    }))}
                                    selectedValues={newItem.planningType ? [newItem.planningType] : []}
                                    onSelect={(val) => {
                                        setNewItem(prev => ({ ...prev, planningType: val }));
                                        setIsTypeDropdownOpen(false);
                                    }}
                                    placeholder="Search Planning Type"
                                    width="w-full"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">USA Ticket No</label>
                            <Input
                                type="text"
                                placeholder="Optional"
                                value={newItem.usaTicketNo}
                                onChange={e => setNewItem(prev => ({ ...prev, usaTicketNo: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* Second Row: Date Submitted, Activation Date, Expiration Date */}
                    <div className="grid grid-cols-3 gap-4 border-t border-slate-100 pt-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date Submitted</label>
                            <Input
                                type="date"
                                value={newItem.dateSubmitted}
                                onChange={e => setNewItem(prev => ({ ...prev, dateSubmitted: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Activation Date</label>
                            <Input
                                type="date"
                                value={newItem.activationDate}
                                onChange={e => setNewItem(prev => ({ ...prev, activationDate: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Expiration Date</label>
                            <Input
                                type="date"
                                value={newItem.expirationDate}
                                onChange={e => setNewItem(prev => ({ ...prev, expirationDate: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* Third Row: Document Name & Attachments */}
                    <div className="grid grid-cols-2 gap-6 border-t border-slate-100 pt-5">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Document Name / Description</label>
                            <textarea
                                placeholder="Enter document name"
                                className="w-full h-[160px] bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                value={newItem.documentName}
                                onChange={e => setNewItem(prev => ({ ...prev, documentName: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-1.5 flex flex-col h-[160px]">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Attachments</label>
                            <div className="flex-1 border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3 transition-colors hover:bg-slate-50 hover:border-slate-300 relative">
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
                                    <p className="text-sm font-bold text-slate-600">Drag & Drop</p>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">or click to upload</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Render currently uploaded documents below */}
                    {newItem.documents.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {newItem.documents.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="relative w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                            {file.type?.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-blue-500" />}
                                        </div>
                                        <span className="text-xs font-bold text-slate-600 truncate">{file.name}</span>
                                    </div>
                                    <button
                                        onClick={() => setNewItem(prev => ({ ...prev, documents: prev.documents.filter((_, i) => i !== idx) }))}
                                        className="p-1.5 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors shrink-0"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Detail View Modal */}
            <Modal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                title="Planning Document Info"
            >
                {selectedViewItem && (
                    <div className="space-y-6">
                        <div className="flex flex-col bg-[#F4F7FA] p-6 rounded-[32px] border border-white/60 shadow-inner">
                            <div className="mb-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">Planning Type</label>
                                <span className="text-sm font-black px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 border border-violet-200">
                                    {selectedViewItem.planningType || '-'}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 border-t border-slate-200/50 pt-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">Submitted</label>
                                    <p className="text-sm font-black text-slate-800">
                                        {safeFormatDate(selectedViewItem.dateSubmitted, 'MM/dd/yy')}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">Active</label>
                                    <p className="text-sm font-black text-slate-800">
                                        {safeFormatDate(selectedViewItem.activationDate, 'MM/dd/yy')}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">Expires</label>
                                    <p className="text-sm font-black text-slate-800">
                                        {safeFormatDate(selectedViewItem.expirationDate, 'MM/dd/yy')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 block">Files & Documents</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {selectedViewItem.documents?.map((file: any, idx: number) => (
                                    <div
                                        key={idx}
                                        onClick={() => handleFileDownload(file.url, file.name)}
                                        className="group relative flex flex-col items-center gap-3 p-4 bg-white rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-violet-200 transition-all duration-300 overflow-hidden cursor-pointer"
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
                                                        <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mb-1">
                                                            <FileText className="w-6 h-6 text-violet-600" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mb-1">
                                                        <FileText className="w-6 h-6 text-violet-600" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-violet-700 uppercase tracking-widest bg-violet-100/50 px-2 py-0.5 rounded-full">
                                                        {file.name?.split('.').pop() || 'FILE'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-center w-full">
                                            <p className="text-xs font-bold text-slate-600 truncate px-1">{file.name}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Delete Confirmation */}
            <ConfirmModal
                isOpen={itemIndexToDelete !== null}
                onClose={() => setItemIndexToDelete(null)}
                onConfirm={confirmRemove}
                title="Delete Planning Document"
                message="Are you sure you want to delete this planning document? All associated files will also be removed."
                confirmText="Delete"
                variant="danger"
            />
        </>
    );
};
