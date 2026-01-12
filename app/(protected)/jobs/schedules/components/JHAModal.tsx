import React from 'react';
import { 
    Loader2, Download, Mail, Edit, CheckCircle2, AlertCircle, Plus, FilePlus, X
} from 'lucide-react';
import { Modal, EmptyState } from '@/components/ui';
import SignaturePad from '../SignaturePad';

interface JHAModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedJHA: any;
    setSelectedJHA: (jha: any) => void;
    isEditMode: boolean;
    setIsEditMode: (mode: boolean) => void;
    handleSave: (e: React.FormEvent) => void;
    handleSaveSignature: (signature: string) => void;
    isGeneratingPDF: boolean;
    handleDownloadPDF: () => void;
    setEmailModalOpen: (open: boolean) => void;
    initialData: any;
    schedules: any[];
    activeSignatureEmployee: string | null;
    setActiveSignatureEmployee: (id: string | null) => void;
}

export const JHAModal = ({
    isOpen,
    onClose,
    selectedJHA,
    setSelectedJHA,
    isEditMode,
    setIsEditMode,
    handleSave,
    handleSaveSignature,
    isGeneratingPDF,
    handleDownloadPDF,
    setEmailModalOpen,
    initialData,
    schedules,
    activeSignatureEmployee,
    setActiveSignatureEmployee
}: JHAModalProps) => {

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Job Hazard Analysis (JHA)"
            maxWidth="4xl"
        >
            {selectedJHA ? (
                isEditMode ? (
                    <form onSubmit={handleSave} className="space-y-6">
                        {/* Header Inputs (Hidden Date/Time, keeping others) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">USA No.</label>
                                <input 
                                    type="text"
                                    className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                                    value={selectedJHA.usaNo || ''}
                                    onChange={(e) => setSelectedJHA({...selectedJHA, usaNo: e.target.value})}
                                    placeholder="Enter USA No."
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Subcontractor USA</label>
                                <input 
                                    type="text"
                                    className="w-full text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0F4C75]"
                                    value={selectedJHA.subcontractorUSANo || ''}
                                    onChange={(e) => setSelectedJHA({...selectedJHA, subcontractorUSANo: e.target.value})}
                                    placeholder="Enter Subcontractor USA"
                                />
                            </div>
                        </div>

                        {/* Section: Daily Work */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase border-b border-slate-100 pb-2">Daily Work</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {[
                                    { key: 'operatingMiniEx', label: 'Operating Mini Ex' },
                                    { key: 'operatingAVacuumTruck', label: 'Vacuum Truck' },
                                    { key: 'excavatingTrenching', label: 'Excavating/Trenching' },
                                    { key: 'acConcWork', label: 'AC/Concrete Work' },
                                    { key: 'operatingBackhoe', label: 'Operating Backhoe' },
                                    { key: 'workingInATrench', label: 'Working in Trench' },
                                    { key: 'trafficControl', label: 'Traffic Control' },
                                    { key: 'roadWork', label: 'Road Work' },
                                    { key: 'operatingHdd', label: 'Operating HDD' },
                                    { key: 'confinedSpace', label: 'Confined Space' },
                                    { key: 'settingUgBoxes', label: 'Setting UG Boxes' },
                                    { key: 'otherDailyWork', label: 'Other Daily Work' },
                                ].map((item) => (
                                    <div key={item.key} className="space-y-2">
                                        <label className={`p-3 h-full rounded-lg border flex items-center gap-3 cursor-pointer transition-all ${(selectedJHA as any)[item.key] ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-[#0F4C75] rounded focus:ring-[#0F4C75]"
                                                checked={!!(selectedJHA as any)[item.key]}
                                                onChange={(e) => setSelectedJHA({ ...selectedJHA, [item.key]: e.target.checked })}
                                            />
                                            <span className={`text-xs font-bold ${(selectedJHA as any)[item.key] ? 'text-blue-900' : 'text-slate-600'}`}>{item.label}</span>
                                        </label>
                                        {item.key === 'otherDailyWork' && (selectedJHA as any).otherDailyWork && (
                                            <textarea
                                                className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 mt-2 focus:ring-2 focus:ring-[#0F4C75] transition-all"
                                                placeholder="Specify Other Daily Work..."
                                                rows={2}
                                                value={(selectedJHA as any).commentsOtherDailyWork || ''}
                                                onChange={(e) => setSelectedJHA({ ...selectedJHA, commentsOtherDailyWork: e.target.value })}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Section: Jobsite Hazards */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase border-b border-slate-100 pb-2">Jobsite Hazards</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {[
                                    { key: 'sidewalks', label: 'Sidewalks', commentKey: 'commentsOnSidewalks' },
                                    { key: 'heatAwareness', label: 'Heat Awareness', commentKey: 'commentsOnHeatAwareness' },
                                    { key: 'ladderWork', label: 'Ladder Work', commentKey: 'commentsOnLadderWork' },
                                    { key: 'overheadLifting', label: 'Overhead Lifting', commentKey: 'commentsOnOverheadLifting' },
                                    { key: 'materialHandling', label: 'Material Handling', commentKey: 'commentsOnMaterialHandling' },
                                    { key: 'roadHazards', label: 'Road Hazards', commentKey: 'commentsOnRoadHazards' },
                                    { key: 'heavyLifting', label: 'Heavy Lifting', commentKey: 'commentsOnHeavyLifting' },
                                    { key: 'highNoise', label: 'High Noise', commentKey: 'commentsOnHighNoise' },
                                    { key: 'pinchPoints', label: 'Pinch Points', commentKey: 'commentsOnPinchPoints' },
                                    { key: 'sharpObjects', label: 'Sharp Objects', commentKey: 'commentsOnSharpObjects' },
                                    { key: 'trippingHazards', label: 'Tripping Hazards', commentKey: 'commentsOnTrippingHazards' },
                                    { key: 'otherJobsiteHazards', label: 'Other Jobsite Hazards', commentKey: 'commentsOnOther' },
                                ].map((item) => (
                                    <div key={item.key} className="space-y-2">
                                        <label className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-all ${(selectedJHA as any)[item.key] ? 'bg-orange-50 border-orange-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                                            <input
                                                type="checkbox"
                                                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-600"
                                                checked={!!(selectedJHA as any)[item.key]}
                                                onChange={(e) => setSelectedJHA({ ...selectedJHA, [item.key]: e.target.checked })}
                                            />
                                            <span className={`text-xs font-bold ${(selectedJHA as any)[item.key] ? 'text-orange-900' : 'text-slate-600'}`}>{item.label}</span>
                                        </label>
                                        {!!(selectedJHA as any)[item.key] && (
                                            <div className="animate-fade-in-down">
                                                <textarea
                                                    className="w-full text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-600 transition-all"
                                                    placeholder={`Comments for ${item.label}...`}
                                                    rows={2}
                                                    value={(selectedJHA as any)[item.commentKey] || ''}
                                                    onChange={(e) => setSelectedJHA({ ...selectedJHA, [item.commentKey]: e.target.value })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4">
                                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Any Specific Notes</label>
                                <textarea
                                    className="w-full text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0F4C75] transition-all resize-none shadow-sm"
                                    placeholder="Additional notes for jobsite hazards..."
                                    rows={3}
                                    value={selectedJHA.anySpecificNotes || ''}
                                    onChange={(e) => setSelectedJHA({ ...selectedJHA, anySpecificNotes: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Section: Emergency Action Plan */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase border-b border-slate-100 pb-2">Emergency Action Plan</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                    { key: 'stagingAreaDiscussed', label: 'Staging Area Discussed' },
                                    { key: 'rescueProceduresDiscussed', label: 'Rescue Procedures Discussed' },
                                    { key: 'evacuationRoutesDiscussed', label: 'Evacuation Routes Discussed' },
                                    { key: 'emergencyContactNumberWillBe911', label: 'Emergency Contact is 911' },
                                    { key: 'firstAidAndCPREquipmentOnsite', label: 'First Aid/CPR Onsite' },
                                    { key: 'closestHospitalDiscussed', label: 'Closest Hospital Discussed' },
                                    ].map((item) => (
                                    <label key={item.key} className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-600"
                                            checked={!!(selectedJHA as any)[item.key]}
                                            onChange={(e) => setSelectedJHA({ ...selectedJHA, [item.key]: e.target.checked })}
                                        />
                                        <span className="text-sm font-medium text-slate-700 group-hover:text-[#0F4C75] transition-colors">{item.label}</span>
                                    </label>
                                    ))}
                            </div>
                        </div>

                        {/* Section: Hospital */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase border-b border-slate-100 pb-2">Hospital Information</h4>
                            <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="text-[10px] font-bold text-red-500 uppercase block mb-1.5">Nearest Hospital Name</label>
                                    <input 
                                        type="text"
                                        className="w-full text-sm font-bold text-slate-700 bg-white border border-red-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-200 shadow-sm"
                                        value={selectedJHA.nameOfHospital || ''}
                                        onChange={(e) => setSelectedJHA({...selectedJHA, nameOfHospital: e.target.value})}
                                        placeholder="Enter Hospital Name"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-red-500 uppercase block mb-1.5">Hospital Address</label>
                                    <input 
                                        type="text"
                                        className="w-full text-sm font-bold text-slate-700 bg-white border border-red-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-200 shadow-sm"
                                        value={selectedJHA.addressOfHospital || ''}
                                        onChange={(e) => setSelectedJHA({...selectedJHA, addressOfHospital: e.target.value})}
                                        placeholder="Enter Hospital Address"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section: Signatures */}
                        <div className="border rounded-xl p-4 border-slate-200 bg-blue-50/50">
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-blue-100 pb-2 flex justify-between">
                                <span>Signatures</span>
                                <span className="text-[10px] font-normal text-slate-500 normal-case">All assignees must sign</span>
                            </h4>
                            
                            {activeSignatureEmployee ? (
                                <div className="max-w-md mx-auto">
                                    <SignaturePad 
                                        employeeName={initialData.employees.find((e: any) => e.value === activeSignatureEmployee)?.label || activeSignatureEmployee}
                                        onSave={handleSaveSignature} 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setActiveSignatureEmployee(null)} 
                                        className="mt-2 w-full text-xs text-slate-500 hover:text-slate-800 font-bold"
                                    >
                                        Cancel Signing
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {(() => {
                                        const schedule = schedules.find(s => s._id === (selectedJHA.schedule_id || selectedJHA._id)) || selectedJHA.scheduleRef;
                                        const assignees = schedule?.assignees || [];
                                        const uniqueAssignees = Array.from(new Set(assignees)).filter(Boolean) as string[];

                                        return uniqueAssignees.map((email: string) => {
                                            const emp = initialData.employees.find((e: any) => e.value === email);
                                            const sig = selectedJHA.signatures?.find((s: any) => s.employee === email);
                                            
                                            return (
                                                <div key={email} className={`relative p-3 rounded-xl border transition-all ${sig ? 'bg-white border-green-200 shadow-sm' : 'bg-white border-dashed border-slate-300 hover:border-[#0F4C75]'}`}>
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden border border-white shadow-sm flex items-center justify-center shrink-0">
                                                            {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : <span className="text-[10px] font-bold text-slate-500">{emp?.label?.[0]}</span>}
                                                        </div>
                                                        <div className="overflow-hidden">
                                                            <p className="text-xs font-bold text-slate-700 truncate">{emp?.label || email}</p>
                                                            <p className="text-[10px] text-slate-400">{sig ? 'Signed' : 'Pending Signature'}</p>
                                                        </div>
                                                    </div>
                                                    
                                                    {sig ? (
                                                        <div className="h-12 border-t border-slate-50 mt-2 flex items-center justify-center">
                                                            <img src={sig.signature} className="max-h-full max-w-full object-contain opacity-80" />
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setActiveSignatureEmployee(email)}
                                                            className="w-full py-1.5 mt-1 text-xs font-bold text-white bg-[#0F4C75] hover:bg-[#0b3d61] rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                                                        >
                                                            <FilePlus size={12} /> Sign Now
                                                        </button>
                                                    )}
                                                    {sig && (
                                                            <div className="absolute top-2 right-2 text-green-500"><CheckCircle2 size={14} /></div>
                                                    )}
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2 border-t border-slate-100 mt-6">
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
                                Save JHA
                            </button>
                        </div>
                    </form>
                ) : (
                <div className="space-y-8">
                    {/* Section 1: JHA Info */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-200 pb-2 flex flex-wrap justify-between items-center gap-2">
                            <span>JHA Info</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsEditMode(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-all shadow-sm"
                                >
                                    <Edit size={12} />
                                    EDIT JHA
                                </button>
                                <button
                                    onClick={() => setEmailModalOpen(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:text-[#0F4C75] hover:border-[#0F4C75] transition-all shadow-sm"
                                >
                                    <Mail size={12} />
                                    EMAIL PDF
                                </button>
                                <button
                                    onClick={handleDownloadPDF}
                                    disabled={isGeneratingPDF}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:text-[#0F4C75] hover:border-[#0F4C75] transition-all shadow-sm disabled:opacity-50"
                                >
                                    {isGeneratingPDF ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                                    DOWNLOAD PDF
                                </button>
                            </div>
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div><p className="text-[10px] font-bold text-slate-400 uppercase">Date</p><p className="text-sm font-bold text-slate-700">{new Date(selectedJHA.date).toLocaleDateString()}</p></div>
                            <div><p className="text-[10px] font-bold text-slate-400 uppercase">Time</p><p className="text-sm font-bold text-slate-700">{selectedJHA.jhaTime}</p></div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Created By</p>
                                {(() => {
                                    const creator = initialData.employees.find((e: any) => e.value === selectedJHA.createdBy);
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
                                    return <p className="text-sm font-bold text-slate-700 truncate">{selectedJHA.createdBy || 'Unknown'}</p>;
                                })()}
                            </div>
                            <div><p className="text-[10px] font-bold text-slate-400 uppercase">USA No.</p><p className="text-sm font-bold text-slate-700">{selectedJHA.usaNo || '-'}</p></div>
                            <div><p className="text-[10px] font-bold text-slate-400 uppercase">Subcontractor USA</p><p className="text-sm font-bold text-slate-700">{selectedJHA.subcontractorUSANo || '-'}</p></div>
                            <div><p className="text-[10px] font-bold text-slate-400 uppercase">Client Email</p><p className="text-sm font-bold text-slate-700">{selectedJHA.clientEmail || '-'}</p></div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Emailed</p>
                                <div className="flex items-center gap-2 mt-0.5 group relative">
                                    <p className="text-sm font-bold text-slate-700">{selectedJHA.emailCounter || 0} times</p>
                                    {selectedJHA.emailCounter > 0 && selectedJHA.jhaEmails && (
                                        <div className="hidden group-hover:block absolute top-full left-0 mt-2 z-50 w-64 bg-slate-800 text-white p-3 rounded-xl shadow-xl text-xs">
                                            <p className="font-bold border-b border-slate-700 pb-1 mb-2">Email History</p>
                                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                                {selectedJHA.jhaEmails.slice().reverse().map((email: any, idx: number) => (
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
                    </div>

                    {/* Section 2: Daily Work */}
                    <div>
                        <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Daily Work</h4>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                            {[
                                { label: 'Operating Mini Ex', val: selectedJHA.operatingMiniEx },
                                { label: 'Vacuum Truck', val: selectedJHA.operatingAVacuumTruck },
                                { label: 'Excavating/Trenching', val: selectedJHA.excavatingTrenching },
                                { label: 'AC/Concrete Work', val: selectedJHA.acConcWork },
                                { label: 'Operating Backhoe', val: selectedJHA.operatingBackhoe },
                                { label: 'Working in Trench', val: selectedJHA.workingInATrench },
                                { label: 'Traffic Control', val: selectedJHA.trafficControl },
                                { label: 'Road Work', val: selectedJHA.roadWork },
                                { label: 'Operating HDD', val: selectedJHA.operatingHdd },
                                { label: 'Confined Space', val: selectedJHA.confinedSpace },
                                { label: 'Setting UG Boxes', val: selectedJHA.settingUgBoxes },
                                { label: 'Other Daily Work', val: selectedJHA.otherDailyWork, comment: selectedJHA.commentsOtherDailyWork },
                            ].map((item, i) => (
                                <div key={i} className={`p-3 rounded-lg border flex flex-col gap-2 ${item.val ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100 opacity-60'}`}>
                                    <div className="flex items-center gap-2">
                                        {item.val ? <CheckCircle2 size={16} className="text-blue-600 shrink-0" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />}
                                        <span className={`text-xs font-bold ${item.val ? 'text-blue-900' : 'text-slate-500'}`}>{item.label}</span>
                                    </div>
                                    {item.val && item.comment && (
                                        <p className="text-[10px] italic text-slate-600 bg-white/50 p-1.5 rounded ml-6 border border-blue-100/50">{item.comment}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section 3: Jobsite Hazards */}
                    <div>
                        <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Jobsite Hazards</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                            {[
                                { label: 'Sidewalks', val: selectedJHA.sidewalks, c: selectedJHA.commentsOnSidewalks },
                                { label: 'Heat Awareness', val: selectedJHA.heatAwareness, c: selectedJHA.commentsOnHeatAwareness },
                                { label: 'Ladder Work', val: selectedJHA.ladderWork, c: selectedJHA.commentsOnLadderWork },
                                { label: 'Overhead Lifting', val: selectedJHA.overheadLifting, c: selectedJHA.commentsOnOverheadLifting },
                                { label: 'Material Handling', val: selectedJHA.materialHandling, c: selectedJHA.commentsOnMaterialHandling },
                                { label: 'Road Hazards', val: selectedJHA.roadHazards, c: selectedJHA.commentsOnRoadHazards },
                                { label: 'Heavy Lifting', val: selectedJHA.heavyLifting, c: selectedJHA.commentsOnHeavyLifting },
                                { label: 'High Noise', val: selectedJHA.highNoise, c: selectedJHA.commentsOnHighNoise },
                                { label: 'Pinch Points', val: selectedJHA.pinchPoints, c: selectedJHA.commentsOnPinchPoints },
                                { label: 'Sharp Objects', val: selectedJHA.sharpObjects, c: selectedJHA.commentsOnSharpObjects },
                                { label: 'Tripping Hazards', val: selectedJHA.trippingHazards, c: selectedJHA.commentsOnTrippingHazards },
                                { label: 'Other Hazards', val: selectedJHA.otherJobsiteHazards, c: selectedJHA.commentsOnOther },
                            ].map((item, i) => (
                                <div key={i} className="group">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            {item.val ? <AlertCircle size={14} className="text-orange-500" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
                                            <span className={`text-xs font-bold ${item.val ? 'text-slate-800' : 'text-slate-400'}`}>{item.label}</span>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.val ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-400'}`}>
                                            {item.val ? 'YES' : 'NO'}
                                        </span>
                                    </div>
                                    {item.c && (
                                        <div className="pl-6 text-[11px] text-slate-600 bg-orange-50/50 p-2 rounded border border-orange-100/50 mt-1">
                                            <span className="font-semibold text-orange-800/70">Note:</span> {item.c}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {selectedJHA.anySpecificNotes && (
                            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                                <p className="text-xs font-bold text-yellow-800 mb-1">Specific Notes:</p>
                                <p className="text-xs text-yellow-900/80">{selectedJHA.anySpecificNotes}</p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Section 4: Emergency Action Plan */}
                        <div>
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Emergency Action Plan</h4>
                            <div className="space-y-3">
                                {[
                                    { label: 'Staging Area Discussed', val: selectedJHA.stagingAreaDiscussed },
                                    { label: 'Rescue Procedures Discussed', val: selectedJHA.rescueProceduresDiscussed },
                                    { label: 'Evacuation Routes Discussed', val: selectedJHA.evacuationRoutesDiscussed },
                                    { label: 'Emergency Contact is 911', val: selectedJHA.emergencyContactNumberWillBe911 },
                                    { label: 'First Aid & CPR Equipment Onsite', val: selectedJHA.firstAidAndCPREquipmentOnsite },
                                    { label: 'Closest Hospital Discussed', val: selectedJHA.closestHospitalDiscussed },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                                        <span className="text-xs font-medium text-slate-700">{item.label}</span>
                                        {item.val ? 
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                                                <CheckCircle2 size={10} /> DONE
                                            </div> 
                                            : 
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-100 text-slate-400 px-2 py-1 rounded-full">
                                                PENDING
                                            </div>
                                        }
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Section 5: Hospital */}
                        <div>
                            <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Hospital Information</h4>
                            <div className="bg-red-50 p-5 rounded-xl border border-red-100">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-500 shrink-0">
                                        <Plus size={20} strokeWidth={3} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">Nearest Hospital</p>
                                        <p className="text-base font-black text-red-900 mb-1">{selectedJHA.nameOfHospital || 'Not Specified'}</p>
                                        <p className="text-sm text-red-800/80 leading-relaxed">{selectedJHA.addressOfHospital || 'No address provided'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 6: Signatures */}
                    <div>
                        <h4 className="text-sm font-black text-[#0F4C75] uppercase mb-4 border-b border-slate-100 pb-2">Employee Signatures</h4>
                        {selectedJHA.signatures && selectedJHA.signatures.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {selectedJHA.signatures.map((sig: any, index: number) => {
                                    const emp = initialData.employees.find((e: any) => e.value === sig.employee);
                                    return (
                                        <div key={index} className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col items-center gap-1.5 hover:shadow-md transition-all">
                                            <div className="w-full h-24 bg-slate-50 rounded border border-slate-100 flex items-center justify-center overflow-hidden relative">
                                                {sig.signature ? (
                                                    <img src={sig.signature} alt="Signature" className="max-w-full max-h-full object-contain" />
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">No Image</span>
                                                )}
                                            </div>
                                            
                                            <div className="flex items-center gap-2 mt-1">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 border border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                                                    {emp?.image ? (
                                                        <img src={emp.image} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-slate-500">{emp?.label?.[0] || 'U'}</span>
                                                    )}
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-700 truncate max-w-[140px]" title={emp?.label || sig.employee}>
                                                    {emp?.label || sig.employee}
                                                    </p>
                                            </div>

                                            <p className="text-[10px] text-slate-400 font-medium">
                                                {new Date(sig.createdAt || Date.now()).toLocaleString('en-US', { 
                                                    year: 'numeric', 
                                                    month: 'numeric', 
                                                    day: 'numeric', 
                                                    hour: 'numeric', 
                                                    minute: 'numeric', 
                                                    hour12: true 
                                                })}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <p className="text-sm text-slate-400 italic">No signatures recorded.</p>
                            </div>
                        )}
                    </div>
                </div>
                )
            ) : (
                <EmptyState title="No Data" message="Unable to load JHA details." />
            )}
        </Modal>
    );
};
