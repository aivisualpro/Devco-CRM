'use client';

import { useState, useRef } from 'react';
import { User, Mail, Phone, MapPin, Briefcase, Calendar, ChevronDown, CheckCircle, XCircle, Building, FileSpreadsheet, Eye, Download, X, FileText, Upload, RefreshCw, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button, Modal, Badge } from '@/components/ui';

interface ClientContact {
    name: string;
    email?: string;
    phone?: string;
    extension?: string;
    type: string;
    active: boolean;
    address?: string;
}

interface ClientDocument {
    name: string;
    url: string;
    thumbnailUrl?: string;
    type: string;
    category?: string;
    uploadedAt?: string | Date;
}

const getCleanUrl = (url: string, downloadName?: string) => {
    if (!url) return '';
    let processedUrl = url;

    // If it's a direct R2 URL, convert to proxy
    if (url.includes('.r2.cloudflarestorage.com/')) {
        const parts = url.split('.r2.cloudflarestorage.com/');
        if (parts.length > 1) {
            processedUrl = `/api/docs/${parts[1]}`;
        }
    }

    if (downloadName && processedUrl.startsWith('/api/docs/')) {
        const separator = processedUrl.includes('?') ? '&' : '?';
        return `${processedUrl}${separator}name=${encodeURIComponent(downloadName)}`;
    }

    return processedUrl;
};

interface Client {
    _id: string; // recordId
    name: string;
    businessAddress?: string;
    proposalWriter?: string;
    status?: string;
    contacts?: ClientContact[];
    addresses?: string[];
    documents?: ClientDocument[];
    [key: string]: any;
}

interface ClientHeaderCardProps {
    client: Client;
    onUpdate: (field: string, value: any) => void;
    onAddContact?: () => void;
    onAddAddress?: () => void;
    onEditContact?: (index: number) => void;
    onRemoveContact?: (index: number) => void;
    onEditAddress?: (index: number) => void;
    onRemoveAddress?: (index: number) => void;
    animate: boolean;
}

