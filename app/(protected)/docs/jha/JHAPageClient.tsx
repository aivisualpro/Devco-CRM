'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Plus, Search, FileText, Edit, Trash2, Loader2, Check, User, AlertTriangle
} from 'lucide-react';
import { 
    Header, Pagination, Button,
    Modal, SearchableSelect
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { JHAModal } from '../../jobs/schedules/components/JHAModal';
import { EmailModal } from '../../jobs/schedules/components/EmailModal';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, ACTIONS } from '@/lib/permissions/types';
import { useRouter } from 'next/navigation';
import { JHACard } from './components/JHACard';
import { formatWallDate, formatWallTime, formatWallDateTime } from '@/lib/format/date';
import { useAllEmployees } from '@/lib/hooks/api';

interface Signature {
    employee: string;
    signature: string;
    createdAt: string;
}

interface JHA {
    _id?: string;
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

export default function JHAPageClient({ initialJhas = [], initialTotal = 0 }: { initialJhas?: any[]; initialTotal?: number }) {
    const { success, error } = useToast();
    const { can } = usePermissions();
    const router = useRouter();
    
    // Permissions
    const canCreate = can(MODULES.JHA, ACTIONS.CREATE);
    const canEdit = can(MODULES.JHA, ACTIONS.EDIT);
    const canDelete = can(MODULES.JHA, ACTIONS.DELETE);
    const canViewEstimates = can(MODULES.ESTIMATES, ACTIONS.VIEW);
    
    // Data State
    const [jhas, setJhas] = useState<JHA[]>(initialJhas as JHA[]);
    const [totalJHAs, setTotalJHAs] = useState(initialTotal);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const { employees: rawEmployees } = useAllEmployees();
    const employees = useMemo(() => rawEmployees.map((e: any) => ({
        value: e.email,
        label: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email,
        image: e.profilePicture || '',
        email: e.email,
        firstName: e.firstName,
        lastName: e.lastName,
    })), [rawEmployees]);
    const [estimates, setEstimates] = useState<any[]>([]); 
    const [clients, setClients] = useState<any[]>([]); 
    const [loading, setLoading] = useState(initialJhas.length === 0);

    // UI State
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    // View/Edit Modal State
    const [isJHAModalOpen, setIsJHAModalOpen] = useState(false);
    const [selectedJHA, setSelectedJHA] = useState<JHA | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [activeSignatureEmployee, setActiveSignatureEmployee] = useState<string | null>(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailTo, setEmailTo] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);

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

