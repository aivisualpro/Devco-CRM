import React, { useState, useEffect } from 'react';
import { 
    CheckCircle2, Edit, FilePlus, Clock, Download, Loader2, 
    Plus, Trash2, Image as ImageIcon, UserCheck, Info, XCircle, Mail
} from 'lucide-react';
import { Modal, EmptyState, Tooltip, TooltipTrigger, TooltipContent, UploadButton, SearchableSelect, Badge } from '@/components/ui';
import SignaturePad from '../SignaturePad';

interface DJTModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDJT: any;
    setSelectedDJT: (djt: any) => void;
    isEditMode: boolean;
    setIsEditMode: (mode: boolean) => void;
    handleSave: (e: React.FormEvent) => void;
    handleSaveSignature: (data: any) => void;
    initialData: any;
    schedules: any[];
    activeSignatureEmployee: string | null;
    setActiveSignatureEmployee: (id: string | null) => void;
    isSavingSignature?: boolean;
    isGeneratingPDF?: boolean;
    handleDownloadPDF?: () => void;
    setEmailModalOpen?: (open: boolean) => void;
}

export const DJTModal = ({
    isOpen,
    onClose,
    selectedDJT,
    setSelectedDJT,
    isEditMode,
    setIsEditMode,
    handleSave,
    handleSaveSignature,
    initialData,
    schedules,
    activeSignatureEmployee,
    setActiveSignatureEmployee,
    isSavingSignature = false,
    isGeneratingPDF = false,
    handleDownloadPDF,
    setEmailModalOpen
}: DJTModalProps) => {
    const [lunchStart, setLunchStart] = useState('12:00');
    const [lunchEnd, setLunchEnd] = useState('12:30');
    const [activeTab, setActiveTab] = useState<'client' | 'info'>('info');
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

    useEffect(() => {
        if (activeSignatureEmployee) {
            setActiveTab('info');
            setLunchStart('12:00');
            setLunchEnd('12:30');
        }
    }, [activeSignatureEmployee]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Daily Job Ticket"
            maxWidth="2xl"
            preventClose={true}
        >
            {selectedDJT ? (
                <div className="flex flex-col max-h-[75vh] bg-white overflow-x-hidden -mx-4">
                    {/* Top Tabs - Only in Edit Mode */}
                    {isEditMode && (
                        <div className="flex bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                            <button
                                onClick={() => setActiveTab('info')}
                                className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 text-center transition-all relative ${activeTab === 'info' ? 'bg-white border-b-2 border-black' : 'hover:bg-slate-100/50'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Info size={16} className={activeTab === 'info' ? 'text-black' : 'text-slate-400'} />
                                    <span className={`text-xs font-bold uppercase tracking-wider ${activeTab === 'info' ? 'text-black' : 'text-slate-500'}`}>Devco</span>
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('client')}
                                className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 text-center transition-all relative ${activeTab === 'client' ? 'bg-white border-b-2 border-black' : 'hover:bg-slate-100/50'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <UserCheck size={16} className={activeTab === 'client' ? 'text-black' : 'text-slate-400'} />
                                    <span className={`text-xs font-bold uppercase tracking-wider ${activeTab === 'client' ? 'text-black' : 'text-slate-500'}`}>Client</span>
                                </div>
                                {selectedDJT.customerSignature && (
                                    <div className="absolute top-2 right-2 text-green-500">
                                        <CheckCircle2 size={12} />
                                    </div>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white">
                        {isEditMode ? (
                            <form onSubmit={handleSave} className="p-8 flex-1 flex flex-col min-h-0 w-full">
                                {activeTab === 'client' ? (
                                    <div className="space-y-6">

                                        <div className="space-y-4 pt-4 border-t border-slate-50">
                                            <div className="space-y-2">
                                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Customer Name</label>
                                                <input 
                                                    type="text"
                                                    className="w-full text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                                                    placeholder="Enter customer name"
                                                    value={selectedDJT.customerPrintName || ''}
                                                    onChange={(e) => setSelectedDJT({...selectedDJT, customerPrintName: e.target.value})}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Digital Signature</label>
                                                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-inner">
                                                    {selectedDJT.customerSignature ? (
                                                        <div className="relative p-8 flex flex-col items-center justify-center min-h-[200px]">
                                                            <img 
                                                                src={selectedDJT.customerSignature} 
                                                                alt="Customer Signature" 
                                                                className="max-h-40 object-contain hover:scale-105 transition-transform" 
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedDJT({...selectedDJT, customerSignature: null})}
                                                                className="mt-6 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-50 transition-all shadow-sm"
                                                            >
                                                                Clear & Re-sign
                                                            </button>
                                                            <p className="absolute top-4 right-4 text-[10px] text-green-600 font-black bg-green-50 px-2 py-1 rounded-full flex items-center gap-1.5 uppercase">
                                                                <CheckCircle2 size={10} /> Verified
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <SignaturePad 
                                                            employeeName={selectedDJT.customerPrintName || "Customer"}
                                                            onSave={(sigUrl) => setSelectedDJT({...selectedDJT, customerSignature: sigUrl})} 
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8">

                                            {/* Job Description */}
                                            <div className="space-y-2">
                                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">1. Job Description</label>
                                                <textarea 
                                                    required
                                                    rows={4}
                                                    className="w-full text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all resize-none placeholder:text-slate-400"
                                                    placeholder="Detailed description of today's work..."
                                                    value={selectedDJT.dailyJobDescription || ''}
                                                    onChange={(e) => setSelectedDJT({...selectedDJT, dailyJobDescription: e.target.value})}
                                                />
                                            </div>

                                            {/* Employee Signatures Section - Integrated into Form */}
                                            <div className="space-y-4 pt-4 border-t border-slate-50">
                                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">2. Crew Sign-Off</label>
                                                
                                                {activeSignatureEmployee ? (
                                                    <div className="max-w-md mx-auto">
                                                        <div className="mb-4 grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                            <div>
                                                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Lunch Start</label>
                                                                <input 
                                                                    type="time" 
                                                                    value={lunchStart}
                                                                    onChange={(e) => setLunchStart(e.target.value)}
                                                                    className="w-full text-xs font-black text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-1.5"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Lunch End</label>
                                                                <input 
                                                                    type="time" 
                                                                    value={lunchEnd}
                                                                    onChange={(e) => setLunchEnd(e.target.value)}
                                                                    className="w-full text-xs font-black text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-1.5"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner">
                                                            <SignaturePad 
                                                                isLoading={isSavingSignature}
                                                                employeeName={initialData.employees.find((e: any) => e.value === activeSignatureEmployee)?.label || activeSignatureEmployee}
                                                                onSave={(sigUrl) => handleSaveSignature({
                                                                    signature: sigUrl,
                                                                    lunchStart,
                                                                    lunchEnd
                                                                })} 
                                                            />
                                                        </div>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setActiveSignatureEmployee(null)} 
                                                            className="mt-4 text-[10px] font-black text-slate-400 hover:text-rose-500 w-full text-center transition-all uppercase"
                                                        >
                                                            Cancel Sign
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {(() => {
                                                            const schedule = selectedDJT.scheduleRef || schedules.find(s => s._id === (selectedDJT.schedule_id || selectedDJT._id));
                                                            const assignees = schedule?.assignees || [];
                                                            
                                                            // Combine people from assignees and those who already signed
                                                            const signatureEmails = (selectedDJT.signatures || []).map((s: any) => s.employee);
                                                            const allRelevantEmails = Array.from(new Set([...assignees, ...signatureEmails])).filter(Boolean) as string[];
                                                            
                                                            if (allRelevantEmails.length === 0) {
                                                                return <p className="text-xs text-slate-400 italic py-4 col-span-2 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">No assignees or signatures found.</p>;
                                                            }

                                                            return allRelevantEmails.map((email: string) => {
                                                                const emp = initialData.employees.find((e: any) => e.value === email);
                                                                const sig = (selectedDJT.signatures || []).find((s: any) => s.employee === email);

                                                                return (
                                                                    <div key={email} className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${sig ? 'bg-green-50 border-green-100' : 'bg-white border-slate-100'}`}>
                                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                            {/* Tiny signature image */}
                                                                            {sig?.signature && (
                                                                                <div className="w-7 h-7 rounded-md bg-white border border-green-200 overflow-hidden flex-shrink-0 shadow-sm">
                                                                                    <img 
                                                                                        src={sig.signature} 
                                                                                        alt="Signature" 
                                                                                        className="w-full h-full object-contain"
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                            <div className="min-w-0">
                                                                                <p className="text-xs font-bold text-slate-900 truncate uppercase">{emp?.label || email}</p>
                                                                                <p className={`text-[9px] font-black uppercase ${sig ? 'text-green-600' : 'text-slate-400'}`}>
                                                                                    {sig ? 'Signed' : 'Pending'}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        {!sig && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setActiveSignatureEmployee(email)}
                                                                                className="px-3 py-1.5 bg-black text-white text-[9px] font-black rounded-lg uppercase flex-shrink-0"
                                                                            >
                                                                                Sign
                                                                            </button>
                                                                        )}
                                                                        {sig && <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />}
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Equipment Used Table */}
                                            <div className="space-y-4 pt-4 border-t border-slate-50">
                                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">3. Equipment Used</label>
                                                
                                                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                                                    <table className="w-full text-left border-collapse table-fixed">
                                                        <thead className="bg-slate-50">
                                                            <tr>
                                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-1/2">Equipment</th>
                                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-1/3">Type</th>
                                                                <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-20">Qty</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {(initialData.equipmentItems || []).map((eq: any) => {
                                                                    const currentItem = (selectedDJT.equipmentUsed || []).find((i: any) => i.equipment === eq.value);
                                                                    const qty = currentItem?.qty;
                                                                const type = currentItem?.type || 'owned';

                                                                const updateEquipment = (updates: any) => {
                                                                    const newList = [...(selectedDJT.equipmentUsed || [])];
                                                                    const idx = newList.findIndex(i => i.equipment === eq.value);
                                                                    if (idx > -1) {
                                                                        newList[idx] = { ...newList[idx], ...updates };
                                                                    } else {
                                                                        newList.push({ equipment: eq.value, type: 'owned', qty: 0, cost: eq.dailyCost || 0, ...updates });
                                                                    }
                                                                    setSelectedDJT({ ...selectedDJT, equipmentUsed: newList });
                                                                };

                                                                return (
                                                                    <tr key={eq.value} className="hover:bg-slate-50/50 transition-colors">
                                                                        <td className="px-4 py-3 text-xs font-bold text-slate-900">{eq.label}</td>
                                                                        <td className="px-4 py-3">
                                                                            <div className="flex gap-1">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => updateEquipment({ type: 'owned' })}
                                                                                    className={`px-2 py-1 text-[9px] font-black rounded uppercase transition-all ${type === 'owned' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                                                >
                                                                                    Owned
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => updateEquipment({ type: 'rental' })}
                                                                                    className={`px-2 py-1 text-[9px] font-black rounded uppercase transition-all ${type === 'rental' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                                                >
                                                                                    Rental
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-4 py-3">
                                                                            <input 
                                                                                type="number"
                                                                                min="0"
                                                                                className="w-16 text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded p-1.5 focus:outline-none focus:border-black"
                                                                                value={qty ?? ''}
                                                                                onChange={(e) => updateEquipment({ qty: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Job Images */}
                                            <div className="space-y-4 pt-4 border-t border-slate-50">
                                                <div className="flex items-center justify-between">
                                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">4. Site Images</label>
                                                    <UploadButton 
                                                        multiple={true}
                                                        accept="image/*"
                                                        onUpload={(url) => {
                                                            setSelectedDJT((prev: any) => ({
                                                                ...prev,
                                                                djtimages: [...(prev?.djtimages || []), url]
                                                            }));
                                                        }}
                                                        label="Upload Photos"
                                                        className="h-8 !px-3 !bg-slate-900 rounded-lg text-[10px] !text-white font-black uppercase"
                                                    />
                                                </div>
                                                
                                                <div className="grid grid-cols-4 gap-3">
                                                    {(selectedDJT.djtimages || []).map((imgUrl: string, idx: number) => (
                                                        <div key={idx} className="relative aspect-square bg-slate-50 rounded-xl overflow-hidden group border border-slate-100 shadow-sm">
                                                            <img src={imgUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={`DJT ${idx}`} />
                                                            <button 
                                                                type="button"
                                                                onClick={() => {
                                                                    const newList = selectedDJT.djtimages.filter((_: any, i: number) => i !== idx);
                                                                    setSelectedDJT({ ...selectedDJT, djtimages: newList });
                                                                }}
                                                                className="absolute top-1 right-1 p-1 bg-white/90 rounded-full text-rose-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {(!selectedDJT.djtimages || selectedDJT.djtimages.length === 0) && (
                                                        <div className="col-span-4 py-6 border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center gap-2">
                                                            <ImageIcon size={20} className="text-slate-200" />
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">No photos uploaded</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                <div className="flex gap-4 pt-6 mt-auto sticky bottom-0 bg-white border-t border-slate-50 p-6 -mx-8 -mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditMode(false)}
                                        className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-500 text-xs font-black rounded-xl hover:bg-slate-50 transition-all uppercase tracking-widest"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] px-4 py-3 bg-black text-white text-xs font-black rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-xl shadow-black/10"
                                    >
                                        Save
                                    </button>
                                </div>
                            </form>
                        ) : (
                        <div className="p-6 flex-1 flex flex-col min-h-0 overflow-y-auto w-full">
                                <div className="flex items-center justify-end mb-4 gap-2">
                                    {handleDownloadPDF && (
                                        <>
                                            {setEmailModalOpen && (
                                                <button
                                                    onClick={() => setEmailModalOpen(true)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:text-[#0F4C75] hover:border-[#0F4C75] transition-all"
                                                >
                                                    <Mail size={12} />
                                                    EMAIL
                                                </button>
                                            )}
                                            <button
                                                onClick={handleDownloadPDF}
                                                disabled={isGeneratingPDF}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:text-black hover:border-slate-300 transition-all disabled:opacity-50"
                                            >
                                                {isGeneratingPDF ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                                PDF
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => setIsEditMode(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-bold hover:bg-black transition-all"
                                    >
                                        <Edit size={12} />
                                        Edit
                                    </button>
                                </div>

                                <div className="space-y-5">
                                    {/* Ticket Info Section */}
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 mb-4">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Created By</p>
                                            {(() => {
                                                const creator = initialData.employees.find((e: any) => e.value === selectedDJT.createdBy);
                                                if (creator) {
                                                    return (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                                                {creator.image ? <img src={creator.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-slate-500">{creator.label?.[0]}</div>}
                                                            </div>
                                                            <p className="text-sm font-bold text-slate-700 truncate">{creator.label}</p>
                                                        </div>
                                                    );
                                                }
                                                return <p className="text-sm font-bold text-slate-700 truncate">{selectedDJT.createdBy || 'Unknown'}</p>;
                                            })()}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Date & Time</p>
                                            <p className="text-sm font-bold text-slate-700">
                                                {(() => {
                                                    const schedule = selectedDJT.scheduleRef || schedules.find((s: any) => String(s._id) === String(selectedDJT.schedule_id || selectedDJT._id));
                                                    const dateVal = schedule?.fromDate || selectedDJT.date || selectedDJT.createdAt;
                                                    if (!dateVal) return 'N/A';
                                                    const d = new Date(dateVal);
                                                    if (isNaN(d.getTime())) return 'N/A';
                                                    const dateStr = d.toLocaleDateString('en-US', { timeZone: 'UTC' });
                                                    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
                                                    return `${dateStr} at ${timeStr}`;
                                                })()}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Client Email</p>
                                            <p className="text-sm font-bold text-slate-700">{selectedDJT.clientEmail || '-'}</p>
                                        </div>
                                         <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Emailed</p>
                                            <div className="flex items-center gap-2 mt-0.5 group relative">
                                                <p className="text-sm font-bold text-slate-700">{selectedDJT.emailCounter || 0} times</p>
                                                {selectedDJT.emailCounter > 0 && selectedDJT.djtEmails && (
                                                    <div className="hidden group-hover:block absolute top-full left-0 mt-2 z-50 w-64 bg-slate-800 text-white p-3 rounded-xl shadow-xl text-xs">
                                                        <p className="font-bold border-b border-slate-700 pb-1 mb-2">Email History</p>
                                                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                                            {selectedDJT.djtEmails.slice().reverse().map((email: any, idx: number) => (
                                                                <div key={idx} className="flex justify-between items-start gap-2">
                                                                    <span className="truncate flex-1 text-slate-300">{email.emailto}</span>
                                                                    <span className="text-[10px] text-slate-500 shrink-0">{new Date(email.createdAt).toLocaleDateString()}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Today's Progress */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 block">Today's Progress</label>
                                        <div className="p-4 bg-slate-50 rounded-xl border-l-4 border-slate-900">
                                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedDJT.dailyJobDescription || 'No description recorded.'}</p>
                                        </div>
                                    </div>

                                    {/* Equipment Used - Stacked in single column */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 block">Equipment Used</label>
                                        {(selectedDJT.equipmentUsed || []).length > 0 ? (
                                            <div className="flex flex-col gap-2">
                                                {(selectedDJT.equipmentUsed || []).filter((item: any) => item.qty > 0).map((item: any, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-sm">
                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${item.type === 'rental' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                            {item.type || 'owned'}
                                                        </span>
                                                        <span className="text-xs font-semibold text-slate-800 flex-1">
                                                            {(initialData?.equipmentItems || []).find((e: any) => String(e.value) === String(item.equipment))?.label || item.equipment || 'Equipment'}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">×{item.qty || 1}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">No equipment logged</p>
                                        )}
                                    </div>

                                    {/* Site Images - Smaller grid */}
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 block">Site Images</label>
                                        {(selectedDJT.djtimages || []).length > 0 ? (
                                            <div className="grid grid-cols-4 gap-2">
                                                {(selectedDJT.djtimages || []).map((url: string, idx: number) => (
                                                    <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-slate-100 group cursor-pointer" onClick={() => setEnlargedImage(url)}>
                                                        <img src={url} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic">No photos attached</p>
                                        )}
                                    </div>
                                </div>

                                {/* Crew Sign-Off - Compact */}
                                <div className="mt-6 pt-5 border-t border-slate-100">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Crew Sign-Off</h4>
                                    
                                    {activeSignatureEmployee ? (
                                        <div className="max-w-sm mx-auto">
                                            <div className="mb-3 grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl">
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Lunch Start</label>
                                                    <input 
                                                        type="time" 
                                                        value={lunchStart}
                                                        onChange={(e) => setLunchStart(e.target.value)}
                                                        className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-slate-400"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Lunch End</label>
                                                    <input 
                                                        type="time" 
                                                        value={lunchEnd}
                                                        onChange={(e) => setLunchEnd(e.target.value)}
                                                        className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-slate-400"
                                                    />
                                                </div>
                                            </div>
                                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                 <SignaturePad 
                                                    isLoading={isSavingSignature}
                                                    employeeName={initialData.employees.find((e: any) => e.value === activeSignatureEmployee)?.label || activeSignatureEmployee}
                                                    onSave={(sigUrl) => handleSaveSignature({
                                                        signature: sigUrl,
                                                        lunchStart,
                                                        lunchEnd
                                                    })} 
                                                />
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={() => setActiveSignatureEmployee(null)} 
                                                className="mt-3 text-[10px] font-bold text-slate-400 hover:text-rose-500 w-full text-center"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            {(() => {
                                                const scheduleId = selectedDJT.schedule_id || selectedDJT._id || selectedDJT.scheduleRef?._id;
                                                const schedule = selectedDJT.scheduleRef || schedules.find(s => String(s._id) === String(scheduleId));
                                                const assignees = schedule?.assignees || [];
                                                
                                                const sigs = selectedDJT.signatures || [];
                                                const signatureEmails = sigs.map((s: any) => s.employee);
                                                const allRelevantEmails = Array.from(new Set([...assignees, ...signatureEmails])).filter(Boolean) as string[];

                                                if (allRelevantEmails.length === 0) {
                                                    return (
                                                        <div className="col-span-2 py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                            <p className="text-xs text-slate-400">No crew members assigned</p>
                                                        </div>
                                                    );
                                                }

                                                return allRelevantEmails.map((email: string) => {
                                                    const emp = initialData.employees.find((e: any) => e.value === email);
                                                    const sig = (selectedDJT.signatures || []).find((s: any) => s.employee === email);
                                                    const timesheet = schedule?.timesheet?.find((t: any) => t.employee === email);

                                                    return (
                                                        <div key={email} className={`p-3 rounded-xl border flex items-center gap-3 ${sig ? 'bg-green-50/50 border-green-100' : 'bg-white border-slate-100'}`}>
                                                            {/* Show signature thumbnail if signed, otherwise show avatar */}
                                                            {sig?.signature ? (
                                                                <div className="w-8 h-8 rounded-md bg-white border border-green-200 overflow-hidden flex-shrink-0 shadow-sm">
                                                                    <img 
                                                                        src={sig.signature} 
                                                                        alt="Signature" 
                                                                        className="w-full h-full object-contain"
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 shrink-0 overflow-hidden">
                                                                    {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : emp?.label?.[0]?.toUpperCase()}
                                                                </div>
                                                            )}
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-semibold text-slate-900 truncate">{emp?.label || email}</p>
                                                                <p className={`text-[9px] font-medium ${sig ? 'text-green-600' : 'text-slate-400'}`}>
                                                                    {sig ? 'Signed' : 'Pending'}
                                                                </p>
                                                            </div>
                                                            {sig ? (
                                                                <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setActiveSignatureEmployee(email)}
                                                                    className="px-2 py-1 text-[9px] font-bold text-white bg-slate-900 rounded-md hover:bg-black shrink-0"
                                                                >
                                                                    Sign
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {/* Client Verification - Compact */}
                                <div className="mt-5 pt-5 border-t border-slate-100">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Client Verification</h4>
                                    <div className="flex items-start gap-4">
                                        <div className="flex-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Customer Name</label>
                                                <p className="text-sm font-semibold text-slate-900">{selectedDJT.customerPrintName || 'Not Captured'}</p>
                                        </div>
                                        <div className="w-32 h-16 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                                            {selectedDJT.customerSignature ? (
                                                <img src={selectedDJT.customerSignature} alt="Signature" className="max-h-full object-contain" />
                                            ) : (
                                                <p className="text-[9px] text-slate-300 font-medium">No signature</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Lightbox Overlay */}
                    {enlargedImage && (
                        <div 
                            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
                            onClick={() => setEnlargedImage(null)}
                        >
                            <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors">
                                <XCircle size={32} />
                            </button>
                            <img 
                                src={enlargedImage} 
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300" 
                                alt="Enlarged Site Photo" 
                            />
                        </div>
                    )}
                </div>
            ) : (
                <EmptyState title="Missing Ticket Data" message="We couldn't retrieve the details for this ticket." />
            )}
        </Modal>
    );
};