export function ClientHeaderCard({ 
    client, 
    onUpdate, 
    onAddContact, 
    onAddAddress, 
    onEditContact,
    onRemoveContact,
    onEditAddress,
    onRemoveAddress,
    animate 
}: ClientHeaderCardProps) {
    const primaryContact = client.contacts?.find(c => c.active) || client.contacts?.[0];

    return (
        <div className="bg-[#eef2f6] rounded-[40px] shadow-[12px_12px_24px_#d1d9e6,-12px_-12px_24px_#ffffff] p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">

                {/* COLUMN 1: Client Details */}
                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff]">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">
                        Client Details
                    </label>
                    <div className="text-xl font-black text-slate-800 tracking-tight mb-2 underline decoration-indigo-500/30 underline-offset-4">
                        {client.name}
                    </div>
                    
                    <div className="space-y-2 mt-auto">
                        <div className="flex items-start gap-2 text-xs font-normal text-slate-600">
                            <MapPin className="w-3.5 h-3.5 text-rose-400 mt-0.5 flex-shrink-0" />
                            <span className="leading-snug">{client.businessAddress || 'No Address'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-normal text-slate-600">
                            <Building className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            <span className="truncate">{client.status || 'Active'}</span>
                        </div>
                    </div>
                </div>

                {/* COLUMN 2: Contacts (Deck View) */}
                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff]">
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                            Contacts
                        </label>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onAddContact?.(); }}
                            className="p-1 rounded-full bg-white/50 text-[#0F4C75] hover:bg-[#0F4C75] hover:text-white transition-all shadow-sm"
                            title="Add Contact"
                        >
                            <Plus size={10} />
                        </button>
                    </div>
                    <div className="flex flex-col gap-2 overflow-y-auto max-h-[140px] pr-1 thin-scrollbar">
                        {client.contacts?.length ? client.contacts.map((contact, i) => (
                            <div key={i} className="group relative flex flex-col p-2 bg-white/60 rounded-xl border border-white/50 shadow-sm transition-all hover:bg-white">
                                <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="text-[11px] font-normal text-slate-700 truncate">{contact.name}</span>
                                    <Badge variant={contact.active ? "success" : "default"} className="text-[8px] py-0 px-1.5 h-4 font-normal uppercase">
                                        {contact.type}
                                    </Badge>
                                </div>
                                {contact.address && (
                                    <div className="flex items-start gap-1 mb-1 text-[10px] text-slate-500 font-normal">
                                        <MapPin className="w-3 h-3 text-rose-400 mt-0.5 shrink-0" />
                                        <span className="truncate">{contact.address}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-[10px] text-slate-500 font-normal">
                                    <div className="flex items-center gap-1">
                                        <Phone className="w-3 h-3 text-emerald-400" />
                                        <span>{contact.phone || 'No phone'}</span>
                                    </div>
                                    {contact.email && (
                                        <div className="flex items-center gap-1 min-w-0">
                                            <Mail className="w-3 h-3 text-sky-400 shrink-0" />
                                            <span className="truncate">{contact.email}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Hover actions */}
                                <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-1 bg-white/90 backdrop-blur-sm p-0.5 rounded-lg shadow-sm border border-slate-100">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onEditContact?.(i); }}
                                        className="p-1 text-slate-400 hover:text-[#0F4C75] transition-colors"
                                    >
                                        <Pencil size={12} />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onRemoveContact?.(i); }}
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        )) : (
                            <div className="flex items-center justify-center h-20 text-[10px] text-slate-400 italic">No contacts registered</div>
                        )}
                    </div>
                </div>

                {/* COLUMN 3: Job/Billing Addresses (Deck View) */}
                <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff]">
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                            Job/Billing Addresses
                        </label>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onAddAddress?.(); }}
                            className="p-1 rounded-full bg-white/50 text-[#0F4C75] hover:bg-[#0F4C75] hover:text-white transition-all shadow-sm"
                            title="Add Address"
                        >
                            <Plus size={10} />
                        </button>
                    </div>
                    <div className="flex flex-col gap-2 overflow-y-auto max-h-[140px] pr-1 thin-scrollbar">
                        {client.addresses?.length ? client.addresses.map((address, i) => (
                            <div key={i} className="group relative flex items-start gap-2 p-2 bg-white/60 rounded-xl border border-white/50 shadow-sm transition-all hover:bg-white text-[10px] text-slate-600 leading-tight font-normal">
                                <MapPin className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                                <span className="pr-12">{address}</span>

                                {/* Hover actions */}
                                <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-1 bg-white/90 backdrop-blur-sm p-0.5 rounded-lg shadow-sm border border-slate-100 font-normal">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onEditAddress?.(i); }}
                                        className="p-1 text-slate-400 hover:text-[#0F4C75] transition-colors"
                                    >
                                        <Pencil size={12} />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onRemoveAddress?.(i); }}
                                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        )) : (
                            <div className="flex items-center justify-center h-20 text-[10px] text-slate-400 italic">No additional addresses</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Reusable Detail Row
interface DetailRowProps {
    label: string;
    value: string | number | undefined | null;
    isLink?: boolean;
    href?: string;
}

export function DetailRow({ label, value, isLink, href }: DetailRowProps) {
    return (
        <div className="flex items-center justify-between py-3 px-4 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest w-1/3">
                {label}
            </div>
            <div className={`flex-1 text-right text-sm font-medium ${isLink ? 'text-[#0F4C75]' : 'text-slate-700'}`}>
                {isLink ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline break-all">
                        {value || '-'}
                    </a>
                ) : (
                    <span className="break-words">{value || '-'}</span>
                )}
            </div>
        </div>
    );
}

