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
import { DJTModal } from '../../jobs/schedules/components/DJTModal';
import { EmailModal } from '../../jobs/schedules/components/EmailModal';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrentUser } from '@/lib/context/AppContext';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import { useRouter } from 'next/navigation';
import { DJTCard } from './components/DJTCard';
import { formatWallDate, formatWallTime, formatWallDateTime } from '@/lib/format/date';

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
    const currentUser = useCurrentUser();

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
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const router = useRouter();

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

    // ── Phase 1: DJT records (fast — renders cards immediately) ──
    const fetchDJTs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/djt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'getDJTs',
                    payload: { page: currentPage, limit: itemsPerPage, search }
                })
            });
            const data = await res.json();
            if (data?.success) {
                setDjts(data.result.djts);
                setTotalDJTs(data.result.total);
            }
        } catch (err) {
            console.error('Error fetching DJTs:', err);
            error('Failed to load Job Tickets');
        }
        setLoading(false);
    };

    // ── Phase 2: Supporting data (lazy — loads in background, never blocks UI) ──
    const [supportLoaded, setSupportLoaded] = useState(false);
    const fetchSupportingData = async () => {
        if (supportLoaded) return;
        try {
            const [empRes, schedRes, estRes, clientRes, eqRes] = await Promise.all([
                fetch(`/api/employees`).then(r => r.json()),
                fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'getSchedulesPage',
                        payload: {
                            startDate: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString(),
                            skipInitialData: true,
                            limit: 500,
                        }
                    })
                }).then(r => r.json()),
                fetch(`/api/estimates`).then(r => r.json()),
                fetch(`/api/clients`).then(r => r.json()),
                fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getEquipmentItems' })
                }).then(r => r.json()).catch(() => ({ success: false })),
            ]);

            if (empRes?.success) {
                const emps = (empRes.result || []).map((e: any) => ({
                    value: e.email,
                    label: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email,
                    image: e.profilePicture || '',
                    email: e.email,
                    firstName: e.firstName,
                    lastName: e.lastName,
                }));
                setEmployees(emps);
            }
            if (schedRes?.success) setSchedules(schedRes.result.schedules || []);
            if (estRes?.success) setEstimates(estRes.result || []);
            if (clientRes?.success) setClients(clientRes.result || []);
            if (eqRes?.success) setEquipmentItems(eqRes.result || []);
            setSupportLoaded(true);
        } catch (err) {
            console.error('Error fetching supporting data:', err);
        }
    };

    useEffect(() => {
        fetchDJTs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage]);

    // Lazy-load supporting data once on mount (non-blocking)
    useEffect(() => {
        fetchSupportingData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Search Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (currentPage !== 1) {
                setCurrentPage(1);
            } else {
                fetchDJTs();
            }
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

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
                label: `${s.estimate || 'No Est'} - ${s.fromDate ? formatWallDate(s.fromDate) : 'No Date'}`,
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
        const userEmail = currentUser?.email || null;
        const scheduleDate = schedule.fromDate ? new Date(schedule.fromDate) : new Date();
        const newDJT: DJT = {
            schedule_id: schedule._id,
            scheduleRef: schedule,
            date: scheduleDate.toISOString(), 
            djtTime: scheduleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
            createdBy: userEmail || 'system',
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
                fetchDJTs();
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
                        createdBy: selectedDJT.createdBy || currentUser?.email || 'system',
                        scheduleRef: undefined
                    }
                })
            }).then(async (res) => {
                const data = await res.json();
                if (!data.success) {
                    error('Failed to save Job Ticket in background');
                    // Revert or refresh data if failed
                    fetchDJTs();
                }
            }).catch(() => {
                error('Network error saving Job Ticket');
                fetchDJTs();
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
                        createdBy: updatedDJT.createdBy || currentUser?.email || 'system',
                        scheduleRef: undefined
                    }
                })
            });
            
        } catch (err) {
            console.error(err);
            error('Failed to save signature');
            fetchDJTs(); // Refresh on error
        } finally {
            setIsSavingSignature(false);
        }
    };

    const getDJTPdfVariables = (targetDJT: any) => {
        const schedule = targetDJT.scheduleRef || schedules.find(s => s._id === (targetDJT.schedule_id || targetDJT._id));
        const estimate = estimates.find((e: any) => {
            const estNum = e.value || e.estimate || e.estimateNum;
            return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
        });
        const client = clients.find((c: any) => c._id === schedule?.customerId || c.name === schedule?.customerName);

        const variables: Record<string, any> = {
            dailyJobDescription: targetDJT.dailyJobDescription || '',
            customerPrintName: targetDJT.customerPrintName || '',
            customerId: client?.name || schedule?.customerName || '',
            contactName: estimate?.contactName || estimate?.contact || '',
            contactPhone: estimate?.contactPhone || estimate?.phone || '',
            jobAddress: estimate?.jobAddress || estimate?.address || schedule?.jobLocation || '',
            customerName: schedule?.customerName || '',
            jobLocation: schedule?.jobLocation || '',
            estimate: schedule?.estimate || '',
            estimateNum: schedule?.estimate || '',
            projectName: estimate?.projectTitle || estimate?.projectName || '',
            foremanName: schedule?.foremanName || '',
            date: targetDJT.date ? formatWallDate(targetDJT.date) : '',
            day: new Date(targetDJT.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
        };

        if (targetDJT.customerSignature) variables['customerSignature'] = targetDJT.customerSignature;

        for (let i = 1; i <= 15; i++) {
            variables[`sig_name_${i}`] = '';
            variables[`sig_img_${i}`] = '';
            variables[`Print Name_${i}`] = '';
            variables[`Times_${i}`] = '';
        }

        if (targetDJT.signatures && targetDJT.signatures.length > 0) {
            variables.hasSignatures = true;
            targetDJT.signatures.forEach((sig: any, index: number) => {
                const empName = employees.find(e => e.value === sig.employee)?.label || sig.employee;
                const idx = index + 1;
                variables[`sig_name_${idx}`] = empName;
                variables[`sig_img_${idx}`] = sig.signature;
                variables[`Print Name_${idx}`] = empName;
                
                const timesheet = schedule?.timesheet?.find((t: any) => t.employee === sig.employee);
                if (timesheet) {
                    const inTime = formatWallTime(timesheet.clockIn);
                    const outTime = formatWallTime(timesheet.clockOut);
                    variables[`Times_${idx}`] = `${inTime} - ${outTime}`;
                }
            });
        } else {
            variables.hasSignatures = false;
        }

        return variables;
    };

    const handleDownloadDjtPdf = async (djtOverride?: any) => {
        const targetDJT = djtOverride || selectedDJT;
        if (!targetDJT) return;
        setIsGeneratingDJTPDF(true);
        try {
            const templateId = '1cN4CpzsvuKLYXtmSANeyqTTlL3HPc7XEyFsjfNwzo-8';
            const variables = getDJTPdfVariables(targetDJT);
            const schedule = targetDJT.scheduleRef || schedules.find((s: any) => s._id === (targetDJT.schedule_id || targetDJT._id));

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

    const handleEmailOpen = (djt: any) => {
        setSelectedDJT(djt);
        setEmailTo(djt.clientEmail || '');
        setEmailModalOpen(true);
    };

    const handleConfirmEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDJT || !emailTo) return;

        setIsSendingEmail(true);
        try {
            const templateId = '1cN4CpzsvuKLYXtmSANeyqTTlL3HPc7XEyFsjfNwzo-8';
            const variables = getDJTPdfVariables(selectedDJT);

            const pdfRes = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!pdfRes.ok) throw new Error('Failed to generate PDF');
            const blob = await pdfRes.blob();

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64data = reader.result as string;
                const emailRes = await fetch('/api/email-jha', { // Wait, do I have a dedicated DJT email endpoint or email-jha logic? The api/email-jha route likely supports generalized PDFs for DJT as well! Let's just use email-jha or similar!
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: emailTo,
                        pdfBase64: base64data,
                        docName: 'DJT',
                        projectName: variables.projectName || variables.customerName || 'Project'
                    })
                });

                const data = await emailRes.json();
                if (data.success) {
                    success('Email sent successfully!');
                    setEmailModalOpen(false);
                } else error(data.error || 'Failed to send email');
                setIsSendingEmail(false);
            };
        } catch (err) {
            console.error('Email error:', err);
            error('Failed to send email');
            setIsSendingEmail(false);
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
                ) : paginatedDJTs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mb-4 shadow-sm">
                            <FileText className="w-7 h-7 text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-semibold text-sm mb-1">No Job Tickets Found</p>
                        <p className="text-slate-400 text-xs">Create your first job ticket to get started.</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Bar */}
                        <div className="flex items-center gap-3 mb-5 flex-wrap">
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-sm">
                                <div className="w-2 h-2 rounded-full bg-[#0F4C75]" />
                                <span className="text-xs font-bold text-slate-700">{totalDJTs}</span>
                                <span className="text-xs text-slate-400">Total</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-sm">
                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-xs font-bold text-slate-700">{paginatedDJTs.filter((d: any) => d.customerSignature).length}</span>
                                <span className="text-xs text-slate-400">Signed</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-sm">
                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                <span className="text-xs font-bold text-slate-700">{paginatedDJTs.filter((d: any) => !d.customerSignature).length}</span>
                                <span className="text-xs text-slate-400">Pending</span>
                            </div>
                        </div>

                        {/* Card Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
                            {paginatedDJTs.map((djt: any, idx: number) => (
                                <DJTCard
                                    key={djt._id || idx}
                                    djt={djt}
                                    schedule={djt.scheduleRef}
                                    clientName={getClientName(djt.scheduleRef)}
                                    employees={employees}
                                    equipmentItems={equipmentItems}
                                    canViewEstimates={can(MODULES.ESTIMATES, ACTIONS.VIEW)}
                                    canEdit={canEdit}
                                    canDelete={canDelete}
                                    onView={handleViewOpen}
                                    onEdit={handleEditOpen}
                                    onDelete={handleDelete}
                                    onDownloadPDF={handleDownloadDjtPdf}
                                    onEmail={handleEmailOpen}
                                    router={router}
                                />
                            ))}
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

            {/* Email Modal */}
            <EmailModal
                isOpen={emailModalOpen}
                onClose={() => !isSendingEmail && setEmailModalOpen(false)}
                emailTo={emailTo}
                setEmailTo={setEmailTo}
                handleEmailConfirm={handleConfirmEmail}
                isSending={isSendingEmail}
                title="Email DJT Document"
            />
        </div>
    );
}
