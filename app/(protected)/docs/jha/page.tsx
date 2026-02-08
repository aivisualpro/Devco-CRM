'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Plus, Search, FileText, Edit, Trash2, Loader2, Calendar, Users
} from 'lucide-react';
import { 
    Header, Table, TableHead, TableBody, TableRow, 
    TableHeader, TableCell, Pagination, Badge, Button,
    Modal, SearchableSelect
} from '@/components/ui';
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
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="lg:hidden space-y-3">
                            {paginatedJHAs.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-500 font-medium text-sm">No JHA records found.</p>
                                </div>
                            ) : (
                                paginatedJHAs.map((jha: any, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-white rounded-2xl border border-slate-100 p-4 active:scale-[0.98] transition-transform shadow-sm"
                                        onClick={() => handleViewOpen(jha)}
                                        onTouchStart={() => handleLongPressStart(jha)}
                                        onTouchEnd={handleLongPressEnd}
                                        onTouchCancel={handleLongPressEnd}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0F4C75] flex items-center justify-center shrink-0">
                                                    <FileText size={18} />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">
                                                        {jha.date ? new Date(jha.date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                                    </div>
                                                    <div className="text-xs text-slate-400">{jha.jhaTime || '--:--'}</div>
                                                </div>
                                            </div>
                                            <Badge variant="default" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                                                {jha.scheduleRef?.estimate || 'No Est'}
                                            </Badge>
                                        </div>

                                        <div className="text-xs text-slate-600 font-medium mb-2 truncate">
                                            {getClientName(jha.scheduleRef)}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                                {jha.usaNo && <span className="font-mono">USA: {jha.usaNo}</span>}
                                            </div>
                                            <div className="flex -space-x-1.5">
                                                {(jha.signatures || []).slice(0, 4).map((sig: any, i: number) => {
                                                    const emp = employees.find(e => e.value === sig.employee);
                                                    return (
                                                        <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden">
                                                            {emp?.image ? <img src={emp.image} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] font-bold text-slate-500">{emp?.label?.[0]}</span>}
                                                        </div>
                                                    );
                                                })}
                                                {(jha.signatures || []).length > 4 && (
                                                    <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600">
                                                        +{(jha.signatures || []).length - 4}
                                                    </div>
                                                )}
                                                {(!jha.signatures || jha.signatures.length === 0) && (
                                                    <span className="text-[10px] text-slate-400 italic">No signatures</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            {/* Pagination for mobile */}
                            {totalPages > 1 && (
                                <div className="py-4">
                                    <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                                </div>
                            )}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden lg:flex flex-col flex-1 min-h-0">
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
                                <Table 
                                    containerClassName="flex-1 overflow-auto"
                                    footer={<Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />}
                                >
                                    <TableHead className="bg-slate-50 border-b border-slate-100 z-10 sticky top-0">
                                        <TableRow>
                                            <TableHeader className="pl-6 py-4">Date</TableHeader>
                                            <TableHeader>Client</TableHeader>
                                            <TableHeader>Estimate</TableHeader>
                                            <TableHeader>USA No.</TableHeader>
                                            <TableHeader>Signatures</TableHeader>
                                            <TableHeader className="text-right pr-6">Actions</TableHeader>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {paginatedJHAs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                                                    No JHA records found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedJHAs.map((jha: any, idx) => (
                                                <TableRow 
                                                    key={idx} 
                                                    className="hover:bg-slate-50/50 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
                                                    onClick={() => handleViewOpen(jha)}
                                                >
                                                    <TableCell className="pl-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0F4C75] flex items-center justify-center shrink-0">
                                                                <FileText size={16} />
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-bold text-slate-700">
                                                                    {jha.date ? new Date(jha.date).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'N/A'}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400">
                                                                    {jha.jhaTime || '--:--'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-sm font-medium text-slate-600">
                                                            {getClientName(jha.scheduleRef)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="default" className="bg-slate-100 text-slate-600 border-slate-200">
                                                            {jha.scheduleRef?.estimate || 'No Est'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-mono text-slate-600">{jha.usaNo || '-'}</span>
                                                            {jha.subcontractorUSANo && (
                                                                <span className="text-[10px] text-slate-400">Sub: {jha.subcontractorUSANo}</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex -space-x-2">
                                                            {(jha.signatures || []).map((sig: any, i: number) => {
                                                                const emp = employees.find(e => e.value === sig.employee);
                                                                return (
                                                                    <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden" title={emp?.label || sig.employee}>
                                                                        {emp?.image ? <img src={emp.image} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] font-bold text-slate-500">{emp?.label?.[0]}</span>}
                                                                    </div>
                                                                );
                                                            })}
                                                            {(!jha.signatures || jha.signatures.length === 0) && (
                                                                <span className="text-xs text-slate-400 italic">None</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                                            {canEdit && (
                                                                <Button variant="ghost" size="icon" onClick={() => handleEditOpen(jha)} className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                                                                    <Edit size={16} />
                                                                </Button>
                                                            )}
                                                            {canDelete && (
                                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(jha)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
                                                                    <Trash2 size={16} />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
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
