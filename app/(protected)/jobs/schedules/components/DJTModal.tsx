import React, { useState, useEffect } from 'react';
import { 
    CheckCircle2, Edit, FilePlus, Clock, Download, Loader2, 
    Plus, Trash2, Image as ImageIcon, UserCheck, Info, XCircle
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
    handleDownloadPDF
}: DJTModalProps) => {
    const [lunchStart, setLunchStart] = useState('12:00');
    const [lunchEnd, setLunchEnd] = useState('12:30');
    const [activeTab, setActiveTab] = useState<'client' | 'info'>('client');
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
            maxWidth="4xl"
            preventClose={true}
        >
            {selectedDJT ? (
                <div className="flex flex-col h-[80vh] bg-white overflow-x-hidden -mx-4">
                    {/* Top Tabs - Only in Edit Mode */}
                    {isEditMode && (
                        <div className="flex bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
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
                            <button
                                onClick={() => setActiveTab('info')}
                                className={`flex-1 flex flex-col items-center justify-center gap-1 py-1.5 text-center transition-all relative ${activeTab === 'info' ? 'bg-white border-b-2 border-black' : 'hover:bg-slate-100/50'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Info size={16} className={activeTab === 'info' ? 'text-black' : 'text-slate-400'} />
                                    <span className={`text-xs font-bold uppercase tracking-wider ${activeTab === 'info' ? 'text-black' : 'text-slate-500'}`}>Devco</span>
                                </div>
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
                                                                    <div key={email} className={`p-3 rounded-xl border flex items-center justify-between ${sig ? 'bg-green-50 border-green-100' : 'bg-white border-slate-100'}`}>
                                                                        <div className="min-w-0">
                                                                            <p className="text-xs font-bold text-slate-900 truncate uppercase">{emp?.label || email}</p>
                                                                            <p className={`text-[9px] font-black uppercase ${sig ? 'text-green-600' : 'text-slate-400'}`}>
                                                                                {sig ? 'Signed' : 'Pending'}
                                                                            </p>
                                                                        </div>
                                                                        {!sig && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => setActiveSignatureEmployee(email)}
                                                                                className="px-3 py-1.5 bg-black text-white text-[9px] font-black rounded-lg uppercase"
                                                                            >
                                                                                Sign
                                                                            </button>
                                                                        )}
                                                                        {sig && <CheckCircle2 size={14} className="text-green-500" />}
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
                                                                const qty = currentItem?.qty || 0;
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
                                                                                value={qty}
                                                                                onChange={(e) => updateEquipment({ qty: Number(e.target.value) })}
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
                                                        onUpload={(url) => {
                                                            setSelectedDJT((prev: any) => ({
                                                                ...prev,
                                                                djtimages: [...(prev?.djtimages || []), url]
                                                            }));
                                                        }}
                                                        label="Upload Photos"
                                                        className="h-8 !px-3 !bg-slate-900 rounded-lg text-[10px] font-black uppercase"
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
                            <div className="p-8 flex-1 flex flex-col min-h-0 overflow-y-auto w-full">
                                <div className="flex items-center justify-end mb-6 gap-3">
                                    {handleDownloadPDF && (
                                        <button
                                            onClick={handleDownloadPDF}
                                            disabled={isGeneratingPDF}
                                            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 hover:text-black transition-all shadow-sm disabled:opacity-50 uppercase tracking-widest"
                                        >
                                            {isGeneratingPDF ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                            PDF
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsEditMode(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-[10px] font-black hover:bg-slate-800 transition-all shadow-lg shadow-black/5 uppercase tracking-widest"
                                    >
                                        <Edit size={12} />
                                        Edit
                                    </button>
                                </div>

                                <div className="space-y-12">
                                    {/* 1. Job Details & Progress */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Progress</label>
                                        <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 relative overflow-hidden group">
                                            <div className="absolute top-0 left-0 w-1.5 h-full bg-black"></div>
                                            <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{selectedDJT.dailyJobDescription || 'No description recorded.'}</p>
                                        </div>
                                    </div>

                                    {/* 2. Equipment Used */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Equipment Used</label>
                                        {(selectedDJT.equipmentUsed || []).length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {(selectedDJT.equipmentUsed || []).map((item: any, idx: number) => (
                                                    <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${item.type === 'rental' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                                {item.type || 'owned'}
                                                            </span>
                                                            <span className="text-lg font-black text-slate-900">x{item.qty || 1}</span>
                                                        </div>
                                                        <p className="text-sm font-black text-slate-800 tracking-tight leading-tight">
                                                            {(initialData?.equipmentItems || []).find((e: any) => e.value === item.equipment)?.label || 'Unknown Gear'}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center bg-slate-50/50 rounded-3xl border border-slate-100">
                                                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest italic">No equipment used</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. Site Photos */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Site Images</label>
                                        {(selectedDJT.djtimages || []).length > 0 ? (
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {(selectedDJT.djtimages || []).map((url: string, idx: number) => (
                                                    <div key={idx} className="aspect-square rounded-3xl overflow-hidden border border-slate-100 group cursor-pointer relative" onClick={() => setEnlargedImage(url)}>
                                                        <img src={url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-black text-[10px] uppercase tracking-widest">Enlarge</div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center bg-slate-50/50 rounded-3xl border border-slate-100">
                                                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest italic">No photos attached</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* 4. Crew Sign-Off */}
                                    <div className="space-y-6 pt-10 border-t border-slate-100">
                                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest text-center">Crew Sign-Off</h4>
                                        
                                        {activeSignatureEmployee ? (
                                            <div className="max-w-md mx-auto">
                                                <div className="mb-6 grid grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-3xl border border-slate-100 shadow-sm">
                                                    <div>
                                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                            <Clock size={12} className="text-blue-600" />
                                                            Lunch Start
                                                        </label>
                                                        <input 
                                                            type="time" 
                                                            value={lunchStart}
                                                            onChange={(e) => setLunchStart(e.target.value)}
                                                            className="w-full text-xs font-black text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                            <Clock size={12} className="text-blue-600" />
                                                            Lunch End
                                                        </label>
                                                        <input 
                                                            type="time" 
                                                            value={lunchEnd}
                                                            onChange={(e) => setLunchEnd(e.target.value)}
                                                            className="w-full text-xs font-black text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-2xl shadow-black/5 ring-1 ring-black/5">
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
                                                    className="mt-6 text-[10px] font-black text-slate-400 hover:text-rose-500 w-full text-center transition-all uppercase tracking-widest hover:bg-rose-50 py-2 rounded-lg"
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {(() => {
                                                    const scheduleId = selectedDJT.schedule_id || selectedDJT._id || selectedDJT.scheduleRef?._id;
                                                    const schedule = selectedDJT.scheduleRef || schedules.find(s => String(s._id) === String(scheduleId));
                                                    const assignees = schedule?.assignees || [];
                                                    
                                                    // Combine people from assignees and those who already signed
                                                    const sigs = selectedDJT.signatures || [];
                                                    const signatureEmails = sigs.map((s: any) => s.employee);
                                                    const allRelevantEmails = Array.from(new Set([...assignees, ...signatureEmails])).filter(Boolean) as string[];

                                                    if (allRelevantEmails.length === 0) {
                                                        return (
                                                            <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center py-10 bg-slate-50/50 rounded-[40px] border-2 border-dashed border-slate-100 mx-auto w-full max-w-lg">
                                                                <UserCheck className="w-10 h-10 text-slate-200 mb-3" />
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No Crew Members or Signatures</p>
                                                            </div>
                                                        );
                                                    }

                                                    return allRelevantEmails.map((email: string) => {
                                                        const emp = initialData.employees.find((e: any) => e.value === email);
                                                        const sig = (selectedDJT.signatures || []).find((s: any) => s.employee === email);
                                                        const timesheet = schedule?.timesheet?.find((t: any) => t.employee === email);

                                                        return (
                                                            <div key={email} className={`relative p-5 rounded-3xl border-2 transition-all group ${sig ? 'bg-white border-green-50 shadow-sm' : 'bg-slate-50 border-transparent hover:border-slate-100'}`}>
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center text-xs font-black text-slate-400 shrink-0 uppercase shadow-sm">
                                                                        {emp?.image ? <img src={emp.image} className="w-full h-full rounded-full object-cover" /> : emp?.label?.[0]}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-black text-slate-900 truncate uppercase tracking-tight">{emp?.label || email}</p>
                                                                        <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${sig ? 'text-green-500' : 'text-slate-300'}`}>
                                                                            {sig ? 'Confirmed DJT' : 'Pending Sign'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                
                                                                {sig ? (
                                                                    <div className="mt-4 pt-4 border-t border-slate-50 space-y-4">
                                                                        <div className="h-14 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                                                                            <img src={sig.signature} className="max-h-full max-w-full object-contain mix-blend-multiply" />
                                                                        </div>
                                                                        {timesheet && (
                                                                            <div className="grid grid-cols-2 gap-2">
                                                                                <div className="bg-slate-50 p-2.5 rounded-2xl flex flex-col items-center">
                                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">In</span>
                                                                                    <span className="text-[11px] font-black text-slate-900 font-mono">
                                                                                        {timesheet.clockIn ? new Date(timesheet.clockIn).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12: true}) : 'N/A'}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="bg-slate-50 p-2.5 rounded-2xl flex flex-col items-center">
                                                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Out</span>
                                                                                    <span className="text-[11px] font-black text-slate-900 font-mono">
                                                                                        {timesheet.clockOut ? new Date(timesheet.clockOut).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12: true}) : 'N/A'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setActiveSignatureEmployee(email)}
                                                                        className="w-full py-2.5 mt-4 text-[10px] font-black text-slate-600 bg-white border border-slate-200 hover:border-black hover:text-black rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-sm"
                                                                    >
                                                                        <Edit size={12} /> Sign Report
                                                                    </button>
                                                                )}
                                                                {sig && (
                                                                        <div className="absolute top-3 right-3 text-green-500 bg-green-50 p-1 rounded-full"><CheckCircle2 size={14} /></div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        )}
                                    </div>

                                    {/* 5. Client Verification */}
                                    <div className="space-y-6 pt-10 border-t border-slate-100">
                                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest text-center">Client Verification</h4>
                                        <div className="space-y-8">
                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Name</label>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <p className="text-base font-black text-slate-900">{selectedDJT.customerPrintName || 'Not Captured'}</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Signature</label>
                                                <div className="aspect-video max-w-md bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100 flex items-center justify-center overflow-hidden p-8">
                                                    {selectedDJT.customerSignature ? (
                                                        <img src={selectedDJT.customerSignature} alt="Signature" className="max-h-full object-contain mix-blend-multiply opacity-80" />
                                                    ) : (
                                                        <p className="text-sm font-bold text-slate-300 uppercase tracking-widest font-black">Awaiting Signature</p>
                                                    )}
                                                </div>
                                            </div>
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
