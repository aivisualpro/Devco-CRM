'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Plus, Search, FileText, Edit, Trash2, Loader2
} from 'lucide-react';
import { 
    Header, Table, TableHead, TableBody, TableRow, 
    TableHeader, TableCell, Pagination, Badge, Button,
    Modal, SearchableSelect
} from '@/components/ui';
import { useToast } from '@/hooks/useToast';
import { JHAModal } from '../schedules/components/JHAModal';

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
    
    // Data State
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
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
    // Stub for email modal since we might not implement full email flow yet or reuse another component
    // For now we'll minimally support what JHAModal needs
    const [emailModalOpen, setEmailModalOpen] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars

    // Create New JHA Flow State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedScheduleId, setSelectedScheduleId] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Schedules
            const schRes = await fetch('/api/schedules', {
                method: 'POST',
                body: JSON.stringify({ action: 'getSchedules' }) 
            });
            const schData = await schRes.json();
            
            // Fetch Employees
            const empRes = await fetch('/api/webhook/devcoBackend', {
                method: 'POST',
                body: JSON.stringify({ action: 'getEmployees' })
            });
            const empData = await empRes.json();

            if (schData.success) {
                setSchedules(schData.result || []);
            }
            if (empData.success) {
                // Map employees to format expected by Select/JHAModal
                const formattedEmps = (empData.result || []).map((e: any) => ({
                    value: e.email,
                    label: `${e.firstName} ${e.lastName}`,
                    image: e.profilePicture,
                    ...e
                }));
                setEmployees(formattedEmps);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
            error('Failed to load data');
        }
        setLoading(false);
    };

    // Filtered JHA List (Schedules usually have jha object if created)
    const existingJHAs = useMemo(() => {
        return schedules
            .filter(s => s.jha && Object.keys(s.jha).length > 0)
            .map(s => ({ ...s.jha, schedule_id: s._id, scheduleRef: s })); 
    }, [schedules]);

    // Available Schedules for New JHA
    const availableSchedules = useMemo(() => {
        return schedules
            .filter(s => !s.jha || Object.keys(s.jha).length === 0)
            .map(s => ({
                value: s._id,
                label: `${s.estimate || 'No Est'} - ${s.fromDate ? new Date(s.fromDate).toLocaleDateString() : 'No Date'}`,
                ...s
            }));
    }, [schedules]);

    // Search & Pagination for Table
    const filteredJHAs = useMemo(() => {
        if (!search) return existingJHAs;
        const lowerSearch = search.toLowerCase();
        return existingJHAs.filter((jha: any) => {
            const dateStr = jha.date ? new Date(jha.date).toLocaleDateString() : '';
            const schedule = jha.scheduleRef;
            return (
                dateStr.includes(lowerSearch) ||
                (schedule?.estimate || '').toLowerCase().includes(lowerSearch) ||
                (schedule?.title || '').toLowerCase().includes(lowerSearch) ||
                (jha.usaNo || '').toLowerCase().includes(lowerSearch)
            );
        });
    }, [existingJHAs, search]);

    const paginatedJHAs = filteredJHAs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredJHAs.length / itemsPerPage);

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
            createdBy: '', // Should be current user, but we might not have session context here easily. Let's leave blank or try to infer?
            signatures: [],
            // Defaults
            active: true
        };

        setSelectedJHA(newJHA);
        setIsEditMode(true);
        setIsCreateModalOpen(false);
        setIsJHAModalOpen(true);
    };

    const handleEditOpen = (jha: any) => {
        setSelectedJHA({ ...jha });
        setIsEditMode(false);
        setIsJHAModalOpen(true);
    };

    const handleDelete = async (jha: any) => {
        if (!confirm('Are you sure you want to delete this JHA?')) return;

        try {
            // We update the schedule to remove the JHA object (set to null/empty)
            // Or maybe just empty object {} based on "hasJHA" logic
            const payload = {
                id: jha.schedule_id,
                jha: null // or {}
            };

            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateSchedule', payload })
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
                id: selectedJHA.schedule_id,
                jha: {
                    ...selectedJHA,
                    // Ensure we don't save scheduleRef to DB if it was attached for UI
                    scheduleRef: undefined,
                    schedule_id: undefined
                }
            };

            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateSchedule', payload })
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
        // Remove existing if any
        const filtered = currentSignatures.filter((s: any) => s.employee !== activeSignatureEmployee);
        filtered.push(newSignature);

        const updatedJHA = { ...selectedJHA, signatures: filtered };
        setSelectedJHA(updatedJHA); // Update local state immediately

        // Also save to DB immediately for signatures usually
        try {
             const payload = {
                id: selectedJHA.schedule_id,
                jha: {
                    ...updatedJHA,
                    scheduleRef: undefined,
                    schedule_id: undefined
                }
            };

            await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateSchedule', payload })
            });
            success('Signature saved');
            setActiveSignatureEmployee(null);
            
            // Refresh in background
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
                title="Job Hazard Analysis"
                rightContent={
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search JHAs..."
                                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-[#0F4C75] w-64 shadow-sm"
                            />
                        </div>
                        <Button onClick={handleCreateOpen} className="!bg-[#0F4C75] !rounded-full px-6">
                            <Plus className="w-4 h-4 mr-2" /> New JHA
                        </Button>
                    </div>
                }
            />

            <div className="flex-1 p-6 overflow-hidden flex flex-col min-h-0">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 text-[#0F4C75] animate-spin" />
                        </div>
                    ) : (
                        <Table 
                            containerClassName="flex-1 overflow-auto"
                            footer={<Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />}
                        >
                            <TableHead className="bg-slate-50 border-b border-slate-100 z-10 sticky top-0">
                                <TableRow>
                                    <TableHeader className="pl-6 py-4">Status & Info</TableHeader>
                                    <TableHeader>Estimate / Project</TableHeader>
                                    <TableHeader>USA No.</TableHeader>
                                    <TableHeader>Signatures</TableHeader>
                                    <TableHeader className="text-right pr-6">Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedJHAs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                                            No JHA records found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedJHAs.map((jha: any, idx) => (
                                        <TableRow 
                                            key={idx} 
                                            className="hover:bg-slate-50/50 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
                                            onClick={() => handleEditOpen(jha)}
                                        >
                                            <TableCell className="pl-6 py-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0F4C75] flex items-center justify-center shrink-0">
                                                        <FileText size={20} />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-sm font-bold text-slate-700">
                                                                {jha.date ? new Date(jha.date).toLocaleDateString() : 'N/A'}
                                                            </span>
                                                            <Badge variant="outline" className="text-[10px] text-slate-500 bg-white">
                                                                {jha.jhaTime || '--:--'}
                                                            </Badge>
                                                        </div>
                                                        <span className="text-xs text-slate-500 font-medium">Created by {
                                                            employees.find(e => e.value === jha.createdBy)?.label || jha.createdBy || 'Unknown'
                                                        }</span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-700">{jha.scheduleRef?.estimate || 'No Est'}</span>
                                                    <span className="text-xs text-slate-500 line-clamp-1">{jha.scheduleRef?.title || jha.scheduleRef?.projectName || '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-slate-600">{jha.usaNo || '-'}</span>
                                                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Sub: {jha.subcontractorUSANo || '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex -space-x-2">
                                                    {(jha.signatures || []).map((sig: any, i: number) => {
                                                        const emp = employees.find(e => e.value === sig.employee);
                                                        return (
                                                            <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden" title={emp?.label || sig.employee}>
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
                                                <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditOpen(jha)} className="h-8 w-8 text-slate-400 hover:text-blue-600">
                                                        <Edit size={16} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(jha)} className="h-8 w-8 text-slate-400 hover:text-red-600">
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>

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
