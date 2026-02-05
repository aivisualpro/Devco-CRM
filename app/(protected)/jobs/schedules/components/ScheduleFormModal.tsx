'use client';

import React, { useState, useEffect } from 'react';
import { X, Upload, MapPin, Shield } from 'lucide-react';
import { Modal, Badge } from '@/components/ui';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { UploadButton } from '@/components/ui/UploadButton';
import { useToast } from '@/hooks/useToast';
import { ScheduleItem } from './ScheduleCard';

interface Objective {
    text: string;
    completed: boolean;
}

interface ScheduleFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    schedule: ScheduleItem | null;
    initialData: {
        employees: any[];
        clients: any[];
        constants: any[];
        estimates: any[];
    };
    onSave: (schedule: ScheduleItem, isNew: boolean) => void;
}

function formatLocalDateTime(dateStr: string): string {
    if (!dateStr) return '';
    // If already in YYYY-MM-DDTHH:mm format, return as is
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateStr)) {
        return dateStr;
    }
    // Otherwise parse and format
    try {
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        if (match) {
            return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`;
        }
        return dateStr.slice(0, 16);
    } catch {
        return '';
    }
}

export function ScheduleFormModal({ isOpen, onClose, schedule, initialData, onSave }: ScheduleFormModalProps) {
    const { success, error: toastError } = useToast();
    const [editingItem, setEditingItem] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Initialize form when schedule changes
    useEffect(() => {
        if (schedule) {
            setEditingItem({ ...schedule });
        } else {
            setEditingItem(null);
        }
    }, [schedule]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;

        setIsSaving(true);
        try {
            const isNew = !editingItem._id;
            // Create payload excluding non-editable heavy fields to prevent overwriting with partial data
            const { djt, jha, timesheet, JHASignatures, DJTSignatures, ...cleanPayload } = editingItem;
            
            const payload = isNew ? cleanPayload : { ...cleanPayload, id: editingItem._id };
            
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: isNew ? 'createSchedule' : 'updateSchedule',
                    payload: payload
                })
            });
            const data = await res.json();
            if (data.success) {
                success(isNew ? 'Schedule Created' : 'Schedule Updated');
                onSave(data.result || editingItem, isNew);
                onClose();
            } else {
                toastError(data.error || 'Failed to save');
            }
        } catch (err) {
            console.error(err);
            toastError('Failed to save schedule');
        } finally {
            setIsSaving(false);
        }
    };

    if (!editingItem) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingItem?._id ? "Edit Schedule" : "New Schedule"}
            maxWidth="4xl"
            preventClose={true}
        >
            <form onSubmit={handleSave} className="py-2">
                <div className="space-y-6 min-h-[400px]">
                    {/* Row 1: Tag, From Date, To Date */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <SearchableSelect
                                id="schedTag"
                                label="Tag"
                                placeholder="Select Tag"
                                disableBlank={true}
                                options={initialData.constants.filter((c: any) => c.type === 'Schedule Items').map((c: any) => ({
                                    label: c.description,
                                    value: c.description,
                                    image: c.image,
                                    color: c.color
                                }))}
                                value={editingItem?.item || ''}
                                onChange={(val) => {
                                    const updates: any = { item: val };
                                    if (val === 'Day Off') {
                                        updates.title = 'Day Off';
                                    }
                                    setEditingItem((prev: any) => ({ ...prev, ...updates }));
                                }}
                                onNext={() => {}}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-900">From Date & Time</label>
                            <input
                                id="schedFromDate"
                                type="datetime-local"
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                                value={editingItem?.fromDate ? formatLocalDateTime(editingItem.fromDate) : ''}
                                onChange={(e) => {
                                    const newFrom = e.target.value;
                                    setEditingItem((prev: any) => {
                                        if (!prev?.toDate) return { ...prev, fromDate: newFrom, toDate: newFrom };
                                        const newFromDatePart = newFrom.split('T')[0];
                                        const oldToTimePart = formatLocalDateTime(prev.toDate).split('T')[1] || '15:30';
                                        const newToDateString = `${newFromDatePart}T${oldToTimePart}`;
                                        return {
                                            ...prev,
                                            fromDate: newFrom,
                                            toDate: newToDateString
                                        };
                                    });
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-slate-900">To Date & Time</label>
                            <input
                                id="schedToDate"
                                type="datetime-local"
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                                min={editingItem?.fromDate ? formatLocalDateTime(editingItem.fromDate) : undefined}
                                value={editingItem?.toDate ? formatLocalDateTime(editingItem.toDate) : ''}
                                onChange={(e) => setEditingItem({ ...editingItem, toDate: e.target.value })}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                            />
                        </div>
                    </div>

                    {/* Assignees */}
                    <div className="space-y-2">
                        <SearchableSelect
                            id="schedTeam"
                            label="Assignees"
                            placeholder="Select Team"
                            multiple
                            disableBlank={true}
                            options={initialData.employees
                                .filter((emp: any) => emp.isScheduleActive)
                                .sort((a: any, b: any) => (a.label || '').localeCompare(b.label || ''))
                                .map((emp: any) => ({
                                    label: emp.label,
                                    value: emp.value,
                                    image: emp.image
                                }))}
                            value={editingItem?.assignees || []}
                            onChange={(val) => setEditingItem((prev: any) => ({ ...prev, assignees: val }))}
                        />
                    </div>

                    {/* Row 2: Client, Proposal, Title/Reason */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                        {editingItem?.item !== 'Day Off' && (
                            <>
                                <div>
                                    <SearchableSelect
                                        id="schedClient"
                                        label="Client"
                                        placeholder="Select client"
                                        disableBlank={true}
                                        options={initialData.clients.map((c: any) => ({ label: c.name, value: c._id }))}
                                        value={editingItem?.customerId || ''}
                                        onChange={(val) => {
                                            const client = initialData.clients.find((c: any) => c._id === val);
                                            setEditingItem((prev: any) => ({
                                                ...prev,
                                                customerId: val,
                                                customerName: client?.name || '',
                                                estimate: (prev?.customerId && prev.customerId !== val) ? '' : prev?.estimate
                                            }));
                                        }}
                                        onNext={() => {}}
                                    />
                                </div>
                                <div>
                                    <SearchableSelect
                                        id="schedProposal"
                                        label="Proposal #"
                                        placeholder="Select proposal"
                                        disableBlank={true}
                                        options={initialData.estimates
                                            .filter((e: any) => !editingItem?.customerId || (e.customerId && e.customerId.toString() === editingItem.customerId.toString()))
                                            .map((e: any) => ({ label: e.label || e.value, value: e.value }))}
                                        value={editingItem?.estimate || ''}
                                        onChange={(val) => {
                                            const est = initialData.estimates.find((e: any) => e.value === val);
                                            const client = initialData.clients.find((c: any) => c._id === est?.customerId);
                                            setEditingItem((prev: any) => ({ 
                                                ...prev, 
                                                estimate: val,
                                                customerId: est?.customerId || prev?.customerId, 
                                                customerName: client?.name || prev?.customerName,
                                                title: est?.projectTitle || est?.projectName || prev?.title || '', 
                                                description: est?.scopeOfWork || prev?.description || '',
                                                service: Array.isArray(est?.services) ? est.services.join(', ') : (est?.services || prev?.service || ''),
                                                fringe: est?.fringe || prev?.fringe || 'No',
                                                certifiedPayroll: est?.certifiedPayroll || prev?.certifiedPayroll || 'No',
                                                jobLocation: est?.jobAddress || prev?.jobLocation || '',
                                                aerialImage: est?.aerialImage || (val ? '' : prev?.aerialImage),
                                                siteLayout: est?.siteLayout || (val ? '' : prev?.siteLayout)
                                            }));
                                        }}
                                        onNext={() => {}}
                                    />
                                </div>
                            </>
                        )}
                        
                        <div className={`space-y-2 ${editingItem?.item === 'Day Off' ? 'md:col-span-2' : ''}`}>
                            <label className="block text-sm font-bold text-slate-900">
                                {editingItem?.item === 'Day Off' ? 'Reason' : 'Title'}
                            </label>
                            <input
                                id="schedTitle"
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all h-[42px]"
                                placeholder={editingItem?.item === 'Day Off' ? "Enter reason..." : "Project Main Phase"}
                                value={editingItem?.title || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                            />
                        </div>

                        {editingItem?.item === 'Day Off' && (
                            <div className="flex items-center h-[42px] mt-7">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <div className="relative flex items-center">
                                        <input 
                                            type="checkbox" 
                                            className="peer h-5 w-5 cursor-pointer appearance-none rounded border border-slate-300 shadow-sm transition-all checked:border-slate-800 checked:bg-slate-800 hover:border-slate-400 focus:ring-1 focus:ring-slate-800 focus:ring-offset-1"
                                            checked={editingItem?.isDayOffApproved === true}
                                            onChange={(e) => setEditingItem({...editingItem, isDayOffApproved: e.target.checked})}
                                        />
                                        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                            </svg>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-slate-700">Approved</span>
                                </label>
                            </div>
                        )}
                    </div>

                    {editingItem?.item !== 'Day Off' && (
                        <>

                        {/* Job Location (read-only from estimate) */}
                        {editingItem?.estimate && (() => {
                            const est = initialData.estimates.find((e: any) => e.value === editingItem.estimate);
                            const jobAddr = est?.jobAddress || editingItem?.jobLocation;
                            if (!jobAddr) return null;
                            return (
                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-500">Job Location</label>
                                    <div className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700">
                                        {jobAddr}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Row 3: Staffing (PM, Foreman) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                            <div className="space-y-2">
                                <SearchableSelect
                                    id="schedPM"
                                    label="Project Manager"
                                    placeholder="Select PM"
                                    disableBlank={true}
                                    options={initialData.employees
                                        .filter((emp: any) => emp.designation?.toLowerCase().includes('project manager'))
                                        .map((emp: any) => ({
                                            label: emp.label,
                                            value: emp.value,
                                            image: emp.image
                                        }))}
                                    value={editingItem?.projectManager || ''}
                                    onChange={(val) => setEditingItem({ ...editingItem, projectManager: val })}
                                    onNext={() => {}}
                                />
                            </div>
                            <div className="space-y-2">
                                <SearchableSelect
                                    id="schedForeman"
                                    label="Foreman"
                                    placeholder="Select Foreman"
                                    disableBlank={true}
                                    options={initialData.employees
                                        .filter((emp: any) => emp.designation?.toLowerCase().includes('foreman'))
                                        .map((emp: any) => ({
                                            label: emp.label,
                                            value: emp.value,
                                            image: emp.image
                                        }))}
                                    value={editingItem?.foremanName || ''}
                                    onChange={(val) => setEditingItem({ ...editingItem, foremanName: val })}
                                    onNext={() => {}}
                                />
                            </div>
                        </div>

                        {/* Service, Notify, Per Diem, Fringe, CP */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <SearchableSelect
                                    id="schedService"
                                    label="Service"
                                    placeholder="Select Service"
                                    multiple={true}
                                    disableBlank={true}
                                    options={initialData.constants.filter((c: any) => c.type?.toLowerCase() === 'services').map((c: any) => ({
                                        label: c.description,
                                        value: c.description,
                                        image: c.image,
                                        color: c.color
                                    }))}
                                    value={editingItem?.service ? editingItem.service.split(',').map((s: string) => s.trim()).filter(Boolean) : []}
                                    onChange={(val) => {
                                        const strVal = Array.isArray(val) ? val.join(', ') : val;
                                        setEditingItem({ ...editingItem, service: strVal });
                                    }}
                                    onNext={() => {}}
                                />
                            </div>
                            <div className="space-y-2">
                                <SearchableSelect
                                    id="schedNotify"
                                    label="Notify Assignees"
                                    placeholder="Select"
                                    disableBlank={true}
                                    options={[
                                        { label: 'No', value: 'No', color: '#ef4444' },
                                        { label: 'Yes', value: 'Yes', color: '#22c55e' }
                                    ]}
                                    value={editingItem?.notifyAssignees === true ? 'Yes' : (editingItem?.notifyAssignees === false ? 'No' : (editingItem?.notifyAssignees || 'No'))}
                                    onChange={(val) => setEditingItem({ ...editingItem, notifyAssignees: val })}
                                    onNext={() => {}}
                                />
                            </div>
                            <div className="space-y-2">
                                <SearchableSelect
                                    id="schedPerDiem"
                                    label="Per Diem Eligible"
                                    placeholder="Select"
                                    disableBlank={true}
                                    options={[
                                        { label: 'No', value: 'No', color: '#ef4444' },
                                        { label: 'Yes', value: 'Yes', color: '#22c55e' }
                                    ]}
                                    value={editingItem?.perDiem === true ? 'Yes' : (editingItem?.perDiem === false ? 'No' : (editingItem?.perDiem || 'No'))}
                                    onChange={(val) => setEditingItem({ ...editingItem, perDiem: val })}
                                    onNext={() => {}}
                                />
                            </div>
                            <div className="space-y-2">
                                <SearchableSelect
                                    id="schedFringe"
                                    label="Fringe"
                                    placeholder="Select Fringe"
                                    disableBlank={true}
                                    options={initialData.constants.filter((c: any) => c.type === 'Fringe').map((c: any) => ({
                                        label: c.description,
                                        value: c.description,
                                        image: c.image,
                                        color: c.color
                                    }))}
                                    value={editingItem?.fringe || ''}
                                    onChange={(val) => setEditingItem({ ...editingItem, fringe: val })}
                                    onNext={() => {}}
                                />
                            </div>
                            <div className="space-y-2">
                                <SearchableSelect
                                    id="schedCP"
                                    label="Certified Payroll"
                                    placeholder="Select CP"
                                    disableBlank={true}
                                    options={initialData.constants.filter((c: any) => c.type === 'Certified Payroll').map((c: any) => ({
                                        label: c.description,
                                        value: c.description,
                                        image: c.image,
                                        color: c.color
                                    }))}
                                    value={editingItem?.certifiedPayroll === true ? 'Yes' : (editingItem?.certifiedPayroll === false ? 'No' : (editingItem?.certifiedPayroll || ''))}
                                    onChange={(val) => setEditingItem({ ...editingItem, certifiedPayroll: val })}
                                    onNext={() => {}}
                                />
                            </div>
                        </div>

                        {/* Today's Objectives */}
                        <div className="space-y-2 mt-4">
                            <label className="block text-sm font-bold text-slate-900">Today&apos;s objectives</label>
                            <div className="flex gap-2">
                                <input
                                    id="newObjective"
                                    type="text"
                                    placeholder="Enter objective..."
                                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = e.currentTarget.value.trim();
                                            if (val) {
                                                e.preventDefault();
                                                const current = Array.isArray(editingItem?.todayObjectives) ? editingItem.todayObjectives : [];
                                                const newObjective: Objective = { text: val, completed: false };
                                                setEditingItem({ ...editingItem, todayObjectives: [...current, newObjective] });
                                                e.currentTarget.value = '';
                                            }
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors"
                                    onClick={() => {
                                        const input = document.getElementById('newObjective') as HTMLInputElement;
                                        if (input && input.value.trim()) {
                                            const val = input.value.trim();
                                            const current = Array.isArray(editingItem?.todayObjectives) ? editingItem.todayObjectives : [];
                                            const newObjective: Objective = { text: val, completed: false };
                                            setEditingItem({ ...editingItem, todayObjectives: [...current, newObjective] });
                                            input.value = '';
                                        }
                                    }}
                                >
                                    Add
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {(Array.isArray(editingItem?.todayObjectives) ? editingItem.todayObjectives : []).map((obj: Objective | string, idx: number) => {
                                    const objText = typeof obj === 'string' ? obj : obj.text;
                                    const isCompleted = typeof obj === 'string' ? false : obj.completed;
                                    return (
                                        <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg group ${isCompleted ? 'bg-green-50 border-green-200' : 'bg-slate-100 border-slate-200'}`}>
                                            <span className={`text-sm font-medium ${isCompleted ? 'text-green-700 line-through' : 'text-slate-700'}`}>{objText}</span>
                                            <button
                                                type="button"
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                                onClick={() => {
                                                    const current = Array.isArray(editingItem?.todayObjectives) ? editingItem.todayObjectives : [];
                                                    setEditingItem({ ...editingItem, todayObjectives: current.filter((_: any, i: number) => i !== idx) });
                                                }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Description / Scope of Work */}
                        <div className="space-y-2 mt-2">
                            <label className="block text-sm font-bold text-slate-900">Scope of Work</label>
                            <textarea
                                id="schedDesc"
                                rows={6}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all resize-y placeholder:text-slate-400"
                                placeholder="Enter scope of work..."
                                value={editingItem?.description || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                            />
                        </div>

                        {/* Aerial Image & Site Layout */}
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            {/* Aerial Image */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-bold text-slate-900">Aerial Image</label>
                                    {(() => {
                                        const est = initialData.estimates.find((e: any) => e.value === editingItem.estimate);
                                        if (est?.aerialImage && editingItem.aerialImage === est.aerialImage) {
                                            return (
                                                <Badge variant="info" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1 py-0 px-2 h-5">
                                                    <Shield size={10} />
                                                    From Estimate
                                                </Badge>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                                <div className="flex flex-col h-[200px]">
                                    <div className="flex-1 min-h-[140px] mb-2">
                                        {editingItem?.aerialImage ? (
                                            <div className="relative group h-full">
                                                <img 
                                                    src={editingItem.aerialImage} 
                                                    alt="Aerial View" 
                                                    className="w-full h-full object-cover rounded-lg border border-slate-200"
                                                />
                                                {(() => {
                                                    const est = initialData.estimates.find((e: any) => e.value === editingItem.estimate);
                                                    if (!(est?.aerialImage && editingItem.aerialImage === est.aerialImage)) {
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingItem({ ...editingItem, aerialImage: '' })}
                                                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                        ) : (
                                            <div className="w-full h-full rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                                                <div className="text-center text-slate-400">
                                                    <Upload className="w-6 h-6 mx-auto mb-1 opacity-50" />
                                                    <p className="text-[10px] font-medium">No image</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const est = initialData.estimates.find((e: any) => e.value === editingItem.estimate);
                                            const isLocked = est?.aerialImage && editingItem.aerialImage === est.aerialImage;
                                            return (
                                                <>
                                                    <input
                                                        type="text"
                                                        placeholder="Paste image URL..."
                                                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                                        value={editingItem?.aerialImage || ''}
                                                        onChange={(e) => setEditingItem({ ...editingItem, aerialImage: e.target.value })}
                                                        disabled={isLocked}
                                                    />
                                                    {!isLocked && (
                                                        <UploadButton 
                                                            onUpload={(url) => setEditingItem({ ...editingItem, aerialImage: url })}
                                                            folder="schedules/aerial"
                                                        />
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Site Layout */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-bold text-slate-900">Site Layout</label>
                                    {(() => {
                                        const est = initialData.estimates.find((e: any) => e.value === editingItem.estimate);
                                        if (est?.siteLayout && editingItem.siteLayout === est.siteLayout) {
                                            return (
                                                <Badge variant="success" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 py-0 px-2 h-5">
                                                    <Shield size={10} />
                                                    From Estimate
                                                </Badge>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                                <div className="flex flex-col h-[200px]">
                                    <div className="flex-1 min-h-[140px] mb-2">
                                        {editingItem?.siteLayout && editingItem.siteLayout.includes('earth.google.com') ? (() => {
                                            const coordsMatch = editingItem.siteLayout.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                                            const lat = coordsMatch?.[1];
                                            const lng = coordsMatch?.[2];
                                            const embedUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}&t=k&z=19&ie=UTF8&iwloc=&output=embed` : '';
                                            
                                            return embedUrl ? (
                                                <div className="relative group h-full">
                                                    <div className="w-full h-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                                                        <iframe
                                                            width="100%"
                                                            height="100%"
                                                            style={{ border: 0 }}
                                                            src={embedUrl}
                                                            className="w-full h-full"
                                                            loading="lazy"
                                                        />
                                                    </div>
                                                    {(() => {
                                                        const est = initialData.estimates.find((e: any) => e.value === editingItem.estimate);
                                                        if (!(est?.siteLayout && editingItem.siteLayout === est.siteLayout)) {
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingItem({ ...editingItem, siteLayout: '' })}
                                                                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            ) : (
                                                <div className="w-full h-full rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                                                    <div className="text-center text-slate-400">
                                                        <MapPin className="w-6 h-6 mx-auto mb-1 opacity-50" />
                                                        <p className="text-[10px] font-medium">Invalid URL</p>
                                                    </div>
                                                </div>
                                            );
                                        })() : editingItem?.siteLayout ? (
                                            <div className="relative group h-full">
                                                <img 
                                                    src={editingItem.siteLayout} 
                                                    alt="Site Layout" 
                                                    className="w-full h-full object-cover rounded-lg border border-slate-200"
                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                                {(() => {
                                                    const est = initialData.estimates.find((e: any) => e.value === editingItem.estimate);
                                                    if (!(est?.siteLayout && editingItem.siteLayout === est.siteLayout)) {
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingItem({ ...editingItem, siteLayout: '' })}
                                                                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        );
                                                    }
                                                    return null;
                                                })()}
                                            </div>
                                        ) : (
                                            <div className="w-full h-full rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center">
                                                <div className="text-center text-slate-400">
                                                    <MapPin className="w-6 h-6 mx-auto mb-1 opacity-50" />
                                                    <p className="text-[10px] font-medium">No layout</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const est = initialData.estimates.find((e: any) => e.value === editingItem.estimate);
                                            const isLocked = est?.siteLayout && editingItem.siteLayout === est.siteLayout;
                                            return (
                                                <>
                                                    <input
                                                        type="text"
                                                        placeholder="Paste Google Earth URL..."
                                                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-black transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                                        value={editingItem?.siteLayout || ''}
                                                        onChange={(e) => setEditingItem({ ...editingItem, siteLayout: e.target.value })}
                                                        disabled={isLocked}
                                                    />
                                                    {!isLocked && (
                                                        <UploadButton 
                                                            onUpload={(url) => setEditingItem({ ...editingItem, siteLayout: url })}
                                                            folder="schedules/layout"
                                                        />
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                        </>
                    )}

                    {/* Footer buttons */}
                    <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 bg-white border border-slate-200 text-slate-900 text-sm font-bold rounded-lg hover:bg-slate-50 transition-all font-sans"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-6 py-2 bg-[#1A1A1A] text-white text-sm font-bold rounded-lg hover:bg-black transition-all shadow-sm font-sans disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : (editingItem?._id ? 'Update Schedule' : 'Create Schedule')}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

export default ScheduleFormModal;
