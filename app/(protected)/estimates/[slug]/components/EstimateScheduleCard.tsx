'use client';

import React, { useState, useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import { ScheduleCard, ScheduleItem } from '@/app/(protected)/jobs/schedules/components/ScheduleCard';
import { ScheduleFormModal } from '@/app/(protected)/jobs/schedules/components/ScheduleFormModal';
import { JHAModal } from '@/app/(protected)/jobs/schedules/components/JHAModal';
import { DJTModal } from '@/app/(protected)/jobs/schedules/components/DJTModal';
import { ScheduleDetailModal } from '@/app/(protected)/dashboard/components/ScheduleDetailModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui';

interface EstimateScheduleCardProps {
    schedules: ScheduleItem[];
    setSchedules: React.Dispatch<React.SetStateAction<ScheduleItem[]>>;
    estimate: any; 
    employees: any[];
    currentUser: any;
    clientOptions: any[];
    allConstants: any[];
    equipmentCatalog: any[];
    overheadCatalog?: any[];
}

export const EstimateScheduleCard: React.FC<EstimateScheduleCardProps> = ({
    schedules,
    setSchedules,
    estimate,
    employees,
    currentUser,
    clientOptions,
    allConstants,
    equipmentCatalog,
    overheadCatalog = []
}) => {
    const { success, error: toastError } = useToast();

    // Schedule Edit/View State
    const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
    const [scheduleDetailOpen, setScheduleDetailOpen] = useState(false);
    const [editScheduleOpen, setEditScheduleOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<ScheduleItem | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    // Media viewer state for ScheduleDetailModal
    const [mediaModalOpen, setMediaModalOpen] = useState(false);
    const [mediaUrl, setMediaUrl] = useState('');
    const [mediaTitle, setMediaTitle] = useState('');

    // JHA State
    const [jhaModalOpen, setJhaModalOpen] = useState(false);
    const [selectedJHA, setSelectedJHA] = useState<any>(null);
    const [isJhaEditMode, setIsJhaEditMode] = useState(false);
    const [isGeneratingJHAPDF, setIsGeneratingJHAPDF] = useState(false);
    const [activeSignatureEmployee, setActiveSignatureEmployee] = useState<string | null>(null);

    // DJT State
    const [djtModalOpen, setDjtModalOpen] = useState(false);
    const [selectedDJT, setSelectedDJT] = useState<any>(null);
    const [isDjtEditMode, setIsDjtEditMode] = useState(false);
    const [isGeneratingDJTPDF, setIsGeneratingDJTPDF] = useState(false);
    const [isSavingSignature, setIsSavingSignature] = useState(false);

    // Email State (for JHA/DJT PDF emailing if needed)
    const [emailModalOpen, setEmailModalOpen] = useState(false);

    // Action Confirmation State (for Drive Time, Dump Washout, Shop Time)
    const [actionConfirm, setActionConfirm] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText: string;
        variant: 'danger' | 'primary' | 'dark';
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        confirmText: 'Confirm',
        variant: 'primary',
        onConfirm: () => {}
    });

    // Delete Schedule Handler
    const handleDeleteSchedule = async () => {
        if (!deleteId) return;
        try {
            const res = await fetch(`/api/schedules?id=${deleteId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                setSchedules(prev => prev.filter(s => s._id !== deleteId));
                success('Schedule deleted');
            } else {
                toastError(data.error || 'Failed to delete');
            }
        } catch (e) {
            console.error(e);
            toastError('Failed to delete schedule');
        } finally {
            setIsConfirmOpen(false);
            setDeleteId(null);
        }
    };

    const normalizedEquipment = useMemo(() => {
        return (equipmentCatalog || []).map((item: any) => ({
            ...item,
            label: item.label || item.equipmentMachine || item.description || item.name || 'Unknown Equipment',
            value: item.value || (item._id ? String(item._id) : '')
        }));
    }, [equipmentCatalog]);

    const normalizedEmployees = useMemo(() => {
        return (employees || []).map((e: any) => ({
            ...e,
            label: e.label || `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || 'Unknown',
            value: e.value || e.email || e._id, // Prefer email as value for employees usually
            image: e.profilePicture || e.image
        }));
    }, [employees]);

    // Transform clientOptions to match ScheduleCard expected format
    const normalizedClients = useMemo(() => {
        return (clientOptions || []).map((c: any) => ({
            _id: c.value || c.id,
            name: c.label,
            recordId: c.id || c.value
        }));
    }, [clientOptions]);

    const handleDownloadDjtPdf = async () => {
        if (!selectedDJT) return;
        setIsGeneratingDJTPDF(true);
        try {
            const templateId = '1cN4CpzsvuKLYXtmSANeyqTTlL3HPc7XEyFsjfNwzo-8';
            
            // Build variables from selectedDJT and its parent schedule
            const schedule = schedules.find(s => s._id === (selectedDJT.schedule_id || selectedDJT._id));
            
            // Use local normalized lists
            const client = clientOptions.find(c => c.value === schedule?.customerId || c.label === schedule?.customerName);
            
            // Combine fields
            const variables: Record<string, any> = {
                dailyJobDescription: selectedDJT.dailyJobDescription || '',
                customerPrintName: selectedDJT.customerPrintName || '',
                
                // Customer name/info
                customerId: estimate?.customerName || client?.label || schedule?.customerName || '',
                // Contact info from estimate
                contactName: estimate?.contactName || '',
                contactPhone: estimate?.contactPhone || '',
                jobAddress: estimate?.jobAddress || schedule?.jobLocation || '',
                // Other schedule info
                customerName: estimate?.customerName || client?.label || schedule?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                estimate: schedule?.estimate || '',
                estimateNum: schedule?.estimate || '',
                projectName: estimate?.projectName || estimate?.projectTitle || '',
                foremanName: schedule?.foremanName || '',
                date: new Date(selectedDJT.date || schedule?.fromDate || new Date()).toLocaleDateString(),
                day: new Date(selectedDJT.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
            };

            // Customer Signature
            if (selectedDJT.customerSignature) {
                variables['customerSignature'] = selectedDJT.customerSignature;
            }

            // Prepare multiple signatures
            for (let i = 1; i <= 15; i++) {
                variables[`sig_name_${i}`] = '';
                variables[`sig_img_${i}`] = '';
                variables[`Print Name_${i}`] = '';
                variables[`Times_${i}`] = '';
            }

            if (selectedDJT.signatures && selectedDJT.signatures.length > 0) {
                variables.hasSignatures = true;
                selectedDJT.signatures.forEach((sig: any, index: number) => {
                    const empName = normalizedEmployees.find(e => e.value === sig.employee)?.label || sig.employee;
                    const idx = index + 1;
                    variables[`sig_name_${idx}`] = empName;
                    variables[`sig_img_${idx}`] = sig.signature;
                    variables[`Print Name_${idx}`] = empName;
                    
                    // Add time info if available
                    const timesheet = schedule?.timesheet?.find((t: any) => t.employee === sig.employee);
                    if (timesheet) {
                        const inTime = new Date(timesheet.clockIn).toLocaleTimeString([], {hour:'numeric', minute:'2-digit', timeZone: 'UTC'});
                        const outTime = new Date(timesheet.clockOut).toLocaleTimeString([], {hour:'numeric', minute:'2-digit', timeZone: 'UTC'});
                        variables[`Times_${idx}`] = `${inTime} - ${outTime}`;
                    }
                });
            } else {
                variables.hasSignatures = false;
            }

            const response = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate DJT PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `DJT_${schedule?.customerName || 'Report'}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            success('DJT PDF downloaded successfully!');
        } catch (error: any) {
            console.error('DJT PDF Error:', error);
            toastError(error.message || 'Failed to download DJT PDF');
        } finally {
            setIsGeneratingDJTPDF(false);
        }
    };

    // Calculate Costs
    const { equipmentTotal, overheadTotal, djtCount } = useMemo(() => {
        let eqTotal = 0;
        let ovCounts = 0;

        // Get Overhead Constants
        const overheads = overheadCatalog && overheadCatalog.length > 0 ? overheadCatalog : (allConstants || []).filter((c: any) => c.type === 'Overhead');
        
        const getRate = (name: string) => {
             const item = overheads.find((c: any) => (c.overhead || c.description)?.trim().toLowerCase() === name.toLowerCase());
             return Number(item?.dailyRate) || Number(item?.dailyCost) || 0;
        };

        const devcoOverhead = getRate('Devco Overhead');
        const riskFactor = getRate('Risk Factor');
        const dailyOverheadRate = devcoOverhead + riskFactor;

        schedules.forEach(schedule => {
            // Equipment Cost (Owned only)
            if (schedule.djt?.equipmentUsed && Array.isArray(schedule.djt.equipmentUsed)) {
                schedule.djt.equipmentUsed.forEach((eq: any) => {
                    if (eq.type?.toLowerCase() === 'owned') {
                        eqTotal += (Number(eq.qty) || 0) * (Number(eq.cost) || 0);
                    }
                });
            }

            // Overhead Count (Schedules with DJT)
            if (schedule.hasDJT) {
                ovCounts++;
            }
        });

        return { 
            equipmentTotal: eqTotal, 
            overheadTotal: ovCounts * dailyOverheadRate,
            djtCount: ovCounts
        };
    }, [schedules, allConstants, overheadCatalog]);

    const totalCost = equipmentTotal + overheadTotal;
    const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-50 rounded-lg text-[#0F4C75]">
                            <CalendarClock className="w-5 h-5" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Schedules</h3>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">
                            {schedules.length}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <div className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 font-medium">
                            <span className="text-indigo-500 text-xs uppercase font-bold mr-2">Job Tickets</span>
                            {djtCount}
                        </div>
                        <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 font-medium">
                            <span className="text-amber-500 text-xs uppercase font-bold mr-2">Overhead</span>
                            {formatCurrency(overheadTotal)}
                        </div>
                        <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 font-medium">
                            <span className="text-emerald-500 text-xs uppercase font-bold mr-2">Equipment</span>
                            {formatCurrency(equipmentTotal)}
                        </div>
                        <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-900 text-white font-bold shadow-sm">
                            <span className="text-slate-400 text-xs uppercase font-bold mr-2">Total</span>
                            {formatCurrency(totalCost)}
                        </div>
                    </div>
            </div>
            {schedules.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                    No schedules found for this job.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {schedules.map(item => (
                        <ScheduleCard 
                            key={item._id} 
                            item={item}
                            initialData={{
                                employees: normalizedEmployees,
                                clients: normalizedClients,
                                constants: allConstants,
                                estimates: estimate ? [{ value: estimate.estimate, jobAddress: estimate.jobAddress }] : []
                            }}
                            currentUser={currentUser}
                            isSelected={selectedSchedule?._id === item._id}
                            onClick={() => {
                                setSelectedSchedule(item);
                                setScheduleDetailOpen(true);
                            }}
                            onEdit={(item) => {
                                // Open inline edit modal
                                setEditingSchedule(item);
                                setEditScheduleOpen(true);
                            }}
                            onCopy={(item) => {
                                // Copy schedule with next day dates
                                const addOneDay = (dateStr: string) => {
                                    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
                                    if (!match) return dateStr;
                                    const [, year, month, day, hours, minutes] = match;
                                    const utcDate = new Date(Date.UTC(
                                        parseInt(year),
                                        parseInt(month) - 1,
                                        parseInt(day) + 1
                                    ));
                                    const newYear = utcDate.getUTCFullYear();
                                    const newMonth = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
                                    const newDay = String(utcDate.getUTCDate()).padStart(2, '0');
                                    return `${newYear}-${newMonth}-${newDay}T${hours}:${minutes}`;
                                };
                                const clonedItem = {
                                    ...item,
                                    _id: undefined as any,
                                    fromDate: addOneDay(item.fromDate),
                                    toDate: addOneDay(item.toDate),
                                    timesheet: [],
                                    hasJHA: false,
                                    jha: undefined,
                                    JHASignatures: [],
                                    hasDJT: false,
                                    djt: undefined,
                                    DJTSignatures: [],
                                    syncedToAppSheet: false
                                };
                                setEditingSchedule(clonedItem as ScheduleItem);
                                setEditScheduleOpen(true);
                            }}
                            onDelete={(item) => {
                                setDeleteId(item._id);
                                setIsConfirmOpen(true);
                            }}
                            // Functionality Handlers
                            onViewJHA={(item) => {
                                const jhaWithSigs = { ...(item.jha || {}), signatures: item.JHASignatures || [] };
                                setSelectedJHA(jhaWithSigs);
                                setIsJhaEditMode(false);
                                setJhaModalOpen(true);
                            }}
                            onCreateJHA={(item) => {
                                setSelectedJHA({ schedule_id: item._id });
                                setIsJhaEditMode(true);
                                setJhaModalOpen(true);
                            }}
                            onViewDJT={(item) => {
                                const djtWithSigs = { ...(item.djt || {}), schedule_id: item._id, signatures: item.DJTSignatures || [] };
                                setSelectedDJT(djtWithSigs);
                                setIsDjtEditMode(false);
                                setDjtModalOpen(true);
                            }}
                            onCreateDJT={(item) => {
                                setSelectedDJT({ schedule_id: item._id });
                                setIsDjtEditMode(true);
                                setDjtModalOpen(true);
                            }}
                            onToggleDriveTime={(item, activeTs, e) => {
                                if (e) e.stopPropagation();
                                const isStopping = !!activeTs;
                                setActionConfirm({
                                    isOpen: true,
                                    title: isStopping ? 'Stop Drive Time' : 'Start Drive Time',
                                    message: `Are you sure you want to ${isStopping ? 'STOP' : 'START'} Drive Time?`,
                                    confirmText: isStopping ? 'Stop' : 'Start',
                                    variant: isStopping ? 'danger' : 'primary',
                                    onConfirm: async () => {
                                        if (!currentUser) return;
                                        const now = new Date().toISOString();
                                        // Optimistic
                                        if (activeTs) {
                                            setSchedules(prev => prev.map(s => {
                                                if (s._id !== item._id) return s;
                                                return { ...s, timesheet: (s.timesheet || []).map(ts => ts._id === activeTs._id ? { ...ts, clockOut: now } : ts) };
                                            }));
                                        }
                                        try {
                                            const res = await fetch('/api/schedules', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ 
                                                    action: 'toggleDriveTime', 
                                                    scheduleId: item._id,
                                                    employee: currentUser.email
                                                })
                                            });
                                            const data = await res.json();
                                            if (data.success) {
                                                setSchedules(prev => prev.map(s => s._id === item._id ? { ...s, timesheet: data.timesheet } : s));
                                                success(activeTs ? 'Clocked Out' : 'Clocked In');
                                            } else {
                                                toastError(data.error);
                                            }
                                        } catch (e) { console.error(e); }
                                    }
                                });
                            }}
                            onQuickTimesheet={(item, type, e) => {
                                if (e) e.stopPropagation();
                                const isIncrement = (item.timesheet || []).some((ts: any) => 
                                    ts.employee?.toLowerCase() === (currentUser?.email?.toLowerCase() || '') &&
                                    ((type === 'Dump Washout' && (String(ts.dumpWashout).toLowerCase() === 'true' || ts.dumpWashout === true)) ||
                                     (type === 'Shop Time' && (String(ts.shopTime).toLowerCase() === 'true' || ts.shopTime === true)))
                                );
                                const actionWord = isIncrement ? 'INCREMENT' : 'REGISTER';
                                setActionConfirm({
                                    isOpen: true,
                                    title: `${type}`,
                                    message: `Are you sure you want to ${actionWord} ${type}?`,
                                    confirmText: 'Confirm',
                                    variant: 'primary',
                                    onConfirm: async () => {
                                        if (!currentUser) return;
                                        try {
                                            const res = await fetch('/api/schedules', {
                                                method: 'POST',
                                                headers: {'Content-Type': 'application/json'},
                                                body: JSON.stringify({
                                                    action: 'quickTimesheet',
                                                    scheduleId: item._id,
                                                    employee: currentUser.email,
                                                    type
                                                })
                                            });
                                            const data = await res.json();
                                            if (data.success) {
                                                setSchedules(prev => prev.map(s => s._id === item._id ? { ...s, timesheet: data.timesheet } : s));
                                                success(`${type} Recorded`);
                                            } else {
                                                toastError(data.error);
                                            }
                                        } catch (e) {
                                            console.error(e);
                                            toastError('Failed to update timesheet');
                                        }
                                    }
                                });
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            <JHAModal
                isOpen={jhaModalOpen}
                onClose={() => setJhaModalOpen(false)}
                selectedJHA={selectedJHA}
                setSelectedJHA={setSelectedJHA}
                isEditMode={isJhaEditMode}
                setIsEditMode={setIsJhaEditMode}
                schedules={schedules}
                handleSave={async (e) => {
                    e.preventDefault();
                    if (!selectedJHA) return;
                    try {
                        const payload = { ...selectedJHA, schedule_id: selectedJHA.schedule_id || selectedJHA._id };
                        const res = await fetch('/api/jha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveJHA', payload }) });
                        const data = await res.json();
                        if (data.success) {
                            success('JHA Saved');
                            setJhaModalOpen(false);
                            
                            // Immediately update local schedules state
                            setSchedules(prev => prev.map(s => {
                                if (s._id === payload.schedule_id) {
                                    return {
                                        ...s,
                                        hasJHA: true,
                                        jha: data.result || payload
                                    };
                                }
                                return s;
                            }));
                        } else toastError(data.error || 'Failed to save JHA');
                    } catch (e) { 
                        console.error(e); 
                        toastError('Error saving JHA');
                    }
                }}
                initialData={{
                    employees: normalizedEmployees,
                }}
                handleSaveSignature={async (dataUrl) => {
                     if (!activeSignatureEmployee || !selectedJHA) return;
                     try {
                         const payload = { schedule_id: selectedJHA.schedule_id, employee: activeSignatureEmployee, signature: dataUrl, createdBy: currentUser?.email };
                         const res = await fetch('/api/jha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveJHASignature', payload }) });
                         const data = await res.json();
                         if (data.success) {
                             success('Signature Saved');
                             setSelectedJHA((prev: any) => ({ ...prev, signatures: [...(prev.signatures || []), data.result] }));
                             setActiveSignatureEmployee(null);
                             
                             // Update local schedules to show signature on card
                             setSchedules(prev => prev.map(s => {
                                 if (s._id === payload.schedule_id) {
                                     return {
                                         ...s,
                                         JHASignatures: [...(s.JHASignatures || []), data.result]
                                     };
                                 }
                                 return s;
                             }));
                         } else toastError(data.error);
                     } catch (e) { console.error(e); }
                }}
                activeSignatureEmployee={activeSignatureEmployee}
                setActiveSignatureEmployee={setActiveSignatureEmployee}
                isGeneratingPDF={isGeneratingJHAPDF}
                handleDownloadPDF={async () => {
                     if (!selectedJHA) return;
                     setIsGeneratingJHAPDF(true);
                     try {
                         const templateId = '164zwSdl2631kZ4mRUVtzWhg5oewL0wy6RVCgPQig258';
                         const schedule = schedules.find(s => s._id === selectedJHA.schedule_id);
                         const variables: any = { ...selectedJHA, customerName: schedule?.customerName, date: selectedJHA.date || new Date().toLocaleDateString() };
                         const response = await fetch('/api/generate-google-pdf', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ templateId, variables }) });
                         if (response.ok) {
                             const blob = await response.blob();
                             const url = window.URL.createObjectURL(blob);
                             const a = document.createElement('a');
                             a.href = url;
                             a.download = 'JHA.pdf';
                             a.click();
                             success('PDF Downloaded');
                         }
                     } catch (e) { console.error(e); } finally { setIsGeneratingJHAPDF(false); }
                }}
                setEmailModalOpen={setEmailModalOpen}
            />
            
            <DJTModal
                isOpen={djtModalOpen}
                onClose={() => setDjtModalOpen(false)}
                selectedDJT={selectedDJT}
                setSelectedDJT={setSelectedDJT}
                isEditMode={isDjtEditMode}
                setIsEditMode={setIsDjtEditMode}
                schedules={schedules}
                handleSave={async (e) => {
                    e.preventDefault();
                    if (!selectedDJT) return;
                    try {
                        const payload = { ...selectedDJT, schedule_id: selectedDJT.schedule_id || selectedDJT._id };
                        const res = await fetch('/api/djt', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ action: 'saveDJT', payload }) });
                        const data = await res.json();
                        if (data.success) { 
                            success('DJT Saved'); 
                            setDjtModalOpen(false); 
                            
                            // Immediately update local schedules state so totals refresh
                            setSchedules(prev => prev.map(s => {
                                if (s._id === payload.schedule_id) {
                                    return {
                                        ...s,
                                        hasDJT: true,
                                        djt: data.result || payload
                                    };
                                }
                                return s;
                            }));
                        } else {
                            toastError(data.error || 'Failed to save DJT');
                        }
                    } catch (e) { 
                        console.error(e); 
                        toastError('Error saving DJT');
                    }
                }}
                initialData={{
                    employees: normalizedEmployees,
                    equipmentItems: normalizedEquipment
                }}
                handleSaveSignature={async (data) => {
                    if (!activeSignatureEmployee || !selectedDJT) return;
                    setIsSavingSignature(true);
                    try {
                        const payload = { schedule_id: selectedDJT.schedule_id, employee: activeSignatureEmployee, signature: typeof data === 'string' ? data : data.signature, createdBy: currentUser?.email };
                         const res = await fetch('/api/djt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveDJTSignature', payload }) });
                         const json = await res.json();
                         if (json.success) {
                             setSelectedDJT((prev: any) => ({ ...prev, signatures: [...(prev.signatures || []), json.result] }));
                             setActiveSignatureEmployee(null);
                             success('Signature Saved');
                             
                             // Update local schedules to show signature on card
                             setSchedules(prev => prev.map(s => {
                                 if (s._id === payload.schedule_id) {
                                     return {
                                         ...s,
                                         DJTSignatures: [...(s.DJTSignatures || []), json.result]
                                     };
                                 }
                                 return s;
                             }));
                         }
                    } catch (e) { console.error(e); } finally { setIsSavingSignature(false); }
                }}
                activeSignatureEmployee={activeSignatureEmployee}
                setActiveSignatureEmployee={setActiveSignatureEmployee}
                isGeneratingPDF={isGeneratingDJTPDF}
                handleDownloadPDF={handleDownloadDjtPdf}
                isSavingSignature={isSavingSignature}
            />
            
            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={() => {
                    setIsConfirmOpen(false);
                    setDeleteId(null);
                }}
                title="Delete Schedule"
                message="Are you sure you want to delete this schedule? This action cannot be undone."
                onConfirm={handleDeleteSchedule}
            />

            {/* Action Confirmation Modal (Drive Time, Dump Washout, Shop Time) */}
            <ConfirmModal
                isOpen={actionConfirm.isOpen}
                onClose={() => setActionConfirm(prev => ({ ...prev, isOpen: false }))}
                onConfirm={actionConfirm.onConfirm}
                title={actionConfirm.title}
                message={actionConfirm.message}
                confirmText={actionConfirm.confirmText}
                cancelText="Cancel"
                variant={actionConfirm.variant}
            />

            {/* Schedule Detail Modal - Reusing dashboard component */}
            <ScheduleDetailModal
                isOpen={scheduleDetailOpen}
                onClose={() => {
                    setScheduleDetailOpen(false);
                    setSelectedSchedule(null);
                }}
                schedule={selectedSchedule}
                initialData={{
                    employees: normalizedEmployees,
                    clients: normalizedClients,
                    constants: allConstants,
                    estimates: estimate ? [{ value: estimate.estimate, jobAddress: estimate.jobAddress }] : []
                }}
                onOpenMedia={(type, url, title) => {
                    setMediaUrl(url);
                    setMediaTitle(title);
                    setMediaModalOpen(true);
                }}
            />

            {/* Media Viewer Modal */}
            <Modal
                isOpen={mediaModalOpen}
                onClose={() => setMediaModalOpen(false)}
                title={mediaTitle}
                maxWidth="4xl"
            >
                <div className="flex justify-center items-center p-4">
                    <img src={mediaUrl} alt={mediaTitle} className="max-w-full max-h-[70vh] object-contain rounded-xl" />
                </div>
            </Modal>

            {/* Schedule Edit/Create Form Modal */}
            <ScheduleFormModal
                isOpen={editScheduleOpen}
                onClose={() => {
                    setEditScheduleOpen(false);
                    setEditingSchedule(null);
                }}
                schedule={editingSchedule}
                initialData={{
                    employees: normalizedEmployees,
                    clients: normalizedClients,
                    constants: allConstants,
                    estimates: estimate ? [{ 
                        value: estimate.estimate, 
                        label: `${estimate.estimate} - ${estimate.projectTitle || estimate.projectName || ''}`.trim(),
                        jobAddress: estimate.jobAddress,
                        customerId: estimate.customerId,
                        projectTitle: estimate.projectTitle,
                        projectName: estimate.projectName,
                        scopeOfWork: estimate.scopeOfWork,
                        services: estimate.services,
                        fringe: estimate.fringe,
                        certifiedPayroll: estimate.certifiedPayroll,
                        aerialImage: estimate.aerialImage,
                        siteLayout: estimate.siteLayout
                    }] : []
                }}
                onSave={(savedSchedule, isNew) => {
                    if (isNew) {
                        setSchedules(prev => [...prev, savedSchedule]);
                    } else {
                        setSchedules(prev => prev.map(s => s._id === savedSchedule._id ? savedSchedule : s));
                    }
                }}
            />
        </div>
    );
};
