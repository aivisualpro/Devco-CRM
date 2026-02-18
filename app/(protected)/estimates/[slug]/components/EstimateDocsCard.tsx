'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FileText, Shield, ChevronRight, Loader2, Download, Upload, Layout, FileCheck, Receipt, Plus, Trash2, Calendar, DollarSign, Paperclip, X, Image as ImageIcon, Check, Pencil, User, ChevronDown, MessageSquare, Send, Reply, Forward, AlertTriangle, Clipboard, MapPin, HardHat, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal, Input, Button, ConfirmModal, MyDropDown, Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, FileDropZone } from '@/components/ui';
import type { UploadedFile } from '@/components/ui';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULES, DATA_SCOPE } from '@/lib/permissions/types';
import { JHAModal } from '@/app/(protected)/jobs/schedules/components/JHAModal';
import { DJTModal } from '@/app/(protected)/jobs/schedules/components/DJTModal';
import { getLocalNowISO } from '@/lib/scheduleUtils';

// Google Doc Template IDs
const DOC_TEMPLATES: Record<string, string> = {
    '20 Day Prelim': '1tkVNaR45XBFatu7WSn7LUpmsLS8G5aqy9IO5xtlQcAA',
    'CP - Conditional Release (Progress)': '1HER_h4JAsp-WOB6VGOK8eq9UAr9mib58RcTWt1gwC70',
    'COI - Certificate of Insurance': '',
    'CF - Conditional Release (Final)': '1NXMwX1PAmYFjdzSBwXbPq3jRgFjgUE00zFfpZWrSi5Y',
    'UP - Unconditional Release (Progress)': '1UDSOXcvBirMqQGN1v6Q1lJOBFfO6p2V0r-KRF8OGs-A',
    'UF - Unconditional Release (Final)': '',
    'Mechanics Lien': '',
    'Intent to Lien': '1WGKasNMJNAjO62xVBdipNg9wOeSyNA-zRAeZeGI3WM8',
    'Fringe Benefit Statement': '',
    'DAS 140': '',
    'Certified Payroll Report': '',
    'PW Docs & PLA Agreement': '',
    'DAS 142': '',
    'Fringe Benefits Report': '',
    'Union Status Letter': '',
    'Billing Ticket': '10I-srE4jryX1mGOEeTRsRPxyWTmmyIl_p51olERbctQ',
    // Add more templates here as needed
};

const safeFormatDate = (dateStr: string | undefined | null, formatStr: string = 'MM/dd/yy') => {
    if (!dateStr || String(dateStr).trim() === '') return '-';
    try {
        let finalStr = String(dateStr);
        if (finalStr.includes('-') && !finalStr.includes('T')) {
            finalStr = `${finalStr}T00:00:00`;
        }
        const d = new Date(finalStr);
        if (isNaN(d.getTime())) {
            const d2 = new Date(String(dateStr));
            if (isNaN(d2.getTime())) return String(dateStr);
            return format(d2, formatStr);
        }
        return format(d, formatStr);
    } catch (e) {
        return String(dateStr) || '-';
    }
};

interface Employee {
    _id: string;
    firstName?: string;
    lastName?: string;
    companyPosition?: string;
    signature?: string;
    [key: string]: any;
}

interface EstimateDocsCardProps {
    className?: string;
    formData?: Record<string, any>;
    employees?: Employee[];
    onUpdate?: (field: string, value: any) => void;
    planningOptions?: { id: string; label: string; value: string; color?: string }[];
    activeClient?: any;
}

