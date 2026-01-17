import React, { useState, useEffect } from 'react';
import { 
    CheckCircle2, Edit, FilePlus, Clock
} from 'lucide-react';
import { Modal, EmptyState, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui';
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
    isSavingSignature = false
}: DJTModalProps) => {
    const [lunchStart, setLunchStart] = useState('12:00');
    const [lunchEnd, setLunchEnd] = useState('12:30');

    useEffect(() => {
        if (activeSignatureEmployee) {
            setLunchStart('12:00');
            setLunchEnd('12:30');
        }
    }, [activeSignatureEmployee]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Daily Job Ticket"
            maxWidth="md"
        >
            {selectedDJT ? (
                isEditMode ? (
                    <form onSubmit={handleSave} className="py-2">
                        <div className="space-y-6">
                            
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-900">Daily Job Description</label>
                                <textarea 
                                    required
                                    rows={4}
                                    className="w-full text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all resize-none placeholder:text-slate-400"
                                    placeholder="Detailed description of today's work..."
                                    value={selectedDJT.dailyJobDescription || ''}
                                    onChange={(e) => setSelectedDJT({...selectedDJT, dailyJobDescription: e.target.value})}
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-900">Name</label>
                                <input 
                                    type="text"
                                    className="w-full text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                                    placeholder="Enter customer name"
                                    value={selectedDJT.customerPrintName || ''}
                                    onChange={(e) => setSelectedDJT({...selectedDJT, customerPrintName: e.target.value})}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-sm font-bold text-slate-900">Signature</label>
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                                    {selectedDJT.customerSignature ? (
                                        <div className="relative p-4 flex flex-col items-center justify-center bg-slate-50">
                                            <img 
                                                src={selectedDJT.customerSignature} 
                                                alt="Customer Signature" 
                                                className="max-h-32 object-contain mb-4" 
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setSelectedDJT({...selectedDJT, customerSignature: null})}
                                                className="text-xs text-red-500 hover:text-red-700 font-bold hover:underline"
                                            >
                                                Clear & Re-sign
                                            </button>
                                            <p className="absolute top-2 right-2 text-xs text-green-600 font-bold flex items-center gap-1">
                                                <CheckCircle2 size={12} /> Captured
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

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditMode(false)}
                                    className="px-6 py-2 bg-white border border-slate-200 text-slate-900 text-sm font-bold rounded-lg hover:bg-slate-50 transition-all font-sans"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-[#1A1A1A] text-white text-sm font-bold rounded-lg hover:bg-black transition-all flex items-center gap-2 font-sans shadow-sm"
                                >
                                    Save Job Ticket
                                </button>
                            </div>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-6 pt-2">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Summary</h4>
                            <button
                                onClick={() => setIsEditMode(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] text-white rounded-lg text-xs font-bold hover:bg-black transition-all shadow-sm"
                            >
                                <Edit size={14} />
                                EDIT
                            </button>
                        </div>

                        <div className="space-y-6 text-sm">
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Description</label>
                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedDJT.dailyJobDescription || 'No description provided.'}</p>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Customer Name</label>
                                <p className="font-bold text-slate-900">{selectedDJT.customerPrintName || 'Not recorded'}</p>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Customer Confirmation</label>
                                <div className="max-w-[200px] h-24 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-center overflow-hidden">
                                    {selectedDJT.customerSignature ? (
                                        <img src={selectedDJT.customerSignature} alt="Signature" className="max-w-full max-h-full object-contain" />
                                    ) : (
                                        <p className="text-xs italic text-slate-400">No signature</p>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <h4 className="text-xs font-bold text-slate-900 uppercase mb-4 flex justify-between items-center">
                                    <span>Employee Signatures</span>
                                </h4>
                                
                                {activeSignatureEmployee ? (
                                    <div className="max-w-md">
                                        <div className="mb-4 grid grid-cols-2 gap-4 bg-slate-50/80 p-3 rounded-xl border border-slate-100 shadow-sm">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                    <Clock size={10} className="text-[#0F4C75]" />
                                                    Lunch Start
                                                </label>
                                                <div className="relative group">
                                                    <input 
                                                        type="time" 
                                                        value={lunchStart}
                                                        onChange={(e) => setLunchStart(e.target.value)}
                                                        className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] transition-all"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                    <Clock size={10} className="text-[#0F4C75]" />
                                                    Lunch End
                                                </label>
                                                <div className="relative group">
                                                    <input 
                                                        type="time" 
                                                        value={lunchEnd}
                                                        onChange={(e) => setLunchEnd(e.target.value)}
                                                        className="w-full text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]/20 focus:border-[#0F4C75] transition-all"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="border border-slate-200 rounded-lg overflow-hidden">
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
                                        {isSavingSignature ? (
                                            <p className="mt-2 text-xs text-slate-400 italic text-center animate-pulse">Saving signature and syncing timesheet...</p>
                                        ) : (
                                            <button 
                                                type="button" 
                                                onClick={() => setActiveSignatureEmployee(null)} 
                                                className="mt-2 text-xs text-slate-500 hover:text-rose-500 hover:underline w-full text-center transition-colors"
                                            >
                                                Cancel Signing
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {(() => {
                                            const schedule = schedules.find(s => s._id === (selectedDJT.schedule_id || selectedDJT._id));
                                            const assignees = schedule?.assignees || [];
                                            const uniqueAssignees = Array.from(new Set(assignees)).filter(Boolean) as string[];

                                            if (uniqueAssignees.length === 0 && (!selectedDJT.signatures || selectedDJT.signatures.length === 0)) {
                                                return <p className="text-xs text-slate-400 italic">No assignees found.</p>;
                                            }

                                            return uniqueAssignees.map((email: string) => {
                                                const emp = initialData.employees.find((e: any) => e.value === email);
                                                const sig = selectedDJT.signatures?.find((s: any) => s.employee === email);
                                                
                                                // Check for timesheet data existence - logic to display clock in/out if available
                                                // Ideally, we would have timesheet data attached to the schedule or djt object.
                                                // Assuming schedule.timesheet array exists and we can match by employee and date.
                                                // But 'schedule' here comes from 'schedules' prop.
                                                
                                                const timesheet = schedule?.timesheet?.find((t: any) => t.employee === email);
                                                // Note: This matches ANY timesheet for this employee on this schedule. 
                                                // If there are multiple, it picks first. Basic logic for now.

                                                return (
                                                    <div key={email} className={`relative p-3 rounded-lg border transition-all ${sig ? 'bg-white border-green-200' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0 uppercase">
                                                                {emp?.image ? <img src={emp.image} className="w-full h-full rounded-full object-cover" /> : emp?.label?.[0]}
                                                            </div>
                                                            <div className="overflow-hidden min-w-0 flex-1">
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <p className="text-xs font-bold text-slate-700 truncate">{emp?.label || email}</p>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>{emp?.label || email}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                                <p className="text-[10px] text-slate-400">{sig ? 'Signed & Clocked Out' : 'Pending'}</p>
                                                            </div>
                                                        </div>
                                                        
                                                        {sig ? (
                                                            <div className="mt-3 space-y-3">
                                                                <div className="h-12 border-t border-slate-50 flex items-center justify-center py-1">
                                                                    <img src={sig.signature} className="max-h-full max-w-full object-contain opacity-90" />
                                                                </div>
                                                                {timesheet && (
                                                                    <div className="grid grid-cols-2 gap-px bg-slate-100 rounded-lg overflow-hidden border border-slate-100">
                                                                        <div className="bg-slate-50 p-2 flex flex-col items-center">
                                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Clock In</span>
                                                                            <span className="text-xs font-black text-slate-700 font-mono">
                                                                                {new Date(timesheet.clockIn).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12: true})}
                                                                            </span>
                                                                        </div>
                                                                        <div className="bg-slate-50 p-2 flex flex-col items-center">
                                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Clock Out</span>
                                                                            <span className="text-xs font-black text-slate-700 font-mono">
                                                                                {new Date(timesheet.clockOut).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', hour12: true})}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveSignatureEmployee(email)}
                                                                className="w-full py-2 mt-3 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
                                                            >
                                                                <Edit size={12} /> Sign
                                                            </button>
                                                        )}
                                                        {sig && (
                                                                <div className="absolute top-2 right-2 text-green-500"><CheckCircle2 size={16} /></div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex justify-end pt-2">
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-white border border-slate-200 text-slate-900 text-sm font-bold rounded-lg hover:bg-slate-50 transition-all font-sans"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )
            ) : (
                <EmptyState title="No Data" message="Unable to load DJT details." />
            )}
        </Modal>
    );
};
