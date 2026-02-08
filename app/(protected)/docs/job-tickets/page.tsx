'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Plus, Search, FileText, Edit, Trash2, Loader2, Check, Download
} from 'lucide-react';
import { 
    Header, Table, TableHead, TableBody, TableRow, 
    TableHeader, TableCell, Pagination, Badge, Button,
    Modal, SearchableSelect, Tooltip, TooltipContent, TooltipTrigger
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { DJTModal } from '../../jobs/schedules/components/DJTModal';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';

interface Signature {
    employee: string;
    signature: string;
    createdAt: string;
}

interface DJT {
    _id?: string;
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
    const { can } = usePermissions();

    // Permissions
    const canCreate = can(MODULES.JOB_TICKETS, ACTIONS.CREATE);
    const canEdit = can(MODULES.JOB_TICKETS, ACTIONS.EDIT);
    const canDelete = can(MODULES.JOB_TICKETS, ACTIONS.DELETE);
    
    // Data State
    const [djts, setDjts] = useState<DJT[]>([]); // Separated state for DJT list
    const [totalDJTs, setTotalDJTs] = useState(0);

    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [estimates, setEstimates] = useState<any[]>([]); 
    const [clients, setClients] = useState<any[]>([]); 
    const [equipmentItems, setEquipmentItems] = useState<any[]>([]); 
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
    const [isGeneratingDJTPDF, setIsGeneratingDJTPDF] = useState(false);

    // Create New DJT Flow State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedScheduleId, setSelectedScheduleId] = useState('');

    // Mobile action sheet
    const [actionSheetItem, setActionSheetItem] = useState<DJT | null>(null);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);

    const handleLongPressStart = (djt: DJT) => {
        longPressTimer.current = setTimeout(() => {
            setActionSheetItem(djt);
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
                    setEquipmentItems(data.result.initialData.equipmentItems || []);
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
                label: `${s.estimate || 'No Est'} - ${s.fromDate ? new Date(s.fromDate).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'No Date'}`,
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
            // Optimistic Update
            const updatedDJT = { ...selectedDJT };
            
            // Update DJT list
            setDjts(prev => {
                const exists = prev.find(d => d.schedule_id === selectedDJT.schedule_id || (selectedDJT._id && d._id === selectedDJT._id));
                if (exists) {
                    return prev.map(d => 
                        (d.schedule_id === selectedDJT.schedule_id || (selectedDJT._id && d._id === selectedDJT._id)) ? { ...d, ...updatedDJT } : d
                    );
                } else {
                    return [updatedDJT, ...prev];
                }
            });

            // Update schedules list (for dropdowns etc)
            setSchedules(prev => prev.map(s => 
                s._id === selectedDJT.schedule_id ? { ...s, djt: updatedDJT } : s
            ));
            
            setIsDJTModalOpen(false); // Close immediately for better UX
            success('Job Ticket saved'); // Show success immediately

            // Background Save
            fetch('/api/djt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'saveDJT', 
                    payload: {
                        ...selectedDJT,
                        schedule_id: selectedDJT.schedule_id || selectedDJT._id,
                        createdBy: selectedDJT.createdBy || 'system',
                        scheduleRef: undefined
                    }
                })
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

            // Optimistic Update for DJT List
            setDjts(prev => prev.map(d => 
                (d.schedule_id === selectedDJT.schedule_id || d._id === selectedDJT._id) ? { ...d, signatures: filteredSignatures } : d
            ));

            // Optimistic Update for Schedule List
            setSchedules(prev => prev.map(s => 
                s._id === selectedDJT.schedule_id ? { ...s, djt: updatedDJT } : s
            ));

            success('Signature saved'); // Feedback
            setActiveSignatureEmployee(null);

            // 2. Background Save
            await fetch('/api/djt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'saveDJT', 
                    payload: {
                        ...updatedDJT,
                        schedule_id: updatedDJT.schedule_id || updatedDJT._id,
                        createdBy: updatedDJT.createdBy || 'system',
                        scheduleRef: undefined
                    }
                })
            });
            
        } catch (err) {
            console.error(err);
            error('Failed to save signature');
            fetchData(); // Refresh on error
        } finally {
            setIsSavingSignature(false);
        }
    };

    const handleDownloadDjtPdf = async () => {
        if (!selectedDJT) return;
        setIsGeneratingDJTPDF(true);
        try {
            const templateId = '1cN4CpzsvuKLYXtmSANeyqTTlL3HPc7XEyFsjfNwzo-8';
            
            // Build variables from selectedDJT and its parent schedule
            // In this view, scheduleRef is attached directly to djt
            const schedule = selectedDJT.scheduleRef || schedules.find(s => s._id === (selectedDJT.schedule_id || selectedDJT._id));
            
            // Find matching estimate for contact info - match by estimate number (value field)
            const estimate = estimates.find((e: any) => {
                const estNum = e.value || e.estimate || e.estimateNum;
                return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
            });
            
            // Find matching client for customer name
            const client = clients.find(c => c._id === schedule?.customerId || c.name === schedule?.customerName);
            
            // Combine fields
            const variables: Record<string, any> = {
                dailyJobDescription: selectedDJT.dailyJobDescription || '',
                customerPrintName: selectedDJT.customerPrintName || '',
                
                // Customer name from clients collection or schedule
                customerId: client?.name || schedule?.customerName || '',
                // Contact info from estimate
                contactName: estimate?.contactName || estimate?.contact || '',
                contactPhone: estimate?.contactPhone || estimate?.phone || '',
                jobAddress: estimate?.jobAddress || estimate?.address || schedule?.jobLocation || '',
                // Other schedule info
                customerName: schedule?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                estimate: schedule?.estimate || '',
                estimateNum: schedule?.estimate || '',
                projectName: estimate?.projectTitle || estimate?.projectName || '',
                foremanName: schedule?.foremanName || '',
                date: new Date(selectedDJT.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { timeZone: 'UTC' }),
                day: new Date(selectedDJT.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
            };

            // Customer Signature
            if (selectedDJT.customerSignature) {
                variables['customerSignature'] = selectedDJT.customerSignature;
            }

            // Prepare multiple signatures (Clear slots up to 15)
            for (let i = 1; i <= 15; i++) {
                variables[`sig_name_${i}`] = '';
                variables[`sig_img_${i}`] = '';
                variables[`Print Name_${i}`] = '';
                variables[`Times_${i}`] = '';
            }

            if (selectedDJT.signatures && selectedDJT.signatures.length > 0) {
                variables.hasSignatures = true;
                selectedDJT.signatures.forEach((sig: any, index: number) => {
                    const empName = employees.find(e => e.value === sig.employee)?.label || sig.employee;
                    const idx = index + 1;
                    variables[`sig_name_${idx}`] = empName;
                    variables[`sig_img_${idx}`] = sig.signature;
                    variables[`Print Name_${idx}`] = empName;
                    
                     const timesheet = schedule?.timesheet?.find((t: any) => t.employee === sig.employee);
                     if (timesheet) {
                         const inTime = new Date(timesheet.clockIn).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', timeZone: 'UTC'});
                         const outTime = new Date(timesheet.clockOut).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit', timeZone: 'UTC'});
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
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate DJT PDF');
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
        } catch (err: any) {
            console.error('DJT PDF Error:', err);
            error(err.message || 'Failed to download DJT PDF');
        } finally {
            setIsGeneratingDJTPDF(false);
        }
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
                                placeholder="Search Job Tickets..."
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
                            {paginatedDJTs.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
                                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-500 font-medium text-sm">No Job Ticket records found.</p>
                                </div>
                            ) : (
                                paginatedDJTs.map((djt: any, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-white rounded-2xl border border-slate-100 p-4 active:scale-[0.98] transition-transform shadow-sm"
                                        onClick={() => handleViewOpen(djt)}
                                        onTouchStart={() => handleLongPressStart(djt)}
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
                                                        {(djt.date || djt.scheduleRef?.fromDate) ? new Date(djt.date || djt.scheduleRef?.fromDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                                    </div>
                                                    <div className="text-xs text-slate-400">{djt.djtTime || '--:--'}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {djt.customerSignature && (
                                                    <div className="w-5 h-5 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                                                        <Check size={12} />
                                                    </div>
                                                )}
                                                <Badge variant="default" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">
                                                    {djt.scheduleRef?.estimate || 'No Est'}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="text-xs text-slate-600 font-medium mb-1 truncate">
                                            {getClientName(djt.scheduleRef)}
                                        </div>
                                        {djt.dailyJobDescription && (
                                            <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">{djt.dailyJobDescription}</p>
                                        )}

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                                {(djt.equipmentUsed || []).length > 0 && (
                                                    <span>{(djt.equipmentUsed || []).length} equipment</span>
                                                )}
                                            </div>
                                            <div className="flex -space-x-1.5">
                                                {(djt.signatures || []).slice(0, 4).map((sig: any, i: number) => {
                                                    const emp = employees.find(e => e.value === sig.employee);
                                                    return (
                                                        <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-green-50 flex items-center justify-center overflow-hidden">
                                                            {emp?.image ? <img src={emp.image} alt="" className="w-full h-full object-cover" /> : <span className="text-[8px] font-bold text-green-700">{emp?.label?.[0]}</span>}
                                                        </div>
                                                    );
                                                })}
                                                {(djt.signatures || []).length > 4 && (
                                                    <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600">
                                                        +{(djt.signatures || []).length - 4}
                                                    </div>
                                                )}
                                                {(!djt.signatures || djt.signatures.length === 0) && (
                                                    <span className="text-[10px] text-slate-400 italic">No signatures</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
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
                                            <TableHeader>Description</TableHeader>
                                            <TableHeader>Equipment</TableHeader>
                                            <TableHeader>Signatures</TableHeader>
                                            <TableHeader className="text-center">Client Signed</TableHeader>
                                            <TableHeader className="text-right pr-6">Actions</TableHeader>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {paginatedDJTs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-12 text-slate-400">
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
                                                                    {(djt.date || djt.scheduleRef?.fromDate) ? new Date(djt.date || djt.scheduleRef?.fromDate).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'N/A'}
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
                                                        <div className="flex flex-col gap-1">
                                                            {(djt.equipmentUsed || []).map((eq: any, i: number) => {
                                                                const eqItem = equipmentItems.find(e => String(e._id) === String(eq.equipment) || String(e.id) === String(eq.equipment));
                                                                const name = eqItem ? eqItem.equipmentMachine : eq.equipment;
                                                                return (
                                                                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-fit mb-1">
                                                                        <span className="font-semibold text-slate-900 truncate max-w-[150px]" title={name}>{name}</span>
                                                                        <span className="text-slate-300">/</span>
                                                                        <span className={cn("uppercase text-[9px] font-bold", eq.type?.toLowerCase() === 'owned' ? "text-blue-600" : "text-amber-600")}>
                                                                            {eq.type || 'Owned'}
                                                                        </span>
                                                                        <span className="text-slate-300">/</span>
                                                                        <span className="text-slate-500 font-medium">Qty: {eq.qty || 1}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                            {(!djt.equipmentUsed || djt.equipmentUsed.length === 0) && <span className="text-slate-300 text-xs">-</span>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center -space-x-2">
                                                            {(djt.scheduleRef?.assignees || []).map((assigneeId: string, i: number) => {
                                                                const hasSigned = (djt.signatures || []).some((s: any) => s.employee === assigneeId);
                                                                const emp = employees.find(e => e.value === assigneeId || e.email === assigneeId);
                                                                if (!hasSigned) return null;
                                                                return (
                                                                     <Tooltip key={i}>
                                                                        <TooltipTrigger>
                                                                            <div className="w-7 h-7 rounded-full border-2 border-white bg-green-50 flex items-center justify-center overflow-hidden shrink-0 relative">
                                                                                {emp?.image ? (
                                                                                    <img src={emp.image} alt="" className="w-full h-full object-cover" /> 
                                                                                ) : (
                                                                                    <span className="text-[9px] font-bold text-green-700">{(emp?.firstName?.[0] || assigneeId?.[0] || '?').toUpperCase()}</span>
                                                                                )}
                                                                                <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-full" />
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p className="font-medium">{emp?.firstName} {emp?.lastName}</p>
                                                                            <p className="text-xs text-slate-400">Signed</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                );
                                                            })}
                                                            {(djt.signatures || []).filter((s:any) => !(djt.scheduleRef?.assignees || []).includes(s.employee)).map((sig: any, i: number) => {
                                                                 const emp = employees.find(e => e.value === sig.employee);
                                                                 return (
                                                                     <Tooltip key={`extra-${i}`}>
                                                                        <TooltipTrigger>
                                                                            <div className="w-7 h-7 rounded-full border-2 border-white bg-green-50 flex items-center justify-center overflow-hidden shrink-0">
                                                                                {emp?.image ? <img src={emp.image} alt="" className="w-full h-full object-cover" /> : <span className="text-[9px] font-bold text-green-700">{(emp?.firstName?.[0] || sig.employee?.[0] || '?').toUpperCase()}</span>}
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>{emp?.label || sig.employee}</p>
                                                                        </TooltipContent>
                                                                     </Tooltip>
                                                                 )
                                                            })}
                                                            {(!djt.signatures || djt.signatures.length === 0) && (
                                                                <span className="text-xs text-slate-400 italic">None</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {djt.customerSignature ? (
                                                            <div className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full">
                                                                <Check size={14} />
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                                            {canEdit && (
                                                                <Button variant="ghost" size="icon" onClick={() => handleEditOpen(djt)} className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50">
                                                                    <Edit size={16} />
                                                                </Button>
                                                            )}
                                                            {canDelete && (
                                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(djt)} className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50">
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
                                Job Ticket — {(actionSheetItem.date || actionSheetItem.scheduleRef?.fromDate) ? new Date(actionSheetItem.date || actionSheetItem.scheduleRef?.fromDate || new Date()).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'N/A'}
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
                    initialData={{ employees, estimates, clients, equipmentItems }}
                    schedules={schedules}
                    activeSignatureEmployee={activeSignatureEmployee}
                    setActiveSignatureEmployee={setActiveSignatureEmployee}
                    isSavingSignature={isSavingSignature}
                    isGeneratingPDF={isGeneratingDJTPDF}
                    handleDownloadPDF={handleDownloadDjtPdf}
                />
            )}
        </div>
    );
}