export function DocumentGallery({
    documents,
    onRemove,
    onPreview,
    onUpload,
    isUploading = false
}: {
    documents: ClientDocument[],
    onRemove?: (index: number) => void,
    onPreview: (doc: ClientDocument) => void,
    onUpload: (files: File[]) => void,
    isUploading?: boolean
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [activeTab, setActiveTab] = useState('All');

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) onUpload(files);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            onUpload(files);
            e.target.value = '';
        }
    };

    if (isUploading) {
        return (
            <div className="p-12 flex flex-col items-center justify-center gap-4 text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin text-[#3282B8]" />
                <span className="text-sm font-medium animate-pulse">Uploading documents...</span>
            </div>
        );
    }

    const getCategory = (doc: ClientDocument) => {
        const name = doc.name || '';
        const ext = name.split('.').pop()?.toLowerCase() || '';

        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'Image';
        if (ext === 'pdf') return 'PDF';
        if (['doc', 'docx'].includes(ext)) return 'Doc';
        if (['csv', 'xls', 'xlsx'].includes(ext)) return 'CSV / Sheets';
        if (['zip', 'rar', '7z', 'gz'].includes(ext)) return 'Zip / Archives';

        return 'Other';
    };

    const tabs = ['All', 'PDF', 'Image', 'Doc', 'CSV / Sheets', 'Zip / Archives', 'Other'];

    const availableTabs = tabs.filter(tab =>
        tab === 'All' || documents.some(doc => getCategory(doc) === tab)
    );

    const filteredDocs = activeTab === 'All'
        ? documents
        : documents.filter(doc => getCategory(doc) === activeTab);

    return (
        <div
            className={`relative min-h-[300px] transition-all duration-300 ${isDragging ? 'bg-[#3282B8]/5' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
        >
            <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

            {isDragging && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#3282B8]/10 border-2 border-dashed border-[#3282B8]/40 rounded-2xl pointer-events-none">
                    <div className="bg-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3 scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-[#0F4C75] animate-bounce" />
                        <span className="text-[#0F4C75] font-bold uppercase tracking-wider text-sm">Drop files to upload</span>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
                    <div className="flex items-center gap-1 bg-slate-100/50 p-1 rounded-xl border border-slate-200 w-fit">
                        {availableTabs.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab ? 'bg-[#0F4C75] text-white shadow-md' : 'text-slate-500 hover:bg-white hover:text-[#0F4C75]'}`}
                            >
                                {tab}
                                <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === tab ? 'bg-white/20' : 'bg-slate-200 text-slate-500'}`}>
                                    {tab === 'All' ? documents.length : documents.filter(d => getCategory(d) === tab).length}
                                </span>
                            </button>
                        ))}
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[#0F4C75] hover:text-[#3282B8] hover:bg-[#3282B8]/5 font-bold text-xs uppercase tracking-widest self-end md:self-auto"
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Files
                    </Button>
                </div>

                {!documents || documents.length === 0 ? (
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="p-16 text-center flex flex-col items-center gap-4 cursor-pointer group hover:bg-slate-50/50 transition-colors rounded-3xl border-2 border-dashed border-slate-200 hover:border-[#3282B8]/50"
                    >
                        <div className="w-24 h-24 rounded-3xl bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform group-hover:bg-[#3282B8]/10">
                            <Upload className="w-10 h-10 text-slate-300 group-hover:text-[#0F4C75]" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-base text-slate-600 font-bold group-hover:text-[#0F4C75]">Drag or Click to upload</p>
                            <p className="text-xs text-slate-400">PDF, DOC, Images, CSV are supported</p>
                        </div>
                    </div>
                ) : filteredDocs.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center gap-2">
                        <FileText className="w-12 h-12 text-slate-200" />
                        <p className="text-sm font-medium text-slate-400">No {activeTab} files found</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-6">
                        {filteredDocs.map((doc, idx) => {
                            const isImage = doc.type?.startsWith('image/');
                            return (
                                <div key={idx} className="group relative flex flex-col gap-2">
                                    <div
                                        onClick={() => onPreview(doc)}
                                        className="aspect-[3/4] rounded-2xl bg-white border-2 border-slate-100 shadow-sm overflow-hidden group-hover:border-[#3282B8] group-hover:shadow-[#3282B8]/20 transition-all cursor-pointer relative"
                                    >
                                        {doc.thumbnailUrl ? (
                                            <img src={doc.thumbnailUrl} alt={doc.name} className="w-full h-full object-cover" />
                                        ) : isImage ? (
                                            <img src={getCleanUrl(doc.url)} alt={doc.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
                                                <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                                    <FileText className={`w-6 h-6 ${doc.type?.includes('pdf') ? 'text-red-500' : 'text-blue-500'}`} />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter bg-white px-2 py-0.5 rounded-full shadow-sm">{doc.type?.split('/').pop() || 'FILE'}</span>
                                            </div>
                                        )}

                                        <div className="absolute inset-0 bg-[#0F4C75]/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <div className="p-2 bg-white rounded-lg text-[#0F4C75] hover:scale-110 transition-transform shadow-lg">
                                                <Eye className="w-4 h-4" />
                                            </div>
                                            {onRemove && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const globalIndex = documents.indexOf(doc);
                                                        onRemove(globalIndex);
                                                    }}
                                                    className="p-2 bg-white rounded-lg text-red-500 hover:scale-110 transition-transform shadow-lg"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="px-1 text-center">
                                        <div className="text-[11px] font-bold text-slate-700 truncate w-full" title={doc.name}>{doc.name}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                            {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export function DocumentPreviewModal({ doc, isOpen, onClose }: { doc: ClientDocument | null, isOpen: boolean, onClose: () => void }) {
    if (!doc) return null;

    const isImage = doc.type?.startsWith('image/');
    const isPDF = doc.type?.includes('pdf');

    const handleDownload = () => {
        const extension = doc.url.split('.').pop() || 'pdf';
        const fileName = doc.name.toLowerCase().endsWith(`.${extension.toLowerCase()}`)
            ? doc.name
            : `${doc.name}.${extension}`;

        const link = document.createElement('a');
        link.href = getCleanUrl(doc.url, fileName);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={doc.name}
            footer={
                <div className="flex justify-between w-full">
                    <div className="text-xs text-slate-400 font-medium self-center">
                        Uploaded on {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : 'Unknown date'}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={onClose}>Close</Button>
                        <Button onClick={handleDownload}>
                            <Download className="w-4 h-4 mr-2" />
                            Download File
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="bg-slate-900 rounded-2xl overflow-hidden min-h-[500px] flex items-center justify-center relative group">
                {isImage ? (
                    <img src={getCleanUrl(doc.url)} alt={doc.name} className="max-w-full max-h-[70vh] object-contain shadow-2xl" />
                ) : isPDF ? (
                    <iframe
                        src={`${getCleanUrl(doc.url)}#toolbar=0`}
                        className="w-full h-[70vh] border-0"
                        title={doc.name}
                    />
                ) : (
                    <div className="text-center p-12">
                        <div className="w-24 h-24 rounded-3xl bg-white/10 flex items-center justify-center mx-auto mb-6">
                            <FileSpreadsheet className="w-12 h-12 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Preview not available</h3>
                        <p className="text-slate-400 mb-8 max-w-sm">This file type ({doc.type}) cannot be previewed directly in the browser.</p>
                        <Button onClick={handleDownload} variant="secondary">
                            <Download className="w-4 h-4 mr-2" />
                            Download to View
                        </Button>
                    </div>
                )}
            </div>
        </Modal>
    );
}

export function AccordionCard({ title, isOpen, onToggle, children, icon: Icon, rightElement, contentClassName, className = '', isStatic = false }: any) {
    return (
        <div className={`bg-white rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] overflow-hidden transition-all duration-300 border border-gray-100 ${className}`}>
            <div
                onClick={!isStatic ? onToggle : undefined}
                className={`w-full flex items-center justify-between p-4 transition-colors ${!isStatic ? 'cursor-pointer hover:bg-gray-50' : ''} ${isOpen || isStatic ? 'bg-slate-50/80' : 'bg-white'}`}
            >
                <div className="flex items-center gap-3">
                    {Icon && <Icon className="w-5 h-5 text-[#3282B8]" />}
                    <h3 className="text-lg font-bold text-slate-700 tracking-tight">{title}</h3>
                </div>
                <div className="flex items-center gap-4">
                    {rightElement && <div onClick={(e) => e.stopPropagation()}>{rightElement}</div>}
                    {!isStatic && (
                        <div className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                            <ChevronDown className="w-5 h-5" />
                        </div>
                    )}
                </div>
            </div>
            <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen || isStatic ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
                <div className={`p-0 ${contentClassName || ''}`}>
                    {children}
                </div>
            </div>
        </div>
    );
}
