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
import { DJTModal } from '../../jobs/schedules/components/DJTModal';

interface Signature {
    employee: string;
    signature: string;
    createdAt: string;
}

interface DJT {
    schedule_id?: string;
    scheduleRef?: Schedule;
    date?: string; // Often inherent in schedule date, but DJT might have its own
    djtTime?: string;
    createdBy?: string;
    signatures?: Signature[];
    dailyJobDescription?: string;
    customerPrintName?: string;
    customerSignature?: string;
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
    djt?: DJT;
    assignees?: string[];
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

export default function JobTicketPage() {
    const { success, error } = useToast();
    
    // Data State
    const [djts, setDjts] = useState<DJT[]>([]); // Separated state for DJT list
    const [totalDJTs, setTotalDJTs] = useState(0);

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
    const [isDJTModalOpen, setIsDJTModalOpen] = useState(false);
    const [selectedDJT, setSelectedDJT] = useState<DJT | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [activeSignatureEmployee, setActiveSignatureEmployee] = useState<string | null>(null);
    const [isSavingSignature, setIsSavingSignature] = useState(false);

    // Create New DJT Flow State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedScheduleId, setSelectedScheduleId] = useState('');

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
            // 1. Fetch DJTs (Paginated)
            const djtRes = await fetch('/api/djt', {
                method: 'POST',
                body: JSON.stringify({ 
                    action: 'getDJTs',
                    payload: { 
                        page: currentPage, 
                        limit: itemsPerPage,
                        search 
                    }
                })
            });
            const djtData = await djtRes.json();
            
            if (djtData.success) {
                 setDjts(djtData.result.djts);
                 setTotalDJTs(djtData.result.total);
            }

            // 2. Fetch Schedules (For dropdown & Initial Data)
            // Load once if empty
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

    // Helper to get client name (Updated to use robust helper similar to JHA)
    const getClientName = (schedule: Schedule | undefined) => {
        if (!schedule) return '-';
        if (schedule.customerName) return schedule.customerName; 
        
        if (schedule.estimate) {
            const est = estimates.find(e => e.estimate === schedule.estimate);
            if (est?.customerName) return est.customerName;
            if (est?.customerId) {
                const client = clients.find(c => c._id === est.customerId);
                if (client) return client.name;
            }
        }
        
        if (schedule.customerId) {
             const client = clients.find(c => c._id === schedule.customerId);
             if (client) return client.name;
        }

        return '-';
    };

    // Available Schedules for New DJT
    const availableSchedules = useMemo(() => {
        return schedules
            .filter(s => !s.djt || Object.keys(s.djt).length === 0)
            .map(s => ({
                value: s._id,
                label: `${s.estimate || 'No Est'} - ${s.fromDate ? new Date(s.fromDate).toLocaleDateString() : 'No Date'}`,
                ...s
            }));
    }, [schedules]);

    const paginatedDJTs = djts; // Server paginated
    const totalPages = Math.ceil(totalDJTs / itemsPerPage);

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

        // Initialize new DJT
        const newDJT: DJT = {
            schedule_id: schedule._id,
            scheduleRef: schedule,
            date: new Date().toISOString(), 
            djtTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            signatures: [],
            dailyJobDescription: '',
            active: true
        };

        setSelectedDJT(newDJT);
        setIsEditMode(true);
        setIsCreateModalOpen(false);
        setIsDJTModalOpen(true);
    };

    const handleEditOpen = (djt: any) => {
        setSelectedDJT({ ...djt });
        setIsEditMode(true);
        setIsDJTModalOpen(true);
    };

    const handleViewOpen = (djt: any) => {
        setSelectedDJT({ ...djt });
        setIsEditMode(false);
        setIsDJTModalOpen(true);
    };

