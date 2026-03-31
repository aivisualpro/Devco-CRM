import React, { useState, useEffect } from 'react';
import { Modal, Input, Button } from '@/components/ui';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { ScheduleItem } from './ScheduleCard';
import { useToast } from '@/hooks/useToast';
import { FileEdit, X, Trash2 } from 'lucide-react';
import { getLocalNowISO } from '@/lib/scheduleUtils';

interface ChangeOfScopeModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: ScheduleItem | null;
    setSchedules?: React.Dispatch<React.SetStateAction<ScheduleItem[]>>;
}

export const ChangeOfScopeModal: React.FC<ChangeOfScopeModalProps> = ({
    isOpen,
    onClose,
    schedule,
    setSchedules
}) => {
    const { success, error: toastError } = useToast();
    const [jobDescription, setJobDescription] = useState('');
    const [customerPrintName, setCustomerPrintName] = useState('');
    const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setJobDescription('');
            setCustomerPrintName('');
            setSignatureDataUrl(null);
        }
    }, [isOpen]);

    const handleSave = async () => {
        if (!schedule) return;
        if (!jobDescription.trim()) {
            toastError('Job Description is required');
            return;
        }

        setIsSaving(true);
        try {
            const newScope = {
                jobDescription,
                customerPrintName,
                customerSignature: signatureDataUrl || '',
                createdAt: getLocalNowISO(),
            };

            const updatedChangeOfScope = [...(schedule.changeOfScope || []), newScope];

            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateSchedule',
                    payload: {
                        id: schedule._id,
                        changeOfScope: updatedChangeOfScope
                    }
                })
            });

            const data = await res.json();
            if (data.success) {
                success('Change of Scope added successfully');
                if (setSchedules) {
                    setSchedules(prev => prev.map(s => 
                        s._id === schedule._id ? { ...s, changeOfScope: updatedChangeOfScope } : s
                    ));
                }
                onClose();
            } else {
                toastError(data.error || 'Failed to update schedule');
            }
        } catch (error) {
            console.error(error);
            toastError('An error occurred while saving.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (index: number) => {
        if (!schedule) return;
        if (!confirm('Are you sure you want to delete this change of scope?')) return;
        
        setIsSaving(true);
        try {
            const updatedChangeOfScope = [...(schedule.changeOfScope || [])];
            updatedChangeOfScope.splice(index, 1);

            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateSchedule',
                    payload: {
                        id: schedule._id,
                        changeOfScope: updatedChangeOfScope
                    }
                })
            });

            const data = await res.json();
            if (data.success) {
                success('Change of Scope deleted successfully');
                if (setSchedules) {
                    setSchedules(prev => prev.map(s => 
                        s._id === schedule._id ? { ...s, changeOfScope: updatedChangeOfScope } : s
                    ));
                }
            } else {
                toastError(data.error || 'Failed to update schedule');
            }
        } catch (error) {
            console.error(error);
            toastError('An error occurred while deleting.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !schedule) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Change of Scope" maxWidth="3xl">
            <div className="space-y-6">
                {/* Form to add a new Change of Scope */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <FileEdit className="w-5 h-5 text-[#0F4C75]" />
                        Add New Change of Scope
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Job Description *</label>
                            <textarea
                                className="w-full bg-white border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#0F4C75] min-h-[100px] outline-none"
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                placeholder="Describe the change of scope..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Customer Print Name</label>
                            <Input
                                value={customerPrintName}
                                onChange={(e) => setCustomerPrintName(e.target.value)}
                                placeholder="Enter customer print name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Customer Signature</label>
                            <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
                                <SignaturePad
                                    onChange={(dataUrl: string) => setSignatureDataUrl(dataUrl)}
                                    label="Customer Signature"
                                />
                            </div>
                            {signatureDataUrl && (
                                <div className="mt-2 text-xs font-bold text-emerald-600 flex items-center gap-1">
                                    <span>✓ Signature captured</span>
                                    <button 
                                        onClick={() => setSignatureDataUrl(null)}
                                        className="text-red-500 hover:text-red-700 ml-2"
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
                        <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Change of Scope'}
                        </Button>
                    </div>
                </div>

                {/* List of existing Changes of Scope */}
                {schedule.changeOfScope && schedule.changeOfScope.length > 0 && (
                    <div className="mt-8">
                        <h3 className="text-base font-bold text-slate-800 mb-3">Previous Changes of Scope</h3>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                            {schedule.changeOfScope.map((scope: any, index: number) => (
                                <div key={index} className="bg-white border text-sm border-slate-200 rounded-xl p-4 shadow-sm relative group">
                                    <button 
                                        className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                        onClick={() => handleDelete(index)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    
                                    <div className="mb-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase">Date: </span>
                                        <span className="text-slate-700">{new Date(scope.createdAt || new Date()).toLocaleString()}</span>
                                    </div>
                                    <div className="mb-3 whitespace-pre-wrap text-slate-700">
                                        <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Description: </span>
                                        {scope.jobDescription}
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                                        {scope.customerPrintName && (
                                            <div>
                                                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Print Name: </span>
                                                <div className="font-semibold text-slate-800">{scope.customerPrintName}</div>
                                            </div>
                                        )}
                                        {scope.customerSignature && (
                                            <div>
                                                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Signature: </span>
                                                <img src={scope.customerSignature} alt="Signature" className="h-12 border border-slate-200 rounded object-contain bg-slate-50" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