export const EstimateDocsCard: React.FC<EstimateDocsCardProps> = ({ className, formData, employees = [], onUpdate, planningOptions = [], activeClient }) => {
    const { user: currentUser, getDataScope } = usePermissions();
    const [generatingDoc, setGeneratingDoc] = useState<string | null>(null);
    const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
    const [generatingProgress, setGeneratingProgress] = useState(0);
    const [isSignedContractModalOpen, setIsSignedContractModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [newContract, setNewContract] = useState<{ date: string; amount: string; attachments: any[] }>({
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: '',
        attachments: []
    });
    const [selectedViewContract, setSelectedViewContract] = useState<any>(null);
    const [contractIndexToDelete, setContractIndexToDelete] = useState<number | null>(null);

    // Aggregated Receipts & Billing Tickets State
    const [aggregatedReceipts, setAggregatedReceipts] = useState<any[]>([]);
    const [aggregatedBillingTickets, setAggregatedBillingTickets] = useState<any[]>([]); // New State
    const [loadingReceipts, setLoadingReceipts] = useState(false);

    // Job Docs State: JHA, Job Tickets, Pothole Logs, Pre-Bore Logs
    const [jhaRecords, setJhaRecords] = useState<any[]>([]);
    const [jobTicketRecords, setJobTicketRecords] = useState<any[]>([]);
    const [potholeLogRecords, setPotholeLogRecords] = useState<any[]>([]);
    const [preBoreLogRecords, setPreBoreLogRecords] = useState<any[]>([]);
    const [loadingJobDocs, setLoadingJobDocs] = useState(false);
    const [estimateSchedules, setEstimateSchedules] = useState<any[]>([]);
    const [equipmentItems, setEquipmentItems] = useState<any[]>([]);

    // JHA Modal State
    const [jhaModalOpen, setJhaModalOpen] = useState(false);
    const [selectedJHA, setSelectedJHA] = useState<any>(null);
    const [isJhaEditMode, setIsJhaEditMode] = useState(false);
    const [isGeneratingJHAPDF, setIsGeneratingJHAPDF] = useState(false);
    const [activeSignatureEmployee, setActiveSignatureEmployee] = useState<string | null>(null);
    const [emailModalOpen, setEmailModalOpen] = useState(false);

    // DJT Modal State
    const [djtModalOpen, setDjtModalOpen] = useState(false);
    const [selectedDJT, setSelectedDJT] = useState<any>(null);
    const [isDjtEditMode, setIsDjtEditMode] = useState(false);
    const [isGeneratingDJTPDF, setIsGeneratingDJTPDF] = useState(false);
    const [isSavingSignature, setIsSavingSignature] = useState(false);

    // Pothole Log Modal State
    const [potholeModalOpen, setPotholeModalOpen] = useState(false);
    const [selectedPotholeLog, setSelectedPotholeLog] = useState<any>(null);
    const [potholeCreateOpen, setPotholeCreateOpen] = useState(false);
    const [newPotholeLog, setNewPotholeLog] = useState<any>({
        date: format(new Date(), 'yyyy-MM-dd'),
        estimate: '',
        projectionLocation: '',
        potholeItems: [],
        createdBy: ''
    });

    // Pre-Bore Log Modal State
    const [preBoreModalOpen, setPreBoreModalOpen] = useState(false);
    const [selectedPreBoreLog, setSelectedPreBoreLog] = useState<any>(null);
    const [preBoreCreateOpen, setPreBoreCreateOpen] = useState(false);
    const [newPreBoreLog, setNewPreBoreLog] = useState<any>({
        date: format(new Date(), 'yyyy-MM-dd'),
        customerForeman: '',
        customerWorkRequestNumber: '',
        startTime: '',
        addressBoreStart: '',
        addressBoreEnd: '',
        devcoOperator: '',
        drillSize: '',
        pilotBoreSize: '',
        soilType: '',
        boreLength: '',
        pipeSize: '',
        preBoreLogs: [],
        createdBy: ''
    });
    const [selectedScheduleForPreBore, setSelectedScheduleForPreBore] = useState<string>('');

    useEffect(() => {
        const fetchAllVersions = async () => {
            if (!formData?.estimate) return;
            setLoadingReceipts(true);
            try {
                // Fetch all estimates to aggregate receipts and billing tickets across versions
                const res = await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        action: 'getEstimates',
                        payload: { limit: 1000, includeBilling: true, includeReceipts: true }
                    })
                });
                const data = await res.json();
                
                if (data.success && Array.isArray(data.result)) {
                    // Filter for all versions of this estimate number
                    const relevantEstimates = data.result.filter((e: any) => String(e.estimate || '').trim() === String(formData.estimate || '').trim());
                    console.log('[EstimateDocsCard] Aggregating from estimates:', relevantEstimates.length, 'for', formData.estimate);
                    
                    // --- Aggregating Receipts ---
                    let allR: any[] = [];
                    const addedIds = new Set<string>();
                    const addedKeys = new Set<string>();

                    // Helper to add receipts uniquely
                    const addUnique = (list: any[]) => {
                        list.forEach(r => {
                            if (!r) return;
                            // Prefer _id for uniqueness
                            if (r._id) {
                                if (!addedIds.has(r._id)) {
                                    addedIds.add(r._id);
                                    allR.push(r);
                                }
                            } else {
                                // Fallback to content hash for legacy/new items without ID
                                const key = `${r.vendor}|${r.amount}|${r.date}|${r.remarks}`;
                                if (!addedKeys.has(key)) {
                                    addedKeys.add(key);
                                    allR.push(r);
                                }
                            }
                        });
                    };

                    // 1. Add from current formData first (most recent/draft)
                    if (formData.receiptsAndCosts) {
                        addUnique(formData.receiptsAndCosts);
                    }

                    // 2. Add from fetched versions
                    relevantEstimates.forEach((est: any) => {
                        if (est.receiptsAndCosts && Array.isArray(est.receiptsAndCosts)) {
                            addUnique(est.receiptsAndCosts);
                        }
                    });

                    // Filter by data scope
                    const rScope = getDataScope(MODULES.RECEIPTS_COSTS);
                    if (rScope === DATA_SCOPE.SELF && !currentUser?.role?.includes('Admin')) {
                        const userEmail = currentUser?.email?.toLowerCase();
                        const userId = currentUser?.userId;
                        allR = allR.filter(r => {
                            const isCreator = String(r.createdBy || '').toLowerCase() === userEmail;
                            const isTagged = (r.tag || []).some((t: string) => {
                                const tl = String(t || '').toLowerCase();
                                return tl === userEmail || t === userId;
                            });
                            return isCreator || isTagged;
                        });
                    }

                    // Sort by Date Descending
                    allR.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
                    setAggregatedReceipts(allR);

                    // --- Aggregating Billing Tickets ---
                    let allB: any[] = [];
                    const addedBillingIds = new Set<string>();
                    const addedBillingKeys = new Set<string>();

                    const addUniqueBilling = (list: any[]) => {
                        list.forEach(item => {
                            if (!item) return;
                            if (item._id) {
                                if (!addedBillingIds.has(item._id)) {
                                    addedBillingIds.add(item._id);
                                    allB.push(item);
                                }
                            } else {
                                const key = `${item.date}|${item.lumpSum}|${item.billingTerms}`;
                                if (!addedBillingKeys.has(key)) {
                                    addedBillingKeys.add(key);
                                    allB.push(item);
                                }
                            }
                        });
                    };

                    if (formData.billingTickets) {
                        addUniqueBilling(formData.billingTickets);
                    }

                    relevantEstimates.forEach((est: any) => {
                        if (est.billingTickets && Array.isArray(est.billingTickets)) {
                            addUniqueBilling(est.billingTickets);
                        }
                    });

                    // Filter by data scope
                    const bScope = getDataScope(MODULES.BILLING_TICKETS);
                    if (bScope === DATA_SCOPE.SELF && !currentUser?.role?.includes('Admin')) {
                        const userEmail = currentUser?.email?.toLowerCase();
                        const userId = currentUser?.userId;
                        allB = allB.filter(b => {
                            // Billing tickets usually use createdBy
                            const isCreator = String(b.createdBy || '').toLowerCase() === userEmail;
                            // Check if user is in any tags if billing tickets support tagging (similar to receipts)
                            const isTagged = (b.tag || []).some((t: string) => {
                                const tl = String(t || '').toLowerCase();
                                return tl === userEmail || t === userId;
                            });
                            return isCreator || isTagged;
                        });
                    }

                    allB.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
                    console.log('[EstimateDocsCard] Aggregated Billing Tickets:', allB);
                    setAggregatedBillingTickets(allB);
                }
            } catch (err) {
                console.error("Failed to fetch aggregated data", err);
            } finally {
                setLoadingReceipts(false);
            }
        };

        fetchAllVersions();
    }, [formData?.estimate, formData?.receiptsAndCosts, formData?.billingTickets]); // Re-run if main formData changes

    // Fetch Job Docs: JHA, DJT, Pothole Logs, Pre-Bore Logs
    useEffect(() => {
        const fetchJobDocs = async () => {
            if (!formData?.estimate) return;
            setLoadingJobDocs(true);
            try {
                // 1. First get schedules for this estimate number
                const schedRes = await fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getSchedules', payload: {} })
                });
                const schedData = await schedRes.json();
                const allSchedules = schedData.success ? (schedData.result || []) : [];
                const filteredSchedules = allSchedules.filter(
                    (s: any) => String(s.estimate || '').trim() === String(formData.estimate || '').trim()
                );
                setEstimateSchedules(filteredSchedules);
                const scheduleIds = filteredSchedules.map((s: any) => String(s._id));

                // Fetch equipment items for DJT modal
                const initRes = await fetch('/api/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getInitialData', payload: {} })
                });
                const initData = await initRes.json();
                if (initData.success && initData.result?.equipmentItems) {
                    setEquipmentItems(initData.result.equipmentItems);
                }

                // 2. Fetch JHA records for these schedules
                const jhaRes = await fetch('/api/jha', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getJHAs', payload: { page: 1, limit: 500 } })
                });
                const jhaData = await jhaRes.json();
                if (jhaData.success && jhaData.result?.jhas) {
                    const filtered = jhaData.result.jhas.filter(
                        (j: any) => scheduleIds.includes(String(j.schedule_id || ''))
                    );
                    setJhaRecords(filtered);
                }

                // 3. Fetch DJT (Job Tickets) for this estimate (API looks up schedules internally)
                const djtRes = await fetch('/api/djt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getDJTs', payload: { page: 1, limit: 500, estimate: formData.estimate } })
                });
                const djtData = await djtRes.json();
                if (djtData.success && djtData.result?.djts) {
                    // Deduplicate by schedule_id (keep first/latest per schedule)
                    const uniqueDjts = Array.from(new Map(djtData.result.djts.map((d: any) => [String(d.schedule_id), d])).values());
                    setJobTicketRecords(uniqueDjts);
                }

                // 4. Fetch Pothole Logs (directly by estimate)
                const phRes = await fetch('/api/pothole-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'getPotholeLogs', payload: { estimate: formData.estimate } })
                });
                const phData = await phRes.json();
                if (phData.success) {
                    setPotholeLogRecords(phData.result || []);
                }

                // 5. Fetch Pre-Bore Logs (embedded in schedules)
                const pbLogs: any[] = [];
                for (const sched of filteredSchedules) {
                    if (sched.preBore && Array.isArray(sched.preBore) && sched.preBore.length > 0) {
                        sched.preBore.forEach((pb: any) => {
                            pbLogs.push({
                                ...pb,
                                scheduleId: sched._id,
                                scheduleTitle: sched.title,
                            });
                        });
                    }
                }
                setPreBoreLogRecords(pbLogs);

            } catch (err) {
                console.error('Failed to fetch job docs', err);
            } finally {
                setLoadingJobDocs(false);
            }
        };

        fetchJobDocs();
    }, [formData?.estimate]);

    // Refetch helper
    const refetchJobDocs = useCallback(async () => {
        if (!formData?.estimate) return;
        setLoadingJobDocs(true);
        try {
            const schedRes = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getSchedules', payload: {} })
            });
            const schedData = await schedRes.json();
            const allSchedules = schedData.success ? (schedData.result || []) : [];
            const filteredSchedules = allSchedules.filter(
                (s: any) => String(s.estimate || '').trim() === String(formData.estimate || '').trim()
            );
            setEstimateSchedules(filteredSchedules);
            const scheduleIds = filteredSchedules.map((s: any) => String(s._id));

            const jhaRes = await fetch('/api/jha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getJHAs', payload: { page: 1, limit: 500 } }) });
            const jhaData = await jhaRes.json();
            if (jhaData.success && jhaData.result?.jhas) setJhaRecords(jhaData.result.jhas.filter((j: any) => scheduleIds.includes(String(j.schedule_id || ''))));

            const djtRes = await fetch('/api/djt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getDJTs', payload: { page: 1, limit: 500, estimate: formData.estimate } }) });
            const djtData = await djtRes.json();
            if (djtData.success && djtData.result?.djts) {
                setJobTicketRecords(Array.from(new Map(djtData.result.djts.map((d: any) => [String(d.schedule_id), d])).values()));
            }

            const phRes = await fetch('/api/pothole-logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getPotholeLogs', payload: { estimate: formData.estimate } }) });
            const phData = await phRes.json();
            if (phData.success) setPotholeLogRecords(phData.result || []);

            const pbLogs: any[] = [];
            for (const sched of filteredSchedules) {
                if (sched.preBore && Array.isArray(sched.preBore) && sched.preBore.length > 0) {
                    sched.preBore.forEach((pb: any) => pbLogs.push({ ...pb, scheduleId: sched._id, scheduleTitle: sched.title }));
                }
            }
            setPreBoreLogRecords(pbLogs);
        } catch (err) { console.error(err); } finally { setLoadingJobDocs(false); }
    }, [formData?.estimate]);

    // Normalized employees for modals
    const normalizedEmployees = useMemo(() => {
        return (employees || []).map((e: any) => ({
            ...e,
            label: e.label || `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || 'Unknown',
            value: e.value || e.email || e._id,
            image: e.profilePicture || e.image
        }));
    }, [employees]);

    // --- JHA Handlers ---
    const handleViewJHA = (jha: any) => {
        setSelectedJHA({ ...jha, signatures: jha.signatures || [] });
        setIsJhaEditMode(false);
        setJhaModalOpen(true);
    };

    const handleSaveJHA = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedJHA) return;
        try {
            const payload = { ...selectedJHA, schedule_id: selectedJHA.schedule_id || selectedJHA._id };
            const res = await fetch('/api/jha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveJHA', payload }) });
            const data = await res.json();
            if (data.success) {
                toast.success('JHA Saved');
                setJhaModalOpen(false);
                refetchJobDocs();
            } else toast.error(data.error || 'Failed to save JHA');
        } catch (e) { console.error(e); toast.error('Error saving JHA'); }
    };

    const handleSaveJHASignature = async (dataUrl: string) => {
        if (!activeSignatureEmployee || !selectedJHA) return;
        try {
            const payload = { schedule_id: selectedJHA.schedule_id, employee: activeSignatureEmployee, signature: dataUrl, createdBy: currentUser?.email };
            const res = await fetch('/api/jha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveJHASignature', payload }) });
            const data = await res.json();
            if (data.success) {
                toast.success('Signature Saved');
                setSelectedJHA((prev: any) => ({ ...prev, signatures: [...(prev.signatures || []), data.result] }));
                setActiveSignatureEmployee(null);
            } else toast.error(data.error);
        } catch (e) { console.error(e); }
    };

    const handleDownloadJHAPDF = async () => {
        if (!selectedJHA) return;
        setIsGeneratingJHAPDF(true);
        try {
            const templateId = '164zwSdl2631kZ4mRUVtzWhg5oewL0wy6RVCgPQig258';
            const schedule = estimateSchedules.find(s => s._id === selectedJHA.schedule_id);
            const variables: any = { ...selectedJHA, customerName: schedule?.customerName, date: selectedJHA.date || new Date().toLocaleDateString() };
            const response = await fetch('/api/generate-google-pdf', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ templateId, variables }) });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'JHA.pdf'; a.click();
                toast.success('PDF Downloaded');
            }
        } catch (e) { console.error(e); } finally { setIsGeneratingJHAPDF(false); }
    };

    // --- DJT Handlers ---
    const handleViewDJT = (djt: any) => {
        setSelectedDJT({ ...djt, schedule_id: djt.schedule_id, signatures: djt.signatures || [] });
        setIsDjtEditMode(false);
        setDjtModalOpen(true);
    };

    const handleSaveDJT = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDJT) return;
        try {
            const payload = { ...selectedDJT, schedule_id: selectedDJT.schedule_id || selectedDJT._id };
            const res = await fetch('/api/djt', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ action: 'saveDJT', payload }) });
            const data = await res.json();
            if (data.success) {
                toast.success('DJT Saved');
                setDjtModalOpen(false);
                refetchJobDocs();
            } else toast.error(data.error || 'Failed to save DJT');
        } catch (e) { console.error(e); toast.error('Error saving DJT'); }
    };

    const handleSaveDJTSignature = async (data: any) => {
        if (!activeSignatureEmployee || !selectedDJT) return;
        setIsSavingSignature(true);
        try {
            const payload = { schedule_id: selectedDJT.schedule_id, employee: activeSignatureEmployee, signature: typeof data === 'string' ? data : data.signature, createdBy: currentUser?.email, clientNow: getLocalNowISO() };
            const res = await fetch('/api/djt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'saveDJTSignature', payload }) });
            const json = await res.json();
            if (json.success) {
                setSelectedDJT((prev: any) => ({ ...prev, signatures: [...(prev.signatures || []), json.result] }));
                setActiveSignatureEmployee(null);
                toast.success('Signature Saved');
            }
        } catch (e) { console.error(e); } finally { setIsSavingSignature(false); }
    };

    const handleDownloadDJTPDF = async () => {
        if (!selectedDJT) return;
        setIsGeneratingDJTPDF(true);
        try {
            const templateId = '1cN4CpzsvuKLYXtmSANeyqTTlL3HPc7XEyFsjfNwzo-8';
            const schedule = estimateSchedules.find(s => s._id === (selectedDJT.schedule_id || selectedDJT._id));
            const variables: Record<string, any> = {
                dailyJobDescription: selectedDJT.dailyJobDescription || '',
                customerPrintName: selectedDJT.customerPrintName || '',
                customerName: formData?.customerName || schedule?.customerName || '',
                jobLocation: schedule?.jobLocation || '',
                estimate: schedule?.estimate || '',
                foremanName: schedule?.foremanName || '',
                date: new Date(selectedDJT.date || schedule?.fromDate || new Date()).toLocaleDateString(),
                day: new Date(selectedDJT.date || schedule?.fromDate || new Date()).toLocaleDateString('en-US', { weekday: 'long' }),
            };
            if (selectedDJT.customerSignature) variables['customerSignature'] = selectedDJT.customerSignature;
            for (let i = 1; i <= 15; i++) { variables[`sig_name_${i}`] = ''; variables[`sig_img_${i}`] = ''; variables[`Print Name_${i}`] = ''; variables[`Times_${i}`] = ''; }
            if (selectedDJT.signatures?.length > 0) {
                selectedDJT.signatures.forEach((sig: any, index: number) => {
                    const empName = normalizedEmployees.find(e => e.value === sig.employee)?.label || sig.employee;
                    const idx = index + 1;
                    variables[`sig_name_${idx}`] = empName;
                    variables[`sig_img_${idx}`] = sig.signature;
                    variables[`Print Name_${idx}`] = empName;
                });
            }
            const response = await fetch('/api/generate-google-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId, variables }) });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `DJT_${schedule?.customerName || 'Report'}.pdf`; a.click();
                toast.success('DJT PDF downloaded');
            }
        } catch (e) { console.error(e); toast.error('Failed to download PDF'); } finally { setIsGeneratingDJTPDF(false); }
    };

    // --- Pothole Log Handlers ---
    const handleViewPotholeLog = (log: any) => {
        setSelectedPotholeLog(log);
        setPotholeModalOpen(true);
    };

    const handleCreatePotholeLog = async () => {
        if (!formData?.estimate) return;
        try {
            const item = {
                ...newPotholeLog,
                estimate: formData.estimate,
                createdBy: currentUser?.email || ''
            };
            const res = await fetch('/api/pothole-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'createPotholeLog', payload: { item } })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Pothole Log created');
                setPotholeCreateOpen(false);
                setNewPotholeLog({ date: format(new Date(), 'yyyy-MM-dd'), estimate: '', projectionLocation: '', potholeItems: [], createdBy: '' });
                refetchJobDocs();
            } else toast.error(data.error || 'Failed to create');
        } catch (e) { console.error(e); toast.error('Error creating pothole log'); }
    };

    // --- Pre-Bore Log Handlers ---
    const handleViewPreBoreLog = (pb: any) => {
        setSelectedPreBoreLog(pb);
        setPreBoreModalOpen(true);
    };

    const handleCreatePreBoreLog = async () => {
        if (!selectedScheduleForPreBore) { toast.error('Please select a schedule'); return; }
        try {
            const item = {
                ...newPreBoreLog,
                createdBy: currentUser?.email || '',
                legacyId: `PB-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
            };
            const res = await fetch('/api/pre-bore-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'createPreBoreLog', payload: { scheduleId: selectedScheduleForPreBore, item } })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Pre-Bore Log created');
                setPreBoreCreateOpen(false);
                setNewPreBoreLog({ date: format(new Date(), 'yyyy-MM-dd'), customerForeman: '', customerWorkRequestNumber: '', startTime: '', addressBoreStart: '', addressBoreEnd: '', devcoOperator: '', drillSize: '', pilotBoreSize: '', soilType: '', boreLength: '', pipeSize: '', preBoreLogs: [], createdBy: '' });
                setSelectedScheduleForPreBore('');
                refetchJobDocs();
            } else toast.error(data.error || 'Failed to create');
        } catch (e) { console.error(e); toast.error('Error creating pre-bore log'); }
    };

    const prelimDocs = [
        '20 Day Prelim',
        'COI - Certificate of Insurance',
        'Legal Docs',
        'Mechanics Lien',
        'Intent to Lien'
    ];

    const baseCertifiedPayrollDocs = [
        'Fringe Benefit Statement',
        'DAS 140',
        'Certified Payroll Report',
        'PW Docs & PLA Agreement',
        'DAS 142',
        'Fringe Benefits Report',
        'Union Status Letter',
        'Proof of DAS 140 & 142 Sent',
        'Checklist of Labor Law Requirements',
        'Certificate of Compliance',
        'DIR Registration',
        'List of Subcontractors',
        'Subcontractor CPR',
        'Authorized Signatory',
        'Skilled & Trained Reporting',
        'Fringe Benefits Proof of Payment'
    ];
    const customCertifiedPayrollDocs: string[] = formData?.customCertifiedPayrollDocs || [];
    const certifiedPayrollDocs = [...customCertifiedPayrollDocs, ...baseCertifiedPayrollDocs];
    const [isAddingPayrollDoc, setIsAddingPayrollDoc] = useState(false);
    const [newPayrollDocName, setNewPayrollDocName] = useState('');

    const jobPlanningDocs = formData?.jobPlanningDocs || [];
    const signedContracts = formData?.signedContracts || [];
    const receiptsAndCosts = aggregatedReceipts.length > 0 ? aggregatedReceipts : (formData?.receiptsAndCosts || []);

    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [isReceiptDetailsModalOpen, setIsReceiptDetailsModalOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
    const [isReceiptUploading, setIsReceiptUploading] = useState(false);
    const [receiptToDelete, setReceiptToDelete] = useState<number | null>(null);
    const [editingReceiptIndex, setEditingReceiptIndex] = useState<number | null>(null);

    const [newReceipt, setNewReceipt] = useState({
        type: 'Receipt' as 'Invoice' | 'Receipt',
        vendor: '',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        dueDate: '',
        remarks: '',
        tag: [] as string[],
        approvalStatus: 'Not Approved' as 'Approved' | 'Not Approved',
        status: '' as 'Devco Paid' | '',
        paidBy: '',
        paymentDate: '',
        upload: [] as any[],
        createdBy: ''
    });

    const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false);
    const [isPlanningDetailsModalOpen, setIsPlanningDetailsModalOpen] = useState(false);
    const [selectedPlanningItem, setSelectedPlanningItem] = useState<any>(null);
    const [isPlanningUploading, setIsPlanningUploading] = useState(false);
    const [planningItemToDelete, setPlanningItemToDelete] = useState<number | null>(null);
    const [editingPlanningIndex, setEditingPlanningIndex] = useState<number | null>(null);
    const [isPlanningTypeDropdownOpen, setIsPlanningTypeDropdownOpen] = useState(false);

    const [newPlanningItem, setNewPlanningItem] = useState({
        planningType: '',
        usaTicketNo: '',
        dateSubmitted: format(new Date(), 'yyyy-MM-dd'),
        activationDate: '',
        expirationDate: '',
        documentName: '',
        documents: [] as any[]
    });

    // Releases State
    const [releasesConstants, setReleasesConstants] = useState<any[]>([]);
    const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
    const [isReleaseTypeOpen, setIsReleaseTypeOpen] = useState(false);
    const [editingReleaseIndex, setEditingReleaseIndex] = useState<number | null>(null);
    const [releaseToDelete, setReleaseToDelete] = useState<number | null>(null);
    const [newRelease, setNewRelease] = useState({
        documentType: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        amountOfCheck: '',
        DatesOfWaiverRelease: [] as string[],
        amountsOfUnpaidProgressPayment: [] as string[],
        receivedProgressPayments: [] as string[],
        disputedClaims: '',
        documentId: '' // For linking later
    });

    const releases = formData?.releases || []; // Extract from formData

    // Certified Payroll Upload State
    const certifiedPayrollUploads: Record<string, any[]> = formData?.certifiedPayrollUploads || {};
    const payrollUploadRef = React.useRef<HTMLInputElement>(null);
    const [payrollUploadingDoc, setPayrollUploadingDoc] = useState<string | null>(null);

    const handlePayrollDocUpload = async (docName: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !onUpdate) return;

        setPayrollUploadingDoc(docName);
        const existing = [...(certifiedPayrollUploads[docName] || [])];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('folder', `estimates/${formData?.estimate || 'general'}/certified-payroll/${docName.replace(/[^a-zA-Z0-9]/g, '_')}`);

                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                const data = await res.json();

                if (data.success && data.url) {
                    existing.push({
                        name: file.name,
                        url: data.url,
                        thumbnailUrl: data.thumbnailUrl || '',
                        type: file.type,
                        uploadedAt: new Date().toISOString(),
                        uploadedBy: currentUser?.email || '',
                        uploaderImage: (currentUser as any)?.image || ''
                    });
                } else {
                    toast.error(`Failed to upload ${file.name}`);
                }
            } catch (err) {
                console.error('Payroll Upload Error:', err);
                toast.error(`Error uploading ${file.name}`);
            }
        }

        const updated = { ...certifiedPayrollUploads, [docName]: existing };
        onUpdate('certifiedPayrollUploads', updated);
        setPayrollUploadingDoc(null);
        // Reset file input
        if (payrollUploadRef.current) payrollUploadRef.current.value = '';
    };

    const removePayrollUpload = (docName: string, uploadIndex: number) => {
        if (!onUpdate) return;
        const existing = [...(certifiedPayrollUploads[docName] || [])];
        existing.splice(uploadIndex, 1);
        const updated = { ...certifiedPayrollUploads, [docName]: existing };
        onUpdate('certifiedPayrollUploads', updated);
    };

    // COI (Certificate of Insurance) Upload State
    const coiInputRef = React.useRef<HTMLInputElement>(null);
    const [isCoiUploading, setIsCoiUploading] = useState(false);
    const coiDocument = formData?.coiDocument as { url: string; name: string; uploadedAt: string } | undefined;

    const handleCoiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onUpdate) return;

        setIsCoiUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('folder', `estimates/${formData?.estimate || 'general'}/coi`);

            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            const data = await res.json();

            if (data.success && data.url) {
                onUpdate('coiDocument', {
                    url: data.url,
                    thumbnailUrl: data.thumbnailUrl || '',
                    name: file.name,
                    uploadedAt: new Date().toISOString()
                });
                toast.success('COI uploaded successfully');
            } else {
                toast.error('Failed to upload COI');
            }
        } catch (err) {
            console.error('COI Upload Error:', err);
            toast.error('Error uploading COI');
        } finally {
            setIsCoiUploading(false);
            if (coiInputRef.current) coiInputRef.current.value = '';
        }
    };

    // Legal Docs Upload State (Multiple Files)
    const legalDocsInputRef = React.useRef<HTMLInputElement>(null);
    const [isLegalDocsUploading, setIsLegalDocsUploading] = useState(false);
    const legalDocs = (formData?.legalDocs || []) as { url: string; name: string; type: string; uploadedAt: string }[];

    const handleLegalDocsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !onUpdate) return;

        setIsLegalDocsUploading(true);
        const uploaded: { url: string; thumbnailUrl?: string; name: string; type: string; uploadedAt: string }[] = [...legalDocs];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const fd = new FormData();
                fd.append('file', file);
                fd.append('folder', `estimates/${formData?.estimate || 'general'}/legal`);

                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                const data = await res.json();

                if (data.success && data.url) {
                    uploaded.push({
                        url: data.url,
                        thumbnailUrl: data.thumbnailUrl || '',
                        name: file.name,
                        type: file.type,
                        uploadedAt: new Date().toISOString()
                    });
                }
            }

            onUpdate('legalDocs', uploaded);
            toast.success(`${files.length} file(s) uploaded successfully`);
        } catch (err) {
            console.error('Legal Docs Upload Error:', err);
            toast.error('Error uploading legal documents');
        } finally {
            setIsLegalDocsUploading(false);
            if (legalDocsInputRef.current) legalDocsInputRef.current.value = '';
        }
    };

    const removeLegalDoc = (index: number) => {
        if (!onUpdate) return;
        const updated = legalDocs.filter((_, i) => i !== index);
        onUpdate('legalDocs', updated);
        toast.success('Document removed');
    };

    // Intent to Lien State (Array of Objects like Releases)
    const [isIntentToLienModalOpen, setIsIntentToLienModalOpen] = useState(false);
    const [editingIntentToLienIndex, setEditingIntentToLienIndex] = useState<number | null>(null);
    const [intentToLienToDelete, setIntentToLienToDelete] = useState<number | null>(null);
    const [newIntentToLien, setNewIntentToLien] = useState({
        arBalance: '',
        fromDate: format(new Date(), 'yyyy-MM-dd'),
        toDate: format(new Date(), 'yyyy-MM-dd'),
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        // Parent fields (editable, will update parent estimate)
        poName: '',
        PoAddress: '',
        liName: '',
        liAddress: '',
        scName: '',
        scAddress: '',
        bondNumber: '',
        projectId: ''
    });

    const intentToLienItems = (formData?.intentToLien || []) as any[];

    const handleAddIntentToLien = () => {
        setNewIntentToLien({
            arBalance: '',
            fromDate: format(new Date(), 'yyyy-MM-dd'),
            toDate: format(new Date(), 'yyyy-MM-dd'),
            dueDate: format(new Date(), 'yyyy-MM-dd'),
            // Pre-fill from parent estimate
            poName: formData?.poName || '',
            PoAddress: formData?.PoAddress || '',
            liName: formData?.liName || '',
            liAddress: formData?.liAddress || '',
            scName: formData?.scName || '',
            scAddress: formData?.scAddress || '',
            bondNumber: formData?.bondNumber || '',
            projectId: formData?.projectId || ''
        });
        setEditingIntentToLienIndex(null);
        setIsIntentToLienModalOpen(true);
    };

    const handleEditIntentToLien = (index: number) => {
        const item = intentToLienItems[index];
        setNewIntentToLien({
            arBalance: item.arBalance || '',
            fromDate: item.fromDate || format(new Date(), 'yyyy-MM-dd'),
            toDate: item.toDate || format(new Date(), 'yyyy-MM-dd'),
            dueDate: item.dueDate || format(new Date(), 'yyyy-MM-dd'),
            // Pull from parent if not stored in item
            poName: formData?.poName || '',
            PoAddress: formData?.PoAddress || '',
            liName: formData?.liName || '',
            liAddress: formData?.liAddress || '',
            scName: formData?.scName || '',
            scAddress: formData?.scAddress || '',
            bondNumber: formData?.bondNumber || '',
            projectId: formData?.projectId || ''
        });
        setEditingIntentToLienIndex(index);
        setIsIntentToLienModalOpen(true);
    };

    const handleSaveIntentToLien = () => {
        if (!onUpdate) return;

        // Update parent estimate fields
        onUpdate('poName', newIntentToLien.poName);
        onUpdate('PoAddress', newIntentToLien.PoAddress);
        onUpdate('liName', newIntentToLien.liName);
        onUpdate('liAddress', newIntentToLien.liAddress);
        onUpdate('scName', newIntentToLien.scName);
        onUpdate('scAddress', newIntentToLien.scAddress);
        onUpdate('bondNumber', newIntentToLien.bondNumber);
        onUpdate('projectId', newIntentToLien.projectId);

        // Create intent to lien item (only the specific fields)
        const intentItem = {
            _id: editingIntentToLienIndex !== null 
                ? intentToLienItems[editingIntentToLienIndex]._id 
                : `itl_${Date.now()}`,
            arBalance: newIntentToLien.arBalance,
            fromDate: newIntentToLien.fromDate,
            toDate: newIntentToLien.toDate,
            dueDate: newIntentToLien.dueDate,
            createdAt: editingIntentToLienIndex !== null 
                ? intentToLienItems[editingIntentToLienIndex].createdAt 
                : new Date().toISOString()
        };

        let updatedItems;
        if (editingIntentToLienIndex !== null) {
            updatedItems = [...intentToLienItems];
            updatedItems[editingIntentToLienIndex] = intentItem;
        } else {
            updatedItems = [...intentToLienItems, intentItem];
        }

        onUpdate('intentToLien', updatedItems);
        setIsIntentToLienModalOpen(false);
        setEditingIntentToLienIndex(null);
        toast.success(editingIntentToLienIndex !== null ? 'Intent to Lien updated' : 'Intent to Lien added');
    };

    const confirmRemoveIntentToLien = () => {
        if (intentToLienToDelete === null || !onUpdate) return;
        const updated = intentToLienItems.filter((_: any, i: number) => i !== intentToLienToDelete);
        onUpdate('intentToLien', updated);
        setIntentToLienToDelete(null);
        toast.success('Intent to Lien removed');
    };

    // Fetch Release Constants
    React.useEffect(() => {
        const fetchRel = async () => {
            try {
                const res = await fetch('/api/constants?type=Releases');
                const data = await res.json();
                if (data.success) {
                    const constants = data.result.map((item: any) => ({
                        ...item,
                        value: item.value || item.description || ''
                    }));
                    setReleasesConstants(constants);
                }
            } catch (e) { console.error('Failed to fetch release constants', e); }
        };
        fetchRel();
    }, []);

    const handleAddRelease = () => {
        setNewRelease({
            documentType: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            amountOfCheck: '',
            DatesOfWaiverRelease: [],
            amountsOfUnpaidProgressPayment: [],
            receivedProgressPayments: [],
            disputedClaims: '',
            documentId: ''
        });
        setEditingReleaseIndex(null);
        setIsReleaseModalOpen(true);
    };

    const handleEditRelease = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const item = releases[index];
        setNewRelease({
            documentType: item.documentType || '',
            date: item.date || '',
            amountOfCheck: item.amountOfCheck || '',
            DatesOfWaiverRelease: item.DatesOfWaiverRelease || [],
            amountsOfUnpaidProgressPayment: item.amountsOfUnpaidProgressPayment || [],
            receivedProgressPayments: item.receivedProgressPayments || [],
            disputedClaims: item.disputedClaims || '',
            documentId: item.documentId || ''
        });
        setEditingReleaseIndex(index);
        setIsReleaseModalOpen(true);
    };

    const handleSaveRelease = () => {
        if (!onUpdate) return;
        if (!newRelease.documentType) {
            toast.error('Document Type is required');
            return;
        }

        let updated;
        if (editingReleaseIndex !== null) {
            updated = releases.map((item: any, idx: number) => 
                idx === editingReleaseIndex ? { ...item, ...newRelease } : item
            );
        } else {
            updated = [...releases, { 
                ...newRelease, 
                _id: Math.random().toString(36).substr(2, 9),
                createdBy: currentUser?.userId,
                createdAt: new Date().toISOString()
            }];
        }
        
        onUpdate('releases', updated);
        setIsReleaseModalOpen(false);
        setEditingReleaseIndex(null);
        toast.success(editingReleaseIndex !== null ? 'Release updated' : 'Release added');
    };

    const confirmRemoveRelease = () => {
        if (!onUpdate || releaseToDelete === null) return;
        const updated = releases.filter((_: any, i: number) => i !== releaseToDelete);
        onUpdate('releases', updated);
        setReleaseToDelete(null);
        toast.success('Release removed');
    };

    const getReleaseCode = (type: string) => {
        if (!type) return '';
        if (type.includes('CP -') || type.includes('CP (')) return 'CP';
        if (type.includes('UP -') || type.includes('UP (')) return 'UP';
        if (type.includes('CF -') || type.includes('CF (')) return 'CF';
        if (type.includes('UF -') || type.includes('UF (')) return 'UF';
        return '';
    };

    // Billing Tickets State
    // Billing Tickets State
    const billingTickets = aggregatedBillingTickets.length > 0 ? aggregatedBillingTickets : (formData?.billingTickets || []);
    const [isBillingTicketModalOpen, setIsBillingTicketModalOpen] = useState(false);
    const [isBillingTermsOpen, setIsBillingTermsOpen] = useState(false);
    const [editingBillingTicketIndex, setEditingBillingTicketIndex] = useState<number | null>(null);
    const [billingTicketToDelete, setBillingTicketToDelete] = useState<number | null>(null);
    const [isBillingTicketUploading, setIsBillingTicketUploading] = useState(false);
    const [newBillingTicket, setNewBillingTicket] = useState({
        date: format(new Date(), 'yyyy-MM-dd'),
        billingTerms: '' as 'COD' | 'Net 30' | 'Net 45' | 'Net 60' | 'Other' | '',
        otherBillingTerms: '',
        uploads: [] as any[],
        titleDescriptions: [] as { title: string; description: string }[],
        lumpSum: '',
        createdBy: ''
    });

    const billingTermsOptions = ['COD', 'Net 30', 'Net 45', 'Net 60', 'Other'];

    const handleAddBillingTicket = () => {
        setNewBillingTicket({
            date: format(new Date(), 'yyyy-MM-dd'),
            billingTerms: '',
            otherBillingTerms: '',
            uploads: [],
            titleDescriptions: [{ title: '', description: '' }],
            lumpSum: '',
            createdBy: formData?.proposalWriter || ''
        });
        setEditingBillingTicketIndex(null);
        setIsBillingTicketModalOpen(true);
    };

    const handleEditBillingTicket = (index: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const item = billingTickets[index];
        
        // 1. Sanitize Lump Sum (strip $ and commas)
        let safeLumpSum = '';
        if (item.lumpSum || item.amount) {
            safeLumpSum = String(item.lumpSum || item.amount).replace(/[^0-9.]/g, '');
        }

        // 2. Resolve Billing Terms
        // If the term is non-standard, we treat it as "Other" and put the text in otherBillingTerms
        const standardOptions = ['COD', 'Net 30', 'Net 45', 'Net 60'];
        let safeBillingTerms = '';
        let safeOtherBillingTerms = item.otherBillingTerms || '';
        
        const rawTerm = (item.billingTerms || item.term || '').trim();

        if (rawTerm) {
            if (standardOptions.includes(rawTerm)) {
                safeBillingTerms = rawTerm;
            } else if (rawTerm.toLowerCase() === 'other') {
                safeBillingTerms = 'Other';
            } else {
                // It's a custom term
                safeBillingTerms = 'Other';
                // Only overwrite otherBillingTerms if it wasn't already set to something else
                if (!safeOtherBillingTerms) {
                    safeOtherBillingTerms = rawTerm;
                }
            }
        } else if (safeOtherBillingTerms) {
            // No main term, but we have other terms -> force "Other"
            safeBillingTerms = 'Other';
        }

        // 3. Robust Date Parsing
        let safeDate = format(new Date(), 'yyyy-MM-dd');
        if (item.date) {
            const parsed = new Date(item.date);
            if (!isNaN(parsed.getTime())) {
                safeDate = format(parsed, 'yyyy-MM-dd');
            }
        }

        setNewBillingTicket({
            date: safeDate,
            billingTerms: safeBillingTerms as any, // Cast to match strict union type
            otherBillingTerms: safeOtherBillingTerms,
            uploads: item.uploads || [],
            titleDescriptions: item.titleDescriptions?.length ? item.titleDescriptions : [{ title: '', description: '' }],
            lumpSum: safeLumpSum,
            createdBy: item.createdBy || ''
        });
        setEditingBillingTicketIndex(index);
        setIsBillingTicketModalOpen(true);
    };

    const handleSaveBillingTicket = () => {
        if (!onUpdate) return;

        const cleanedTitleDescriptions = newBillingTicket.titleDescriptions.filter(td => td.title.trim() || td.description.trim());

        const ticketData = {
            ...newBillingTicket,
            titleDescriptions: cleanedTitleDescriptions
        };

        let updated;
        if (editingBillingTicketIndex !== null) {
            updated = billingTickets.map((item: any, idx: number) =>
                idx === editingBillingTicketIndex ? { ...item, ...ticketData } : item
            );
        } else {
            updated = [...billingTickets, {
                ...ticketData,
                _id: Math.random().toString(36).substr(2, 9),
                createdAt: new Date().toISOString()
            }];
        }

        onUpdate('billingTickets', updated);
        setIsBillingTicketModalOpen(false);
        setEditingBillingTicketIndex(null);
        toast.success(editingBillingTicketIndex !== null ? 'Billing ticket updated' : 'Billing ticket added');
    };

    const confirmRemoveBillingTicket = () => {
        if (!onUpdate || billingTicketToDelete === null) return;
        const updated = billingTickets.filter((_: any, i: number) => i !== billingTicketToDelete);
        onUpdate('billingTickets', updated);
        setBillingTicketToDelete(null);
        toast.success('Billing ticket removed');
    };

    const handleBillingTicketFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setIsBillingTicketUploading(true);
        const uploaded = [...newBillingTicket.uploads];

        for (const file of files) {
            try {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('folder', `estimates/${formData?.estimate || 'general'}/billing`);

                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                const data = await res.json();

                if (data.success && data.url) {
                    uploaded.push({
                        name: file.name,
                        url: data.url,
                        thumbnailUrl: data.thumbnailUrl || '',
                        type: file.type
                    });
                } else {
                    toast.error(`Failed to upload ${file.name}`);
                }
            } catch (err) {
                console.error('Upload Error:', err);
                toast.error(`Error uploading ${file.name}`);
            }
        }

        setNewBillingTicket(prev => ({ ...prev, uploads: uploaded }));
        setIsBillingTicketUploading(false);
    };

    const removeBillingTicketUpload = (index: number) => {
        setNewBillingTicket(prev => ({
            ...prev,
            uploads: prev.uploads.filter((_, i) => i !== index)
        }));
    };


    const addTitleDescription = () => {
        setNewBillingTicket(prev => ({
            ...prev,
            titleDescriptions: [...prev.titleDescriptions, { title: '', description: '' }]
        }));
    };

    const updateTitleDescription = (index: number, field: 'title' | 'description', value: string) => {
        setNewBillingTicket(prev => ({
            ...prev,
            titleDescriptions: prev.titleDescriptions.map((td, i) =>
                i === index ? { ...td, [field]: value } : td
            )
        }));
    };

    const removeTitleDescription = (index: number) => {
        setNewBillingTicket(prev => ({
            ...prev,
            titleDescriptions: prev.titleDescriptions.filter((_, i) => i !== index)
        }));
    };


    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
    const [paymentContext, setPaymentContext] = useState<{ index: number | 'new', data: any } | null>(null);
    const [paymentDetails, setPaymentDetails] = useState({
        paidBy: '',
        paymentDate: format(new Date(), 'yyyy-MM-dd')
    });

    // Chat States for Estimate
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [newChatMessage, setNewChatMessage] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [chatAssignees, setChatAssignees] = useState<string[]>([]);
    const [cursorPosition, setCursorPosition] = useState(0); 
    const chatInputRef = React.useRef<HTMLInputElement>(null);
    const chatScrollRef = React.useRef<HTMLDivElement>(null);

    const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
    const [editingMsgText, setEditingMsgText] = useState('');
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null);

    // Fetch Chat Messages for this Estimate
    React.useEffect(() => {
        if (!formData?.estimate) return;

        const fetchChat = async () => {
            try {
                // Fetch messages specifically for this estimate
                const res = await fetch(`/api/chat?limit=50&estimate=${encodeURIComponent(formData.estimate)}`);
                if (!res.ok) {
                    console.warn(`Chat fetch failed with status: ${res.status}`);
                    return;
                }
                const data = await res.json();
                if (data.success) {
                    setChatMessages(data.messages);
                    // Scroll to bottom
                    setTimeout(() => {
                        if (chatScrollRef.current) {
                            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                        }
                    }, 100);
                }
            } catch (error) {
                console.error('Failed to fetch estimate chat', error);
            }
        };

        fetchChat();
        const interval = setInterval(fetchChat, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [formData?.estimate]); // Re-run if estimate ID changes

    const handleChatInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setNewChatMessage(val);
        
        const cursor = e.target.selectionStart || 0;
        setCursorPosition(cursor);
        
        // Check for trigger at cursor
        const textBefore = val.slice(0, cursor);
        const words = textBefore.split(/\s+/);
        const lastWord = words[words.length - 1];

        if (lastWord.startsWith('@')) {
            setMentionQuery(lastWord.slice(1));
            setShowMentions(true);
        } else {
            setShowMentions(false);
        }
    };

    const handleSendChatMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newChatMessage.trim() || !formData?.estimate) return;

        const messageText = newChatMessage;

        // Build assignees with name lookup (chatAssignees is string[] of emails here)
        const safeAssignees = chatAssignees.map(email => {
            const emp = employees.find((e: any) => 
                (e.value || e.email || '')?.toLowerCase() === email.toLowerCase()
            );
            return {
                email,
                name: emp?.label || `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || email
            };
        }).filter(a => a.email);

        const optimisticMsg = {
            _id: `temp-${Date.now()}`,
            sender: currentUser?.email || 'Me',
            senderName: currentUser?.email || 'Me',
            message: messageText,
            assignees: safeAssignees.map(a => a.email), // Keep as string[] for chat renderer
            createdAt: new Date().toISOString()
        };

        setChatMessages(prev => [...prev, optimisticMsg]);
        setNewChatMessage('');
        setChatAssignees([]);
        
        // Reset height
        if (chatInputRef.current) {
            // chatInputRef.current.style.height = 'auto'; // if using textarea
        }

        try {
            await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: optimisticMsg.message,
                    estimate: formData.estimate,
                    assignees: safeAssignees,
                    replyTo: replyingTo ? {
                        _id: replyingTo._id,
                        sender: replyingTo.sender,
                        message: replyingTo.message
                    } : undefined
                })
            });
            setReplyingTo(null);

            // Auto-create a To Do task if employees were tagged (same as Dashboard)
            console.log('[EstimateChat] safeAssignees:', safeAssignees, 'chatAssignees raw:', chatAssignees);
            if (safeAssignees.length > 0) {
                console.log('[EstimateChat] Creating task for assignees:', safeAssignees);
                try {
                    const taskRes = await fetch('/api/tasks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            task: messageText.replace(/@\S+/g, '').replace(/#\S+/g, '').trim() || messageText,
                            status: 'todo',
                            assignees: safeAssignees.map((a: any) => a.email),
                            createdBy: currentUser?.email || 'System',
                            estimate: formData.estimate,
                            customerId: formData.customerId || '',
                            customerName: formData.customerName || '',
                            jobAddress: formData.jobAddress || ''
                        })
                    });
                    if (taskRes.ok) {
                        const taskData = await taskRes.json();
                        if (taskData.task) {
                            toast.success('Task created for assigned employees');
                        }
                    }
                } catch (taskErr) {
                    console.error('Auto-task creation failed:', taskErr);
                }
            }
        } catch (error) {
            console.error('Failed to send', error);
            toast.error('Failed to send message');
        }
    };

    const handleUpdateMessage = async (id: string, text: string) => {
        if (!text.trim()) return;
        try {
            const res = await fetch(`/api/chat/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();
            if (data.success) {
                setChatMessages(prev => prev.map(m => m._id === id ? { ...m, message: text } : m));
                setEditingMsgId(null);
                setEditingMsgText('');
                toast.success('Message updated');
            } else {
                toast.error(data.error || 'Failed to update');
            }
        } catch (error) {
            toast.error('Operation failed');
        }
    };

    const handleDeleteMessage = (id: string) => {
        setDeleteMsgId(id);
    };

    const confirmDeleteMessage = async () => {
        if (!deleteMsgId) return;
        try {
            const res = await fetch(`/api/chat/${deleteMsgId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                setChatMessages(prev => prev.filter(m => m._id !== deleteMsgId));
                toast.success('Message deleted');
            } else {
                toast.error(data.error || 'Failed to delete');
            }
        } catch (error) {
            console.error('Failed to delete', error);
            toast.error('Failed to delete message');
        } finally {
            setDeleteMsgId(null);
        }
    };

    const getEmployeeData = (idOrEmail: string) => {
        if (!idOrEmail) return null;
        const lower = idOrEmail.toLowerCase();
        const found = employees.find(e => 
            String(e._id || '').toLowerCase() === lower || 
            String(e.email || '').toLowerCase() === lower ||
            String(e.value || '').toLowerCase() === lower
        );
        if (!found) return null;

        return {
            ...found,
            label: found.label || (found.firstName ? `${found.firstName} ${found.lastName || ''}`.trim() : idOrEmail),
            image: found.image || found.profilePicture
        };
    };

    const employeeOptions = useMemo(() => {
        return employees.map(emp => {
            const label = emp.label || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email || emp._id;
            return {
                id: emp._id,
                label: label,
                value: emp.email || emp._id || emp.value,
                profilePicture: emp.image || emp.profilePicture
            };
        }).sort((a, b) => a.label.localeCompare(b.label));
    }, [employees]);

    const filteredChatOptions = useMemo(() => {
        const source = employeeOptions;
        if (!mentionQuery) return source.slice(0, 100);
        return source.filter(e => e.label.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 50);
    }, [mentionQuery, employeeOptions]);

    const handleAddPlanning = () => {
        setNewPlanningItem({
            planningType: '',
            usaTicketNo: '',
            dateSubmitted: format(new Date(), 'yyyy-MM-dd'),
            activationDate: '',
            expirationDate: '',
            documentName: '',
            documents: []
        });
        setEditingPlanningIndex(null);
        setIsPlanningModalOpen(true);
    };

    const handleEditPlanning = (index: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const item = jobPlanningDocs[index];
        setNewPlanningItem({ ...item });
        setEditingPlanningIndex(index);
        setIsPlanningModalOpen(true);
    };

    const handleConfirmPlanning = async () => {
        if (!newPlanningItem.planningType || !newPlanningItem.documentName) {
            toast.error('Type and Document Name are required');
            return;
        }

        const updatedDocs = [...jobPlanningDocs];
        if (editingPlanningIndex !== null) {
            updatedDocs[editingPlanningIndex] = { ...newPlanningItem };
        } else {
            updatedDocs.push({ 
                ...newPlanningItem, 
                _id: `plan-${Date.now()}`,
                createdAt: new Date().toISOString()
            });
        }

        onUpdate?.('jobPlanningDocs', updatedDocs);
        setIsPlanningModalOpen(false);
        toast.success(editingPlanningIndex !== null ? 'Planning document updated' : 'Planning document added');
    };

    const handlePlanningFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setIsPlanningUploading(true);
        const uploaded = [...newPlanningItem.documents];

        for (const file of files) {
            try {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('folder', `estimates/${formData?.estimate || 'general'}/planning`);

                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                const data = await res.json();

                if (data.success && data.url) {
                    uploaded.push({
                        name: file.name,
                        url: data.url,
                        thumbnailUrl: data.thumbnailUrl || '',
                        type: file.type,
                        uploadedAt: new Date().toISOString()
                    });
                } else {
                    toast.error(`Failed to upload ${file.name}`);
                }
            } catch (err) {
                console.error('Upload error:', err);
                toast.error(`Failed to upload ${file.name}`);
            }
        }

        setNewPlanningItem(prev => ({ ...prev, documents: uploaded }));
        setIsPlanningUploading(false);
    };

    const confirmRemovePlanningItem = () => {
        if (planningItemToDelete === null) return;
        const updated = jobPlanningDocs.filter((_: any, i: number) => i !== planningItemToDelete);
        onUpdate?.('jobPlanningDocs', updated);
        setPlanningItemToDelete(null);
        toast.success('Planning document removed');
    };

    const handleDocClick = async (docName: string, itemIndex?: number) => {
        // 1. Try to find ID in fetched release constants (dynamic)
        const dbConstant = releasesConstants.find(r => r.value === docName);
        let templateId = dbConstant?.templateId;

        // 2. Fallback to hardcoded map
        if (!templateId) {
            templateId = DOC_TEMPLATES[docName];
        }
        
        if (!templateId) {
            toast.error(`Template not configured for "${docName}"`);
            return;
        }

        if (!formData) {
            toast.error('No estimate data available');
            return;
        }

        setGeneratingDoc(docName);
        if (itemIndex !== undefined) setGeneratingIndex(itemIndex);
        setGeneratingProgress(5);

        const intervalId = setInterval(() => {
            setGeneratingProgress(prev => {
                if (prev >= 95) return prev;
                return prev + Math.floor(Math.random() * 8) + 1;
            });
        }, 400);

        try {
            // Build variables from formData
            const variables: Record<string, string> = {
                // Job Info
                jobAddress: formData.jobAddress || '',
                projectDescription: formData.projectDescription || '',
                prelimAmount: formData.prelimAmount || '',
                date: formData.date || new Date().toLocaleDateString(),
                today: new Date().toLocaleDateString(),
                
                // Property Owner / Public Agency
                poName: formData.poName || '',
                PoAddress: formData.PoAddress || '',
                PoPhone: formData.PoPhone || '',
                
                // Original Contractor
                ocName: formData.ocName || '',
                ocAddress: formData.ocAddress || '',
                ocPhone: formData.ocPhone || '',
                
                // Sub-Contractor
                subCName: formData.subCName || '',
                subCAddress: formData.subCAddress || '',
                subCPhone: formData.subCPhone || '',
                
                // Lending Institution
                liName: formData.liName || '',
                liAddress: formData.liAddress || '',
                liPhone: formData.liPhone || '',
                
                // Surety Company
                scName: formData.scName || '',
                scAddress: formData.scAddress || '',
                scPhone: formData.scPhone || '',
                bondNumber: formData.bondNumber || '',
                
                // Fringe Benefits Trust
                fbName: formData.fbName || '',
                fbAddress: formData.fbAddress || '',
                
                // Certified Payroll
                certifiedPayroll: formData.certifiedPayroll || '',
                
                // Customer Info
                customerName: formData.customerName || '',
                contactName: formData.contactName || '',
                contactEmail: formData.contactEmail || '',
                contactPhone: formData.contactPhone || '',
                
                // Project
                projectName: formData.projectName || '',
                estimate: formData.estimate || '',
                usaNumber: formData.usaNumber || '',
                projectId: formData.projectId || '',
                customerPONo: formData.customerPONo || '',
                workRequestNo: formData.workRequestNo || '',
                subContractAgreementNo: formData.subContractAgreementNo || '',
                customerJobNo: formData.customerJobNo || '',
                DIRProjectNo: formData.DIRProjectNo || '',
                
                // Customer ID should be the client name
                customerId: formData.customerName || formData.customer || '',
                
                // Robust Customer Info - Prioritize official record from CRM over estimate's job-site contact info
                customerAddress: (() => {
                    if (activeClient) {
                        const primary = (activeClient.addresses || []).find((a: any) => typeof a === 'object' && a.primary);
                        const addr = (typeof primary === 'object' ? primary.address : primary) || activeClient.businessAddress;
                        if (addr) return addr;
                    }
                    return formData.contactAddress || '';
                })(),
                
                customerPhone: (() => {
                    if (activeClient) {
                        const primary = (activeClient.contacts || []).find((c: any) => c.primary);
                        if (primary?.phone) return primary.phone;
                        if (activeClient.phone) return activeClient.phone;
                    }
                    return formData.contactPhone || '';
                })(),
                
                // Get proposalWriter employee details
                createdBy: (() => {
                    const proposalWriterEmail = formData.proposalWriter;
                    if (proposalWriterEmail && employees.length > 0) {
                        const emp = employees.find(e => e._id === proposalWriterEmail);
                        if (emp) {
                            return `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
                        }
                    }
                    return '';
                })(),
                companyPosition: (() => {
                    const proposalWriterEmail = formData.proposalWriter;
                    if (proposalWriterEmail && employees.length > 0) {
                        const emp = employees.find(e => e._id === proposalWriterEmail);
                        return emp?.companyPosition || '';
                    }
                    return '';
                })(),
                signature: (() => {
                    const proposalWriterEmail = formData.proposalWriter;
                    if (proposalWriterEmail && employees.length > 0) {
                        const emp = employees.find(e => e._id === proposalWriterEmail);
                        return emp?.signature || '';
                    }
                    return '';
                })(),
                cfoSignature: (() => {
                    if (employees.length > 0) {
                        const cfo = employees.find(e => 
                            (e.email || e._id || '').toLowerCase() === 'dt@devco-inc.com'
                        );
                        return cfo?.signature || '';
                    }
                    return '';
                })(),
            };

            // Inject Intent to Lien specific fields
            if (docName === 'Intent to Lien' && itemIndex !== undefined) {
                const intentItem = intentToLienItems[itemIndex];
                if (intentItem) {
                    // Set {{today}} to the intent to lien's createdAt date
                    if (intentItem.createdAt) {
                        variables.today = new Date(intentItem.createdAt).toLocaleDateString();
                    }
                    
                    // Intent to Lien specific fields
                    variables.arBalance = intentItem.arBalance || '';
                    variables.fromDate = intentItem.fromDate ? new Date(intentItem.fromDate).toLocaleDateString() : '';
                    variables.toDate = intentItem.toDate ? new Date(intentItem.toDate).toLocaleDateString() : '';
                    variables.dueDate = intentItem.dueDate ? new Date(intentItem.dueDate).toLocaleDateString() : '';
                }
            }

            // Inject Release specific fields if this doc is a Release type
            // Use itemIndex when available to get the correct release (not just the first match by type)
            const releaseItem = (itemIndex !== undefined && releases?.[itemIndex])
                ? releases[itemIndex]
                : releases?.find((r: any) => r.documentType === docName);
            if (releaseItem) {
                // Set {{today}} to the release's createdAt date (when the release was created)
                if (releaseItem.createdAt) {
                    variables.today = new Date(releaseItem.createdAt).toLocaleDateString();
                }
                
                // Ensure date formatting consistency
                if (releaseItem.date) {
                   variables.date = new Date(releaseItem.date).toLocaleDateString(); 
                }
                
                if (releaseItem.amountOfCheck) {
                    const rawVal = String(releaseItem.amountOfCheck).replace(/[^0-9.-]+/g, '');
                    const num = parseFloat(rawVal);
                    variables.amountOfCheck = !isNaN(num) ? `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : releaseItem.amountOfCheck;
                }
                
                if (releaseItem.disputedClaims) {
                    const rawVal = String(releaseItem.disputedClaims).replace(/[^0-9.-]+/g, '');
                    const num = parseFloat(rawVal);
                    // Only show if it's a non-zero number
                    if (!isNaN(num) && num > 0) {
                        variables.disputedClaims = `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    } else {
                        variables.disputedClaims = ''; // Don't print if empty or 0
                    }
                } else {
                    variables.disputedClaims = '';
                }

                // Inject Creator (Signer) details
                const creatorId = releaseItem.createdBy;
                const creatorEmployee = employees.find(e => e._id === creatorId);
                if (creatorEmployee) {
                    variables.createdBy = `${creatorEmployee.firstName || ''} ${creatorEmployee.lastName || ''}`.trim();
                    variables.companyPosition = creatorEmployee.companyPosition || '';
                    variables.signature = creatorEmployee.signature || '';
                }
                
                // For array fields like un-paid amounts, format them if they are numbers
                if (releaseItem.amountsOfUnpaidProgressPayment && Array.isArray(releaseItem.amountsOfUnpaidProgressPayment)) {
                    variables.amountsOfUnpaidProgressPayment = releaseItem.amountsOfUnpaidProgressPayment.map((val: any) => {
                        const rawVal = String(val).replace(/[^0-9.-]+/g, '');
                        const num = parseFloat(rawVal);
                        return !isNaN(num) ? `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : val;
                    }).join(', ');
                }
                
                if (releaseItem.DatesOfWaiverRelease && Array.isArray(releaseItem.DatesOfWaiverRelease)) {
                    // Format dates?
                    variables.DatesOfWaiverRelease = releaseItem.DatesOfWaiverRelease.map((d: string) => new Date(d).toLocaleDateString()).join(', ');
                }
                
                // Received Progress Payments array (for UP)
                if (releaseItem.receivedProgressPayments && Array.isArray(releaseItem.receivedProgressPayments)) {
                     variables.receivedProgressPayment = releaseItem.receivedProgressPayments.join(', ');
                }
            }

            // Inject Billing Ticket specific fields
            if (docName === 'Billing Ticket' && itemIndex !== undefined) {
                const billingItem = billingTickets[itemIndex];
                if (billingItem) {
                    variables.date = billingItem.date ? new Date(billingItem.date).toLocaleDateString() : variables.date;
                    variables.day = billingItem.date ? format(new Date(billingItem.date), 'EEEE') : format(new Date(), 'EEEE');
                    variables.billingTerms = billingItem.billingTerms || '';
                    variables.otherBillingTerms = billingItem.otherBillingTerms || '';
                    const rawLumpSum = String(billingItem.lumpSum || '').replace(/[^0-9.-]+/g, '');
                    variables.lumpSum = rawLumpSum ? `$${parseFloat(rawLumpSum).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00';
                    
                    // Support for repeating section
                    if (billingItem.titleDescriptions && billingItem.titleDescriptions.length > 0) {
                        // Pass as array - the backend needs to handle this specifically
                        (variables as any).titleDescriptions = (billingItem.titleDescriptions as any[]).map((td: any) => ({
                            title: td.title || '',
                            description: td.description || ''
                        }));

                        // NEW: Provide a pre-interleaved string for simplified templates with STYLING MARKERS
                        variables.billingTicketDetails = (billingItem.titleDescriptions as any[]).map((td: any) => {
                            let itemStr = '';
                            if (td.title && td.title.trim()) {
                                // Only add title bullet and styling if title exists
                                itemStr = `● [B][S+]${td.title.trim()}[/S+][/B]`;
                            }
                            
                            if (td.description && td.description.trim()) {
                                const indentedDesc = (td.description as string).split('\n').map((line: string) => `   ○ ${line}`).join('\n');
                                if (itemStr) {
                                    itemStr += `\n${indentedDesc}`;
                                } else {
                                    itemStr = indentedDesc;
                                }
                            }
                            return itemStr;
                        }).filter(str => str !== '').join('\n\n');
                    }
                }
            }

            const response = await fetch('/api/generate-google-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateId, variables })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate PDF');
            }

            // Download the PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${docName.replace(/\s+/g, '_')}_${formData.estimate || 'doc'}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

            setGeneratingProgress(100);
            toast.success(`${docName} downloaded successfully!`);
        } catch (error: any) {
            console.error('PDF Generation Error:', error);
            toast.error(error.message || 'Failed to generate PDF');
        } finally {
            clearInterval(intervalId);
            // Wait a bit to show 100%
            setTimeout(() => {
                setGeneratingDoc(null);
                setGeneratingIndex(null);
                setGeneratingProgress(0);
            }, 600);
        }
    };
    
    const handleFileDownload = (url: string, fileName: string) => {
        if (!url) {
            toast.error('File URL is not available');
            return;
        }

        // Use our server-side proxy to force download and bypass CORS/Cloudinary issues
        const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(fileName)}`;
        
        const link = document.createElement('a');
        link.href = proxyUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('Download starting...');
    };


    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const uploadedAttachments = [...newContract.attachments];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('folder', `estimates/${formData?.estimate || 'general'}/contracts`);

                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                const data = await res.json();

                if (data.success && data.url) {
                    uploadedAttachments.push({
                        name: file.name,
                        url: data.url,
                        thumbnailUrl: data.thumbnailUrl || '',
                        type: file.type
                    });
                } else {
                    toast.error(`Failed to upload ${file.name}`);
                }
            } catch (err) {
                console.error('Upload Error:', err);
                toast.error(`Error uploading ${file.name}`);
            }
        }

        setNewContract(prev => ({ ...prev, attachments: uploadedAttachments }));
        setIsUploading(false);
    };

    const handleAddContract = () => {
        if (!onUpdate) return;
        if (!newContract.date) {
            toast.error('Date is required');
            return;
        }
        if (!newContract.amount) {
            toast.error('Amount is required');
            return;
        }
        if (!newContract.attachments || newContract.attachments.length === 0) {
            toast.error('At least one file is required');
            return;
        }

        const updatedContracts = [...signedContracts, {
            ...newContract,
            amount: parseFloat(newContract.amount) || 0
        }];
        onUpdate('signedContracts', updatedContracts);
        setIsSignedContractModalOpen(false);
        setNewContract({
            date: format(new Date(), 'yyyy-MM-dd'),
            amount: '',
            attachments: []
        });
        toast.success('Signed contract added');
    };

    const handleRemoveContract = (idx: number) => {
        setContractIndexToDelete(idx);
    };

    const confirmRemoveContract = async () => {
        if (!onUpdate || contractIndexToDelete === null) return;
        
        const contractToDelete = signedContracts[contractIndexToDelete];
        const urlsToDelete = contractToDelete.attachments?.map((a: any) => a.url).filter(Boolean) || [];

        if (urlsToDelete.length > 0) {
            try {
                await fetch('/api/webhook/devcoBackend', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'deleteCloudinaryFiles',
                        payload: { urls: urlsToDelete }
                    })
                });
            } catch (err) {
                console.error('Error deleting files from Cloudinary:', err);
            }
        }

        const updatedContracts = signedContracts.filter((_: any, i: number) => i !== contractIndexToDelete);
        onUpdate('signedContracts', updatedContracts);
        setContractIndexToDelete(null);
        toast.success('Contract removed');
    };

    const handleReceiptFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsReceiptUploading(true);
        const uploadedAttachments = [...newReceipt.upload];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('folder', `estimates/${formData?.estimate || 'general'}/receipts`);

                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                const data = await res.json();

                if (data.success && data.url) {
                    uploadedAttachments.push({
                        name: file.name,
                        url: data.url,
                        thumbnailUrl: data.thumbnailUrl || '',
                        type: file.type
                    });
                }
            } catch (err) {
                console.error('Upload Error:', err);
            }
        }

        setNewReceipt(prev => ({ ...prev, upload: uploadedAttachments }));
        setIsReceiptUploading(false);
    };

    const handleAddReceipt = () => {
        setEditingReceiptIndex(null);
        setNewReceipt({
            type: 'Receipt',
            vendor: '',
            amount: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            dueDate: '',
            remarks: '',
            tag: [],
            approvalStatus: 'Not Approved',
            status: '',
            paidBy: '',
            paymentDate: format(new Date(), 'yyyy-MM-dd'),
            upload: [],
            createdBy: ''
        });
        setIsReceiptModalOpen(true);
    };

    const handleSaveReceipt = () => {
        if (!onUpdate) return;
        
        let updated;
        if (editingReceiptIndex !== null) {
            // Update mode
            updated = receiptsAndCosts.map((item: any, idx: number) => 
                idx === editingReceiptIndex 
                    ? { ...item, ...newReceipt, amount: parseFloat(newReceipt.amount) || 0 }
                    : item
            );
        } else {
            // Add mode
            const receiptEntry = {
                ...newReceipt,
                _id: Math.random().toString(36).substr(2, 9),
                amount: parseFloat(newReceipt.amount) || 0,
                createdAt: new Date(),
                createdBy: formData?.proposalWriter || ''
            };
            updated = [...receiptsAndCosts, receiptEntry];
        }

        onUpdate('receiptsAndCosts', updated);
        setIsReceiptModalOpen(false);
        setEditingReceiptIndex(null);
        setNewReceipt({
            type: 'Receipt',
            vendor: '',
            amount: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            dueDate: '',
            remarks: '',
            tag: [],
            approvalStatus: 'Not Approved',
            status: '',
            paidBy: '',
            paymentDate: '',
            upload: [],
            createdBy: ''
        });
        toast.success(editingReceiptIndex !== null ? 'Receipt updated' : 'Receipt added');
    };

    const handleEditReceipt = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const receipt = receiptsAndCosts[index];
        setEditingReceiptIndex(index);
        setNewReceipt({
            type: receipt.type || 'Receipt',
            vendor: receipt.vendor || '',
            amount: String(receipt.amount || ''),
            date: receipt.date || format(new Date(), 'yyyy-MM-dd'),
            dueDate: receipt.dueDate || '',
            remarks: receipt.remarks || '',
            tag: receipt.tag || [],
            approvalStatus: receipt.approvalStatus || 'Not Approved',
            status: receipt.status || '',
            paidBy: receipt.paidBy || '',
            paymentDate: receipt.paymentDate || '',
            upload: receipt.upload || [],
            createdBy: receipt.createdBy || ''
        });
        setIsReceiptModalOpen(true);
    };

    const confirmRemoveReceipt = () => {
        if (!onUpdate || receiptToDelete === null) return;
        const updated = receiptsAndCosts.filter((_: any, i: number) => i !== receiptToDelete);
        onUpdate('receiptsAndCosts', updated);
        setReceiptToDelete(null);
        toast.success('Receipt removed');
    };

    const handleUpdateReceiptStatus = (index: number, field: string, value: string) => {
        if (!onUpdate) return;
        
        if (field === 'status' && value === 'Devco Paid') {
            setPaymentContext({ index, data: receiptsAndCosts[index] });
            setPaymentDetails({
                paidBy: receiptsAndCosts[index].paidBy || '',
                paymentDate: receiptsAndCosts[index].paymentDate || format(new Date(), 'yyyy-MM-dd')
            });
            setIsPaymentModalOpen(true);
            return;
        }

        const updated = receiptsAndCosts.map((r: any, i: number) => 
            i === index ? { ...r, [field]: value } : r
        );
        onUpdate('receiptsAndCosts', updated);
        if (selectedReceipt && receiptsAndCosts[index]._id === selectedReceipt._id) {
            setSelectedReceipt({ ...selectedReceipt, [field]: value });
        }
    };

    const handleConfirmPaymentDetails = () => {
        if (!onUpdate || !paymentContext) return;

        if (paymentContext.index === 'new') {
            setNewReceipt(prev => ({
                ...prev,
                status: 'Devco Paid',
                paidBy: paymentDetails.paidBy,
                paymentDate: paymentDetails.paymentDate
            }));
        } else {
            const index = paymentContext.index;
            const updated = receiptsAndCosts.map((r: any, i: number) => 
                i === index ? { 
                    ...r, 
                    status: 'Devco Paid',
                    paidBy: paymentDetails.paidBy,
                    paymentDate: paymentDetails.paymentDate
                } : r
            );
            onUpdate('receiptsAndCosts', updated);
            if (selectedReceipt && receiptsAndCosts[index]._id === selectedReceipt._id) {
                setSelectedReceipt({ 
                    ...selectedReceipt, 
                    status: 'Devco Paid',
                    paidBy: paymentDetails.paidBy,
                    paymentDate: paymentDetails.paymentDate
                });
            }
        }

        setIsPaymentModalOpen(false);
        setPaymentContext(null);
    };

    return (
        <div className={`bg-[#eef2f6] rounded-2xl lg:rounded-[40px] p-2 lg:p-4 ${className || ''}`}>


            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 pb-6">




                {/* Column 0: Estimate Chat */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white flex items-center justify-center shadow-md">
                            <MessageSquare className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-700">Estimate Chat</h4>
                        {formData?.estimate && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                                #{formData.estimate}
                            </span>
                        )}
                    </div>
                    
                    
                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] flex flex-col h-[400px] md:h-[500px] relative">

                         <div 
                            className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-200"
                            ref={chatScrollRef}
                         >
                            {chatMessages.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-[10px] text-slate-400 font-bold">No messages for this estimate yet.</p>
                                </div>
                            ) : (
                                chatMessages.map((msg, idx) => {
                                    // Determine if I am the sender
                                    // Use currentUser from usePermissions or fallback to basic check
                                    const isMe = (currentUser?.email && msg.sender?.toLowerCase() === currentUser.email?.toLowerCase()) || 
                                                 msg.senderName === 'Me' || 
                                                 msg.sender === formData?.proposalWriter;
                                    
                                    // Find sender employee for avatar
                                    const senderEmp = employees.find(e => 
                                        e.email?.toLowerCase() === msg.sender?.toLowerCase() || 
                                        e._id === msg.sender ||
                                        e.value?.toLowerCase() === msg.sender?.toLowerCase()
                                    );
                                    const senderLabel = senderEmp?.label || senderEmp?.firstName || msg.senderName || msg.sender || 'U';
                                    const senderInitials = senderLabel.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

                                    const renderMessage = (text: string) => {
                                        const parts = text.split(/(@[\w.@]+)/g);
                                        return parts.map((part, i) => {
                                            if (part.startsWith('@')) {
                                                const label = part.slice(1);
                                                // Check if this person is already an assignee (hide them from text if they are)
                                                const isAssignee = msg.assignees?.some((email: string) => {
                                                    const emp = employees.find(e => 
                                                        e.email?.toLowerCase() === email?.toLowerCase() ||
                                                        e._id === email ||
                                                        e.value?.toLowerCase() === email?.toLowerCase()
                                                    );
                                                    return (emp?.label === label || emp?.firstName === label) || email === label;
                                                });
                                                
                                                if (isAssignee) return null;
                                                return <span key={i} className={`font-bold ${isMe ? 'text-blue-200' : 'text-blue-600'}`}>{part}</span>;
                                            }
                                            return part;
                                        });
                                    };

                                    const HeaderContent = () => {
                                        const AssigneesAvatars = (
                                            <div className="flex -space-x-1.5 overflow-hidden">
                                                {msg.assignees && msg.assignees.length > 0 ? (
                                                    msg.assignees.map((assignee: any, aIdx: number) => {
                                                        // Handle both string (email) and object ({email, name}) formats
                                                        const email = typeof assignee === 'string' ? assignee : assignee?.email || '';
                                                        const assEmp = employees.find(e => 
                                                            e.email?.toLowerCase() === email?.toLowerCase() || 
                                                            e._id === email ||
                                                            e.value?.toLowerCase() === email?.toLowerCase()
                                                        );
                                                        const assName = assEmp?.label || assEmp?.firstName || (typeof assignee === 'object' ? assignee?.name : null) || email || 'U';
                                                        return (
                                                            <Tooltip key={aIdx}>
                                                                <TooltipTrigger asChild>
                                                                    <Avatar className="w-5 h-5 border-[1.5px] border-white/20 shrink-0">
                                                                        <AvatarImage src={assEmp?.image || assEmp?.profilePicture} />
                                                                        <AvatarFallback className="text-[8px] bg-slate-200 font-extrabold text-[#0F4C75]">
                                                                            {assName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p className="text-[10px] font-bold">{assName}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })
                                                ) : null}
                                            </div>
                                        );

                                        const SenderAvatar = (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Avatar className={`w-6 h-6 border-[1.5px] shrink-0 ${isMe ? 'border-white/20' : 'border-white'}`}>
                                                        <AvatarImage src={senderEmp?.image || senderEmp?.profilePicture} />
                                                        <AvatarFallback className={`text-[9px] font-black ${isMe ? 'bg-[#112D4E] text-white' : 'bg-slate-300 text-slate-700'}`}>
                                                            {isMe ? 'ME' : senderInitials}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="text-[10px] font-bold">{isMe ? 'You' : senderLabel}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        );

                                        if (isMe) {
                                            return (
                                                <div className="flex items-center justify-between mb-2 gap-2">
                                                    {AssigneesAvatars}
                                                    {SenderAvatar}
                                                </div>
                                            );
                                        } else {
                                            return (
                                                <div className="flex items-center justify-between mb-2 flex-row-reverse gap-2">
                                                    {AssigneesAvatars}
                                                    {SenderAvatar}
                                                </div>
                                            );
                                        }
                                    };
                                    
                                    return (
                                         <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group mb-1 items-end gap-2`}>
                                            {isMe && !editingMsgId && (
                                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity pb-1">
                                                    <button 
                                                        onClick={() => {
                                                            setReplyingTo(msg);
                                                            chatInputRef.current?.focus();
                                                        }} 
                                                        className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-green-600 transition-colors"
                                                        title="Reply"
                                                    >
                                                        <Reply size={12} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            const cleanText = msg.message.replace(/(@[\w.@]+)/g, '').trim();
                                                            setNewChatMessage(prev => `Fwd: ${cleanText}\n` + prev);
                                                            chatInputRef.current?.focus();
                                                        }} 
                                                        className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
                                                        title="Forward"
                                                    >
                                                        <Forward size={12} />
                                                    </button>
                                                    <button 
                                                        onClick={() => { setEditingMsgId(msg._id); setEditingMsgText(msg.message); }}
                                                        className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteMessage(msg._id)}
                                                        className="p-1 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            )}
                                            
                                            <div id={msg._id} className={`rounded-2xl p-1 min-w-[160px] max-w-[85%] shadow-sm relative ${
                                                isMe 
                                                    ? 'bg-[#526D82] text-white rounded-br-none' 
                                                    : 'bg-white text-slate-700 rounded-bl-none border border-slate-200'
                                            }`}>
                                                <HeaderContent />

                                                {/* Reply Citation */}
                                                {msg.replyTo && (
                                                    <div 
                                                        onClick={() => document.getElementById(msg.replyTo._id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                                        className={`mb-2 mx-1 p-1.5 rounded-lg text-[10px] cursor-pointer hover:opacity-80 transition-opacity ${
                                                            isMe 
                                                                ? 'bg-white/10 border-l-2 border-white/40 text-white/80' 
                                                                : 'bg-slate-50 border-l-2 border-slate-300 text-slate-500'
                                                        }`}
                                                    >
                                                        <p className="font-bold opacity-75 mb-0.5">{msg.replyTo.sender?.split('@')[0]}</p>
                                                        <p className="truncate line-clamp-1 italic opacity-90">{msg.replyTo.message}</p>
                                                    </div>
                                                )}

                                                {editingMsgId === msg._id ? (
                                                    <div className="px-1 py-1 space-y-2">
                                                        <textarea 
                                                            autoFocus
                                                            className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-white/50 min-h-[60px] resize-none"
                                                            value={editingMsgText}
                                                            onChange={(e) => setEditingMsgText(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    handleUpdateMessage(msg._id, editingMsgText);
                                                                } else if (e.key === 'Escape') {
                                                                    setEditingMsgId(null);
                                                                }
                                                            }}
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => setEditingMsgId(null)} className="text-[9px] font-bold uppercase hover:underline">Cancel</button>
                                                            <button onClick={() => handleUpdateMessage(msg._id, editingMsgText)} className="text-[9px] font-bold uppercase hover:underline">Save</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] leading-relaxed break-words px-1">
                                                        {renderMessage(msg.message)}
                                                    </p>
                                                )}

                                                <div className={`flex items-center justify-between mt-1 pt-1 px-1 gap-2 ${isMe ? 'flex-row' : 'flex-row-reverse'}`}>
                                                    <div /> 
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[8px] uppercase tracking-widest font-black opacity-60 shrink-0 ${isMe ? 'text-white' : 'text-slate-400'}`}>
                                                            {new Date(msg.createdAt).toLocaleString([], { 
                                                                month: 'short', 
                                                                day: 'numeric', 
                                                                year: 'numeric', 
                                                                hour: '2-digit', 
                                                                minute: '2-digit', 
                                                                hour12: true 
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {!isMe && !editingMsgId && (
                                                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity pb-1">
                                                    <button 
                                                        onClick={() => {
                                                            setReplyingTo(msg);
                                                            chatInputRef.current?.focus();
                                                        }} 
                                                        className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-green-600 transition-colors"
                                                        title="Reply"
                                                    >
                                                        <Reply size={12} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            const cleanText = msg.message.replace(/(@[\w.@]+)/g, '').trim();
                                                            setNewChatMessage(prev => `Fwd: ${cleanText}\n` + prev);
                                                            chatInputRef.current?.focus();
                                                        }} 
                                                        className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
                                                        title="Forward"
                                                    >
                                                        <Forward size={12} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                         </div>
                             {replyingTo && (
                                 <div className="mb-2 mx-1 p-2 bg-slate-50 border-l-4 border-blue-500 rounded flex items-center justify-between animate-in slide-in-from-bottom-2">
                                     <div className="flex-1 min-w-0">
                                         <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tight mb-0.5">Replying to {replyingTo.sender?.split('@')[0]}</p>
                                         <p className="text-[10px] text-slate-500 truncate italic">{replyingTo.message}</p>
                                     </div>
                                     <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-slate-200 rounded-full transition-colors ml-2">
                                         <X className="w-3 h-3 text-slate-400" />
                                     </button>
                                 </div>
                             )}
                         {/* Chat Input Area */}
                         {/* Chat Input Area */}
                         <div className="mt-3 pt-3 border-t border-slate-200/50 relative" id="estimate-chat-input-container">
                             <MyDropDown
                                  isOpen={showMentions}
                                  onClose={() => setShowMentions(false)}
                                  options={filteredChatOptions}
                                  selectedValues={chatAssignees}
                                  onSelect={(val) => {
                                      if (!chatAssignees.includes(val)) {
                                          setChatAssignees(prev => [...prev, val]);
                                      } else {
                                          setChatAssignees(prev => prev.filter(v => v !== val));
                                      }
                                      
                                      // Remove trigger text
                                      const text = newChatMessage;
                                      const before = text.slice(0, cursorPosition);
                                      const lastAt = before.lastIndexOf('@');
                                      if (lastAt >= 0) {
                                          const newText = before.slice(0, lastAt) + text.slice(cursorPosition);
                                          setNewChatMessage(newText);
                                          
                                          setTimeout(() => {
                                              if (chatInputRef.current) {
                                                  chatInputRef.current.focus();
                                                  const newPos = lastAt;
                                                  chatInputRef.current.setSelectionRange(newPos, newPos);
                                                  setCursorPosition(newPos);
                                              }
                                          }, 0);
                                      }
                                  }}
                                  multiSelect={true}
                                  anchorId="estimate-chat-input-container"
                                  width="w-64"
                                  showSearch={false}
                             />
                             
                             <form 
                                  onSubmit={handleSendChatMessage} 
                                  className="flex flex-col gap-2"
                             >
                                  {chatAssignees.length > 0 && (
                                      <div className="flex items-center gap-2 mb-1 px-1">
                                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Assigning:</span>
                                          <div className="flex -space-x-1.5 overflow-hidden">
                                              {chatAssignees.map((val: string, i: number) => {
                                                  // Find employee by val (id or value)
                                                  // employeeOptions has { id, label, value, profilePicture }
                                                  const emp = employeeOptions.find(e => e.value === val || e.id === val);
                                                  return (
                                                      <div 
                                                          key={i} 
                                                          className="cursor-pointer hover:scale-110 transition-transform"
                                                          onClick={() => setChatAssignees(prev => prev.filter(v => v !== val))}
                                                          title={emp?.label || val}
                                                      >
                                                          <Avatar className="w-5 h-5 border border-white shrink-0 shadow-sm">
                                                              <AvatarImage src={emp?.profilePicture} />
                                                              <AvatarFallback className="text-[8px] bg-slate-200">
                                                                  {(emp?.label || val)[0].toUpperCase()}
                                                              </AvatarFallback>
                                                          </Avatar>
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                          <button 
                                              type="button"
                                              onClick={() => setChatAssignees([])}
                                              className="text-[9px] text-red-500 font-bold hover:underline ml-1"
                                          >
                                              Clear
                                          </button>
                                      </div>
                                  )}
                             
                                  <div className="flex items-end gap-2">
                                      <div className="relative flex-1">
                                          <textarea 
                                              ref={chatInputRef as any}
                                              placeholder="Message team... (@ to mention)"
                                              className="w-full px-4 py-2.5 bg-white/50 border border-slate-200 focus:bg-white rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400 resize-none min-h-[42px] max-h-32 overflow-y-auto"
                                              rows={1}
                                              value={newChatMessage}
                                              onInput={(e: any) => {
                                                  const target = e.target;
                                                  target.style.height = 'auto';
                                                  target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                                              }}
                                              onChange={(e: any) => handleChatInput(e)}
                                              onKeyDown={(e) => {
                                                  if (e.key === 'Enter' && !e.shiftKey) {
                                                      e.preventDefault();
                                                      handleSendChatMessage();
                                                  }
                                              }}
                                          />
                                      </div>
                                      <button 
                                          type="submit"
                                          disabled={!newChatMessage.trim()}
                                          className="w-10 h-10 bg-[#526D82] text-white rounded-xl flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md shrink-0 mb-0.5"
                                      >
                                          <Send className="w-4 h-4" />
                                      </button>
                                  </div>
                            </form>
                         </div>
                    </div>
                </div>

                {/* Column 1: Prelims */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md">
                            <FileText className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-[#0F4C75]">Prelims / Legal / Lien</h4>
                        <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                            {prelimDocs.length}
                        </span>
                    </div>
                    
                    
                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">
                        {/* Hidden file inputs for COI and Legal Docs */}
                        <input 
                            type="file" 
                            ref={coiInputRef} 
                            onChange={handleCoiUpload} 
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            className="hidden" 
                        />
                        <input 
                            type="file" 
                            ref={legalDocsInputRef} 
                            onChange={handleLegalDocsUpload} 
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            multiple
                            className="hidden" 
                        />

                        <div className="grid grid-cols-1 gap-3">
                            {prelimDocs.length > 0 ? prelimDocs.map((docName, idx) => {
                                // Special handling for COI
                                if (docName === 'COI - Certificate of Insurance') {
                                    return (
                                        <div key={idx} className="group">
                                            <div 
                                                className={`
                                                    flex items-center justify-between p-3 rounded-xl cursor-pointer
                                                    ${coiDocument 
                                                        ? 'bg-emerald-50 border border-emerald-200' 
                                                        : 'bg-white/50 hover:bg-white border border-transparent hover:border-slate-200'}
                                                    shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] transition-all duration-200
                                                `}
                                            >
                                                <div className="flex items-center gap-3 flex-1" onClick={() => !coiDocument && coiInputRef.current?.click()}>
                                                    {coiDocument ? (
                                                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                                                            <Check className="w-3.5 h-3.5 text-white" />
                                                        </div>
                                                    ) : isCoiUploading ? (
                                                        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                                                    ) : (
                                                        <Upload className="w-5 h-5 text-slate-400" />
                                                    )}
                                                    <div className="flex flex-col">
                                                        <span className={`text-xs font-bold ${coiDocument ? 'text-emerald-700' : 'text-slate-600'}`}>
                                                            {docName}
                                                        </span>
                                                        {coiDocument && (
                                                            <span className="text-[10px] text-emerald-600">
                                                                Uploaded {new Date(coiDocument.uploadedAt).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {coiDocument && (
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleFileDownload(coiDocument.url, 'COI_Document');
                                                            }}
                                                            className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                                            title="Download COI"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onUpdate?.('coiDocument', null);
                                                                toast.success('COI removed');
                                                            }}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }

                                // Special handling for Legal Docs
                                if (docName === 'Legal Docs') {
                                    return (
                                        <div key={idx} className="group">
                                            <div 
                                                onClick={() => legalDocsInputRef.current?.click()}
                                                className={`
                                                    flex items-center justify-between p-3 rounded-xl cursor-pointer
                                                    ${legalDocs.length > 0 
                                                        ? 'bg-violet-50 border border-violet-200' 
                                                        : 'bg-white/50 hover:bg-white border border-transparent hover:border-slate-200'}
                                                    shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] transition-all duration-200
                                                `}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {isLegalDocsUploading ? (
                                                        <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                                                    ) : legalDocs.length > 0 ? (
                                                        <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-white text-[10px] font-bold">
                                                            {legalDocs.length}
                                                        </div>
                                                    ) : (
                                                        <Upload className="w-5 h-5 text-slate-400" />
                                                    )}
                                                    <span className={`text-xs font-bold ${legalDocs.length > 0 ? 'text-violet-700' : 'text-slate-600'}`}>
                                                        {docName}
                                                    </span>
                                                </div>
                                                <Plus className="w-4 h-4 text-violet-500" />
                                            </div>
                                            
                                            {/* List of uploaded legal docs */}
                                            {legalDocs.length > 0 && (
                                                <div className="mt-2 ml-4 space-y-1">
                                                    {legalDocs.map((doc, docIdx) => (
                                                        <div key={docIdx} className="flex items-center justify-between p-2 bg-violet-50/50 rounded-lg border border-violet-100">
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                <Paperclip className="w-3 h-3 text-violet-400 flex-shrink-0" />
                                                                <span className="text-[10px] text-violet-700 font-medium truncate">{doc.name}</span>
                                                                <span className="text-[9px] text-violet-400 flex-shrink-0">
                                                                    {new Date(doc.uploadedAt).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleFileDownload(doc.url, doc.name);
                                                                    }}
                                                                    className="p-1 text-violet-500 hover:bg-violet-100 rounded transition-colors"
                                                                    title="Download Document"
                                                                >
                                                                    <Download className="w-3 h-3" />
                                                                </button>
                                                                <button 
                                                                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        removeLegalDoc(docIdx);
                                                                    }}
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                // Special handling for Intent to Lien
                                if (docName === 'Intent to Lien') {
                                    return (
                                        <div key={idx} className="group">
                                            <div 
                                                className={`
                                                    flex items-center justify-between p-3 rounded-xl
                                                    ${intentToLienItems.length > 0 
                                                        ? 'bg-amber-50 border border-amber-200' 
                                                        : 'bg-white/50 hover:bg-white border border-transparent hover:border-slate-200'}
                                                    shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff] transition-all duration-200
                                                `}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {intentToLienItems.length > 0 ? (
                                                        <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-white text-[10px] font-bold">
                                                            {intentToLienItems.length}
                                                        </div>
                                                    ) : (
                                                        <FileText className="w-5 h-5 text-slate-400" />
                                                    )}
                                                    <span className={`text-xs font-bold ${intentToLienItems.length > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
                                                        {docName}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={handleAddIntentToLien}
                                                    className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                            </div>
                                            
                                            {/* List of Intent to Lien items */}
                                            {intentToLienItems.length > 0 && (
                                                <div className="mt-2 ml-4 space-y-2">
                                                    {intentToLienItems.map((item: any, itemIdx: number) => (
                                                        <div 
                                                            key={item._id || itemIdx} 
                                                            className="group/item flex items-center justify-between p-2.5 bg-amber-50/50 rounded-lg border border-amber-100 hover:bg-amber-100/50 transition-colors relative overflow-hidden"
                                                        >
                                                            {generatingDoc === 'Intent to Lien' && generatingIndex === itemIdx && (
                                                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-200/50">
                                                                    <div 
                                                                        className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-300 relative"
                                                                        style={{ width: `${generatingProgress}%` }}
                                                                    >
                                                                        <span className="absolute -top-3 right-0 text-[6px] font-black text-orange-600 bg-white/80 px-1 rounded-sm">
                                                                            {generatingProgress}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <div className="flex flex-col gap-0.5 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] text-amber-700 font-bold">
                                                                        AR Balance: ${item.arBalance || '0'}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[9px] text-amber-600">
                                                                    {item.fromDate && item.toDate 
                                                                        ? `${new Date(item.fromDate).toLocaleDateString()} - ${new Date(item.toDate).toLocaleDateString()}`
                                                                        : 'No date range'
                                                                    }
                                                                </span>
                                                                <span className="text-[9px] text-amber-500">
                                                                    Due: {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => {
                                                                        // Generate PDF for this intent to lien
                                                                        handleDocClick('Intent to Lien', itemIdx);
                                                                    }}
                                                                    disabled={generatingDoc === 'Intent to Lien'}
                                                                    className="p-1.5 text-amber-600 hover:bg-amber-200 rounded-lg transition-colors"
                                                                >
                                                                    {generatingDoc === 'Intent to Lien' ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <Download className="w-3.5 h-3.5" />
                                                                    )}
                                                                </button>
                                                                <button
                                                                    onClick={() => handleEditIntentToLien(itemIdx)}
                                                                    className="p-1.5 text-slate-500 hover:bg-amber-200 rounded-lg transition-colors"
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setIntentToLienToDelete(itemIdx)}
                                                                    className="p-1.5 text-red-400 hover:bg-red-100 rounded-lg transition-colors"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                    // Normal DocCard for other documents
                                    return (
                                        <DocCard 
                                            key={idx} 
                                            label={docName}
                                            isLoading={generatingDoc === docName}
                                            progress={generatingProgress}
                                            hasTemplate={!!DOC_TEMPLATES[docName]}
                                            onClick={() => handleDocClick(docName)}
                                        />
                                    );
                            }) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No documents</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 2: Billing Tickets */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shadow-md">
                            <Receipt className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-indigo-700">Billing Tickets</h4>
                        <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                            {billingTickets.length}
                        </span>
                        <button 
                            onClick={handleAddBillingTicket}
                            className="ml-auto p-1.5 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {billingTickets.length > 0 ? billingTickets.map((item: any, idx: number) => (
                                <div 
                                    key={idx}
                                    onClick={(e) => handleEditBillingTicket(idx, e)}
                                    className="bg-white/60 p-3 rounded-xl border border-white/40 shadow-sm relative group cursor-pointer hover:bg-white/80 hover:shadow-md transition-all duration-300 overflow-hidden"
                                >
                                    {generatingDoc === 'Billing Ticket' && generatingIndex === idx && (
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100/50">
                                            <div 
                                                className="h-full bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 transition-all duration-300 relative"
                                                style={{ width: `${generatingProgress}%` }}
                                            >
                                                <span className="absolute -top-3 right-0 text-[7px] font-black text-indigo-600 bg-white/80 px-1 rounded-sm">
                                                    {generatingProgress}%
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 min-w-0 pr-6">
                                    {(item.billingTerms || item.otherBillingTerms) && (
                                        <p className="text-[10px] font-bold text-indigo-500">
                                            {(!item.billingTerms || item.billingTerms === 'Other') ? (item.otherBillingTerms || item.billingTerms) : item.billingTerms}
                                        </p>
                                    )}
                                    {item.date && (
                                        <p className="text-[10px] font-bold text-slate-500">Date: {safeFormatDate(item.date)}</p>
                                    )}
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setBillingTicketToDelete(idx);
                                    }}
                                    className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 absolute top-2 right-2"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDocClick('Billing Ticket', idx);
                                    }}
                                    className="p-1 text-slate-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100 absolute top-2 right-12"
                                    title="Download PDF"
                                >
                                    {generatingDoc === 'Billing Ticket' ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                    ) : (
                                        <Download className="w-3.5 h-3.5" />
                                    )}
                                </button>
                                <button 
                                    onClick={(e) => handleEditBillingTicket(idx, e)}
                                    className="p-1 text-slate-300 hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100 absolute top-2 right-7"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            
                            {(item.lumpSum || item.amount) && (
                                <div className="mt-2 flex items-center gap-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase">Lump Sum</span>
                                    <span className="text-xs font-black text-green-600">
                                        ${parseFloat(String(item.lumpSum || item.amount).replace(/[^0-9.-]+/g, "")).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}

                                    {item.titleDescriptions?.length > 0 && (
                                        <div className="mt-2 space-y-1 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                                            {item.titleDescriptions.slice(0, 3).map((td: any, tIdx: number) => (
                                                <div key={tIdx} className="text-[9px] text-slate-600 leading-tight">
                                                    <span className="font-bold text-slate-800">{td.title}:</span> {td.description ? `${td.description.substring(0, 80)}${td.description.length > 80 ? '...' : ''}` : ''}
                                                </div>
                                            ))}
                                            {item.titleDescriptions.length > 3 && (
                                                <p className="text-[8px] text-slate-400 font-bold ml-1">+{item.titleDescriptions.length - 3} more items...</p>
                                            )}
                                        </div>
                                    )}
                                    
                                    {item.uploads?.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {item.uploads.map((upload: any, uIdx: number) => (
                                                <a
                                                    key={uIdx}
                                                    href={upload.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex items-center gap-1.5 text-[9px] text-violet-600 hover:text-violet-800 hover:bg-violet-50 px-2 py-1 rounded-lg transition-colors group/link"
                                                >
                                                    <Paperclip className="w-2.5 h-2.5 flex-shrink-0" />
                                                    <span className="truncate max-w-[180px] group-hover/link:underline">{upload.name || `File ${uIdx + 1}`}</span>
                                                    {upload.thumbnailUrl && (
                                                        <img src={upload.thumbnailUrl} alt="" className="w-5 h-5 rounded object-cover ml-auto flex-shrink-0" />
                                                    )}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No billing tickets</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 3: Conditional / Un-Conditional Releases */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white flex items-center justify-center shadow-md">
                            <FileCheck className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-cyan-700">Releases</h4>
                        <span className="text-[10px] bg-cyan-100 text-cyan-600 px-2 py-0.5 rounded-full font-bold">
                            {releases.length}
                        </span>
                        <button 
                            onClick={handleAddRelease}
                            className="ml-auto p-1.5 bg-cyan-100 text-cyan-600 rounded-lg hover:bg-cyan-200 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">
                         <div className="grid grid-cols-1 gap-3">
                            {releases.length > 0 ? releases.map((item: any, idx: number) => (
                                <div 
                                    key={idx}
                                    onClick={(e) => handleEditRelease(idx, e)}
                                    className="bg-white/60 p-3 rounded-xl border border-white/40 shadow-sm relative group cursor-pointer hover:bg-white/80 hover:shadow-md transition-all duration-300 overflow-hidden"
                                >
                                    {generatingDoc === item.documentType && generatingIndex === idx && (
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100/50">
                                            <div 
                                                className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 transition-all duration-300 relative"
                                                style={{ width: `${generatingProgress}%` }}
                                            >
                                                <span className="absolute -top-3 right-0 text-[7px] font-black text-blue-600 bg-white/80 px-1 rounded-sm">
                                                    {generatingProgress}%
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 min-w-0 pr-6">
                                            <span className="inline-block text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md bg-cyan-100 text-cyan-600 mb-1.5 truncate max-w-full">
                                                {item.documentType}
                                            </span>
                                            {item.date && (
                                                <p className="text-[10px] font-bold text-slate-500">Date: {safeFormatDate(item.date)}</p>
                                            )}
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setReleaseToDelete(idx);
                                            }}
                                            className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 absolute top-2 right-2"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 border-t border-slate-100/50 pt-2">
                                        {/* Dynamic content summary */}
                                        {['CP', 'CF'].includes(getReleaseCode(item.documentType)) && item.amountOfCheck && (
                                            <div>
                                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">Check Amt</span>
                                                <span className="text-[10px] font-black text-green-600">
                                                    ${parseFloat(String(item.amountOfCheck || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}
                                        {['UF', 'CF'].includes(getReleaseCode(item.documentType)) && item.disputedClaims && (
                                            <div>
                                                <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">Disputed</span>
                                                <span className="text-[10px] font-black text-red-600">
                                                    ${parseFloat(String(item.disputedClaims || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDocClick(item.documentType, idx);
                                        }}
                                        className="absolute bottom-2 right-2 p-1.5 rounded-lg text-cyan-700 hover:text-white hover:bg-cyan-600 transition-all duration-200"
                                        title="Download PDF"
                                    >
                                        {generatingDoc === item.documentType && generatingIndex === idx ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Download className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No release docs</p>
                            )}
                         </div>
                    </div>
                </div>

                {/* Column 4: Certified Payroll */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-md">
                            <Shield className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-emerald-700">Certified Payroll</h4>
                        <span className="text-[10px] bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-bold">
                            {certifiedPayrollDocs.length}
                        </span>
                        <button
                            onClick={() => setIsAddingPayrollDoc(true)}
                            className="ml-auto w-6 h-6 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-sm hover:shadow-md transition-all duration-200"
                            title="Add Certified Payroll Document"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Hidden file input for payroll uploads */}
                    <input
                        ref={payrollUploadRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                            if (payrollUploadingDoc) {
                                handlePayrollDocUpload(payrollUploadingDoc, e);
                            }
                        }}
                    />

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">

                        <div className="grid grid-cols-1 gap-3">
                            {certifiedPayrollDocs.length > 0 ? certifiedPayrollDocs.map((docName, idx) => {
                                const uploads = certifiedPayrollUploads[docName] || [];
                                const hasUploads = uploads.length > 0;
                                const isUploadingThis = payrollUploadingDoc === docName;
                                return (
                                    <div key={idx} className="group">
                                        <div 
                                            className={`
                                                flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200
                                                ${hasUploads 
                                                    ? 'bg-emerald-50 border border-emerald-200' 
                                                    : isUploadingThis
                                                        ? 'bg-blue-50 border border-blue-200'
                                                        : 'bg-white/50 hover:bg-white border border-transparent hover:border-slate-200'}
                                                shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff]
                                            `}
                                        >
                                            <div 
                                                className="flex items-center gap-3 flex-1"
                                                onClick={() => {
                                                    if (!hasUploads && !isUploadingThis) {
                                                        setPayrollUploadingDoc(docName);
                                                        setTimeout(() => payrollUploadRef.current?.click(), 0);
                                                    }
                                                }}
                                            >
                                                {hasUploads ? (
                                                    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                                        <Check className="w-3.5 h-3.5 text-white" />
                                                    </div>
                                                ) : isUploadingThis ? (
                                                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
                                                ) : (
                                                    <Upload className="w-5 h-5 text-slate-400 flex-shrink-0" />
                                                )}
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className={`text-xs font-bold leading-snug ${hasUploads ? 'text-emerald-700' : 'text-slate-600'}`}>
                                                        {docName}
                                                    </span>
                                                    {hasUploads && (
                                                        <div className="flex items-center gap-1.5">
                                                            {uploads[uploads.length - 1].uploaderImage ? (
                                                                <img 
                                                                    src={uploads[uploads.length - 1].uploaderImage} 
                                                                    alt="" 
                                                                    className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                                                                />
                                                            ) : (
                                                                <div className="w-4 h-4 rounded-full bg-emerald-400 flex items-center justify-center flex-shrink-0">
                                                                    <User className="w-2.5 h-2.5 text-white" />
                                                                </div>
                                                            )}
                                                            <span className="text-[10px] text-emerald-600">
                                                                Uploaded {new Date(uploads[uploads.length - 1].uploadedAt).toLocaleDateString()}
                                                                {uploads[uploads.length - 1].uploadedBy && (
                                                                    <> by {(() => {
                                                                        const emp = employees.find(e => e._id === uploads[uploads.length - 1].uploadedBy || 
                                                                            `${e.firstName} ${e.lastName}`.toLowerCase().includes(uploads[uploads.length - 1].uploadedBy?.toLowerCase?.() || ''));
                                                                        if (emp?.firstName) return `${emp.firstName} ${emp.lastName || ''}`;
                                                                        const email = uploads[uploads.length - 1].uploadedBy;
                                                                        return email?.split('@')[0] || 'Unknown';
                                                                    })()}</>
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {isUploadingThis && !hasUploads && (
                                                        <span className="text-[10px] text-blue-500 font-medium">Uploading...</span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Action buttons */}
                                            <div className="flex items-center gap-0.5">
                                                {/* Upload more button (always available, more visible when has uploads) */}
                                                {hasUploads && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPayrollUploadingDoc(docName);
                                                            setTimeout(() => payrollUploadRef.current?.click(), 0);
                                                        }}
                                                        disabled={isUploadingThis}
                                                        className="p-1.5 text-emerald-500 hover:bg-emerald-100 rounded-lg transition-colors"
                                                        title={`Upload more to ${docName}`}
                                                    >
                                                        {isUploadingThis ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Upload className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}

                                                {/* Template download */}
                                                {DOC_TEMPLATES[docName] && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDocClick(docName);
                                                        }}
                                                        disabled={generatingDoc === docName}
                                                        className={`p-1.5 rounded-lg transition-colors ${hasUploads ? 'text-emerald-600 hover:bg-emerald-100' : 'text-slate-400 hover:bg-slate-100'}`}
                                                        title="Generate Template"
                                                    >
                                                        {generatingDoc === docName ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Download className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                )}

                                                {/* Chevron when no template and no uploads */}
                                                {!DOC_TEMPLATES[docName] && !hasUploads && !isUploadingThis && (
                                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#0F4C75] group-hover:translate-x-1 transition-all duration-300" />
                                                )}

                                                {/* Delete custom doc */}
                                                {customCertifiedPayrollDocs.includes(docName) && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const updatedCustom = customCertifiedPayrollDocs.filter(d => d !== docName);
                                                            onUpdate?.('customCertifiedPayrollDocs', updatedCustom);
                                                            // Also clean up uploads for this doc
                                                            const updatedUploads = { ...certifiedPayrollUploads };
                                                            delete updatedUploads[docName];
                                                            onUpdate?.('certifiedPayrollUploads', updatedUploads);
                                                            toast.success(`Removed "${docName}"`);
                                                        }}
                                                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Remove document type"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Uploaded files list — COI-style cards */}
                                        {hasUploads && (
                                            <div className="ml-6 mt-1.5 space-y-1.5">
                                                {uploads.map((upload: any, uIdx: number) => (
                                                    <div 
                                                        key={uIdx}
                                                        className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-100 shadow-sm transition-all duration-200 hover:shadow-md group/file"
                                                    >
                                                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                                            {upload.uploaderImage ? (
                                                                <img 
                                                                    src={upload.uploaderImage} 
                                                                    alt="" 
                                                                    className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                                                                />
                                                            ) : (
                                                                <Paperclip className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                                                            )}
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="text-[10px] font-bold text-emerald-800 truncate max-w-[150px]">
                                                                    {upload.name || `File ${uIdx + 1}`}
                                                                </span>
                                                                <span className="text-[8px] text-emerald-500">
                                                                    {upload.uploadedAt ? new Date(upload.uploadedAt).toLocaleDateString() : ''}
                                                                    {upload.uploadedBy && (
                                                                        <> · {(() => {
                                                                            const email = upload.uploadedBy;
                                                                            return email?.split('@')[0] || '';
                                                                        })()}</>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-0.5 opacity-0 group-hover/file:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleFileDownload(upload.url, upload.name || `payroll_doc_${uIdx}`);
                                                                }}
                                                                className="p-1 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                                                title="Download"
                                                            >
                                                                <Download className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    removePayrollUpload(docName, uIdx);
                                                                }}
                                                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Remove"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            }) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No documents</p>
                            )}

                            {/* Add new payroll doc inline input */}
                            {isAddingPayrollDoc && (
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 border-dashed shadow-sm">
                                    <Plus className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                    <input
                                        type="text"
                                        autoFocus
                                        value={newPayrollDocName}
                                        onChange={(e) => setNewPayrollDocName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newPayrollDocName.trim()) {
                                                const updated = [...customCertifiedPayrollDocs, newPayrollDocName.trim()];
                                                onUpdate?.('customCertifiedPayrollDocs', updated);
                                                setNewPayrollDocName('');
                                                setIsAddingPayrollDoc(false);
                                                toast.success(`Added "${newPayrollDocName.trim()}"`);
                                            }
                                            if (e.key === 'Escape') {
                                                setNewPayrollDocName('');
                                                setIsAddingPayrollDoc(false);
                                            }
                                        }}
                                        placeholder="Document name... (Enter to save)"
                                        className="flex-1 text-xs font-bold text-emerald-800 bg-transparent border-none outline-none placeholder:text-emerald-400 placeholder:font-medium"
                                    />
                                    <button
                                        onClick={() => {
                                            if (newPayrollDocName.trim()) {
                                                const updated = [...customCertifiedPayrollDocs, newPayrollDocName.trim()];
                                                onUpdate?.('customCertifiedPayrollDocs', updated);
                                                setNewPayrollDocName('');
                                                setIsAddingPayrollDoc(false);
                                                toast.success(`Added "${newPayrollDocName.trim()}"`);
                                            }
                                        }}
                                        disabled={!newPayrollDocName.trim()}
                                        className="p-1 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-30"
                                    >
                                        <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setNewPayrollDocName('');
                                            setIsAddingPayrollDoc(false);
                                        }}
                                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 5: Planning */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white flex items-center justify-center shadow-md">
                            <Layout className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-violet-700">Planning</h4>
                        <span className="text-[10px] bg-violet-100 text-violet-600 px-2 py-0.5 rounded-full font-bold">
                            {jobPlanningDocs.length}
                        </span>
                        <button 
                            onClick={handleAddPlanning}
                            className="ml-auto p-1.5 bg-violet-100 text-violet-600 rounded-lg hover:bg-violet-200 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">

                        <div className="grid grid-cols-1 gap-3">
                            {jobPlanningDocs.length > 0 ? jobPlanningDocs.map((item: any, idx: number) => (
                                <div 
                                    key={idx}
                                    onClick={() => {
                                        setSelectedPlanningItem(item);
                                        setIsPlanningDetailsModalOpen(true);
                                    }}
                                    className="bg-white/60 p-3 rounded-xl border border-white/40 shadow-sm relative group cursor-pointer hover:bg-white/80 hover:shadow-md transition-all duration-300"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 min-w-0 pr-8">
                                            <span className="inline-block text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-600 mb-1.5">
                                                {item.planningType}
                                            </span>
                                            <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate leading-none mb-1">
                                                {item.documentName}
                                            </h5>
                                            {item.usaTicketNo && (
                                                <p className="text-[9px] font-bold text-slate-400">USA: {item.usaTicketNo}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-0.5 absolute top-2 right-2">
                                            <button 
                                                onClick={(e) => handleEditPlanning(idx, e)}
                                                className="p-1 text-slate-300 hover:text-violet-600 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPlanningItemToDelete(idx);
                                                }}
                                                className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100/50">
                                        <div>
                                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Active</p>
                                            <p className="text-[9px] font-black text-slate-700 leading-none">
                                                {safeFormatDate(item.activationDate, 'MM/dd/yy')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Expires</p>
                                            <p className={`text-[9px] font-black leading-none ${
                                                (() => {
                                                    if (!item.expirationDate) return 'text-slate-700';
                                                    try {
                                                        const d = new Date(item.expirationDate);
                                                        return !isNaN(d.getTime()) && d < new Date() ? 'text-red-500' : 'text-slate-700';
                                                    } catch (e) { return 'text-slate-700'; }
                                                })()
                                            }`}>
                                                {safeFormatDate(item.expirationDate, 'MM/dd/yy')}
                                            </p>
                                        </div>
                                    </div>

                                    {item.documents && item.documents.length > 0 && (
                                        <div className="flex items-center gap-1.5 mt-2.5">
                                            <div className="flex -space-x-1.5">
                                                {item.documents.slice(0, 3).map((doc: any, dIdx: number) => (
                                                    <button 
                                                        key={dIdx} 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleFileDownload(doc.url, doc.name);
                                                        }}
                                                        className="w-5 h-5 rounded-full bg-violet-50 border border-white flex items-center justify-center shadow-sm hover:bg-violet-100 hover:border-violet-200 hover:scale-110 transition-all duration-200 z-10"
                                                        title={`Download ${doc.name}`}
                                                    >
                                                        <Paperclip className="w-2.5 h-2.5 text-violet-600" />
                                                    </button>
                                                ))}
                                            </div>
                                            <span className="text-[8px] font-bold text-slate-400">
                                                {item.documents.length} item{item.documents.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No planning documents</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 6: Signed Contracts */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-md">
                            <FileCheck className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-amber-700">Signed Contracts</h4>
                        <span className="text-[10px] bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-bold">
                            {signedContracts.length}
                        </span>
                        <button 
                            onClick={() => setIsSignedContractModalOpen(true)}
                            className="ml-auto p-1.5 bg-amber-100 text-amber-600 rounded-lg hover:bg-amber-200 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">

                        <div className="grid grid-cols-1 gap-3">
                            {signedContracts.length > 0 ? signedContracts.map((contract: any, idx: number) => (
                                <div 
                                    key={idx}
                                    onClick={() => setSelectedViewContract(contract)}
                                    className="bg-white/60 p-3 rounded-xl border border-white/40 shadow-sm relative group cursor-pointer hover:bg-white/80 hover:shadow-md transition-all duration-300"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {safeFormatDate(contract.date, 'MM/dd/yyyy')}
                                            </p>
                                            <p className="text-sm font-black text-slate-800">
                                                ${(contract.amount || 0).toLocaleString()}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveContract(idx);
                                            }}
                                            className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    
                                    {contract.attachments && contract.attachments.length > 0 && (
                                        <div className="space-y-1">
                                            {contract.attachments.map((file: any, fIdx: number) => (
                                                <button 
                                                    key={fIdx}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleFileDownload(file.url, file.name);
                                                    }}
                                                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg bg-slate-50/80 border border-slate-100 hover:bg-amber-50 hover:border-amber-200 hover:shadow-sm transition-all duration-200 group/file"
                                                    title={`Download ${file.name}`}
                                                >
                                                    {file.type?.startsWith('image/') ? (
                                                        <ImageIcon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 group-hover/file:scale-110 transition-transform" />
                                                    ) : (
                                                        <Paperclip className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 group-hover/file:scale-110 transition-transform" />
                                                    )}
                                                    <span className="text-[10px] font-medium text-slate-600 truncate group-hover/file:text-amber-700 transition-colors">
                                                        {file.name || `File ${fIdx + 1}`}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No contracts</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column 7: Receipts & Costs */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 text-white flex items-center justify-center shadow-md">
                            <Receipt className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-pink-700">Receipts & Costs</h4>
                        <span className="text-[10px] bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full font-bold">
                            {receiptsAndCosts.length}
                        </span>
                        <button 
                            onClick={handleAddReceipt}
                            className="ml-auto p-1.5 bg-pink-100 text-pink-600 rounded-lg hover:bg-pink-200 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">

                        <div className="grid grid-cols-3 gap-1 mb-4 pb-3 border-b border-slate-200/50">
                            {(() => {
                                const rects = receiptsAndCosts.filter((r: any) => r.type === 'Receipt').reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
                                const invs = receiptsAndCosts.filter((r: any) => r.type === 'Invoice').reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
                                const total = rects + invs;
                                return (
                                    <>
                                        <div className="text-center border-r border-slate-200/50 pr-1">
                                            <p className="text-[6px] font-black text-slate-400 uppercase tracking-tighter mb-1">Receipts</p>
                                            <p className="text-[9px] font-black text-pink-600">${rects.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                        </div>
                                        <div className="text-center border-r border-slate-200/50 px-1">
                                            <p className="text-[6px] font-black text-slate-400 uppercase tracking-tighter mb-1">Invoices</p>
                                            <p className="text-[9px] font-black text-indigo-600">${invs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                        </div>
                                        <div className="text-center pl-1">
                                            <p className="text-[6px] font-black text-slate-400 uppercase tracking-tighter mb-1">Total</p>
                                            <p className="text-[10px] font-black text-[#0F4C75]">${total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {receiptsAndCosts.length > 0 ? [...receiptsAndCosts]
                                .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                                .map((item: any) => {
                                    const originalIdx = receiptsAndCosts.findIndex((r: any) => r._id === item._id);
                                    return (
                                        <div 
                                            key={item._id || originalIdx}
                                            onClick={() => setSelectedReceipt(item)}
                                            className="bg-white/60 p-3 rounded-xl border border-white/40 shadow-sm relative group cursor-pointer hover:bg-white/80 hover:shadow-md transition-all duration-300"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-col gap-1 mb-1.5">
                                                        <span className={`w-fit text-[8px] font-black uppercase tracking-tighter px-1 rounded ${item.type === 'Invoice' ? 'bg-indigo-100 text-indigo-600' : 'bg-pink-100 text-pink-600'}`}>
                                                            {item.type}
                                                        </span>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                                                            {item.vendor || 'Unknown Vendor'}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-black text-slate-800">
                                                            ${(item.amount || 0).toLocaleString()}
                                                        </p>
                                                        {item.upload?.length > 0 && (
                                                            <span className="flex items-center gap-0.5 text-[8px] font-bold text-slate-400">
                                                                <Paperclip className="w-2 h-2" />
                                                                {item.upload.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={(e) => handleEditReceipt(originalIdx, e)}
                                                        className="p-1 text-slate-300 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setReceiptToDelete(originalIdx);
                                                        }}
                                                        className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                    
                                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full border ${item.approvalStatus === 'Approved' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                            {item.approvalStatus || 'Not Approved'}
                                        </span>
                                        {item.status === 'Devco Paid' && (
                                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                Devco Paid
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/50">
                                        <span className="text-[10px] text-slate-400 font-bold">{item.date}</span>
                                        <div className="flex items-center gap-2">
                                            {/* Creator & Tags */}
                                            <div className="flex -space-x-1.5">
                                                <TooltipProvider>
                                                    {/* Creator */}
                                                    {(() => {
                                                        const creator = getEmployeeData(item.createdBy);
                                                        return (
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="w-5 h-5 rounded-full border border-white bg-slate-100 flex items-center justify-center text-[7px] font-bold text-slate-500 shadow-sm overflow-hidden">
                                                                        {creator?.image ? <img src={creator.image} className="w-full h-full object-cover" /> : (item.createdBy?.[0]?.toUpperCase() || 'U')}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>Created By: {creator?.label || item.createdBy}</p></TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })()}

                                                    {/* Tags */}
                                                    {(item.tag || []).slice(0, 2).map((tagMail: string, i: number) => {
                                                        const tagEmp = getEmployeeData(tagMail);
                                                        return (
                                                            <Tooltip key={i}>
                                                                <TooltipTrigger asChild>
                                                                    <div className="w-5 h-5 rounded-full border border-white bg-[#0F4C75] flex items-center justify-center text-[7px] font-bold text-white shadow-sm overflow-hidden">
                                                                        {tagEmp?.image ? <img src={tagEmp.image} className="w-full h-full object-cover" /> : (tagMail?.[0]?.toUpperCase() || 'T')}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent><p>Tagged: {tagEmp?.label || tagMail}</p></TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })}
                                                    {(item.tag || []).length > 2 && (
                                                        <div className="w-5 h-5 rounded-full border border-white bg-slate-50 flex items-center justify-center text-[7px] font-bold text-slate-400 shadow-sm">
                                                            +{(item.tag || []).length - 2}
                                                        </div>
                                                    )}
                                                </TooltipProvider>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No records</p>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Field Documents Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 pb-6">

                {/* Column: JHA */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center shadow-md">
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-orange-700">JHA</h4>
                        <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">
                            {jhaRecords.length}
                        </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {loadingJobDocs ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                                </div>
                            ) : jhaRecords.length > 0 ? jhaRecords.map((jha: any, idx: number) => {
                                const creator = normalizedEmployees.find(e => e.value === jha.createdBy);
                                const sigs = (jha.signatures || []).filter((s: any) => s.employee && s.signature);
                                return (
                                <div
                                    key={jha._id || idx}
                                    onClick={() => handleViewJHA(jha)}
                                    className="bg-white/60 p-3 rounded-xl border border-white/40 shadow-sm relative group cursor-pointer hover:bg-orange-50/60 hover:shadow-md hover:border-orange-200 transition-all duration-300"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {safeFormatDate(jha.date, 'MM/dd/yyyy')}
                                            </p>
                                            <p className="text-xs font-black text-slate-800 truncate">
                                                {jha.scheduleRef?.title || jha.computedTitle || 'JHA Record'}
                                            </p>
                                        </div>
                                        <Eye className="w-3.5 h-3.5 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                        {jha.usaNo && (
                                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">
                                                USA #{jha.usaNo}
                                            </span>
                                        )}
                                        <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">
                                            {jha.jhaTime || '-'}
                                        </span>
                                    </div>
                                    {/* Creator */}
                                    <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-100/50">
                                        <div className="w-5 h-5 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                            {creator?.image ? (
                                                <img src={creator.image} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[8px] font-black text-slate-500">
                                                    {(creator?.label || jha.createdBy || '?')[0]?.toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500 truncate">{creator?.label || jha.createdBy || '-'}</span>
                                    </div>
                                    {/* Signature Avatars */}
                                    {sigs.length > 0 && (
                                        <div className="flex items-center gap-1 mt-2">
                                            <div className="flex -space-x-1.5">
                                                {sigs.slice(0, 6).map((sig: any, sIdx: number) => {
                                                    const emp = normalizedEmployees.find(e => e.value === sig.employee);
                                                    return (
                                                        <div
                                                            key={sIdx}
                                                            className="w-5 h-5 rounded-full border-2 border-white bg-green-50 overflow-hidden shrink-0 relative"
                                                            title={emp?.label || sig.employee}
                                                        >
                                                            {emp?.image ? (
                                                                <img src={emp.image} className="w-full h-full object-cover" alt="" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-[7px] font-black text-green-700">
                                                                    {(emp?.label || sig.employee || '?')[0]?.toUpperCase()}
                                                                </div>
                                                            )}
                                                            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {sigs.length > 6 && (
                                                <span className="text-[8px] font-bold text-slate-400 ml-0.5">+{sigs.length - 6}</span>
                                            )}
                                            <span className="text-[8px] font-bold text-green-600 ml-auto">{sigs.length} signed</span>
                                        </div>
                                    )}
                                </div>
                                );
                            }) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No JHA records</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column: Job Tickets */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 text-white flex items-center justify-center shadow-md">
                            <Clipboard className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-cyan-700">Job Tickets</h4>
                        <span className="text-[10px] bg-cyan-100 text-cyan-600 px-2 py-0.5 rounded-full font-bold">
                            {jobTicketRecords.length}
                        </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {loadingJobDocs ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
                                </div>
                            ) : jobTicketRecords.length > 0 ? jobTicketRecords.map((djt: any, idx: number) => {
                                const creator = normalizedEmployees.find(e => e.value === djt.createdBy);
                                const sigs = (djt.signatures || []).filter((s: any) => s.employee && s.signature);
                                // Equipment cost: owned only
                                const eqCost = (djt.equipmentUsed || []).reduce((sum: number, eq: any) => {
                                    if (eq.type?.toLowerCase() === 'owned') {
                                        return sum + (Number(eq.qty) || 0) * (Number(eq.cost) || 0);
                                    }
                                    return sum;
                                }, 0);
                                const ownedCount = (djt.equipmentUsed || []).filter((eq: any) => eq.type?.toLowerCase() === 'owned').length;
                                const rentalCount = (djt.equipmentUsed || []).filter((eq: any) => eq.type?.toLowerCase() === 'rental').length;
                                return (
                                <div
                                    key={djt._id || idx}
                                    onClick={() => handleViewDJT(djt)}
                                    className="bg-white/60 p-3 rounded-xl border border-white/40 shadow-sm relative group cursor-pointer hover:bg-cyan-50/60 hover:shadow-md hover:border-cyan-200 transition-all duration-300"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {(djt.date || djt.scheduleRef?.fromDate) 
                                                    ? new Date(djt.date || djt.scheduleRef?.fromDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: '2-digit', day: '2-digit', year: 'numeric' })
                                                    : safeFormatDate(djt.createdAt, 'MM/dd/yyyy')
                                                }
                                                {djt.schedule_id && (
                                                    <span className="text-slate-300 ml-1.5">· {djt.schedule_id}</span>
                                                )}
                                            </p>
                                            <p className="text-xs font-black text-slate-800 truncate">
                                                {djt.scheduleRef?.title || 'Job Ticket'}
                                            </p>
                                        </div>
                                        <Eye className="w-3.5 h-3.5 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    {djt.dailyJobDescription && (
                                        <p className="text-[10px] text-slate-500 font-medium truncate mt-1">
                                            {djt.dailyJobDescription}
                                        </p>
                                    )}
                                    {/* Cost Badges */}
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                        {eqCost > 0 && (
                                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100" title="Equipment (Owned)">
                                                🔧 ${eqCost.toLocaleString()}
                                            </span>
                                        )}
                                        {djt.djtCost > 0 && (
                                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100" title="Total Cost">
                                                💰 ${(djt.djtCost || 0).toLocaleString()}
                                            </span>
                                        )}
                                        {ownedCount > 0 && (
                                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                                {ownedCount} Owned
                                            </span>
                                        )}
                                        {rentalCount > 0 && (
                                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">
                                                {rentalCount} Rental
                                            </span>
                                        )}
                                    </div>
                                    {/* Equipment Names */}
                                    {(djt.equipmentUsed || []).length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            {(djt.equipmentUsed || []).slice(0, 3).map((eq: any, eIdx: number) => {
                                                const eqName = equipmentItems.find(e => String(e.value) === String(eq.equipment))?.label || eq.equipment;
                                                return (
                                                    <span key={eIdx} className="text-[7px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded-full border border-slate-100 truncate max-w-[120px]" title={eqName}>
                                                        {eqName}
                                                    </span>
                                                );
                                            })}
                                            {(djt.equipmentUsed || []).length > 3 && (
                                                <span className="text-[7px] font-bold text-slate-400">+{(djt.equipmentUsed || []).length - 3}</span>
                                            )}
                                        </div>
                                    )}
                                    {/* Creator */}
                                    <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-100/50">
                                        <div className="w-5 h-5 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                            {creator?.image ? (
                                                <img src={creator.image} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[8px] font-black text-slate-500">
                                                    {(creator?.label || djt.createdBy || '?')[0]?.toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500 truncate">{creator?.label || djt.createdBy || '-'}</span>
                                    </div>
                                    {/* Signature Avatars */}
                                    {sigs.length > 0 && (
                                        <div className="flex items-center gap-1 mt-2">
                                            <div className="flex -space-x-1.5">
                                                {sigs.slice(0, 6).map((sig: any, sIdx: number) => {
                                                    const emp = normalizedEmployees.find(e => e.value === sig.employee);
                                                    return (
                                                        <div
                                                            key={sIdx}
                                                            className="w-5 h-5 rounded-full border-2 border-white bg-green-50 overflow-hidden shrink-0 relative"
                                                            title={emp?.label || sig.employee}
                                                        >
                                                            {emp?.image ? (
                                                                <img src={emp.image} className="w-full h-full object-cover" alt="" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-[7px] font-black text-green-700">
                                                                    {(emp?.label || sig.employee || '?')[0]?.toUpperCase()}
                                                                </div>
                                                            )}
                                                            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {sigs.length > 6 && (
                                                <span className="text-[8px] font-bold text-slate-400 ml-0.5">+{sigs.length - 6}</span>
                                            )}
                                            <span className="text-[8px] font-bold text-green-600 ml-auto">{sigs.length} signed</span>
                                        </div>
                                    )}
                                </div>
                                );
                            }) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No job tickets</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column: Pothole Logs */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white flex items-center justify-center shadow-md">
                            <MapPin className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-rose-700">Pothole Logs</h4>
                        <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-bold">
                            {potholeLogRecords.length}
                        </span>
                        <button
                            onClick={() => setPotholeCreateOpen(true)}
                            className="ml-auto w-6 h-6 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm"
                            title="Add Pothole Log"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {loadingJobDocs ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
                                </div>
                            ) : potholeLogRecords.length > 0 ? potholeLogRecords.map((log: any, idx: number) => (
                                <div
                                    key={log._id || idx}
                                    onClick={() => handleViewPotholeLog(log)}
                                    className="bg-white/60 p-3 rounded-xl border border-white/40 shadow-sm relative group cursor-pointer hover:bg-rose-50/60 hover:shadow-md hover:border-rose-200 transition-all duration-300"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {safeFormatDate(log.date, 'MM/dd/yyyy')}
                                            </p>
                                            <p className="text-xs font-black text-slate-800 truncate">
                                                {log.projectionLocation || 'Pothole Log'}
                                            </p>
                                        </div>
                                        <Eye className="w-3.5 h-3.5 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                        <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                                            {(log.potholeItems || []).length} Items
                                        </span>
                                        {log.locationOfPothole?.lat && (
                                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">
                                                📍 GPS
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/50">
                                        <span className="text-[10px] text-slate-400 font-bold truncate">{log.createdBy || '-'}</span>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No pothole logs</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Column: Pre-Bore Logs */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shadow-md">
                            <HardHat className="w-4 h-4" />
                        </div>
                        <h4 className="text-sm font-bold text-indigo-700">Pre-Bore Logs</h4>
                        <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                            {preBoreLogRecords.length}
                        </span>
                        <button
                            onClick={() => setPreBoreCreateOpen(true)}
                            className="ml-auto w-6 h-6 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white flex items-center justify-center transition-colors shadow-sm"
                            title="Add Pre-Bore Log"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/30 shadow-[inset_2px_2px_6px_#d1d9e6,inset_-2px_-2px_6px_#ffffff] h-[350px] md:h-[500px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-3">
                            {loadingJobDocs ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                                </div>
                            ) : preBoreLogRecords.length > 0 ? preBoreLogRecords.map((pb: any, idx: number) => (
                                <div
                                    key={pb.legacyId || pb._id || idx}
                                    onClick={() => handleViewPreBoreLog(pb)}
                                    className="bg-white/60 p-3 rounded-xl border border-white/40 shadow-sm relative group cursor-pointer hover:bg-indigo-50/60 hover:shadow-md hover:border-indigo-200 transition-all duration-300"
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {safeFormatDate(pb.date, 'MM/dd/yyyy')}
                                            </p>
                                            <p className="text-xs font-black text-slate-800 truncate">
                                                {pb.scheduleTitle || pb.addressBoreStart || 'Pre-Bore Log'}
                                            </p>
                                        </div>
                                        <Eye className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                        {pb.devcoOperator && (
                                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                {pb.devcoOperator}
                                            </span>
                                        )}
                                        <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">
                                            {(pb.preBoreLogs || []).length} Rods
                                        </span>
                                        {pb.boreLength && (
                                            <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">
                                                {pb.boreLength} ft
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100/50">
                                        <span className="text-[10px] text-slate-400 font-bold truncate">{pb.createdBy || pb.customerForeman || '-'}</span>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-[10px] text-slate-400 font-bold text-center py-4">No pre-bore logs</p>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* JHA Modal (reused from schedules) */}
            <JHAModal
                isOpen={jhaModalOpen}
                onClose={() => setJhaModalOpen(false)}
                selectedJHA={selectedJHA}
                setSelectedJHA={setSelectedJHA}
                isEditMode={isJhaEditMode}
                setIsEditMode={setIsJhaEditMode}
                schedules={estimateSchedules}
                handleSave={handleSaveJHA}
                initialData={{ employees: normalizedEmployees }}
                handleSaveSignature={handleSaveJHASignature}
                activeSignatureEmployee={activeSignatureEmployee}
                setActiveSignatureEmployee={setActiveSignatureEmployee}
                isGeneratingPDF={isGeneratingJHAPDF}
                handleDownloadPDF={handleDownloadJHAPDF}
                setEmailModalOpen={setEmailModalOpen}
            />

            {/* DJT Modal (reused from schedules) */}
            <DJTModal
                isOpen={djtModalOpen}
                onClose={() => setDjtModalOpen(false)}
                selectedDJT={selectedDJT}
                setSelectedDJT={setSelectedDJT}
                isEditMode={isDjtEditMode}
                setIsEditMode={setIsDjtEditMode}
                schedules={estimateSchedules}
                handleSave={handleSaveDJT}
                initialData={{ employees: normalizedEmployees, equipmentItems }}
                handleSaveSignature={handleSaveDJTSignature}
                activeSignatureEmployee={activeSignatureEmployee}
                setActiveSignatureEmployee={setActiveSignatureEmployee}
                isSavingSignature={isSavingSignature}
                isGeneratingPDF={isGeneratingDJTPDF}
                handleDownloadPDF={handleDownloadDJTPDF}
            />

            {/* Pothole Log View Modal */}
            <Modal
                isOpen={potholeModalOpen}
                onClose={() => { setPotholeModalOpen(false); setSelectedPotholeLog(null); }}
                title="Pothole Log Details"
                maxWidth="3xl"
            >
                {selectedPotholeLog && (
                    <div className="space-y-6 p-2">
                        {/* Header Info */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Date</p>
                                <p className="text-sm font-bold text-slate-800">{safeFormatDate(selectedPotholeLog.date, 'MM/dd/yyyy')}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Estimate</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPotholeLog.estimate || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Location</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPotholeLog.projectionLocation || '-'}</p>
                            </div>
                            {selectedPotholeLog.locationOfPothole?.lat && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">GPS Coordinates</p>
                                    <p className="text-sm font-bold text-slate-800">
                                        {selectedPotholeLog.locationOfPothole.lat.toFixed(6)}, {selectedPotholeLog.locationOfPothole.lng.toFixed(6)}
                                    </p>
                                </div>
                            )}
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Created By</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPotholeLog.createdBy || '-'}</p>
                            </div>
                        </div>

                        {/* Pothole Items Table */}
                        {selectedPotholeLog.potholeItems && selectedPotholeLog.potholeItems.length > 0 && (
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-rose-500" />
                                    Pothole Items ({selectedPotholeLog.potholeItems.length})
                                </h4>
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="text-left p-2 font-bold text-slate-600">Pothole #</th>
                                                <th className="text-left p-2 font-bold text-slate-600">Type of Utility</th>
                                                <th className="text-left p-2 font-bold text-slate-600">Soil Type</th>
                                                <th className="text-left p-2 font-bold text-slate-600">Top Depth</th>
                                                <th className="text-left p-2 font-bold text-slate-600">Bottom Depth</th>
                                                <th className="text-left p-2 font-bold text-slate-600">Photos</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedPotholeLog.potholeItems.map((item: any, idx: number) => (
                                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="p-2 font-bold">{item.potholeNo || idx + 1}</td>
                                                    <td className="p-2">{item.typeOfUtility || '-'}</td>
                                                    <td className="p-2">{item.soilType || '-'}</td>
                                                    <td className="p-2">{item.topDepthOfUtility || '-'}</td>
                                                    <td className="p-2">{item.bottomDepthOfUtility || '-'}</td>
                                                    <td className="p-2">
                                                        <div className="flex gap-1">
                                                            {item.photo1 && (
                                                                <a href={item.photo1} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                                                                    <ImageIcon className="w-3.5 h-3.5" />
                                                                </a>
                                                            )}
                                                            {item.photo2 && (
                                                                <a href={item.photo2} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                                                                    <ImageIcon className="w-3.5 h-3.5" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Pothole Log Create Modal */}
            <Modal
                isOpen={potholeCreateOpen}
                onClose={() => setPotholeCreateOpen(false)}
                title="Add Pothole Log"
                maxWidth="lg"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setPotholeCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreatePotholeLog} disabled={!newPotholeLog.date}>Create Pothole Log</Button>
                    </div>
                }
            >
                <div className="space-y-4 p-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Date *</label>
                            <Input
                                type="date"
                                value={newPotholeLog.date}
                                onChange={(e) => setNewPotholeLog((prev: any) => ({ ...prev, date: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Projection Location</label>
                            <Input
                                value={newPotholeLog.projectionLocation}
                                onChange={(e) => setNewPotholeLog((prev: any) => ({ ...prev, projectionLocation: e.target.value }))}
                                placeholder="Enter location"
                            />
                        </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <p className="text-xs text-slate-500">
                            <strong>Note:</strong> Pothole items can be added after creating the log.
                        </p>
                    </div>
                </div>
            </Modal>

            {/* Pre-Bore Log View Modal */}
            <Modal
                isOpen={preBoreModalOpen}
                onClose={() => { setPreBoreModalOpen(false); setSelectedPreBoreLog(null); }}
                title="Pre-Bore Log Details"
                maxWidth="4xl"
            >
                {selectedPreBoreLog && (
                    <div className="space-y-6 p-2">
                        {/* Header Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Date</p>
                                <p className="text-sm font-bold text-slate-800">{safeFormatDate(selectedPreBoreLog.date, 'MM/dd/yyyy')}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Schedule</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPreBoreLog.scheduleTitle || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Operator</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPreBoreLog.devcoOperator || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Customer Foreman</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPreBoreLog.customerForeman || '-'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Start Time</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPreBoreLog.startTime || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Address Bore Start</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPreBoreLog.addressBoreStart || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Address Bore End</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPreBoreLog.addressBoreEnd || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Work Request #</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPreBoreLog.customerWorkRequestNumber || '-'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Drill Size</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPreBoreLog.drillSize || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Pilot Bore Size</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPreBoreLog.pilotBoreSize || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Soil Type</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPreBoreLog.soilType || '-'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Bore Length</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPreBoreLog.boreLength || '-'} ft</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Pipe Size</p>
                                <p className="text-sm font-bold text-slate-800">{selectedPreBoreLog.pipeSize || '-'}</p>
                            </div>
                        </div>

                        {/* Pre-Bore Rod Items Table */}
                        {selectedPreBoreLog.preBoreLogs && selectedPreBoreLog.preBoreLogs.length > 0 && (
                            <div>
                                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                                    <HardHat className="w-4 h-4 text-indigo-500" />
                                    Rod Items ({selectedPreBoreLog.preBoreLogs.length})
                                </h4>
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="text-left p-2 font-bold text-slate-600">Rod #</th>
                                                <th className="text-left p-2 font-bold text-slate-600">Distance</th>
                                                <th className="text-left p-2 font-bold text-slate-600">Top Depth</th>
                                                <th className="text-left p-2 font-bold text-slate-600">Bottom Depth</th>
                                                <th className="text-left p-2 font-bold text-slate-600">Over/Under</th>
                                                <th className="text-left p-2 font-bold text-slate-600">Existing Utilities</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedPreBoreLog.preBoreLogs.map((rod: any, idx: number) => (
                                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="p-2 font-bold">{rod.rodNumber || idx + 1}</td>
                                                    <td className="p-2">{rod.distance || '-'}</td>
                                                    <td className="p-2">{rod.topDepth || '-'}</td>
                                                    <td className="p-2">{rod.bottomDepth || '-'}</td>
                                                    <td className="p-2">{rod.overOrUnder || '-'}</td>
                                                    <td className="p-2">{rod.existingUtilities || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Signatures */}
                        <div className="grid grid-cols-2 gap-4">
                            {selectedPreBoreLog.foremanSignature && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Foreman Signature</p>
                                    <img src={selectedPreBoreLog.foremanSignature} alt="Foreman Signature" className="max-h-16 rounded border border-slate-200" />
                                </div>
                            )}
                            {selectedPreBoreLog.customerSignature && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Customer Signature</p>
                                    <img src={selectedPreBoreLog.customerSignature} alt="Customer Signature" className="max-h-16 rounded border border-slate-200" />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Pre-Bore Log Create Modal */}
            <Modal
                isOpen={preBoreCreateOpen}
                onClose={() => setPreBoreCreateOpen(false)}
                title="Add Pre-Bore Log"
                maxWidth="2xl"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setPreBoreCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreatePreBoreLog} disabled={!selectedScheduleForPreBore || !newPreBoreLog.date}>Create Pre-Bore Log</Button>
                    </div>
                }
            >
                <div className="space-y-4 p-2">
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-1 block">Schedule *</label>
                        <select
                            value={selectedScheduleForPreBore}
                            onChange={(e) => setSelectedScheduleForPreBore(e.target.value)}
                            className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        >
                            <option value="">Select a schedule...</option>
                            {estimateSchedules.map((s: any) => (
                                <option key={s._id} value={s._id}>{s.title || s.customerName || s._id}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Date *</label>
                            <Input
                                type="date"
                                value={newPreBoreLog.date}
                                onChange={(e) => setNewPreBoreLog((prev: any) => ({ ...prev, date: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Start Time</label>
                            <Input
                                type="time"
                                value={newPreBoreLog.startTime}
                                onChange={(e) => setNewPreBoreLog((prev: any) => ({ ...prev, startTime: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Customer Foreman</label>
                            <Input
                                value={newPreBoreLog.customerForeman}
                                onChange={(e) => setNewPreBoreLog((prev: any) => ({ ...prev, customerForeman: e.target.value }))}
                                placeholder="Customer foreman name"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Devco Operator</label>
                            <Input
                                value={newPreBoreLog.devcoOperator}
                                onChange={(e) => setNewPreBoreLog((prev: any) => ({ ...prev, devcoOperator: e.target.value }))}
                                placeholder="Devco operator name"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Address Bore Start</label>
                            <Input
                                value={newPreBoreLog.addressBoreStart}
                                onChange={(e) => setNewPreBoreLog((prev: any) => ({ ...prev, addressBoreStart: e.target.value }))}
                                placeholder="Starting address"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Address Bore End</label>
                            <Input
                                value={newPreBoreLog.addressBoreEnd}
                                onChange={(e) => setNewPreBoreLog((prev: any) => ({ ...prev, addressBoreEnd: e.target.value }))}
                                placeholder="Ending address"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Drill Size</label>
                            <Input
                                value={newPreBoreLog.drillSize}
                                onChange={(e) => setNewPreBoreLog((prev: any) => ({ ...prev, drillSize: e.target.value }))}
                                placeholder="e.g. 4&quot;"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Pilot Bore Size</label>
                            <Input
                                value={newPreBoreLog.pilotBoreSize}
                                onChange={(e) => setNewPreBoreLog((prev: any) => ({ ...prev, pilotBoreSize: e.target.value }))}
                                placeholder="e.g. 2&quot;"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Bore Length</label>
                            <Input
                                value={newPreBoreLog.boreLength}
                                onChange={(e) => setNewPreBoreLog((prev: any) => ({ ...prev, boreLength: e.target.value }))}
                                placeholder="In feet"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Soil Type</label>
                            <Input
                                value={newPreBoreLog.soilType}
                                onChange={(e) => setNewPreBoreLog((prev: any) => ({ ...prev, soilType: e.target.value }))}
                                placeholder="e.g. Clay"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Pipe Size</label>
                            <Input
                                value={newPreBoreLog.pipeSize}
                                onChange={(e) => setNewPreBoreLog((prev: any) => ({ ...prev, pipeSize: e.target.value }))}
                                placeholder="e.g. 2&quot;"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">Work Request #</label>
                            <Input
                                value={newPreBoreLog.customerWorkRequestNumber}
                                onChange={(e) => setNewPreBoreLog((prev: any) => ({ ...prev, customerWorkRequestNumber: e.target.value }))}
                                placeholder="Customer work request number"
                            />
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Add Signed Contract Modal */}
            <Modal
                isOpen={isSignedContractModalOpen}
                onClose={() => setIsSignedContractModalOpen(false)}
                title="Add Signed Contract"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setIsSignedContractModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddContract} disabled={!newContract.date || !newContract.amount || !newContract.attachments || newContract.attachments.length === 0}>Add Contract</Button>
                    </div>
                }
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date</label>
                            <Input 
                                type="date"
                                value={newContract.date}
                                onChange={e => setNewContract(prev => ({ ...prev, date: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Amount ($)</label>
                            <Input 
                                type="number"
                                placeholder="0.00"
                                value={newContract.amount}
                                onChange={e => setNewContract(prev => ({ ...prev, amount: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Attachments</label>
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3 transition-colors hover:bg-slate-50 hover:border-slate-300 relative">
                            <input 
                                type="file" 
                                multiple 
                                onChange={handleFileUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                disabled={isUploading}
                            />
                            {isUploading ? (
                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            ) : (
                                <Paperclip className="w-8 h-8 text-slate-300" />
                            )}
                            <div className="text-center">
                                <p className="text-sm font-bold text-slate-600">Click to upload or drag and drop</p>
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Images or Documents</p>
                            </div>
                        </div>

                        {newContract.attachments.length > 0 && (
                            <div className="grid grid-cols-1 gap-2 mt-4">
                                {newContract.attachments.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            {file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-blue-500" /> : <FileText className="w-4 h-4 text-blue-500" />}
                                            <span className="text-xs font-bold text-slate-600 truncate max-w-[200px]">{file.name}</span>
                                        </div>
                                        <button 
                                            onClick={() => setNewContract(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }))}
                                            className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Contract Detail View Modal */}
            <Modal
                isOpen={!!selectedViewContract}
                onClose={() => setSelectedViewContract(null)}
                title="Contract Details"
            >
                {selectedViewContract && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-end bg-[#F4F7FA] p-6 rounded-[32px] border border-white/60 shadow-inner">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">Contract Date</label>
                                <p className="text-2xl font-black text-[#0F4C75]">
                                    {safeFormatDate(selectedViewContract.date, 'MM/dd/yyyy')}
                                </p>
                            </div>
                            <div className="text-right">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 block">Total Amount</label>
                                <p className="text-3xl font-black text-emerald-600">
                                    ${(selectedViewContract.amount || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 block">Project Files & Images</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {selectedViewContract.attachments?.map((file: any, idx: number) => (
                                    <div 
                                        key={idx}
                                        onClick={() => handleFileDownload(file.url, file.name)}
                                        className="group relative flex flex-col items-center gap-3 p-4 bg-white rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-amber-200 transition-all duration-300 overflow-hidden cursor-pointer"
                                    >
                                        <div className="w-full aspect-square rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-50 relative">
                                            {file.thumbnailUrl ? (
                                                <div className="relative w-full h-full flex items-center justify-center p-2">
                                                    <img 
                                                        src={file.thumbnailUrl} 
                                                        alt={file.name}
                                                        className="w-full h-full object-contain transition-all duration-500 group-hover:scale-105"
                                                        onError={(e) => {
                                                            const img = e.target as HTMLImageElement;
                                                            img.style.display = 'none';
                                                            const fallback = img.nextElementSibling as HTMLElement;
                                                            if (fallback) fallback.classList.remove('hidden');
                                                        }}
                                                    />
                                                    <div className="hidden flex-col items-center gap-2">
                                                        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-1">
                                                            <FileText className="w-6 h-6 text-amber-600" />
                                                        </div>
                                                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest bg-amber-100/50 px-2 py-0.5 rounded-full">
                                                            {file.name?.split('.').pop() || 'FILE'}
                                                        </span>
                                                    </div>
                                                    {!file.type.startsWith('image/') && (
                                                        <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] font-black text-[#0F4C75] border border-slate-100 uppercase tracking-tighter">
                                                            {file.name?.split('.').pop()}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-1">
                                                        <FileText className="w-6 h-6 text-amber-600" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest bg-amber-100/50 px-2 py-0.5 rounded-full">
                                                        {file.name?.split('.').pop() || 'FILE'}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                                        </div>
                                        <div className="text-center w-full">
                                            <p className="text-xs font-bold text-slate-600 truncate px-1">{file.name}</p>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleFileDownload(file.url, file.name);
                                            }}
                                            className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-10"
                                            title="Download File"
                                        >
                                            <Download className="w-3.5 h-3.5 text-[#0F4C75]" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Add/Edit Release Modal */}
            <Modal
                isOpen={isReleaseModalOpen}
                onClose={() => setIsReleaseModalOpen(false)}
                title={editingReleaseIndex !== null ? "Edit Release Document" : "Add Release Document"}
                maxWidth="lg"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setIsReleaseModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveRelease}>Save Document</Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Document Type</label>
                        <div className="relative">
                             <button
                                 id="release-type-trigger"
                                 onClick={() => setIsReleaseTypeOpen(!isReleaseTypeOpen)}
                                 className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none flex items-center justify-between"
                             >
                                 <span className={newRelease.documentType ? "text-slate-700 font-medium" : "text-slate-400"}>
                                     {newRelease.documentType || "Select Document Type"}
                                 </span>
                                 <ChevronDown className="w-4 h-4 text-slate-400" />
                             </button>
                             <MyDropDown 
                                  isOpen={isReleaseTypeOpen}
                                  onClose={() => setIsReleaseTypeOpen(false)}
                                  anchorId="release-type-trigger"
                                  options={releasesConstants.map((c: any) => ({
                                      id: c._id,
                                      label: c.value,
                                      value: c.value
                                  }))}
                                  selectedValues={newRelease.documentType ? [newRelease.documentType] : []}
                                  onSelect={(val) => {
                                      setNewRelease(prev => ({ ...prev, documentType: val }));
                                      setIsReleaseTypeOpen(false);
                                  }}
                                  placeholder="Search Document Type"
                                  width="w-full"
                             />
                        </div>
                    </div>

                    {/* CP Fields */}
                    {getReleaseCode(newRelease.documentType) === 'CP' && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Through Date</label>
                                    <Input 
                                        type="date"
                                        value={newRelease.date}
                                        onChange={e => setNewRelease(prev => ({ ...prev, date: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Amount of Check</label>
                                    <Input 
                                        type="number"
                                        value={newRelease.amountOfCheck}
                                        onChange={e => setNewRelease(prev => ({ ...prev, amountOfCheck: e.target.value }))}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            
                            {/* DatesOfWaiverRelease Array */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Dates of Waiver Release</label>
                                    <button 
                                        onClick={() => setNewRelease(prev => ({ ...prev, DatesOfWaiverRelease: [...prev.DatesOfWaiverRelease, ''] }))}
                                        className="text-[10px] text-blue-600 font-bold hover:underline"
                                    >
                                        + Add Date
                                    </button>
                                </div>
                                {newRelease.DatesOfWaiverRelease.length > 0 ? newRelease.DatesOfWaiverRelease.map((dt, i) => (
                                    <div key={i} className="flex gap-2">
                                        <Input 
                                            type="date"
                                            value={dt}
                                            onChange={e => {
                                                const updated = [...newRelease.DatesOfWaiverRelease];
                                                updated[i] = e.target.value;
                                                setNewRelease(prev => ({ ...prev, DatesOfWaiverRelease: updated }));
                                            }}
                                        />
                                        <button onClick={() => setNewRelease(prev => ({ ...prev, DatesOfWaiverRelease: prev.DatesOfWaiverRelease.filter((_, idx) => idx !== i) }))} className="p-2 text-red-400 hover:text-red-500"><X size={16}/></button>
                                    </div>
                                )) : <span className="text-xs text-slate-400 italic pl-1">No additional dates added</span>}
                            </div>

                            {/* amountsOfUnpaidProgressPayment Array */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Unpaid Progress Ammounts</label>
                                    <button 
                                        onClick={() => setNewRelease(prev => ({ ...prev, amountsOfUnpaidProgressPayment: [...prev.amountsOfUnpaidProgressPayment, ''] }))}
                                        className="text-[10px] text-blue-600 font-bold hover:underline"
                                    >
                                        + Add Amount
                                    </button>
                                </div>
                                {newRelease.amountsOfUnpaidProgressPayment.length > 0 ? newRelease.amountsOfUnpaidProgressPayment.map((amt, i) => (
                                    <div key={i} className="flex gap-2">
                                        <Input 
                                            type="number"
                                            placeholder="0.00"
                                            value={amt}
                                            onChange={e => {
                                                const updated = [...newRelease.amountsOfUnpaidProgressPayment];
                                                updated[i] = e.target.value;
                                                setNewRelease(prev => ({ ...prev, amountsOfUnpaidProgressPayment: updated }));
                                            }}
                                        />
                                        <button onClick={() => setNewRelease(prev => ({ ...prev, amountsOfUnpaidProgressPayment: prev.amountsOfUnpaidProgressPayment.filter((_, idx) => idx !== i) }))} className="p-2 text-red-400 hover:text-red-500"><X size={16}/></button>
                                    </div>
                                )) : <span className="text-xs text-slate-400 italic pl-1">No unpaid amounts added</span>}
                            </div>
                        </>
                    )}

                    {/* UP Fields */}
                    {getReleaseCode(newRelease.documentType) === 'UP' && (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Through Date</label>
                                <Input 
                                    type="date"
                                    value={newRelease.date}
                                    onChange={e => setNewRelease(prev => ({ ...prev, date: e.target.value }))}
                                />
                            </div>
                            
                            {/* receivedProgressPayments Array */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Received Progress Payment(s)</label>
                                    <button 
                                        onClick={() => setNewRelease(prev => ({ ...prev, receivedProgressPayments: [...prev.receivedProgressPayments, ''] }))}
                                        className="text-[10px] text-blue-600 font-bold hover:underline"
                                    >
                                        + Add Amount
                                    </button>
                                </div>
                                {newRelease.receivedProgressPayments.length > 0 ? newRelease.receivedProgressPayments.map((amt, i) => (
                                    <div key={i} className="flex gap-2">
                                        <Input 
                                            type="text"
                                            placeholder="Amount or Description"
                                            value={amt}
                                            onChange={e => {
                                                const updated = [...newRelease.receivedProgressPayments];
                                                updated[i] = e.target.value;
                                                setNewRelease(prev => ({ ...prev, receivedProgressPayments: updated }));
                                            }}
                                        />
                                        <button onClick={() => setNewRelease(prev => ({ ...prev, receivedProgressPayments: prev.receivedProgressPayments.filter((_, idx) => idx !== i) }))} className="p-2 text-red-400 hover:text-red-500"><X size={16}/></button>
                                    </div>
                                )) : <span className="text-xs text-slate-400 italic pl-1">No payments added</span>}
                            </div>
                        </div>
                    )}

                    {/* CF Fields */}
                    {getReleaseCode(newRelease.documentType) === 'CF' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Amount of Check</label>
                                <Input 
                                    type="number"
                                    value={newRelease.amountOfCheck}
                                    onChange={e => setNewRelease(prev => ({ ...prev, amountOfCheck: e.target.value }))}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Disputed Claims ($)</label>
                                <Input 
                                    type="number"
                                    value={newRelease.disputedClaims}
                                    onChange={e => setNewRelease(prev => ({ ...prev, disputedClaims: e.target.value }))}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    )}

                    {/* UF Fields */}
                    {getReleaseCode(newRelease.documentType) === 'UF' && (
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Disputed Claims ($)</label>
                            <Input 
                                type="number"
                                value={newRelease.disputedClaims}
                                onChange={e => setNewRelease(prev => ({ ...prev, disputedClaims: e.target.value }))}
                                placeholder="0.00"
                            />
                        </div>
                    )}
                </div>
            </Modal>

            <ConfirmModal
                isOpen={releaseToDelete !== null}
                onClose={() => setReleaseToDelete(null)}
                onConfirm={confirmRemoveRelease}
                title="Remove Release"
                message="Are you sure you want to remove this release document?"
                confirmText="Remove"
                variant="danger"
            />

            {/* Intent to Lien Delete Confirm Modal */}
            <ConfirmModal
                isOpen={intentToLienToDelete !== null}
                onClose={() => setIntentToLienToDelete(null)}
                onConfirm={confirmRemoveIntentToLien}
                title="Remove Intent to Lien"
                message="Are you sure you want to remove this intent to lien document?"
                confirmText="Remove"
                variant="danger"
            />

            {/* Add/Edit Intent to Lien Modal */}
            <Modal
                isOpen={isIntentToLienModalOpen}
                onClose={() => setIsIntentToLienModalOpen(false)}
                title={editingIntentToLienIndex !== null ? "Edit Intent to Lien" : "Add Intent to Lien"}
                maxWidth="2xl"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setIsIntentToLienModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveIntentToLien}>Save Intent to Lien</Button>
                    </div>
                }
            >
                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                    {/* Section: Owner or Reputed Owner */}
                    <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                        <h4 className="text-xs font-bold text-blue-700 mb-3 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Owner or Reputed Owner
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name</label>
                                <Input
                                    value={newIntentToLien.poName}
                                    onChange={(e) => setNewIntentToLien({ ...newIntentToLien, poName: e.target.value })}
                                    placeholder="Property Owner Name"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Address</label>
                                <Input
                                    value={newIntentToLien.PoAddress}
                                    onChange={(e) => setNewIntentToLien({ ...newIntentToLien, PoAddress: e.target.value })}
                                    placeholder="Property Owner Address"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section: Hiring Party (Read-only) */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <h4 className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Hiring Party
                            <span className="text-[9px] text-slate-400 font-normal">(from estimate)</span>
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer ID</label>
                                <Input
                                    value={formData?.customerName || ''}
                                    disabled
                                    className="bg-slate-100 cursor-not-allowed"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Address</label>
                                <Input
                                    value={(() => {
                                        if (activeClient) {
                                            const primary = (activeClient.addresses || []).find((a: any) => typeof a === 'object' && a.primary);
                                            const addr = (typeof primary === 'object' ? primary.address : primary) || activeClient.businessAddress;
                                            if (addr) return addr;
                                        }
                                        return formData?.contactAddress || '';
                                    })()}
                                    disabled
                                    className="bg-slate-100 cursor-not-allowed"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Phone</label>
                                <Input
                                    value={(() => {
                                        if (activeClient) {
                                            const primary = (activeClient.contacts || []).find((c: any) => c.primary);
                                            if (primary?.phone) return primary.phone;
                                            if (activeClient.phone) return activeClient.phone;
                                        }
                                        return formData?.contactPhone || '';
                                    })()}
                                    disabled
                                    className="bg-slate-100 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section: Lender and/or Surety Bond */}
                    <div className="p-4 rounded-xl bg-violet-50/50 border border-violet-100">
                        <h4 className="text-xs font-bold text-violet-700 mb-3 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Lender and/or Surety Bond
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lender Name</label>
                                <Input
                                    value={newIntentToLien.liName}
                                    onChange={(e) => setNewIntentToLien({ ...newIntentToLien, liName: e.target.value })}
                                    placeholder="Lending Institution Name"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lender Address</label>
                                <Input
                                    value={newIntentToLien.liAddress}
                                    onChange={(e) => setNewIntentToLien({ ...newIntentToLien, liAddress: e.target.value })}
                                    placeholder="Lending Institution Address"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Surety Company Name</label>
                                <Input
                                    value={newIntentToLien.scName}
                                    onChange={(e) => setNewIntentToLien({ ...newIntentToLien, scName: e.target.value })}
                                    placeholder="Surety Company Name"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Surety Company Address</label>
                                <Input
                                    value={newIntentToLien.scAddress}
                                    onChange={(e) => setNewIntentToLien({ ...newIntentToLien, scAddress: e.target.value })}
                                    placeholder="Surety Company Address"
                                />
                            </div>
                            <div className="col-span-2 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bond Number</label>
                                <Input
                                    value={newIntentToLien.bondNumber}
                                    onChange={(e) => setNewIntentToLien({ ...newIntentToLien, bondNumber: e.target.value })}
                                    placeholder="Bond Number"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section: Project Name and Address */}
                    <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                        <h4 className="text-xs font-bold text-emerald-700 mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Re: Project Name and Address
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project ID</label>
                                <Input
                                    value={newIntentToLien.projectId}
                                    onChange={(e) => setNewIntentToLien({ ...newIntentToLien, projectId: e.target.value })}
                                    placeholder="Project ID"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project Name <span className="text-slate-400">(from estimate)</span></label>
                                <Input
                                    value={formData?.projectName || ''}
                                    disabled
                                    className="bg-slate-100 cursor-not-allowed"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Job Address <span className="text-slate-400">(from estimate)</span></label>
                                <Input
                                    value={formData?.jobAddress || ''}
                                    disabled
                                    className="bg-slate-100 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section: Intent to Lien Details */}
                    <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                        <h4 className="text-xs font-bold text-amber-700 mb-3 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Intent to Lien Details
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AR Balance</label>
                                <Input
                                    type="text"
                                    value={newIntentToLien.arBalance}
                                    onChange={(e) => setNewIntentToLien({ ...newIntentToLien, arBalance: e.target.value })}
                                    placeholder="$0.00"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">From Date</label>
                                <Input
                                    type="date"
                                    value={newIntentToLien.fromDate}
                                    onChange={(e) => setNewIntentToLien({ ...newIntentToLien, fromDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">To Date</label>
                                <Input
                                    type="date"
                                    value={newIntentToLien.toDate}
                                    onChange={(e) => setNewIntentToLien({ ...newIntentToLien, toDate: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2 space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Due Date</label>
                                <Input
                                    type="date"
                                    value={newIntentToLien.dueDate}
                                    onChange={(e) => setNewIntentToLien({ ...newIntentToLien, dueDate: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Add/Edit Billing Ticket Modal */}
            <Modal
                isOpen={isBillingTicketModalOpen}
                onClose={() => setIsBillingTicketModalOpen(false)}
                title={editingBillingTicketIndex !== null ? "Edit Billing Ticket" : "Add Billing Ticket"}
                maxWidth="2xl"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setIsBillingTicketModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveBillingTicket}>Save Billing Ticket</Button>
                    </div>
                }
            >
                <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
                    {/* Row 1: Date, Billing Terms, File Name */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date</label>
                            <Input 
                                type="date"
                                value={newBillingTicket.date}
                                onChange={e => setNewBillingTicket(prev => ({ ...prev, date: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Billing Terms</label>
                            <div className="relative">
                                <button
                                    id="billing-terms-trigger"
                                    onClick={() => setIsBillingTermsOpen(!isBillingTermsOpen)}
                                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none flex items-center justify-between"
                                >
                                    <span className={newBillingTicket.billingTerms ? "text-slate-700 font-medium" : "text-slate-400"}>
                                        {newBillingTicket.billingTerms || "Select Terms"}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                </button>
                                <MyDropDown 
                                    isOpen={isBillingTermsOpen}
                                    onClose={() => setIsBillingTermsOpen(false)}
                                    anchorId="billing-terms-trigger"
                                    options={billingTermsOptions.map(t => ({ id: t, label: t, value: t }))}
                                    selectedValues={newBillingTicket.billingTerms ? [newBillingTicket.billingTerms] : []}
                                    onSelect={(val) => {
                                        setNewBillingTicket(prev => ({ ...prev, billingTerms: val as any }));
                                        setIsBillingTermsOpen(false);
                                    }}
                                    placeholder="Select Terms"
                                    width="w-full"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Lump Sum ($)</label>
                            <Input 
                                type="number"
                                placeholder="0.00"
                                value={newBillingTicket.lumpSum}
                                onChange={e => setNewBillingTicket(prev => ({ ...prev, lumpSum: e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* Other Billing Terms (visible only when Other is selected) */}
                    {newBillingTicket.billingTerms === 'Other' && (
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Other Billing Terms</label>
                            <Input 
                                type="text"
                                placeholder="Specify billing terms"
                                value={newBillingTicket.otherBillingTerms}
                                onChange={e => setNewBillingTicket(prev => ({ ...prev, otherBillingTerms: e.target.value }))}
                            />
                        </div>
                    )}


                    {/* Title & Descriptions */}
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                Titles & Descriptions
                            </label>
                            <button 
                                onClick={addTitleDescription}
                                className="text-[10px] text-indigo-600 font-bold hover:underline"
                            >
                                + Add Title
                            </button>
                        </div>
                        {newBillingTicket.titleDescriptions.map((td, i) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2 relative group">
                                {newBillingTicket.titleDescriptions.length > 1 && (
                                    <button 
                                        onClick={() => removeTitleDescription(i)}
                                        className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={14}/>
                                    </button>
                                )}
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Title</label>
                                    <Input 
                                        type="text"
                                        placeholder="Enter title"
                                        value={td.title}
                                        onChange={e => updateTitleDescription(i, 'title', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Description</label>
                                    <textarea 
                                        placeholder="Enter description..."
                                        value={td.description}
                                        onChange={e => updateTitleDescription(i, 'description', e.target.value)}
                                        rows={6}
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none min-h-[120px]"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* File Uploads */}
                    <div className="space-y-2 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                                Uploads (Images/Documents)
                            </label>
                            <label className="text-[10px] text-indigo-600 font-bold cursor-pointer hover:underline">
                                + Add Files
                                <input 
                                    type="file" 
                                    multiple 
                                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                                    className="hidden" 
                                    onChange={handleBillingTicketFileUpload} 
                                />
                            </label>
                        </div>
                        {isBillingTicketUploading && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                            </div>
                        )}
                        {newBillingTicket.uploads.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {newBillingTicket.uploads.map((file, i) => (
                                    <div key={i} className="relative group">
                                        {file.type?.startsWith('image') ? (
                                            <img 
                                                src={file.thumbnailUrl || file.url} 
                                                alt={file.name}
                                                className="w-16 h-16 object-cover rounded-lg border border-slate-200"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                                                <FileText className="w-6 h-6 text-slate-400" />
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => removeBillingTicketUpload(i)}
                                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                        <span className="text-[8px] text-slate-500 truncate block max-w-[64px] text-center">{file.name}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[10px] text-slate-400 italic">No files uploaded</p>
                        )}
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                isOpen={billingTicketToDelete !== null}
                onClose={() => setBillingTicketToDelete(null)}
                onConfirm={confirmRemoveBillingTicket}
                title="Remove Billing Ticket"
                message="Are you sure you want to remove this billing ticket?"
                confirmText="Remove"
                variant="danger"
            />

            <ConfirmModal
                isOpen={contractIndexToDelete !== null}
                onClose={() => setContractIndexToDelete(null)}
                onConfirm={confirmRemoveContract}
                title="Remove Contract"
                message="Are you sure you want to remove this signed contract? This action cannot be undone."
                confirmText="Remove"
                variant="danger"
            />

            {/* Add Receipt & Cost Modal */}
            <Modal
                isOpen={isReceiptModalOpen}
                onClose={() => {
                    setIsReceiptModalOpen(false);
                    setEditingReceiptIndex(null);
                }}
                title={editingReceiptIndex !== null ? "Edit Receipt / Cost" : "Add Receipt / Cost"}
                maxWidth="2xl"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setIsReceiptModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveReceipt} disabled={!newReceipt.vendor || !newReceipt.amount}>Save Entry</Button>
                    </div>
                }
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Type</label>
                                <select 
                                    value={newReceipt.type}
                                    onChange={e => setNewReceipt(prev => ({ ...prev, type: e.target.value as any }))}
                                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="Receipt">Receipt</option>
                                    <option value="Invoice">Invoice</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Amount ($)</label>
                                <Input 
                                    type="number"
                                    placeholder="0.00"
                                    value={newReceipt.amount}
                                    onChange={e => setNewReceipt(prev => ({ ...prev, amount: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Vendor</label>
                            <Input 
                                placeholder="Vendor Name"
                                value={newReceipt.vendor}
                                onChange={e => setNewReceipt(prev => ({ ...prev, vendor: e.target.value }))}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Date</label>
                                <Input 
                                    type="date"
                                    value={newReceipt.date}
                                    onChange={e => setNewReceipt(prev => ({ ...prev, date: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Due Date</label>
                                <Input 
                                    type="date"
                                    value={newReceipt.dueDate}
                                    onChange={e => setNewReceipt(prev => ({ ...prev, dueDate: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Remarks</label>
                            <textarea 
                                className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20"
                                placeholder="..."
                                value={newReceipt.remarks}
                                onChange={e => setNewReceipt(prev => ({ ...prev, remarks: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Tags (Team Members)</label>
                            <div className="relative">
                                <button
                                    id="tag-dropdown-anchor"
                                    onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-100 transition-all outline-none"
                                >
                                    <span className="text-slate-400">Tag team members...</span>
                                    <Plus className={`w-4 h-4 transition-transform ${isTagDropdownOpen ? 'rotate-45' : ''}`} />
                                </button>
                                <MyDropDown 
                                    isOpen={isTagDropdownOpen}
                                    onClose={() => setIsTagDropdownOpen(false)}
                                    anchorId="tag-dropdown-anchor"
                                    options={employeeOptions}
                                    selectedValues={newReceipt.tag}
                                    onSelect={(val: string) => {
                                        setNewReceipt(prev => ({
                                            ...prev,
                                            tag: prev.tag.includes(val) 
                                                ? prev.tag.filter(t => t !== val)
                                                : [...prev.tag, val]
                                        }));
                                    }}
                                    multiSelect
                                    width="w-full"
                                />
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {(newReceipt.tag || []).map(t => {
                                        const emp = getEmployeeData(t);
                                        return (
                                            <span key={t} className="text-[10px] font-black bg-white text-[#0F4C75] pl-1 pr-2.5 py-1 rounded-full flex items-center gap-2 border border-slate-200 shadow-sm animate-in fade-in zoom-in duration-200">
                                                <div className="w-5 h-5 rounded-full overflow-hidden border border-slate-100 flex items-center justify-center bg-slate-50">
                                                    {emp?.image ? <img src={emp.image} className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-slate-400" />}
                                                </div>
                                                {emp?.label || t}
                                                <X 
                                                    className="w-3 h-3 cursor-pointer hover:text-red-500 transition-colors ml-1" 
                                                    onClick={() => setNewReceipt(prev => ({ ...prev, tag: prev.tag.filter(tag => tag !== t) }))} 
                                                />
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Attachments</label>
                            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-3 transition-colors hover:bg-slate-50 hover:border-slate-300 relative h-40">
                                <input 
                                    type="file" 
                                    multiple 
                                    onChange={handleReceiptFileUpload}
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    disabled={isReceiptUploading}
                                />
                                {isReceiptUploading ? (
                                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                ) : (
                                    <Paperclip className="w-8 h-8 text-slate-300" />
                                )}
                                <div className="text-center">
                                    <p className="text-sm font-bold text-slate-600">Upload Files</p>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Receipts/Invoices</p>
                                </div>
                            </div>
                            {newReceipt.upload.length > 0 && (
                                <div className="grid grid-cols-1 gap-2 mt-2">
                                    {newReceipt.upload.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                {file.type?.startsWith('image/') ? <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> : <FileText className="w-3.5 h-3.5 text-blue-500" />}
                                                <span className="text-[10px] font-bold text-slate-600 truncate">{file.name}</span>
                                            </div>
                                            <button 
                                                onClick={() => setNewReceipt(prev => ({ ...prev, upload: prev.upload.filter((_, i) => i !== idx) }))}
                                                className="p-1 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Devco Paid</label>
                                <div 
                                    onClick={() => {
                                        if (newReceipt.status === 'Devco Paid') {
                                            setNewReceipt(prev => ({ ...prev, status: '', paidBy: '', paymentDate: '' }));
                                        } else {
                                            setPaymentContext({ index: 'new', data: newReceipt });
                                            setPaymentDetails({
                                                paidBy: '',
                                                paymentDate: format(new Date(), 'yyyy-MM-dd')
                                            });
                                            setIsPaymentModalOpen(true);
                                        }
                                    }}
                                    className={`w-full flex items-center gap-2 border rounded-xl px-4 py-2 text-xs font-bold cursor-pointer transition-all ${newReceipt.status === 'Devco Paid' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${newReceipt.status === 'Devco Paid' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'}`}>
                                        {newReceipt.status === 'Devco Paid' && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    Devco Paid
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Approval</label>
                                <select 
                                    value={newReceipt.approvalStatus}
                                    onChange={e => setNewReceipt(prev => ({ ...prev, approvalStatus: e.target.value as any }))}
                                    className="w-full bg-[#f8fafc] border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="Not Approved">Not Approved</option>
                                    <option value="Approved">Approved</option>
                                </select>
                            </div>
                        </div>

                        {editingReceiptIndex !== null && (
                            <div className="flex items-center gap-2 px-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Created By:</label>
                                {(() => {
                                    const creator = getEmployeeData(newReceipt.createdBy);
                                    return (
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                                                {creator?.image ? <img src={creator.image} className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-slate-400" />}
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-600">{creator?.label || newReceipt.createdBy}</span>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* Receipt Details Modal */}
            <Modal
                isOpen={!!selectedReceipt}
                onClose={() => setSelectedReceipt(null)}
                title="Receipt / Cost Details"
                maxWidth="3xl"
            >
                {selectedReceipt && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                            <div>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-1 inline-block ${selectedReceipt.type === 'Invoice' ? 'bg-indigo-100 text-indigo-600' : 'bg-pink-100 text-pink-600'}`}>
                                    {selectedReceipt.type}
                                </span>
                                <h3 className="text-2xl font-black text-slate-900">{selectedReceipt.vendor}</h3>
                                <p className="text-sm font-bold text-slate-400">{selectedReceipt.date}</p>
                            </div>
                            <div className="text-right">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Amount</label>
                                <div className="flex items-center justify-end gap-1.5 text-3xl font-black text-blue-600">
                                    <DollarSign className="w-6 h-6" />
                                    <span>{(selectedReceipt.amount || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Status</label>
                                <div className="flex flex-col gap-2">
                                    <div 
                                        onClick={() => handleUpdateReceiptStatus(receiptsAndCosts.indexOf(selectedReceipt), 'status', selectedReceipt.status === 'Devco Paid' ? '' : 'Devco Paid')}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase cursor-pointer transition-all ${selectedReceipt.status === 'Devco Paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}
                                    >
                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${selectedReceipt.status === 'Devco Paid' ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}>
                                            {selectedReceipt.status === 'Devco Paid' && <Check className="w-2.5 h-2.5 text-white" />}
                                        </div>
                                        Devco Paid
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Approval</label>
                                <div className="flex flex-col gap-2">
                                    <select 
                                        value={selectedReceipt.approvalStatus}
                                        onChange={(e) => handleUpdateReceiptStatus(receiptsAndCosts.indexOf(selectedReceipt), 'approvalStatus', e.target.value)}
                                        className="bg-transparent font-black text-slate-900 outline-none cursor-pointer hover:text-blue-600 transition-colors"
                                    >
                                        <option value="Not Approved">Not Approved</option>
                                        <option value="Approved">Approved</option>
                                    </select>
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full w-max ${selectedReceipt.approvalStatus === 'Approved' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>
                                        {selectedReceipt.approvalStatus}
                                    </span>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Due Date</label>
                                <p className="font-black text-slate-900">{selectedReceipt.dueDate || '-'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-white/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Metadata</label>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-500">Created By</span>
                                        {(() => {
                                            const creator = getEmployeeData(selectedReceipt.createdBy);
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-slate-900">{creator?.label || selectedReceipt.createdBy}</span>
                                                    <div className="w-6 h-6 rounded-full border border-white bg-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
                                                        {creator?.image ? <img src={creator.image} className="w-full h-full object-cover" /> : <User className="w-3.5 h-3.5 text-slate-400" />}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex items-start justify-between">
                                        <span className="text-[10px] font-bold text-slate-500 mt-1">Tagged Members</span>
                                        <div className="flex flex-wrap justify-end gap-1.5 max-w-[70%]">
                                            {(selectedReceipt.tag || []).length > 0 ? selectedReceipt.tag.map((tagMail: string, i: number) => {
                                                const tagEmp = getEmployeeData(tagMail);
                                                return (
                                                    <div key={i} className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-full border border-slate-100 shadow-sm">
                                                        <div className="w-4 h-4 rounded-full border border-blue-50 bg-[#0F4C75] flex items-center justify-center overflow-hidden">
                                                            {tagEmp?.image ? <img src={tagEmp.image} className="w-full h-full object-cover" /> : <User className="w-2.5 h-2.5 text-white/70" />}
                                                        </div>
                                                        <span className="text-[9px] font-black text-slate-700">{tagEmp?.label || tagMail}</span>
                                                    </div>
                                                );
                                            }) : <span className="text-[10px] font-bold text-slate-300">None</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {selectedReceipt.status === 'Devco Paid' && (
                                <div className="bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100/50 shadow-sm">
                                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 block">Payment Information</label>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-emerald-600/70">Paid By</span>
                                            {(() => {
                                                const payee = getEmployeeData(selectedReceipt.paidBy);
                                                return (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black text-slate-900">{payee?.label || selectedReceipt.paidBy}</span>
                                                        <div className="w-6 h-6 rounded-full border border-white bg-emerald-100 flex items-center justify-center overflow-hidden shadow-sm">
                                                            {payee?.image ? <img src={payee.image} className="w-full h-full object-cover" /> : <User className="w-3.5 h-3.5 text-emerald-600" />}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-emerald-600/70">Payment Date</span>
                                            <p className="text-[10px] font-black text-slate-900">{selectedReceipt.paymentDate || '-'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {selectedReceipt.remarks && (
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Remarks</label>
                                <p className="text-sm text-slate-600 font-medium leading-relaxed">{selectedReceipt.remarks}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 block">Attachments ({selectedReceipt.upload?.length || 0})</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {selectedReceipt.upload?.map((file: any, idx: number) => (
                                    <div 
                                        key={idx}
                                        onClick={() => handleFileDownload(file.url, file.name)}
                                        className="group relative flex flex-col items-center gap-3 p-4 bg-white rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-pink-200 transition-all duration-300 overflow-hidden cursor-pointer"
                                    >
                                        <div className="w-full aspect-square rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-50 relative">
                                            {file.thumbnailUrl ? (
                                                <img 
                                                    src={file.thumbnailUrl} 
                                                    alt={file.name}
                                                    className="w-full h-full object-contain transition-all duration-500 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-12 h-12 rounded-xl bg-pink-50 flex items-center justify-center mb-1">
                                                        <FileText className="w-6 h-6 text-pink-600" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-center w-full">
                                            <p className="text-xs font-bold text-slate-600 truncate px-1">{file.name}</p>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleFileDownload(file.url, file.name);
                                            }}
                                            className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-10"
                                            title="Download File"
                                        >
                                            <Download className="w-3.5 h-3.5 text-pink-600" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Planning Document Modal */}
            <Modal
                isOpen={isPlanningModalOpen}
                onClose={() => setIsPlanningModalOpen(false)}
                title={editingPlanningIndex !== null ? 'Edit Planning Document' : 'Add Planning Document'}
                maxWidth="md"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setIsPlanningModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmPlanning} disabled={isPlanningUploading}>
                            {editingPlanningIndex !== null ? 'Save Changes' : 'Add Document'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-6 pt-4 max-h-[70vh] overflow-y-auto px-1">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 text-nowrap">Document Name</label>
                            <Input 
                                placeholder="e.g. USA Ticket"
                                value={newPlanningItem.documentName}
                                onChange={(e) => setNewPlanningItem(prev => ({ ...prev, documentName: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Planning Type</label>
                            <div className="relative">
                                <button
                                    id="planning-type-anchor"
                                    onClick={() => setIsPlanningTypeDropdownOpen(!isPlanningTypeDropdownOpen)}
                                    className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-100 transition-all outline-none"
                                >
                                    <span>{newPlanningItem.planningType || 'Select Type...'}</span>
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                </button>
                                <MyDropDown 
                                    isOpen={isPlanningTypeDropdownOpen}
                                    onClose={() => setIsPlanningTypeDropdownOpen(false)}
                                    anchorId="planning-type-anchor"
                                    options={planningOptions || [
                                        { id: '1', label: 'USA Ticket', value: 'USA Ticket' },
                                        { id: '2', label: 'Encroachment', value: 'Encroachment' },
                                        { id: '3', label: 'Sewer Bypass', value: 'Sewer Bypass' },
                                        { id: '4', label: 'Traffic Control', value: 'Traffic Control' }
                                    ]}
                                    selectedValues={newPlanningItem.planningType ? [newPlanningItem.planningType] : []}
                                    onSelect={(val: string) => {
                                        setNewPlanningItem(prev => ({ ...prev, planningType: val }));
                                        setIsPlanningTypeDropdownOpen(false);
                                    }}
                                    width="w-full"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">USA Ticket No (Optional)</label>
                        <Input 
                            placeholder="Enter ticket number"
                            value={newPlanningItem.usaTicketNo}
                            onChange={(e) => setNewPlanningItem(prev => ({ ...prev, usaTicketNo: e.target.value }))}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Submitted</label>
                            <Input 
                                type="date"
                                value={newPlanningItem.dateSubmitted}
                                onChange={(e) => setNewPlanningItem(prev => ({ ...prev, dateSubmitted: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Activation</label>
                            <Input 
                                type="date"
                                value={newPlanningItem.activationDate}
                                onChange={(e) => setNewPlanningItem(prev => ({ ...prev, activationDate: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Expiration</label>
                            <Input 
                                type="date"
                                value={newPlanningItem.expirationDate}
                                onChange={(e) => setNewPlanningItem(prev => ({ ...prev, expirationDate: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1 block">Documents / Attachments</label>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {newPlanningItem.documents.map((file: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-violet-50/50 border border-violet-100 rounded-xl group relative">
                                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                                        <Paperclip className="w-4 h-4 text-violet-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-black text-slate-700 truncate leading-none mb-1">{file.name}</p>
                                        <p className="text-[8px] font-bold text-slate-400 leading-none">Uploaded {format(new Date(file.uploadedAt), 'MMM d')}</p>
                                    </div>
                                    <button 
                                        onClick={() => setNewPlanningItem(prev => ({ ...prev, documents: prev.documents.filter((_, i) => i !== idx) }))}
                                        className="absolute -top-2 -right-2 w-6 h-6 bg-white shadow-md border border-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            
                            <label className={`
                                flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer min-h-[80px]
                                ${isPlanningUploading ? 'bg-slate-50 border-slate-200 pointer-events-none' : 'bg-violet-50/30 border-violet-100 hover:bg-violet-50 hover:border-violet-200'}
                            `}>
                                <input 
                                    type="file" 
                                    multiple 
                                    className="hidden" 
                                    onChange={handlePlanningFileUpload}
                                />
                                {isPlanningUploading ? (
                                    <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
                                ) : (
                                    <>
                                        <Plus className="w-5 h-5 text-violet-600" />
                                        <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest">Upload Files</span>
                                    </>
                                )}
                            </label>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Planning Details Modal */}
            <Modal
                isOpen={isPlanningDetailsModalOpen}
                onClose={() => setIsPlanningDetailsModalOpen(false)}
                title="Planning Document Details"
                maxWidth="lg"
            >
                {selectedPlanningItem && (
                    <div className="space-y-8 pt-4">
                        <div className="flex items-center justify-between p-6 bg-gradient-to-br from-violet-50 to-indigo-50/30 rounded-[32px] border border-violet-100/50">
                            <div>
                                <span className="inline-block px-3 py-1 rounded-full bg-violet-100 text-violet-600 text-[10px] font-black uppercase tracking-widest mb-3">
                                    {selectedPlanningItem.planningType}
                                </span>
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">
                                    {selectedPlanningItem.documentName}
                                </h3>
                                {selectedPlanningItem.usaTicketNo && (
                                    <p className="mt-2 text-sm font-bold text-slate-500">USA Ticket: <span className="text-violet-600">{selectedPlanningItem.usaTicketNo}</span></p>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="p-3 bg-white/80 rounded-2xl shadow-sm border border-white inline-block">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                    <p className={`text-sm font-black ${
                                        selectedPlanningItem.expirationDate && new Date(selectedPlanningItem.expirationDate) < new Date() ? 'text-red-500' : 'text-green-500'
                                    }`}>
                                        {selectedPlanningItem.expirationDate && new Date(selectedPlanningItem.expirationDate) < new Date() ? 'EXPIRED' : 'ACTIVE'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6">
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Date Submitted</p>
                                <p className="text-base font-black text-slate-800">
                                    {safeFormatDate(selectedPlanningItem.dateSubmitted, 'MMM dd, yyyy')}
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Activation Date</p>
                                <p className="text-base font-black text-green-600">
                                    {safeFormatDate(selectedPlanningItem.activationDate, 'MMM dd, yyyy')}
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Expiration Date</p>
                                <p className={`text-base font-black ${
                                    (() => {
                                        if (!selectedPlanningItem.expirationDate) return 'text-slate-800';
                                        try {
                                            const d = new Date(selectedPlanningItem.expirationDate);
                                            return !isNaN(d.getTime()) && d < new Date() ? 'text-red-500' : 'text-slate-800';
                                        } catch (e) { return 'text-slate-800'; }
                                    })()
                                }`}>
                                    {safeFormatDate(selectedPlanningItem.expirationDate, 'MMM dd, yyyy')}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 block">Attachments ({selectedPlanningItem.documents?.length || 0})</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-4">
                                {selectedPlanningItem.documents?.map((file: any, idx: number) => (
                                    <div 
                                        key={idx}
                                        onClick={() => handleFileDownload(file.url, file.name)}
                                        className="group relative flex flex-col items-center gap-3 p-4 bg-white rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl hover:border-violet-200 transition-all duration-300 overflow-hidden cursor-pointer"
                                    >
                                        <div className="w-full aspect-square rounded-2xl bg-slate-50 flex items-center justify-center overflow-hidden border border-slate-50 relative">
                                            {file.type?.startsWith('image/') ? (
                                                <img 
                                                    src={file.url} 
                                                    alt={file.name}
                                                    className="w-full h-full object-cover transition-all duration-500 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 text-violet-600">
                                                    <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center mb-1">
                                                        <FileText className="w-6 h-6" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-center w-full">
                                            <p className="text-xs font-bold text-slate-600 truncate px-1">{file.name}</p>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleFileDownload(file.url, file.name);
                                            }}
                                            className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-10"
                                            title="Download File"
                                        >
                                            <Download className="w-3.5 h-3.5 text-violet-600" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <ConfirmModal
                isOpen={planningItemToDelete !== null}
                onClose={() => setPlanningItemToDelete(null)}
                onConfirm={confirmRemovePlanningItem}
                title="Remove Planning Document"
                message="Are you sure you want to remove this planning document? This cannot be undone."
                confirmText="Remove"
                variant="danger"
            />

            <ConfirmModal
                isOpen={receiptToDelete !== null}
                onClose={() => setReceiptToDelete(null)}
                onConfirm={confirmRemoveReceipt}
                title="Remove Receipt Entry"
                message="Are you sure you want to remove this receipt/cost record? This cannot be undone."
                confirmText="Remove"
                variant="danger"
            />
            <ConfirmModal
                isOpen={deleteMsgId !== null}
                onClose={() => setDeleteMsgId(null)}
                onConfirm={confirmDeleteMessage}
                title="Delete Message"
                message="Are you sure you want to delete this message? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
            />

            {/* Payment Details Modal */}
            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                title="Payment Details"
                maxWidth="md"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleConfirmPaymentDetails} disabled={!paymentDetails.paidBy || !paymentDetails.paymentDate}>Confirm Payment</Button>
                    </div>
                }
            >
                <div className="space-y-6 pt-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Paid By (Employee)</label>
                        <div className="relative">
                            <button
                                id="employee-dropdown-anchor"
                                onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-100 transition-all outline-none"
                            >
                                <span>{employeeOptions.find(o => o.value === paymentDetails.paidBy)?.label || 'Select Employee...'}</span>
                                <Plus className={`w-4 h-4 transition-transform ${isEmployeeDropdownOpen ? 'rotate-45' : ''}`} />
                            </button>
                            <MyDropDown 
                                isOpen={isEmployeeDropdownOpen}
                                onClose={() => setIsEmployeeDropdownOpen(false)}
                                anchorId="employee-dropdown-anchor"
                                options={employeeOptions}
                                selectedValues={paymentDetails.paidBy ? [paymentDetails.paidBy] : []}
                                onSelect={(val: string) => {
                                    setPaymentDetails(prev => ({ ...prev, paidBy: val }));
                                    setIsEmployeeDropdownOpen(false);
                                }}
                                width="w-full"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Payment Date</label>
                        <Input 
                            type="date"
                            value={paymentDetails.paymentDate}
                            onChange={(e) => setPaymentDetails(prev => ({ ...prev, paymentDate: e.target.value }))}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
};

interface DocCardProps {
    label: string;
    isPayroll?: boolean;
    isLoading?: boolean;
    progress?: number;
    hasTemplate?: boolean;
    onClick?: () => void;
}

const DocCard: React.FC<DocCardProps> = ({ label, isPayroll, isLoading, progress, hasTemplate, onClick }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div 
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
            className={`
                group flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden
                ${isLoading 
                    ? 'bg-blue-50 shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff]'
                    : isHovered 
                        ? 'bg-[#eef2f6] shadow-[inset_2px_2px_5px_#d1d9e6,inset_-2px_-2px_5px_#ffffff]' 
                        : 'bg-white/60 shadow-[2px_2px_5px_#d1d9e6,-2px_-2px_5px_#ffffff]'
                }
            `}
        >
            {/* Progress Bar */}
            {isLoading && progress !== undefined && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100/50">
                    <div 
                        className="h-full bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-600 transition-all duration-300 relative"
                        style={{ width: `${progress}%` }}
                    >
                        <span className="absolute -top-3 right-0 text-[6px] font-black text-indigo-600 bg-white/80 px-1 rounded-sm">
                            {progress}%
                        </span>
                    </div>
                </div>
            )}

            {/* Content */}
            <p className={`flex-1 text-xs font-bold leading-snug transition-colors ${isHovered || isLoading ? 'text-[#0F4C75]' : 'text-slate-600'}`}>
                {label}
            </p>

            {/* Status Icon */}
            {isLoading ? (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
            ) : hasTemplate ? (
                <Download className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${isHovered ? 'text-[#0F4C75]' : 'text-slate-300'}`} />
            ) : (
                <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${isHovered ? 'text-[#0F4C75] translate-x-1' : 'text-slate-300'}`} />
            )}
        </div>
    );
};