    const handleDelete = async (djt: any) => {
        if (!confirm('Are you sure you want to delete this Job Ticket?')) return;

        try {
            const res = await fetch('/api/djt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'deleteDJT', 
                    payload: { id: djt._id } 
                })
            });
            const data = await res.json();
            if (data.success) {
                success('Job Ticket deleted successfully');
                fetchData();
            } else {
                error('Failed to delete Job Ticket');
            }
        } catch (err) {
            console.error(err);
            error('An error occurred');
        }
    };

    const handleSaveDJT = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDJT) return;
        
        try {
            const payload = {
                id: selectedDJT.schedule_id,
                djt: {
                    ...selectedDJT,
                    // Ensure we don't save scheduleRef to DB if it was attached for UI
                    scheduleRef: undefined,
                    schedule_id: undefined
                }
            };

            // Optimistic Update
            const updatedDJT = { ...selectedDJT };
            setSchedules(prev => prev.map(s => 
                s._id === selectedDJT.schedule_id ? { ...s, djt: updatedDJT } : s
            ));
            setIsDJTModalOpen(false); // Close immediately for better UX
            success('Job Ticket saved'); // Show success immediately

            // Background Save
            fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateSchedule', payload })
            }).then(async (res) => {
                const data = await res.json();
                if (!data.success) {
                    error('Failed to save Job Ticket in background');
                    // Revert or refresh data if failed
                    fetchData();
                }
            }).catch(() => {
                error('Network error saving Job Ticket');
                fetchData();
            });

        } catch (err) {
            console.error(err);
            error('An error occurred');
        }
    };

    const handleSaveSignature = async (signatureData: { signature: string, lunchStart?: string, lunchEnd?: string }) => {
        if (!activeSignatureEmployee || !selectedDJT) return;
        
        setIsSavingSignature(true);
        try {
            // 1. Create new signature object
            const newSignature = {
                employee: activeSignatureEmployee,
                signature: signatureData.signature,
                createdAt: new Date().toISOString()
            };

            const currentSignatures = Array.isArray(selectedDJT.signatures) ? [...selectedDJT.signatures] : [];
            const filteredSignatures = currentSignatures.filter((s: any) => s.employee !== activeSignatureEmployee);
            filteredSignatures.push(newSignature);

            const updatedDJT = { ...selectedDJT, signatures: filteredSignatures };
            setSelectedDJT(updatedDJT);

            // Optimistic Update for Schedule List
            setSchedules(prev => prev.map(s => 
                s._id === selectedDJT.schedule_id ? { ...s, djt: updatedDJT } : s
            ));

            success('Signature saved'); // Feedback
            setActiveSignatureEmployee(null);

            // 2. Prepare Payload
            const payload = {
                id: selectedDJT.schedule_id,
                djt: {
                    ...updatedDJT,
                    scheduleRef: undefined,
                    schedule_id: undefined,
                    schedule: undefined // Just in case
                }
            };

            // Background Save
            await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateSchedule', payload })
            });
            
        } catch (err) {
            console.error(err);
            error('Failed to save signature');
            fetchData(); // Refresh on error
        } finally {
            setIsSavingSignature(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Header 
                rightContent={
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            <input 
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search Job Tickets..."
                                className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-[#0F4C75] w-64 shadow-sm"
                            />
                        </div>
                        <Button onClick={handleCreateOpen} size="icon" className="!bg-[#0F4C75] !rounded-full h-10 w-10 p-0 flex items-center justify-center">
                            <Plus className="w-5 h-5" />
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
                                    <TableHeader className="pl-6 py-4">Date</TableHeader>
                                    <TableHeader>Client</TableHeader>
                                    <TableHeader>Estimate</TableHeader>
                                    <TableHeader>Description</TableHeader>
                                    <TableHeader>Signatures</TableHeader>
                                    <TableHeader className="text-right pr-6">Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedDJTs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                                            No Job Ticket records found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedDJTs.map((djt: any, idx) => (
                                        <TableRow 
                                            key={idx} 
                                            className="hover:bg-slate-50/50 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
                                            onClick={() => handleViewOpen(djt)}
                                        >
                                            <TableCell className="pl-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0F4C75] flex items-center justify-center shrink-0">
                                                        <FileText size={16} />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-700">
                                                            {djt.date ? new Date(djt.date).toLocaleDateString() : 'N/A'}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400">
                                                            {djt.djtTime || '--:--'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm font-medium text-slate-600">
                                                    {getClientName(djt.scheduleRef)}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="default" className="bg-slate-100 text-slate-600 border-slate-200">
                                                    {djt.scheduleRef?.estimate || 'No Est'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-sm text-slate-600 font-medium line-clamp-1 max-w-[300px]" title={djt.dailyJobDescription}>
                                                    {djt.dailyJobDescription || 'No description provided'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex -space-x-2">
                                                    {(djt.signatures || []).map((sig: any, i: number) => {
                                                        const emp = employees.find(e => e.value === sig.employee);
                                                        return (
                                                            <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden" title={emp?.label || sig.employee}>
                                                                {emp?.image ? <img src={emp.image} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] font-bold text-slate-500">{emp?.label?.[0]}</span>}
                                                            </div>
                                                        );
                                                    })}
                                                    {(!djt.signatures || djt.signatures.length === 0) && (
                                                        <span className="text-xs text-slate-400 italic">None</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditOpen(djt)} className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                                                        <Edit size={16} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(djt)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
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
                title="Create New Job Ticket"
                maxWidth="md"
            >
                <div className="space-y-6">
                    <div>
                        <p className="text-sm text-slate-600 mb-4">
                            Select a schedule to create a Job Ticket for. 
                            Only schedules without an existing Job Ticket are listed.
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
                        <Button onClick={handleCreateProceed} disabled={!selectedScheduleId}>Proceed to Form</Button>
                    </div>
                </div>
            </Modal>

            {/* DJT Modal - Step 2 Edit/View */}
            {selectedDJT && (
                <DJTModal
                    isOpen={isDJTModalOpen}
                    onClose={() => setIsDJTModalOpen(false)}
                    selectedDJT={selectedDJT}
                    setSelectedDJT={setSelectedDJT}
                    isEditMode={!!isEditMode}
                    setIsEditMode={setIsEditMode}
                    handleSave={handleSaveDJT}
                    handleSaveSignature={handleSaveSignature}
                    initialData={{ employees: employees }}
                    schedules={schedules}
                    activeSignatureEmployee={activeSignatureEmployee}
                    setActiveSignatureEmployee={setActiveSignatureEmployee}
                    isSavingSignature={isSavingSignature}
                />
            )}
        </div>
    );
}