    // ── Phase 1: JHA records (fast — renders cards immediately) ──
    const fetchJHAs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/jha', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'getJHAs',
                    payload: { page: currentPage, limit: itemsPerPage, search }
                })
            });
            const data = await res.json();
            if (data?.success) {
                setJhas(data.result.jhas);
                setTotalJHAs(data.result.total);
            }
        } catch (err) {
            console.error('Error fetching JHAs:', err);
            error('Failed to load JHA records');
        }
        setLoading(false);
    };

    // ── Phase 2: Supporting data (lazy — only loads when create/edit modal needs it) ──
    const [supportLoaded, setSupportLoaded] = useState(false);
    const fetchSupportingData = async () => {
        if (supportLoaded) return;
        try {
            const [schedRes, estRes, clientRes] = await Promise.all([
                fetch(`/api/schedules?from=${new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString().split('T')[0]}&limit=500`).then(r => r.json()),
                fetch(`/api/estimates?limit=100`).then(r => r.json()),
                fetch(`/api/clients?limit=200`).then(r => r.json()),
            ]);

            if (schedRes?.success) setSchedules(schedRes.result?.schedules || schedRes.result || []);
            if (estRes?.success) setEstimates(estRes.result || []);
            if (clientRes?.success) setClients(clientRes.result || []);
            setSupportLoaded(true);
        } catch (err) {
            console.error('Error fetching supporting data:', err);
        }
    };

    useEffect(() => {
        // Skip initial fetch if we have server-provided data and it's page 1 with no search
        if (initialJhas.length > 0 && currentPage === 1 && !search) return;
        fetchJHAs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage]);

    // Search Debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (currentPage !== 1) {
                setCurrentPage(1); // Reset to page 1 on search
            } else {
                fetchJHAs();
            }
        }, 500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

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
                label: `${s.estimate || 'No Est'} - ${s.fromDate ? formatWallDate(s.fromDate) : 'No Date'}`,
                ...s
            }));
    }, [schedules]);

    const totalPages = Math.ceil(totalJHAs / itemsPerPage);
    const paginatedJHAs = jhas; // Server side pagination means 'jhas' IS the current page


    // Handlers
    const handleCreateOpen = () => {
        fetchSupportingData(); // Lazy-load schedules, estimates, clients only when needed
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
            jhaTime: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
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
        fetchSupportingData(); // Ensure schedules/estimates/clients are loaded
        setSelectedJHA({ ...jha });
        setIsEditMode(true);
        setIsJHAModalOpen(true);
    };

    const handleViewOpen = (jha: any) => {
        fetchSupportingData(); // Ensure data is available for PDF/email actions within the modal
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
                fetchJHAs();
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
                fetchJHAs();
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
            
            fetchJHAs();
        } catch (err) {
            error('Failed to save signature');
        }
    };

    const handleDownloadPDF = async (jhaOverride?: any, setCardDownloading?: (b: boolean) => void) => {
        const target = jhaOverride || selectedJHA;
        if (!target) return;
        
        if (setCardDownloading) setCardDownloading(true);
        else setIsGeneratingPDF(true);
        
        try {
            const templateId = '164zwSdl2631kZ4mRUVtzWhg5oewL0wy6RVCgPQig258';
            const schedule = schedules.find(s => s._id === target.schedule_id) || target.scheduleRef;
            
            const estimate = estimates.find((e: any) => {
                const estNum = e.value || e.estimate || e.estimateNum;
                return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
            });

            const client = clients.find((c: any) => c._id === schedule?.customerId || c.name === schedule?.customerName);

            const variables: Record<string, any> = {
                ...target,
                customerId: client?.name || schedule?.customerName || '',
                contactName: estimate?.contactName || estimate?.contact || '',
                contactPhone: estimate?.contactPhone || estimate?.phone || '',
                jobAddress: estimate?.jobAddress || schedule?.jobLocation || '',
                estimate: schedule?.estimate || '',
                estimateNum: schedule?.estimate || '',
                customerName: schedule?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                foremanName: schedule?.foremanName || '',
                projectName: estimate?.projectTitle || estimate?.projectName || '',
                date: target.date ? formatWallDate(target.date) : '',
                day: new Date(target.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
            };

            const booleanFields = [
                'operatingMiniEx', 'operatingAVacuumTruck', 'excavatingTrenching', 'acConcWork',
                'operatingBackhoe', 'workingInATrench', 'trafficControl', 'roadWork', 'operatingHdd',
                'confinedSpace', 'settingUgBoxes', 'otherDailyWork', 'sidewalks', 'heatAwareness',
                'ladderWork', 'overheadLifting', 'materialHandling', 'roadHazards', 'heavyLifting',
                'highNoise', 'pinchPoints', 'sharpObjects', 'trippingHazards', 'otherJobsiteHazards',
                'stagingAreaDiscussed', 'rescueProceduresDiscussed', 'evacuationRoutesDiscussed',
                'emergencyContactNumberWillBe911', 'firstAidAndCPREquipmentOnsite', 'closestHospitalDiscussed'
            ];
            booleanFields.forEach(f => {
                if (variables[f] === true || variables[f] === 'TRUE' || variables[f] === 'Yes' || variables[f] === '1') {
                    variables[f] = '✔️';
                } else {
                    variables[f] = '';
                }
            });

            for (let i = 1; i <= 15; i++) {
                variables[`sig_name_${i}`] = '';
                variables[`sig_img_${i}`] = '';
                variables[`Print Name_${i}`] = '';
                variables[`_ComputedName_${i}`] = '';
            }

            if (variables.signatures && variables.signatures.length > 0) {
                variables.hasSignatures = true;
                variables.signatures.forEach((sig: any, index: number) => {
                    const empName = employees.find(e => e.value === sig.employee)?.label || sig.employee;
                    const idx = index + 1;
                    variables[`sig_name_${idx}`] = empName;
                    variables[`sig_img_${idx}`] = sig.signature;
                    variables[`Print Name_${idx}`] = empName;
                    variables[`_ComputedName_${idx}`] = empName;
                    if (idx === 1) variables[`_ComputedName`] = empName;
                });
            } else {
                variables.hasSignatures = false;
            }

            const response = await fetch('/api/generate-google-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId, variables }) });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'JHA.pdf'; a.click();
                success('PDF Downloaded');
            } else {
                let errText = 'Failed to download PDF';
                try { const dt = await response.json(); if (dt.error) errText = dt.error; } catch(e){}
                error(errText);
            }
        } catch (e) { 
            console.error(e); 
            error('Failed to download PDF');
        } finally { 
            if (setCardDownloading) setCardDownloading(false);
            else setIsGeneratingPDF(false); 
        }
    };

    const handleEmailJHA = (jha: any) => {
        setSelectedJHA({ ...jha });
        setEmailTo(jha.clientEmail || '');
        setEmailModalOpen(true);
    };

    const handleConfirmEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedJHA || !emailTo) return;

        setIsSendingEmail(true);
        try {
            const templateId = '164zwSdl2631kZ4mRUVtzWhg5oewL0wy6RVCgPQig258';
            const schedule = schedules.find(s => s._id === selectedJHA.schedule_id) || selectedJHA.scheduleRef;
            
            const estimate = estimates.find((e: any) => {
                const estNum = e.value || e.estimate || e.estimateNum;
                return estNum && schedule?.estimate && String(estNum).trim() === String(schedule.estimate).trim();
            });

            const client = clients.find((c: any) => c._id === schedule?.customerId || c.name === schedule?.customerName);

            const variables: Record<string, any> = {
                ...selectedJHA,
                customerId: client?.name || schedule?.customerName || '',
                contactName: estimate?.contactName || estimate?.contact || '',
                contactPhone: estimate?.contactPhone || estimate?.phone || '',
                jobAddress: estimate?.jobAddress || schedule?.jobLocation || '',
                estimate: schedule?.estimate || '',
                estimateNum: schedule?.estimate || '',
                customerName: schedule?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                foremanName: schedule?.foremanName || '',
                projectName: estimate?.projectTitle || estimate?.projectName || '',
                date: selectedJHA.date ? formatWallDate(selectedJHA.date) : '',
                day: new Date(selectedJHA.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
            };

            const booleanFields = [
                'operatingMiniEx', 'operatingAVacuumTruck', 'excavatingTrenching', 'acConcWork',
                'operatingBackhoe', 'workingInATrench', 'trafficControl', 'roadWork', 'operatingHdd',
                'confinedSpace', 'settingUgBoxes', 'otherDailyWork', 'sidewalks', 'heatAwareness',
                'ladderWork', 'overheadLifting', 'materialHandling', 'roadHazards', 'heavyLifting',
                'highNoise', 'pinchPoints', 'sharpObjects', 'trippingHazards', 'otherJobsiteHazards',
                'stagingAreaDiscussed', 'rescueProceduresDiscussed', 'evacuationRoutesDiscussed',
                'emergencyContactNumberWillBe911', 'firstAidAndCPREquipmentOnsite', 'closestHospitalDiscussed'
            ];
            booleanFields.forEach(f => {
                if (variables[f] === true || variables[f] === 'TRUE' || variables[f] === 'Yes' || variables[f] === '1') {
                    variables[f] = '✔️';
                } else {
                    variables[f] = '';
                }
            });

            for (let i = 1; i <= 15; i++) {
                variables[`sig_name_${i}`] = '';
                variables[`sig_img_${i}`] = '';
                variables[`Print Name_${i}`] = '';
                variables[`_ComputedName_${i}`] = '';
            }

            if (variables.signatures && variables.signatures.length > 0) {
                variables.hasSignatures = true;
                variables.signatures.forEach((sig: any, index: number) => {
                    const empName = employees.find(e => e.value === sig.employee)?.label || sig.employee;
                    const idx = index + 1;
                    variables[`sig_name_${idx}`] = empName;
                    variables[`sig_img_${idx}`] = sig.signature;
                    variables[`Print Name_${idx}`] = empName;
                    variables[`_ComputedName_${idx}`] = empName;
                    if (idx === 1) variables[`_ComputedName`] = empName;
                });
            } else {
                variables.hasSignatures = false;
            }

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

                const emailRes = await fetch('/api/email-jha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        emailTo,
                        subject: 'JHA Document',
                        emailBody: 'Please find attached JHA document',
                        attachment: base64data,
                        jhaId: selectedJHA._id,
                        scheduleId: selectedJHA.schedule_id || selectedJHA.scheduleRef?._id
                    })
                });

                const emailData = await emailRes.json();
                if (emailData.success) {
                    success('PDF emailed successfully!');
                    setEmailModalOpen(false);
                    setEmailTo('');
                    
                    const updatedJha = { ...selectedJHA, emailCounter: (selectedJHA.emailCounter || 0) + 1 };
                    setSelectedJHA(updatedJha);
                    setJhas(prev => prev.map(j => j._id === updatedJha._id ? updatedJha : j));
                } else {
                    error(emailData.error || 'Failed to email PDF');
                }
                setIsSendingEmail(false);
            };
        } catch (e: any) {
            console.error('Email PDF Error:', e);
            error(e.message || 'Failed to email PDF');
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
                        {/* Card Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {paginatedJHAs.map((jha: any, idx: number) => {
                                const schedule = jha.scheduleRef;
                                const clientName = getClientName(schedule);
                                const dateStr = (jha.date || schedule?.fromDate) ? formatWallDate(jha.date || schedule?.fromDate) : 'N/A';
                                return (
                                    <JHACard
                                        key={`${jha._id || 'jha'}-${idx}`}
                                        jha={jha}
                                        schedule={schedule}
                                        clientName={clientName}
                                        employees={employees}
                                        canViewEstimates={canViewEstimates}
                                        canEdit={canEdit}
                                        canDelete={canDelete}
                                        onView={handleViewOpen}
                                        onEdit={handleEditOpen}
                                        onDelete={handleDelete}
                                        onDownloadPDF={handleDownloadPDF}
                                        onEmail={handleEmailJHA}
                                        router={router}
                                    />
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
                                JHA — {actionSheetItem.date ? formatWallDate(actionSheetItem.date) : 'N/A'}
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

            {/* Email Modal */}
            <EmailModal
                isOpen={emailModalOpen}
                onClose={() => !isSendingEmail && setEmailModalOpen(false)}
                emailTo={emailTo}
                setEmailTo={setEmailTo}
                handleEmailConfirm={handleConfirmEmail}
                isSending={isSendingEmail}
                title="Email JHA Document"
            />
        </div>
    );
}
