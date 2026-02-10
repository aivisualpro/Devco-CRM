'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Plus, Search, FileText, Edit, Trash2, Loader2, Check
} from 'lucide-react';
import { 
    Header, Pagination, Button,
    Modal, SearchableSelect
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { JHAModal } from '../../jobs/schedules/components/JHAModal';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';

interface Signature {
    employee: string;
    signature: string;
    createdAt: string;
}

interface JHA {
    schedule_id?: string;
    scheduleRef?: Schedule;
    date?: string;
    jhaTime?: string;
    createdBy?: string;
    signatures?: Signature[];
    usaNo?: string;
    subcontractorUSANo?: string;
    [key: string]: any;
}

interface Schedule {
    _id: string;
    estimate?: string;
    projectId?: string;
    projectTitle?: string;
    projectName?: string;
    title?: string;
    fromDate?: string;
    jha?: JHA;
    [key: string]: any;
}

interface Employee {
    value: string;
    label: string;
    image?: string;
    email: string;
    firstName?: string;
    lastName?: string;
}

export default function JHAPage() {
    const { success, error } = useToast();
    const { can } = usePermissions();
    
    // Permissions
    const canCreate = can(MODULES.JHA, ACTIONS.CREATE);
    const canEdit = can(MODULES.JHA, ACTIONS.EDIT);
    const canDelete = can(MODULES.JHA, ACTIONS.DELETE);
    
    // Data State
    const [jhas, setJhas] = useState<JHA[]>([]);
    const [totalJHAs, setTotalJHAs] = useState(0);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [estimates, setEstimates] = useState<any[]>([]); 
    const [clients, setClients] = useState<any[]>([]); 
    const [loading, setLoading] = useState(true);

    // UI State
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // View/Edit Modal State
    const [isJHAModalOpen, setIsJHAModalOpen] = useState(false);
    const [selectedJHA, setSelectedJHA] = useState<JHA | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [activeSignatureEmployee, setActiveSignatureEmployee] = useState<string | null>(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
    const [emailModalOpen, setEmailModalOpen] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars

    // Create New JHA Flow State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedScheduleId, setSelectedScheduleId] = useState('');

    // Mobile action sheet
    const [actionSheetItem, setActionSheetItem] = useState<JHA | null>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    const handleLongPressStart = (jha: JHA) => {
        longPressTimer.current = setTimeout(() => {
            setActionSheetItem(jha);
        }, 500);
    };

    const handleLongPressEnd = () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage]);

    // Search Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (currentPage !== 1) {
                setCurrentPage(1); // Reset to page 1 on search
            } else {
                fetchData();
            }
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch JHAs (Paginated)
            const jhaRes = await fetch('/api/jha', {
                method: 'POST',
                body: JSON.stringify({ 
                    action: 'getJHAs',
                    payload: { 
                        page: currentPage, 
                        limit: itemsPerPage,
                        search 
                    }
                })
            });
            const jhaData = await jhaRes.json();
            
            if (jhaData.success) {
                 setJhas(jhaData.result.jhas);
                 setTotalJHAs(jhaData.result.total);
            }

            if (schedules.length === 0) {
                 const res = await fetch('/api/schedules', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        action: 'getSchedulesPage',
                        payload: {
                            startDate: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString()
                        }
                    }) 
                });

                const data = await res.json();

                if (data.success) {
                    setSchedules(data.result.schedules || []);
                    setEmployees(data.result.initialData.employees || []);
                    setEstimates(data.result.initialData.estimates || []);
                    setClients(data.result.initialData.clients || []);
                }
            }

        } catch (err) {
            console.error('Error fetching data:', err);
            error('Failed to load data');
        }
        setLoading(false);
    };

    // Helper to get client name
    const getClientName = (schedule: Schedule | undefined) => {
        if (!schedule) return '-';
        if (schedule.customerName) return schedule.customerName; 
        
        // Fallback to lookup via estimates/clients list
        if (schedule.estimate) {
            const est = estimates.find(e => e.estimate === schedule.estimate);
            if (est?.customerName) return est.customerName;
            if (est?.customerId) {
                const client = clients.find(c => c._id === est.customerId);
                if (client) return client.name;
            }
        }
        
        // Fallback to customerId on schedule
        if (schedule.customerId) {
             const client = clients.find(c => c._id === schedule.customerId);
             if (client) return client.name;
        }

        return '-';
    };

    // Available Schedules for New JHA
    const availableSchedules = useMemo(() => {
        return schedules
            .filter(s => !s.jha || Object.keys(s.jha).length === 0)
            .map(s => ({
                value: s._id,
                label: `${s.estimate || 'No Est'} - ${s.fromDate ? new Date(s.fromDate).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'No Date'}`,
                ...s
            }));
    }, [schedules]);

    const totalPages = Math.ceil(totalJHAs / itemsPerPage);
    const paginatedJHAs = jhas; // Server side pagination means 'jhas' IS the current page


    // Handlers
    const handleCreateOpen = () => {
        setSelectedScheduleId('');
        setIsCreateModalOpen(true);
    };

    const handleCreateProceed = () => {
        if (!selectedScheduleId) {
            error('Please select a schedule');
            return;
        }
        const schedule = schedules.find(s => s._id === selectedScheduleId);
        if (!schedule) return;

        // Initialize new JHA
        const newJHA: JHA = {
            schedule_id: schedule._id,
            scheduleRef: schedule,
            date: new Date().toISOString(), // Default to today
            jhaTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            createdBy: '', 
            signatures: [],
            active: true
        };

        setSelectedJHA(newJHA);
        setIsEditMode(true);
        setIsCreateModalOpen(false);
        setIsJHAModalOpen(true);
    };

    const handleEditOpen = (jha: any) => {
        setSelectedJHA({ ...jha });
        setIsEditMode(true);
        setIsJHAModalOpen(true);
    };

    const handleViewOpen = (jha: any) => {
        setSelectedJHA({ ...jha });
        setIsEditMode(false);
        setIsJHAModalOpen(true);
    };

    const handleDelete = async (jha: any) => {
        if (!confirm('Are you sure you want to delete this JHA?')) return;

        try {
            const res = await fetch('/api/jha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deleteJHA', payload: { id: jha._id } })
            });

            const data = await res.json();
            if (data.success) {
                success('JHA deleted successfully');
                fetchData();
            } else {
                error('Failed to delete JHA');
            }
        } catch (err) {
            console.error(err);
            error('An error occurred');
        }
    };

    const handleSaveJHA = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedJHA) return;
        
        try {
            const payload = {
                ...selectedJHA,
                schedule_id: selectedJHA.schedule_id || selectedJHA.scheduleRef?._id
            };
            
            delete payload.scheduleRef;

            const res = await fetch('/api/jha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveJHA', payload })
            });

            const data = await res.json();
            if (data.success) {
                success('JHA saved successfully');
                setIsJHAModalOpen(false);
                fetchData();
            } else {
                error('Failed to save JHA');
            }
        } catch (err) {
            console.error(err);
            error('An error occurred');
        }
    };

    const handleSaveSignature = async (sigData: string) => {
        if (!activeSignatureEmployee || !selectedJHA) return;

        const newSignature = {
            employee: activeSignatureEmployee,
            signature: sigData,
            createdAt: new Date().toISOString()
        };

        const currentSignatures = Array.isArray(selectedJHA.signatures) ? [...selectedJHA.signatures] : [];
        const filtered = currentSignatures.filter((s: any) => s.employee !== activeSignatureEmployee);
        filtered.push(newSignature);

        const updatedJHA = { ...selectedJHA, signatures: filtered };
        setSelectedJHA(updatedJHA);

        try {
            const payload = {
                ...updatedJHA,
                schedule_id: selectedJHA.schedule_id || selectedJHA.scheduleRef?._id
            };
            delete payload.scheduleRef;

            await fetch('/api/jha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'saveJHA', payload })
            });
            success('Signature saved');
            setActiveSignatureEmployee(null);
            
            fetchData();
        } catch (err) {
            error('Failed to save signature');
        }
    };

    // Placeholder for PDF download
    const handleDownloadPDF = () => {
        setIsGeneratingPDF(true);
        setTimeout(() => {
             setIsGeneratingPDF(false);
             success('PDF Download not implemented in this view yet');
        }, 1000);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header 
                rightContent={
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 justify-end">
                        <div className="relative flex-1 max-w-[200px] sm:max-w-[264px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search JHAs..."
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-[#0F4C75] shadow-sm"
                            />
                        </div>
                        {canCreate && (
                            <div className="hidden lg:block">
                                <Button onClick={handleCreateOpen} size="icon" className="!bg-[#0F4C75] !rounded-full h-10 w-10 p-0 flex items-center justify-center">
                                    <Plus className="w-5 h-5" />
                                </Button>
                            </div>
                        )}
                    </div>
                }
            />

            <div className="flex-1 p-4 lg:p-6 overflow-auto flex flex-col min-h-0">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-[#0F4C75] animate-spin" />
                    </div>
                ) : paginatedJHAs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mb-4 shadow-sm">
                            <FileText className="w-7 h-7 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-semibold text-sm mb-1">No JHA Records Found</p>
                        <p className="text-slate-400 text-xs">Create your first Job Hazard Analysis to get started.</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Bar */}
                        <div className="flex items-center gap-3 mb-5 flex-wrap">
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-sm">
                                <div className="w-2 h-2 rounded-full bg-[#0F4C75]" />
                                <span className="text-xs font-bold text-slate-700">{totalJHAs}</span>
                                <span className="text-xs text-slate-400">Total</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-sm">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-xs font-bold text-slate-700">{paginatedJHAs.filter((j: any) => (j.signatures || []).length > 0).length}</span>
                                <span className="text-xs text-slate-400">Signed</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-sm">
                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                <span className="text-xs font-bold text-slate-700">{paginatedJHAs.filter((j: any) => !(j.signatures || []).length).length}</span>
                                <span className="text-xs text-slate-400">No Signatures</span>
                            </div>
                        </div>

                        {/* Card Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
                            {paginatedJHAs.map((jha: any, idx: number) => {
                                const schedule = jha.scheduleRef;
                                const clientName = getClientName(schedule);
                                const dateStr = (jha.date || schedule?.fromDate) ? new Date(jha.date || schedule?.fromDate).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                                const creator = employees.find(e => e.value === jha.createdBy);
                                const sigCount = (jha.signatures || []).length;

                                return (
                                    <div
                                        key={jha._id || idx}
                                        className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col"
                                        onClick={() => handleViewOpen(jha)}
                                    >
                                        {/* Card Header - Gradient Accent */}
                                        <div className="relative px-5 pt-4 pb-3 bg-gradient-to-r from-[#0F4C75]/[0.04] to-transparent border-b border-slate-100">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0F4C75] to-[#1B6CA8] text-white flex items-center justify-center shrink-0 shadow-sm">
                                                        <FileText size={18} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-bold text-slate-800 leading-tight">{dateStr}</p>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">{jha.jhaTime || '--:--'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {sigCount > 0 ? (
                                                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-1 rounded-lg">
                                                            <Check size={10} /> {sigCount} Signed
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-bold px-2 py-1 rounded-lg">
                                                            No Signatures
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card Body */}
                                        <div className="px-5 py-4 flex-1 flex flex-col gap-3.5">
                                            {/* Client & Estimate */}
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-semibold text-slate-700 truncate flex-1">{clientName}</p>
                                                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 shrink-0 tracking-wide">
                                                    {schedule?.estimate || 'No Est'}
                                                </span>
                                            </div>

                                            {/* USA Numbers */}
                                            <div className="bg-slate-50/80 rounded-xl px-3.5 py-2.5 border border-slate-100">
                                                <div className="flex items-center gap-4">
                                                    <div className="flex-1">
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">USA No.</p>
                                                        <p className="text-sm font-mono font-semibold text-slate-700 mt-0.5">{jha.usaNo || '—'}</p>
                                                    </div>
                                                    {jha.subcontractorUSANo && (
                                                        <div className="flex-1 border-l border-slate-200 pl-4">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sub USA No.</p>
                                                            <p className="text-sm font-mono font-semibold text-slate-700 mt-0.5">{jha.subcontractorUSANo}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Signatures */}
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Signatures</p>
                                                {sigCount > 0 ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex -space-x-2">
                                                            {(jha.signatures || []).slice(0, 5).map((sig: any, i: number) => {
                                                                const emp = employees.find(e => e.value === sig.employee);
                                                                return (
                                                                    <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-emerald-50 flex items-center justify-center overflow-hidden shadow-sm relative" title={emp?.label || sig.employee}>
                                                                        {emp?.image ? <img src={emp.image} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] font-bold text-emerald-700">{(emp?.label?.[0] || '?').toUpperCase()}</span>}
                                                                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-[1.5px] border-white flex items-center justify-center">
                                                                            <Check size={6} className="text-white" />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {sigCount > 5 && (
                                                                <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500">+{sigCount - 5}</div>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-emerald-600 font-semibold">{sigCount} signed</span>
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-slate-300 italic">No signatures yet</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Card Footer */}
                                        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {creator ? (
                                                    <>
                                                        <div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden shrink-0">
                                                            {creator.image ? <img src={creator.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-slate-500">{creator.label?.[0]}</div>}
                                                        </div>
                                                        <span className="text-[10px] text-slate-500 font-medium truncate">{creator.label}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 truncate">{jha.createdBy || 'Unknown'}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                                                {canEdit && (
                                                    <button onClick={() => handleEditOpen(jha)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#0F4C75] hover:bg-[#0F4C75]/5 transition-colors" title="Edit">
                                                        <Edit size={14} />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button onClick={() => handleDelete(jha)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="pt-6 pb-2">
                                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Mobile FAB */}
            {canCreate && (
                <button
                    onClick={handleCreateOpen}
                    className="lg:hidden fixed bottom-24 right-6 w-14 h-14 bg-[#0F4C75] text-white rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-transform z-30 border-4 border-white"
                >
                    <Plus size={24} />
                </button>
            )}

            {/* Mobile Action Sheet */}
            {actionSheetItem && (
                <div
                    className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 backdrop-blur-sm px-4 pb-20 lg:pb-4 transition-all"
                    onClick={() => setActionSheetItem(null)}
                >
                    <div
                        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-slate-100">
                            <p className="text-sm font-bold text-slate-800">
                                JHA — {actionSheetItem.date ? new Date(actionSheetItem.date).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'N/A'}
                            </p>
                            <p className="text-xs text-slate-500">{getClientName(actionSheetItem.scheduleRef)}</p>
                        </div>
                        <div className="p-2">
                            <button
                                onClick={() => { handleViewOpen(actionSheetItem); setActionSheetItem(null); }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                <FileText size={18} className="text-slate-400" /> View Details
                            </button>
                            {canEdit && (
                                <button
                                    onClick={() => { handleEditOpen(actionSheetItem); setActionSheetItem(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50"
                                >
                                    <Edit size={18} /> Edit
                                </button>
                            )}
                            {canDelete && (
                                <button
                                    onClick={() => { handleDelete(actionSheetItem); setActionSheetItem(null); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 size={18} /> Delete
                                </button>
                            )}
                        </div>
                        <div className="p-2 border-t border-slate-100">
                            <button
                                onClick={() => setActionSheetItem(null)}
                                className="w-full py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal - Step 1 Schedule Selection */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Create New JHA"
                maxWidth="md"
            >
                <div className="space-y-6">
                    <div>
                        <p className="text-sm text-slate-600 mb-4">
                            Select a schedule to create a Job Hazard Analysis for. 
                            Only schedules without an existing JHA are listed.
                        </p>
                        
                        <div className="space-y-2">
                             <label className="text-xs font-bold text-slate-500 uppercase">Select Schedule</label>
                             <SearchableSelect
                                value={selectedScheduleId}
                                onChange={setSelectedScheduleId}
                                options={availableSchedules}
                                placeholder="Search by Estimate or Date..."
                                className="w-full"
                            />
                        </div>
                    </div>
                     <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateProceed} disabled={!selectedScheduleId}>Proceed to JHA Form</Button>
                    </div>
                </div>
            </Modal>

            {/* JHA Modal - Step 2 Edit/View */}
            {selectedJHA && (
                <JHAModal
                    isOpen={isJHAModalOpen}
                    onClose={() => setIsJHAModalOpen(false)}
                    selectedJHA={selectedJHA}
                    setSelectedJHA={setSelectedJHA}
                    isEditMode={!!isEditMode}
                    setIsEditMode={setIsEditMode}
                    handleSave={handleSaveJHA}
                    handleSaveSignature={handleSaveSignature}
                    isGeneratingPDF={isGeneratingPDF}
                    handleDownloadPDF={handleDownloadPDF}
                    setEmailModalOpen={setEmailModalOpen}
                    initialData={{ employees, clients: [] }} // JHAModal primarily needs employees
                    schedules={schedules}
                    activeSignatureEmployee={activeSignatureEmployee}
                    setActiveSignatureEmployee={setActiveSignatureEmployee}
                />
            )}
        </div>
    );
}
